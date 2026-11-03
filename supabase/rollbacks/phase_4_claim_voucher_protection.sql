-- Run transactionally. Restores captured pre-phase-4 behavior; no business rows rewritten.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DROP TRIGGER trg_lock_claim_payment_source ON public.journal_headers;
DROP TRIGGER trg_protect_claim_document ON public.sub_claims;
DROP TRIGGER trg_protect_payment_document ON public.payment_vouchers;
DROP FUNCTION rawasi_private.lock_claim_payment_journal_source();
DROP FUNCTION rawasi_private.protect_claim_payment_documents();
CREATE OR REPLACE FUNCTION public.rpc_unpost_claim(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
    v_jv_id UUID;
BEGIN
    -- أ) الاحتفاظ بآيدي القيد قبل مسحه
    SELECT jv_header_id INTO v_jv_id FROM public.sub_claims WHERE id = p_id;

    -- ب) فك الارتباط أولاً من المستخلص (لتجنب خطأ الفورين كي)
    UPDATE public.sub_claims
    SET is_posted = false,
        status = 'مسودة',
        jv_header_id = NULL,
        jv_id = NULL
    WHERE id = p_id;

    -- ج) الآن يمكننا مسح القيد بأمان
    IF v_jv_id IS NOT NULL THEN
        DELETE FROM public.journal_lines WHERE header_id = v_jv_id;
        DELETE FROM public.journal_headers WHERE id = v_jv_id;
    END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_delete_claim(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
BEGIN
    -- أ) فك الترحيل ومسح القيود أولاً لو كان مرحل
    PERFORM public.rpc_unpost_claim(p_id);

    -- ب) تحرير بنود المقايسة لترجع "جاري التنفيذ"
    UPDATE public.contractor_assignments
    SET status = 'جاري التنفيذ', claim_id = NULL
    WHERE claim_id = p_id;

    -- ج) تحرير الخامات المنصرفة لترجع تظهر في المستخلصات القادمة
    UPDATE public.material_issues
    SET claim_id = NULL
    WHERE claim_id = p_id;

    -- د) تحرير المصروفات النقدية
    UPDATE public.expenses
    SET is_deducted_in_claim = false, claim_id = NULL
    WHERE claim_id = p_id;

    -- هـ) أخيراً.. حذف المستخلص نفسه
    DELETE FROM public.sub_claims WHERE id = p_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_sub_claim(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
BEGIN
    -- أ) فك الترحيل ومسح قيود المستخلص أولاً من الجورنال لو كان مرحل
    PERFORM public.rpc_unpost_claim(p_id);

    -- ب) تحرير بنود المقايسة لترجع حالة البنود "جاري التنفيذ" لتدخل في مستخلصات أخرى
    UPDATE public.contractor_assignments
    SET status = 'جاري التنفيذ', claim_id = NULL
    WHERE claim_id = p_id;

    -- ج) تحرير أذون صرف الخامات لترجع تظهر في المستخلصات القادمة
    UPDATE public.material_issues
    SET claim_id = NULL
    WHERE claim_id = p_id;

    -- د) تحرير المصروفات النقدية المسجلة على المقاول
    UPDATE public.expenses
    SET is_deducted_in_claim = false, claim_id = NULL
    WHERE claim_id = p_id;

    -- هـ) التعديل الصحيح: تحرير سندات الصرف المربوطة بالمستخلص
    UPDATE public.payment_vouchers
    SET sub_claim_id = NULL
    WHERE sub_claim_id = p_id;

    -- و) أخيراً.. حذف المستخلص نفسه
    DELETE FROM public.sub_claims WHERE id = p_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_payment_vouchers_bulk(p_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
BEGIN
    -- مسح القيد أولاً
    DELETE FROM public.journal_headers WHERE reference_id = ANY(p_ids) AND v_type = 'payment_vouchers';

    -- مسح السند
    DELETE FROM public.payment_vouchers WHERE id = ANY(p_ids);
END;
$function$;

CREATE OR REPLACE FUNCTION public.unpost_payment_vouchers_bulk(p_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
BEGIN
    -- 1️⃣ حذف القيود اليومية المرتبطة بالسندات من جدول الـ Headers
    -- (سيتم حذف الأسطر تلقائياً بفضل ON DELETE CASCADE المبرمج في جدول journal_lines)
    -- هنا نحذف أي قيد يكون الـ reference_id الخاص به هو معرف السند
    DELETE FROM public.journal_headers
    WHERE reference_id = ANY(p_ids);

    -- 2️⃣ تحديث المصروفات المرتبطة: إرجاع المبلغ المسدد (paid_amount) إلى 0
    -- لأن فك ترحيل السند يعني أن عملية الدفع "كأن لم تكن" محاسبياً
    UPDATE public.expenses
    SET paid_amount = 0
    WHERE id IN (
        SELECT related_expense_id
        FROM public.payment_vouchers
        WHERE id = ANY(p_ids)
    );

    -- 3️⃣ إعادة حالة سندات الصرف إلى "مسودة" وفك علامة الترحيل
    UPDATE public.payment_vouchers
    SET is_posted = false,
        status = 'مسودة'
    WHERE id = ANY(p_ids);
END;
$function$;
ALTER TABLE public.payment_vouchers DROP CONSTRAINT payment_vouchers_sub_claim_id_fkey;
ALTER TABLE public.payment_vouchers ADD CONSTRAINT payment_vouchers_sub_claim_id_fkey FOREIGN KEY(sub_claim_id) REFERENCES public.sub_claims(id) ON DELETE CASCADE;
DROP INDEX public.payment_vouchers_sub_claim_id_idx;
CREATE OR REPLACE FUNCTION public.unpost_universal_bulk(p_table_name text, p_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
    v_voucher_ids uuid[];
BEGIN
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
NOTIFY pgrst,'reload schema';
