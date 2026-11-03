-- DRAFT ONLY. Transactional rollback; refuses to orphan any salary journal.
SET LOCAL lock_timeout='5s';
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.journal_headers WHERE v_type='payroll_slips')
    OR EXISTS(SELECT 1 FROM public.payroll_slips WHERE journal_header_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Unpost phase 6 salary journals before rollback';
  END IF;
END; $$;
DROP FUNCTION public.save_and_post_payroll(text,date,jsonb);
DROP FUNCTION public.save_payroll_drafts(text,date,jsonb);
DROP FUNCTION public.unpost_payroll_slips(text,uuid[]);
DROP TRIGGER trg_lock_payroll_journal_source ON public.journal_headers;
DROP TRIGGER trg_protect_payroll_document ON public.payroll_slips;
DROP FUNCTION rawasi_private.lock_payroll_journal_source();
DROP FUNCTION rawasi_private.protect_payroll_document();
CREATE OR REPLACE FUNCTION public.get_payroll_balances_with_cutoff(p_month integer, p_year integer, p_cutoff_date date DEFAULT CURRENT_DATE)
 RETURNS TABLE(partner_id uuid, previous_unpaid_balance numeric)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
    v_start_date date;
    v_target_month text;
BEGIN
    v_start_date := MAKE_DATE(p_year, p_month, 1);
    v_target_month := p_year::text || '-' || LPAD(p_month::text, 2, '0');

    RETURN QUERY
    SELECT p.id as partner_id,
        CASE
            WHEN p.partner_type = 'عامل يومية' THEN
                -- 🚀 تم إزالة الضرب: نجمع الفلوس المسجلة في daily_wage مباشرة
                COALESCE((SELECT SUM(ldl.daily_wage) FROM public.labor_daily_logs ldl WHERE ldl.worker_partner_id = p.id AND ldl.work_date < v_start_date), 0)
                - COALESCE((SELECT SUM(pv.amount) FROM public.payment_vouchers pv WHERE pv.partner_id = p.id AND pv.date < v_start_date), 0)
                - COALESCE((SELECT SUM(v.amount) FROM public.violations v WHERE v.partner_id = p.id AND v.date < v_start_date), 0)
            ELSE
                COALESCE((SELECT SUM(ps.net_salary) FROM public.payroll_slips ps WHERE ps.emp_id = p.id AND ps.is_posted = false AND ps.month < v_target_month), 0)
        END::numeric as previous_unpaid_balance
    FROM public.partners p
    WHERE p.partner_type IN ('موظف', 'عامل', 'عامل يومية');
END;
$function$;

CREATE OR REPLACE FUNCTION public.pull_payroll_module_data(p_month integer, p_year integer, p_cutoff_date date DEFAULT CURRENT_DATE)
 RETURNS TABLE(partner_id uuid, days_worked numeric, total_earned_wage numeric, total_violations numeric, total_payments numeric)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
    v_start_date date;
BEGIN
    v_start_date := MAKE_DATE(p_year, p_month, 1);

    RETURN QUERY
    SELECT
        p.id as partner_id,

        -- أ. إجمالي أيام العمل (للعرض فقط في الجدول)
        COALESCE((
            SELECT SUM(ldl.attendance_value) FROM public.labor_daily_logs ldl
            WHERE ldl.worker_partner_id = p.id
              AND EXTRACT(MONTH FROM ldl.work_date) = p_month
              AND EXTRACT(YEAR FROM ldl.work_date) = p_year
        ), 0)::numeric as days_worked,

        -- ب. 🚀 إجمالي الاستحقاق المالي (جمع الفلوس الجاهزة بدون ضرب)
        COALESCE((
            SELECT SUM(ldl.daily_wage) FROM public.labor_daily_logs ldl
            WHERE ldl.worker_partner_id = p.id
              AND EXTRACT(MONTH FROM ldl.work_date) = p_month
              AND EXTRACT(YEAR FROM ldl.work_date) = p_year
        ), 0)::numeric as total_earned_wage,

        -- ج. الغرامات
        COALESCE((
            SELECT SUM(v.amount) FROM public.violations v
            WHERE v.partner_id = p.id
              AND v.date >= v_start_date AND v.date <= p_cutoff_date
        ), 0)::numeric as total_violations,

        -- د. دفعات سندات الصرف
        COALESCE((
            SELECT SUM(pv.amount) FROM public.payment_vouchers pv
            WHERE pv.partner_id = p.id
              AND pv.date >= v_start_date AND pv.date <= p_cutoff_date
        ), 0)::numeric as total_payments

    FROM public.partners p
    WHERE p.partner_type IN ('موظف', 'عامل', 'عامل يومية');
END;
$function$;
ALTER TABLE public.payroll_slips DROP CONSTRAINT payroll_slips_previous_balance_finite,
  DROP CONSTRAINT payroll_slips_journal_header_unique,
  DROP COLUMN journal_header_id,DROP COLUMN previous_balance,DROP COLUMN cutoff_date;
NOTIFY pgrst,'reload schema';

DROP FUNCTION public.create_and_post_sub_claim(uuid,jsonb,uuid[],uuid[],uuid[]);
DROP FUNCTION public.pay_sub_claim(uuid,uuid,jsonb);
DROP TRIGGER trg_protect_invoice_document ON public.invoices;
DROP TRIGGER trg_protect_receipt_document ON public.receipt_vouchers;
DROP TRIGGER trg_lock_invoice_receipt_source ON public.journal_headers;
DROP FUNCTION rawasi_private.protect_invoice_receipt_document();
DROP FUNCTION rawasi_private.lock_invoice_receipt_source();
ALTER TABLE public.receipt_vouchers DROP CONSTRAINT receipt_vouchers_invoice_id_fkey;
ALTER TABLE public.receipt_vouchers ADD CONSTRAINT receipt_vouchers_invoice_id_fkey FOREIGN KEY(invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;
DROP INDEX public.receipt_vouchers_invoice_id_idx;
CREATE OR REPLACE FUNCTION public.delete_invoices_bulk(p_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
BEGIN
    -- مسح قيود اليومية أولاً
    DELETE FROM journal_headers
    WHERE reference_id = ANY(p_ids);

    -- مسح الفاتورة
    DELETE FROM invoices WHERE id = ANY(p_ids);
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_receipts_bulk(p_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
    v_rec RECORD;
BEGIN
    -- 1. تحديث المبالغ المدفوعة في الفواتير المرتبطة (خصم المبالغ قبل حذف السندات)
    FOR v_rec IN
        SELECT invoice_id, SUM(amount) as total_to_subtract
        FROM receipt_vouchers
        WHERE id = ANY(p_ids) AND invoice_id IS NOT NULL
        GROUP BY invoice_id
    LOOP
        UPDATE invoices
        SET paid_amount = COALESCE(paid_amount, 0) - v_rec.total_to_subtract
        WHERE id = v_rec.invoice_id;
    END LOOP;

    -- 2. مسح قيود اليومية المرتبطة بالسندات
    DELETE FROM journal_headers
    WHERE reference_id = ANY(p_ids);

    -- 3. مسح سندات القبض نهائياً
    DELETE FROM receipt_vouchers WHERE id = ANY(p_ids);
END;
$function$;

CREATE OR REPLACE FUNCTION public.unpost_expenses_bulk(record_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
    v_voucher_ids UUID[];
BEGIN
    -- تجميع أرقام سندات الصرف المرتبطة بهذه المصروفات
    SELECT array_agg(id) INTO v_voucher_ids
    FROM public.payment_vouchers
    WHERE related_expense_id = ANY(record_ids);

    -- مسح قيود اليومية المرتبطة بالسندات ثم مسح السندات نفسها
    IF v_voucher_ids IS NOT NULL THEN
        DELETE FROM public.journal_headers WHERE reference_id = ANY(v_voucher_ids);
        DELETE FROM public.payment_vouchers WHERE id = ANY(v_voucher_ids);
    END IF;

    -- مسح قيود المصروف الأساسي
    DELETE FROM public.journal_headers WHERE reference_id = ANY(record_ids);

    -- إرجاع المصروف غير مرحل وتصفير المبلغ المسدد
    UPDATE public.expenses
    SET is_posted = false,
        paid_amount = 0
    WHERE id = ANY(record_ids);
END;
$function$;

CREATE OR REPLACE FUNCTION public.unpost_invoices_bulk(p_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
    v_receipt_ids UUID[];
BEGIN
    -- 1️⃣ تجميع أرقام معرفات (IDs) كل سندات القبض المرتبطة بالفواتير دي
    SELECT array_agg(id) INTO v_receipt_ids
    FROM receipt_vouchers
    WHERE invoice_id = ANY(p_ids);

    -- 2️⃣ مسح قيود اليومية المرتبطة بسندات القبض (إذا وجدت)
    IF v_receipt_ids IS NOT NULL THEN
        DELETE FROM journal_headers
        WHERE reference_id = ANY(v_receipt_ids);

        -- 3️⃣ مسح سندات القبض نفسها نهائياً
        DELETE FROM receipt_vouchers
        WHERE id = ANY(v_receipt_ids);
    END IF;

    -- 4️⃣ مسح قيود اليومية المرتبطة بالفواتير نفسها
    DELETE FROM journal_headers
    WHERE reference_id = ANY(p_ids);

    -- 5️⃣ تصفير ميزان الفاتورة وإرجاع حالتها
    UPDATE invoices
    SET
        status = 'معلق',
        paid_amount = 0  -- 🚀 هنا يرجع حالها كأنها لم تُسدد أبداً
    WHERE id = ANY(p_ids);

END;
$function$;

CREATE OR REPLACE FUNCTION public.unpost_receipts_bulk(p_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
BEGIN
    -- 1. حذف قيود اليومية المرتبطة بالسندات (عشان نلغي أثرها المحاسبي)
    DELETE FROM journal_headers
    WHERE reference_id = ANY(p_ids);

    -- 2. إرجاع حالة السندات إلى 'مسودة' لتمكين التعديل عليها مرة أخرى
    -- تم إزالة العمود is_posted لأنه غير موجود في الجدول
    UPDATE receipt_vouchers
    SET status = 'مسودة'
    WHERE id = ANY(p_ids);
END;
$function$;

CREATE OR REPLACE FUNCTION public.unpost_universal_bulk(p_table_name text, p_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
    v_voucher_ids uuid[];
BEGIN
    IF p_table_name = 'payment_vouchers' THEN
        PERFORM public.unpost_payment_vouchers_bulk(p_ids);
        RETURN;
    END IF;
    -- أ. إذا كان الجدول هو المصروفات (expenses)
    IF p_table_name = 'expenses' THEN
        -- 🔎 محاولة جلب السندات المرتبطة بالمصروفات المحددة
        -- سنبحث في جدول السندات عن أي سجل يشير إلى معرف المصروف
        SELECT array_agg(id) INTO v_voucher_ids
        FROM payment_vouchers
        WHERE reference_no = ANY(p_ids::text[]) -- البحث في المرجع (كـ نص)
           OR description LIKE '%' || (SELECT id::text FROM expenses WHERE id = ANY(p_ids) LIMIT 1) || '%';

        IF v_voucher_ids IS NOT NULL THEN
            -- 1. مسح قيود اليومية المرتبطة بسندات الصرف
            DELETE FROM journal_lines WHERE header_id IN (SELECT id FROM journal_headers WHERE reference_id = ANY(v_voucher_ids));
            DELETE FROM journal_headers WHERE reference_id = ANY(v_voucher_ids);

            -- 2. مسح سندات الصرف نفسها
            DELETE FROM payment_vouchers WHERE id = ANY(v_voucher_ids);
        END IF;

        -- 3. تصفير "المبلغ المدفوع" في جدول المصروفات ليعود السجل كأنه لم يصرف
        UPDATE expenses SET paid_amount = 0 WHERE id = ANY(p_ids);
    END IF;

    -- ب. مسح قيود اليومية المرتبطة بالمصروفات نفسها (Journal Entry)
    DELETE FROM journal_lines
    WHERE header_id IN (
        SELECT id FROM journal_headers WHERE reference_id = ANY(p_ids)
    );

    DELETE FROM journal_headers
    WHERE reference_id = ANY(p_ids);

    -- ج. تحديث حالة المصروفات إلى "غير مرحل" لتمكين التعديل عليها
    EXECUTE format('UPDATE %I SET is_posted = false WHERE id = ANY($1)', p_table_name)
    USING p_ids;
END;
$function$;

CREATE OR REPLACE FUNCTION rawasi_private.handle_payment_voucher_cash_flow()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
    v_project_id uuid := NULL;
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM public.cash_flows WHERE source_id = OLD.id AND source_type = 'payment_voucher';
        RETURN OLD;
    END IF;

    -- 🛡️ حماية: تجاهل السندات التي قيمتها صفر أو أقل
    IF NEW.amount <= 0 THEN
        RETURN NEW;
    END IF;

    IF NEW.sub_claim_id IS NOT NULL THEN
        SELECT project_id INTO v_project_id FROM public.sub_claims WHERE id = NEW.sub_claim_id;
    ELSIF NEW.related_expense_id IS NOT NULL THEN
        SELECT project_id INTO v_project_id FROM public.expenses WHERE id = NEW.related_expense_id;
    END IF;

    IF EXISTS (SELECT 1 FROM public.cash_flows WHERE source_id = NEW.id AND source_type = 'payment_voucher') THEN
        UPDATE public.cash_flows SET
            transaction_date = NEW.date, amount = NEW.amount, payment_method = NEW.payment_method,
            reference_number = COALESCE(NEW.reference_no, NEW.voucher_number), description = COALESCE(NEW.description, NEW.notes),
            account_id = NEW.credit_account_id, project_id = v_project_id, partner_id = NEW.partner_id
        WHERE source_id = NEW.id AND source_type = 'payment_voucher';
    ELSE
        INSERT INTO public.cash_flows (
            transaction_date, flow_type, amount, category, sub_category, payment_method,
            reference_number, description, account_id, project_id, partner_id, source_id, source_type
        ) VALUES (
            NEW.date, 'outflow', NEW.amount, 'أنشطة تشغيلية', 'صرف بموجب سند صرف رقم: ' || COALESCE(NEW.voucher_number, ''),
            NEW.payment_method, COALESCE(NEW.reference_no, NEW.voucher_number), COALESCE(NEW.description, NEW.notes),
            NEW.credit_account_id, v_project_id, NEW.partner_id, NEW.id, 'payment_voucher'
        );
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION rawasi_private.handle_receipt_voucher_cash_flow()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
    v_project_id uuid := NULL;
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM public.cash_flows WHERE source_id = OLD.id AND source_type = 'receipt_voucher';
        RETURN OLD;
    END IF;

    -- 🛡️ حماية: تجاهل السندات التي قيمتها صفر أو أقل
    IF NEW.amount <= 0 THEN
        RETURN NEW;
    END IF;

    IF NEW.project_ids IS NOT NULL AND array_length(NEW.project_ids, 1) > 0 THEN
        v_project_id := NEW.project_ids[1];
    END IF;

    IF EXISTS (SELECT 1 FROM public.cash_flows WHERE source_id = NEW.id AND source_type = 'receipt_voucher') THEN
        UPDATE public.cash_flows SET
            transaction_date = NEW.date, amount = NEW.amount, payment_method = NEW.payment_method,
            reference_number = COALESCE(NEW.reference_number, NEW.receipt_number), description = NEW.notes,
            account_id = NEW.safe_bank_acc_id, project_id = v_project_id, partner_id = NEW.partner_id
        WHERE source_id = NEW.id AND source_type = 'receipt_voucher';
    ELSE
        INSERT INTO public.cash_flows (
            transaction_date, flow_type, amount, category, sub_category, payment_method,
            reference_number, description, account_id, project_id, partner_id, source_id, source_type
        ) VALUES (
            NEW.date, 'inflow', NEW.amount, 'أنشطة تشغيلية', 'تحصيل بموجب سند قبض رقم: ' || COALESCE(NEW.receipt_number, ''),
            NEW.payment_method, COALESCE(NEW.reference_number, NEW.receipt_number), NEW.notes,
            NEW.safe_bank_acc_id, v_project_id, NEW.partner_id, NEW.id, 'receipt_voucher'
        );
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION rawasi_private.sync_invoice_payments()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
    v_invoice_id UUID;
    v_total_paid NUMERIC(15,2);
BEGIN
    -- 1. تحديد الفاتورة المستهدفة (في حالة الإضافة أو التعديل أو الحذف)
    IF TG_OP = 'DELETE' THEN
        v_invoice_id := OLD.invoice_id;
    ELSE
        v_invoice_id := NEW.invoice_id;
    END IF;

    -- 2. إذا كان السند مربوط بفاتورة فعلاً
    IF v_invoice_id IS NOT NULL THEN
        -- حساب إجمالي المبالغ المقبوضة فعلياً لهذه الفاتورة
        -- 🚀 تم التعديل: إضافة حالة 'معتمد' بالتشكيل عشان السيستم يلقطها
        SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
        FROM public.receipt_vouchers
        WHERE invoice_id = v_invoice_id
          AND status IN ('معتمد', 'معتمد', 'معتمد');

        -- 3. تحديث الفاتورة بالمدفوع فقط! (بدون التدخل في حالة الترحيل نهائياً)
        UPDATE public.invoices
        SET paid_amount = v_total_paid
        WHERE id = v_invoice_id;
    END IF;

    -- معالجة حالة نادرة: لو المستخدم عدل السند ونقله من فاتورة لفاتورة تانية
    IF TG_OP = 'UPDATE' AND OLD.invoice_id IS NOT NULL AND OLD.invoice_id <> NEW.invoice_id THEN
        SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
        FROM public.receipt_vouchers
        WHERE invoice_id = OLD.invoice_id AND status IN ('معتمد', 'معتمد', 'معتمد');

        UPDATE public.invoices
        SET paid_amount = v_total_paid
        WHERE id = OLD.invoice_id;
    END IF;

    RETURN NULL;
END;
$function$;
