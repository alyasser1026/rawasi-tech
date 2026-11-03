-- Fresh Rawasi database: schema only, no old business rows.
-- Generated from the local 2026-10-29 schema snapshot.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m')) THEN
    RAISE EXCEPTION 'Initial setup requires an empty public schema';
  END IF;
END;
$$;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
--
-- PostgreSQL database dump
--

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.2

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
-- [clone] SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

-- [clone] COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: audit_and_suspend_mismatched_expenses(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_and_suspend_mismatched_expenses() RETURNS TABLE(affected_count integer)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_count INT := 0;
BEGIN
    -- تحديث المصروفات التي فيها اختلاف بين الإجمالي والمبلغ المدفوع
    -- أو المصروفات التي تم ترحيلها ولكن قيدها المحاسبي به خلل
    WITH mismatch AS (
        SELECT
            e.id
        FROM public.expenses e
        CROSS JOIN LATERAL (
            -- حساب الإجمالي الحقيقي للمصروف (الأساسي + الضريبة - الخصم)
            SELECT ROUND(
                (COALESCE(e.total_price, (e.quantity * e.unit_price)) + COALESCE(e.vat_amount, 0) - COALESCE(e.discount_amount, 0)),
                2
            ) AS expected_total
        ) calc
        WHERE e.is_posted = true -- نبحث فقط في الفواتير المعتمدة (المرحلة)
        AND (
            -- الشرط: إذا كان إجمالي الفاتورة لا يساوي المبلغ المسدد المسجل
            calc.expected_total <> ROUND(e.paid_amount, 2)
            OR
            -- أو إذا كان مجموع سندات الصرف الفعلي في جدول البايمنت لا يساوي المسجل في الاستحقاق
            calc.expected_total <> (
                SELECT ROUND(COALESCE(SUM(amount), 0), 2)
                FROM public.payment_vouchers
                WHERE related_expense_id = e.id
            )
        )
    )
    UPDATE public.expenses
    SET is_posted = false -- 🚀 تحويلها لحالة "معلق" فقط
    WHERE id IN (SELECT id FROM mismatch);

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN QUERY SELECT v_count;
END;
$$;


--
-- Name: auto_bind_payee_id_from_subcontractor(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_bind_payee_id_from_subcontractor() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- التحقق من أن خانة اسم المقاول مكتوب فيها نص وليس فارغة
    IF NEW.sub_contractor IS NOT NULL AND NEW.sub_contractor <> '' THEN
        -- البحث عن الـ ID المطابق للاسم من جدول الـ partners
        SELECT id INTO NEW.payee_id
        FROM public.partners
        WHERE TRIM(BOTH FROM name) = TRIM(BOTH FROM NEW.sub_contractor)
        LIMIT 1;

        -- ميزة أمان إضافية: لو الاسم مكتوب بس ملوش سجل في البارتنر، سيب الـ payee_id زي ما هو
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: auto_create_contractor_assignment(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_create_contractor_assignment() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- إذا كان التنفيذ مقاول باطن
    IF NEW.executor_type = 'مقاول باطن' AND NEW.contractor_id IS NOT NULL THEN
        -- محاولة تحديث الإسناد إذا كان موجوداً مسبقاً (في حالة تعديل أمر الشغل)
        UPDATE public.contractor_assignments
        SET
            contractor_id = NEW.contractor_id,
            project_id = NEW.project_id,
            boq_budget_id = NEW.boq_budget_id,
            assigned_qty = NEW.assigned_qty,
            unit_price = NEW.unit_price
        WHERE job_order_id = NEW.id;

        -- إذا لم يتم تحديث أي سجل (يعني السجل مش موجود)، قم بإنشائه (INSERT)
        IF NOT FOUND THEN
            INSERT INTO public.contractor_assignments (
                job_order_id, contractor_id, project_id, boq_budget_id,
                assigned_qty, unit_price, status
            ) VALUES (
                NEW.id, NEW.contractor_id, NEW.project_id, NEW.boq_budget_id,
                NEW.assigned_qty, NEW.unit_price, 'جاري التنفيذ'
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: auto_fill_violation_names(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_fill_violation_names() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- أ: جلب اسم العامل ومهنته من جدول الشركاء لو الـ partner_id موجود
  IF NEW.partner_id IS NOT NULL THEN
    SELECT name, partner_type INTO NEW.emp_name, NEW.profession
    FROM public.partners
    WHERE id = NEW.partner_id;
  END IF;

  -- ب: جلب اسم الموقع من جدول المشاريع لو الـ project_id موجود
  IF NEW.project_id IS NOT NULL THEN
    SELECT "Property" INTO NEW.site_name
    FROM public.projects
    WHERE id = NEW.project_id;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: auto_link_expense_to_job_order(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_link_expense_to_job_order() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- إذا كان المصروف ملوش أمر شغل، هندور على أمر الشغل بتاع المقاول والفيلا ونربطه
    IF NEW.job_order_id IS NULL AND NEW.project_id IS NOT NULL AND NEW.payee_id IS NOT NULL THEN
        SELECT id INTO NEW.job_order_id
        FROM public.job_orders
        WHERE project_id = NEW.project_id
          AND contractor_id = NEW.payee_id
          AND status IN ('جاري التنفيذ', 'مسودة')
        ORDER BY created_at DESC
        LIMIT 1;

        -- لو لقينا أمر شغل، هنفعل خيار "يخصم من المقاول" أوتوماتيك
        IF NEW.job_order_id IS NOT NULL THEN
            NEW.is_deducted_from_contractor := true;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: auto_link_material_to_job_order(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_link_material_to_job_order() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_project_id UUID;
    v_contractor_id UUID;
BEGIN
    -- إذا كانت الخامة ملهاش أمر شغل
    IF NEW.job_order_id IS NULL THEN
        -- نجيب بيانات الفيلا والمقاول من "رأس إذن الصرف"
        SELECT project_id, subcontractor_id INTO v_project_id, v_contractor_id
        FROM public.material_issues
        WHERE id = NEW.issue_id;

        -- لو متسجلة على مقاول وفيلا، ندور على أمر الشغل بتاعهم
        IF v_project_id IS NOT NULL AND v_contractor_id IS NOT NULL THEN
            SELECT id INTO NEW.job_order_id
            FROM public.job_orders
            WHERE project_id = v_project_id
              AND contractor_id = v_contractor_id
              AND status IN ('جاري التنفيذ', 'مسودة')
            ORDER BY created_at DESC
            LIMIT 1;

            -- لو لقينا أمر شغل، نربط الخامة ونفعل خيار "تخصم من المقاول"
            IF NEW.job_order_id IS NOT NULL THEN
                NEW.is_deducted_from_contractor := true;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: bulk_disburse_expenses(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bulk_disburse_expenses(p_expense_ids uuid[]) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_record RECORD;
    v_voucher_no TEXT;
    v_total NUMERIC;
    v_lines_total NUMERIC;
    v_debit_acc_id UUID;
    v_main_treasury_id UUID := '21b8a1db-bc9f-4cf8-b741-1efeded0963c'; -- 🏦 الخزينة الرئيسية
    v_counter INT := 1; -- 🚀 العداد الذي يمنع التكرار نهائياً
    v_batch_id TEXT;
BEGIN
    -- توليد معرف للدفعة يعتمد على وقت السيرفر الفعلي
    v_batch_id := to_char(clock_timestamp(), 'YYMMDDHH24MISS');

    FOR v_record IN
        SELECT * FROM expenses
        WHERE id = ANY(p_expense_ids)
    LOOP
        -- 1️⃣ حساب إجمالي المصروف بدقة
        SELECT SUM(COALESCE((line->>'total_price')::numeric, (line->>'quantity')::numeric * (line->>'unit_price')::numeric, 0))
        INTO v_lines_total
        FROM jsonb_array_elements(
            CASE WHEN jsonb_typeof(v_record.lines_data) = 'array' THEN v_record.lines_data ELSE '[]'::jsonb END
        ) AS line;

        IF COALESCE(v_lines_total, 0) > 0 THEN
            v_total := v_lines_total + COALESCE(v_record.vat_amount, 0) - COALESCE(v_record.discount_amount, 0);
        ELSE
            v_total := COALESCE(v_record.total_price, (v_record.quantity * v_record.unit_price)) + COALESCE(v_record.vat_amount, 0) - COALESCE(v_record.discount_amount, 0);
        END IF;

        -- 2️⃣ التخطي إذا كان المصروف مسدداً بالكامل
        IF COALESCE(v_record.paid_amount, 0) >= v_total THEN
            CONTINUE;
        END IF;

        -- 3️⃣ تحويل الحساب المدين (النصي) إلى UUID
        SELECT id INTO v_debit_acc_id
        FROM accounts
        WHERE (code || ' - ' || name) = v_record.payment_account OR name = v_record.payment_account
        LIMIT 1;

        -- 4️⃣ 🚀 توليد رقم السند المنيع ضد التكرار (مثال: PV-240510143000-1)
        v_voucher_no := 'PV-' || v_batch_id || '-' || v_counter::text;

        -- 5️⃣ إنشاء سند الصرف
        INSERT INTO payment_vouchers (
            voucher_number,
            date,
            amount,
            partner_id,
            debit_account_id,
            credit_account_id,
            description,
            status,
            related_expense_id,
            payment_method,
            site_ref
        ) VALUES (
            v_voucher_no,
            CURRENT_DATE,
            (v_total - COALESCE(v_record.paid_amount, 0)),
            v_record.payee_id,
            v_debit_acc_id,
            v_main_treasury_id,
            'سداد مصروف: ' || COALESCE(v_record.description, '') || ' (صرف جماعي)',
            'مسودة',
            v_record.id,
            'نقدي',
            v_record.site_ref
        );

        -- 6️⃣ تحديث المصروف
        UPDATE expenses
        SET paid_amount = v_total
        WHERE id = v_record.id;

        -- 🚀 زيادة العداد للسجل التالي
        v_counter := v_counter + 1;

    END LOOP;
END;
$$;


--
-- Name: bulk_disburse_expenses(uuid[], uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bulk_disburse_expenses(p_expense_ids uuid[], p_user_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_record RECORD;
    v_voucher_no TEXT;
    v_total NUMERIC;
    v_lines_total NUMERIC;
    v_debit_acc_id UUID;
    v_main_treasury_id UUID;
    v_counter INT := 1;
    v_batch_id TEXT;
BEGIN
    SELECT id INTO v_main_treasury_id FROM public.accounts WHERE code = '122' LIMIT 1;
    IF v_main_treasury_id IS NULL THEN RAISE EXCEPTION 'حساب الخزينة الرئيسية (122) غير موجود'; END IF;

    v_batch_id := to_char(clock_timestamp(), 'YYMMDDHH24MISS');

    FOR v_record IN SELECT * FROM expenses WHERE id = ANY(p_expense_ids) LOOP
        SELECT SUM(COALESCE((line->>'total_price')::numeric, (line->>'quantity')::numeric * (line->>'unit_price')::numeric, 0))
        INTO v_lines_total
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_record.lines_data) = 'array' THEN v_record.lines_data ELSE '[]'::jsonb END) AS line;

        IF COALESCE(v_lines_total, 0) > 0 THEN
            v_total := v_lines_total + COALESCE(v_record.vat_amount, 0) - COALESCE(v_record.discount_amount, 0);
        ELSE
            v_total := COALESCE(v_record.total_price, (v_record.quantity * v_record.unit_price)) + COALESCE(v_record.vat_amount, 0) - COALESCE(v_record.discount_amount, 0);
        END IF;

        IF COALESCE(v_record.paid_amount, 0) >= v_total THEN CONTINUE; END IF;

        SELECT id INTO v_debit_acc_id FROM accounts WHERE (code || ' - ' || name) = v_record.payment_account OR name = v_record.payment_account LIMIT 1;
        v_voucher_no := 'PV-' || v_batch_id || '-' || v_counter::text;

        INSERT INTO payment_vouchers (
            voucher_number, date, amount, partner_id, debit_account_id, credit_account_id,
            description, status, related_expense_id, payment_method, site_ref, created_by
        ) VALUES (
            v_voucher_no, CURRENT_DATE, (v_total - COALESCE(v_record.paid_amount, 0)),
            v_record.payee_id, v_debit_acc_id, v_main_treasury_id,
            'سداد مصروف: ' || COALESCE(v_record.description, '') || ' (صرف جماعي)',
            'مسودة', v_record.id, 'نقدي', v_record.site_ref, p_user_id
        );

        UPDATE expenses SET paid_amount = v_total WHERE id = v_record.id;
        v_counter := v_counter + 1;
    END LOOP;
END;
$$;


--
-- Name: bulk_disburse_optimized(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bulk_disburse_optimized(p_expense_ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- 1. إنشاء رؤوس السندات لكل المصروفات بضربة واحدة
    -- باستخدام (INSERT INTO ... SELECT) نتجنب الـ Loops
    WITH inserted_vouchers AS (
        INSERT INTO public.payment_vouchers (
            voucher_number, amount, partner_id, debit_account_id, credit_account_id,
            description, status, related_expense_id, site_ref
        )
        SELECT
            'PV-' || to_char(now(), 'YYMMDD') || '-' || substring(id::text, 1, 5),
            (total_price + COALESCE(vat_amount, 0) - COALESCE(discount_amount, 0) - paid_amount),
            payee_id,
            -- هنا يجب وضع منطق جلب حساب المدين (مثلاً من الـ payment_account النصي)
            (SELECT id FROM accounts WHERE name = e.payment_account LIMIT 1),
            '21b8a1db-bc9f-4cf8-b741-1efeded0963c', -- الخزينة
            'سداد مجمع: ' || description,
            'معتمد',
            id,
            site_ref
        FROM public.expenses e
        WHERE id = ANY(p_expense_ids)
        AND (total_price + COALESCE(vat_amount, 0) - COALESCE(discount_amount, 0)) > paid_amount
        RETURNING id, related_expense_id, amount
    )
    -- 2. تحديث المصروفات بالأرقام الجديدة بضربة واحدة
    UPDATE public.expenses
    SET paid_amount = paid_amount + iv.amount
    FROM inserted_vouchers iv
    WHERE public.expenses.id = iv.related_expense_id;

    -- 3. ترحيل القيود (Journal) يمكن استدعاؤه هنا أيضاً بطريقة مجمعة
END;
$$;


--
-- Name: bulk_disburse_v2(uuid[], uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bulk_disburse_v2(p_ids uuid[], p_user_id uuid) RETURNS TABLE(processed_count integer, total_amount numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$DECLARE
    v_main_treasury_id UUID := '21b8a1db-bc9f-4cf8-b741-1efeded0963c';
    -- 🚀 السر هنا: نستخدم clock_timestamp() للملي ثانية + رقم عشوائي لضمان عدم التكرار نهائياً
    v_batch_id TEXT := to_char(clock_timestamp(), 'YYMMDDHH24MISSMS') || '-' || FLOOR(random() * 10000)::TEXT;
    v_count INT;
    v_sum NUMERIC;
BEGIN
    WITH calculated_vouchers AS (
        SELECT
            id as exp_id,
            payee_id,
            exp_date, -- 👈 استخرجنا التاريخ
            payment_account,
            site_ref,
            description,
            ROUND(
                (COALESCE((SELECT SUM(COALESCE((line->>'total_price')::numeric, (line->>'quantity')::numeric * (line->>'unit_price')::numeric, 0))
                   FROM jsonb_array_elements(CASE WHEN jsonb_typeof(lines_data) = 'array' THEN lines_data ELSE '[]'::jsonb END) AS line), (quantity * unit_price))
                   + COALESCE(vat_amount, 0) - COALESCE(discount_amount, 0))
                   - COALESCE(paid_amount, 0)
            , 2) as amount_to_transfer
        FROM public.expenses
        WHERE id = ANY(p_ids)
    ),
    actual_insertion AS (
        INSERT INTO public.payment_vouchers (
            voucher_number, date, amount, partner_id, debit_account_id,
            credit_account_id, description, status, related_expense_id,
            payment_method, site_ref, created_by, is_posted
        )
        SELECT
            'PV-' || v_batch_id || '-' || row_number() OVER (),
            exp_date,          -- 👈 التعديل 1: تاريخ السند هو تاريخ المصروف
            amount_to_transfer,
            NULL,              -- 👈 التعديل 2: حذف البارتنر (سيكون NULL)
            (SELECT id FROM accounts WHERE (code || ' - ' || name) = calculated_vouchers.payment_account OR name = calculated_vouchers.payment_account LIMIT 1),
            v_main_treasury_id,
            'سداد مصروف: ' || COALESCE(description, '') || ' (صرف جماعي)',
            'مسودة',
            exp_id,
            'نقدي',
            site_ref,
            p_user_id,
            false
        FROM calculated_vouchers
        WHERE amount_to_transfer > 0
        RETURNING amount, related_expense_id
    ),
    update_expenses AS (
        UPDATE public.expenses e
        SET paid_amount = e.paid_amount + ai.amount
        FROM actual_insertion ai
        WHERE e.id = ai.related_expense_id
    )
    SELECT COUNT(*), SUM(amount) INTO v_count, v_sum FROM actual_insertion;

    RETURN QUERY SELECT COALESCE(v_count, 0), COALESCE(v_sum, 0);
END;$$;


--
-- Name: check_is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_is_admin() RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT is_admin FROM public.profiles WHERE id = auth.uid();
$$;


--
-- Name: check_user_permission(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_user_permission(module_id text, action_id text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN (
    SELECT
      COALESCE((permissions->module_id->>action_id)::boolean, false)
    FROM public.profiles
    WHERE id = auth.uid()
    OR role = 'admin' -- الآدمن مسموح له بكل شيء
  );
END;
$$;


--
-- Name: clean_blind_journal_lines(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.clean_blind_journal_lines() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- 1. مسح أي سطر أعمى (مدين ودائن = صفر أو NULL)
    DELETE FROM public.journal_lines
    WHERE COALESCE(debit, 0) = 0
      AND COALESCE(credit, 0) = 0;

    -- 2. مسح رؤوس القيود اللي بقت فاضية (يتيمة) بعد مسح سطورها الصفرية
    DELETE FROM public.journal_headers
    WHERE id NOT IN (SELECT header_id FROM public.journal_lines);
END;
$$;


--
-- Name: delete_expenses_bulk(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_expenses_bulk(record_ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_voucher_ids UUID[];
BEGIN
    SELECT array_agg(id) INTO v_voucher_ids
    FROM public.payment_vouchers
    WHERE related_expense_id = ANY(record_ids);

    IF v_voucher_ids IS NOT NULL THEN
        DELETE FROM public.journal_headers WHERE reference_id = ANY(v_voucher_ids);
        DELETE FROM public.payment_vouchers WHERE id = ANY(v_voucher_ids);
    END IF;

    DELETE FROM public.journal_headers WHERE reference_id = ANY(record_ids);
    DELETE FROM public.expenses WHERE id = ANY(record_ids);
END;
$$;


--
-- Name: delete_invoices_bulk(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_invoices_bulk(p_ids uuid[]) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- مسح قيود اليومية أولاً
    DELETE FROM journal_headers
    WHERE reference_id = ANY(p_ids);

    -- مسح الفاتورة
    DELETE FROM invoices WHERE id = ANY(p_ids);
END;
$$;


--
-- Name: delete_labor_logs_bulk(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_labor_logs_bulk(p_ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- 1. إيقاف الـ Triggers (الحراس) مؤقتاً بصلاحيات المدير
    EXECUTE 'ALTER TABLE public.labor_daily_logs DISABLE TRIGGER USER';

    -- 2. مسح القيود أولاً لتجنب أي أخطاء ترابط
    DELETE FROM public.journal_headers
    WHERE reference_id::uuid = ANY(p_ids);

    -- 3. مسح اليوميات نفسها
    DELETE FROM public.labor_daily_logs
    WHERE id = ANY(p_ids);

    -- 4. إعادة تشغيل الـ Triggers فوراً بعد انتهاء المسح
    EXECUTE 'ALTER TABLE public.labor_daily_logs ENABLE TRIGGER USER';
END;
$$;


--
-- Name: delete_payment_vouchers_bulk(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_payment_vouchers_bulk(p_ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- مسح القيد أولاً
    DELETE FROM public.journal_headers WHERE reference_id = ANY(p_ids) AND v_type = 'payment_vouchers';

    -- مسح السند
    DELETE FROM public.payment_vouchers WHERE id = ANY(p_ids);
END;
$$;


--
-- Name: delete_receipt_vouchers_bulk(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_receipt_vouchers_bulk(p_ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- نحذف القيود الأول لو فيه أي قيد متعلق بيها (للاحتياط لو كان معلق بس ليه قيد)
    DELETE FROM journal_headers
    WHERE reference_id = ANY(p_ids) AND source_module = 'receipt_vouchers';

    DELETE FROM receipt_vouchers
    WHERE id = ANY(p_ids);
END;
$$;


--
-- Name: delete_receipts_bulk(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_receipts_bulk(p_ids uuid[]) RETURNS void
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: delete_sub_claim(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_sub_claim(p_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: delete_violations_bulk(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_violations_bulk(p_ids uuid[]) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- 1. فك الترحيل أولاً لضمان مسح القيود والسندات
    PERFORM public.unpost_violations_bulk_journal(p_ids);

    -- 2. مسح المخالفة نفسها
    DELETE FROM public.violations WHERE id = ANY(p_ids);
END;
$$;


--
-- Name: fix_and_reset_corrupted_vouchers(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fix_and_reset_corrupted_vouchers() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_item RECORD;
BEGIN
    -- أ. مسح أسطر القيود (journal_lines) التي لا تمتلك رأس قيد (أيتام)
    DELETE FROM public.journal_lines WHERE header_id NOT IN (SELECT id FROM public.journal_headers);

    -- ب. البحث عن أي "سند صرف" قيده غير متزن أو مبالغه غير مطابقة
    -- سيتم مسح السند، مسح القيد، وتصفير المصروف المرتبط به
    FOR v_item IN
        SELECT
            pv.id AS voucher_id,
            pv.related_expense_id,
            h.id AS header_id
        FROM public.payment_vouchers pv
        LEFT JOIN public.journal_headers h ON h.reference_id = pv.id
        LEFT JOIN (
            SELECT header_id, SUM(debit) as total_debit, SUM(credit) as total_credit
            FROM public.journal_lines GROUP BY header_id
        ) l ON l.header_id = h.id
        WHERE
            h.id IS NULL -- سند مرحل بلا قيد
            OR ROUND(l.total_debit, 2) <> ROUND(l.total_credit, 2) -- قيد غير متزن
            OR ROUND(l.total_debit, 2) <> ROUND(pv.amount, 2) -- قيد لا يطابق قيمة السند
    LOOP
        -- 1. مسح القيود المرتبطة بالسند (رأس وأسطر)
        IF v_item.header_id IS NOT NULL THEN
            DELETE FROM public.journal_headers WHERE id = v_item.header_id;
        END IF;

        -- 2. مسح سند الصرف نفسه لأنه غير مطابق
        DELETE FROM public.payment_vouchers WHERE id = v_item.voucher_id;

        -- 3. 🚀 الأهم: إعادة المصروف المرتبط لحالته الأولى (معلق وغير مسدد)
        IF v_item.related_expense_id IS NOT NULL THEN
            UPDATE public.expenses
            SET paid_amount = 0,
                is_posted = false
            WHERE id = v_item.related_expense_id;
        END IF;
    END LOOP;

    -- ج. تنظيف المصروفات التي تم ترحيلها (Accrual) ولكن قيدها غير متزن
    FOR v_item IN
        SELECT h.id as header_id, h.reference_id as expense_id
        FROM public.journal_headers h
        JOIN public.journal_lines l ON h.id = l.header_id
        WHERE h.reference_id IN (SELECT id FROM public.expenses)
        GROUP BY h.id, h.reference_id
        HAVING ROUND(SUM(l.debit), 2) <> ROUND(SUM(l.credit), 2)
    LOOP
        -- مسح القيد المضروب
        DELETE FROM public.journal_headers WHERE id = v_item.header_id;
        -- فك ترحيل المصروف
        UPDATE public.expenses SET is_posted = false, paid_amount = 0 WHERE id = v_item.expense_id;
    END LOOP;

END;
$$;


--
-- Name: fix_historical_expense_journals(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fix_historical_expense_journals() RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_updated_headers INT := 0;
    v_updated_lines INT := 0;
BEGIN
    -- 1️⃣ تحديث سطور المدين (تنزيل ID المقاول في ذمته)
    UPDATE public.journal_lines jl
    SET partner_id = e.payee_id
    FROM public.journal_headers jh
    JOIN public.expenses e ON e.id = jh.reference_id
    WHERE jl.header_id = jh.id
      AND jl.debit > 0  -- 🚀 شرط الطرف المدين فقط
      AND e.payee_id IS NOT NULL; -- نضمن إن المصروف مربوط بمقاول أصلاً

    GET DIAGNOSTICS v_updated_lines = ROW_COUNT;

    -- 2️⃣ تحديث سطور الدائن (تفريغ ذمة الشركة لتبقى نظيفة تماماً)
    UPDATE public.journal_lines jl
    SET partner_id = NULL
    FROM public.journal_headers jh
    JOIN public.expenses e ON e.id = jh.reference_id
    WHERE jl.header_id = jh.id
      AND jl.credit > 0; -- 🚀 شرط الطرف الدائن فقط

    RETURN jsonb_build_object(
        'success', true,
        'message', 'تمت عملية تصحيح القيود التاريخية بنجاح 🎯',
        'updated_debit_lines_count', v_updated_lines
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;


--
-- Name: fix_temp_import_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fix_temp_import_id() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- لو الإكسيل باعت الآيدي فاضي (NULL أو نص فارغ)، السيستم هيعمله آيدي جديد
    IF NEW.id IS NULL OR TRIM(NEW.id) = '' THEN
        NEW.id := gen_random_uuid()::text;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: generate_financial_reports_json(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_financial_reports_json() RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    income_statement JSONB;
    balance_sheet JSONB;
    v_revenues JSONB;
    v_expenses JSONB;
    v_total_revenue NUMERIC := 0;
    v_total_expense NUMERIC := 0;
    v_net_income NUMERIC := 0;

    v_assets JSONB;
    v_liabilities JSONB;
    v_equity JSONB;
    v_total_assets NUMERIC := 0;
    v_total_liabilities NUMERIC := 0;
    v_total_equity NUMERIC := 0;
BEGIN
    ---------------------------------------------------------------------------
    -- A) INCOME STATEMENT (قائمة الدخل)
    ---------------------------------------------------------------------------
    -- Revenues (إيرادات): Credit - Debit
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'balance', COALESCE(bal.balance, 0))), '[]'::jsonb),
           COALESCE(SUM(bal.balance), 0)
    INTO v_revenues, v_total_revenue
    FROM public.accounts a
    LEFT JOIN (
        SELECT jl.account_id, SUM(jl.credit - jl.debit) as balance
        FROM public.journal_lines jl
        JOIN public.journal_headers jh ON jl.header_id = jh.id
        WHERE jh.status = 'معتمد'
        GROUP BY jl.account_id
    ) bal ON a.id = bal.account_id
    WHERE a.account_type = 'إيرادات' AND COALESCE(bal.balance, 0) != 0;

    -- Expenses (مصروفات): Debit - Credit
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'balance', COALESCE(bal.balance, 0))), '[]'::jsonb),
           COALESCE(SUM(bal.balance), 0)
    INTO v_expenses, v_total_expense
    FROM public.accounts a
    LEFT JOIN (
        SELECT jl.account_id, SUM(jl.debit - jl.credit) as balance
        FROM public.journal_lines jl
        JOIN public.journal_headers jh ON jl.header_id = jh.id
        WHERE jh.status = 'معتمد'
        GROUP BY jl.account_id
    ) bal ON a.id = bal.account_id
    WHERE a.account_type = 'مصروفات' AND COALESCE(bal.balance, 0) != 0;

    -- Calculate Net Income
    v_net_income := COALESCE(v_total_revenue, 0) - COALESCE(v_total_expense, 0);

    -- Build Income Statement JSON
    income_statement := jsonb_build_object(
        'revenues', v_revenues,
        'expenses', v_expenses,
        'total_revenue', v_total_revenue,
        'total_expense', v_total_expense,
        'net_income', v_net_income
    );

    ---------------------------------------------------------------------------
    -- B) BALANCE SHEET (المركز المالي)
    ---------------------------------------------------------------------------
    -- Assets (أصول): Debit - Credit
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'balance', COALESCE(bal.balance, 0))), '[]'::jsonb),
           COALESCE(SUM(bal.balance), 0)
    INTO v_assets, v_total_assets
    FROM public.accounts a
    LEFT JOIN (
        SELECT jl.account_id, SUM(jl.debit - jl.credit) as balance
        FROM public.journal_lines jl
        JOIN public.journal_headers jh ON jl.header_id = jh.id
        WHERE jh.status = 'معتمد'
        GROUP BY jl.account_id
    ) bal ON a.id = bal.account_id
    WHERE a.account_type = 'أصول' AND COALESCE(bal.balance, 0) != 0;

    -- Liabilities (التزامات): Credit - Debit
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'balance', COALESCE(bal.balance, 0))), '[]'::jsonb),
           COALESCE(SUM(bal.balance), 0)
    INTO v_liabilities, v_total_liabilities
    FROM public.accounts a
    LEFT JOIN (
        SELECT jl.account_id, SUM(jl.credit - jl.debit) as balance
        FROM public.journal_lines jl
        JOIN public.journal_headers jh ON jl.header_id = jh.id
        WHERE jh.status = 'معتمد'
        GROUP BY jl.account_id
    ) bal ON a.id = bal.account_id
    WHERE a.account_type = 'التزامات' AND COALESCE(bal.balance, 0) != 0;

    -- Equity (حقوق ملكية): Credit - Debit
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'balance', COALESCE(bal.balance, 0))), '[]'::jsonb),
           COALESCE(SUM(bal.balance), 0)
    INTO v_equity, v_total_equity
    FROM public.accounts a
    LEFT JOIN (
        SELECT jl.account_id, SUM(jl.credit - jl.debit) as balance
        FROM public.journal_lines jl
        JOIN public.journal_headers jh ON jl.header_id = jh.id
        WHERE jh.status = 'معتمد'
        GROUP BY jl.account_id
    ) bal ON a.id = bal.account_id
    WHERE a.account_type = 'حقوق ملكية' AND COALESCE(bal.balance, 0) != 0;

    -- Build Balance Sheet JSON
    balance_sheet := jsonb_build_object(
        'assets', v_assets,
        'liabilities', v_liabilities,
        'equity', v_equity,
        'total_assets', v_total_assets,
        'total_liabilities', v_total_liabilities,
        'total_equity', v_total_equity,
        'net_income', v_net_income,
        'total_liabilities_and_equity', v_total_liabilities + v_total_equity + v_net_income
    );

    ---------------------------------------------------------------------------
    -- C) UPSERT TO CACHE TABLE
    ---------------------------------------------------------------------------
    INSERT INTO public.sys_financial_reports (report_name, report_data, updated_at)
    VALUES ('IncomeStatement', income_statement, NOW())
    ON CONFLICT (report_name) DO UPDATE SET report_data = EXCLUDED.report_data, updated_at = NOW();

    INSERT INTO public.sys_financial_reports (report_name, report_data, updated_at)
    VALUES ('BalanceSheet', balance_sheet, NOW())
    ON CONFLICT (report_name) DO UPDATE SET report_data = EXCLUDED.report_data, updated_at = NOW();

END;
$$;


--
-- Name: get_accounts_report(date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_accounts_report(p_date_from date DEFAULT '1900-01-01'::date, p_date_to date DEFAULT '2099-12-31'::date) RETURNS TABLE(id uuid, code character varying, name character varying, parent_id uuid, is_transactional boolean, account_type character varying, total_debit numeric, total_credit numeric, balance numeric)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE
    -- 1️⃣ تجميع حركات الحسابات من جدول القيود (الأسطر) مع فلترة التاريخ والحالة
    account_activity AS (
        SELECT
            l.account_id,
            SUM(l.debit) as own_debit,
            SUM(l.credit) as own_credit
        FROM journal_lines l
        JOIN journal_headers h ON l.header_id = h.id
        WHERE h.status = 'posted'
          AND h.entry_date BETWEEN p_date_from AND p_date_to
        GROUP BY l.account_id
    ),
    -- 2️⃣ بناء هيكل الشجرة (Recursive CTE)
    tree AS (
        SELECT
            a.id,
            a.code,
            a.name,
            a.parent_id,
            a.is_transactional,
            a.account_type,
            a.id as root_id -- لمعرفة تبعية الأبناء للأباء في التجميع
        FROM accounts a

        UNION ALL

        SELECT
            a.id,
            a.code,
            a.name,
            a.parent_id,
            a.is_transactional,
            a.account_type,
            t.root_id
        FROM accounts a
        JOIN tree t ON a.parent_id = t.id
    ),
    -- 3️⃣ تجميع مبالغ الأبناء وصبها في الآباء
    aggregated_data AS (
        SELECT
            t.root_id as acc_id,
            SUM(COALESCE(act.own_debit, 0)) as total_d,
            SUM(COALESCE(act.own_credit, 0)) as total_c
        FROM tree t
        LEFT JOIN account_activity act ON t.id = act.account_id
        GROUP BY t.root_id
    )
    -- 4️⃣ النتيجة النهائية مرتبطة ببيانات الحساب الأساسية
    SELECT
        a.id,
        a.code,
        a.name,
        a.parent_id,
        a.is_transactional,
        a.account_type,
        COALESCE(ad.total_d, 0) as total_debit,
        COALESCE(ad.total_c, 0) as total_credit,
        (COALESCE(ad.total_d, 0) - COALESCE(ad.total_c, 0)) as balance
    FROM accounts a
    LEFT JOIN aggregated_data ad ON a.id = ad.acc_id
    ORDER BY a.code ASC;
END;
$$;


--
-- Name: get_accounts_report_with_lines(date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_accounts_report_with_lines(p_date_from date DEFAULT '1900-01-01'::date, p_date_to date DEFAULT '2099-12-31'::date) RETURNS TABLE(id uuid, code character varying, name character varying, parent_id uuid, is_transactional boolean, account_type character varying, total_debit numeric, total_credit numeric, balance numeric, transactions jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE account_tree AS (
        SELECT
            a.id, a.parent_id,
            COALESCE(SUM(jl.debit), 0) AS t_debit,
            COALESCE(SUM(jl.credit), 0) AS t_credit,
            (COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0)) AS bal
        FROM public.accounts a
        LEFT JOIN public.journal_lines jl ON a.id = jl.account_id
        LEFT JOIN public.journal_headers jh ON jl.header_id = jh.id
            AND jh.status = 'posted'
            AND jh.entry_date >= p_date_from
            AND jh.entry_date <= p_date_to
        GROUP BY a.id

        UNION ALL

        SELECT
            parent.id, parent.parent_id, child.t_debit, child.t_credit, child.bal
        FROM public.accounts parent
        JOIN account_tree child ON child.parent_id = parent.id
    ),
    aggregated_balances AS (
        SELECT
            at.id, SUM(at.t_debit) AS total_debit, SUM(at.t_credit) AS total_credit, SUM(at.bal) AS balance
        FROM account_tree at
        GROUP BY at.id
    ),
    account_transactions AS (
        SELECT
            a.id AS acc_id,
            COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'id', jl.id,
                        'date', jh.entry_date,
                        'description', COALESCE(jh.description, ''),
                        'notes', COALESCE(jl.notes, ''), -- 🚀 سحب ملاحظات السطر (محتجزات الضمان وغيرها)
                        'partner_name', COALESCE(p.name, ''), -- 🚀 سحب اسم البارتنر
                        'debit', jl.debit,
                        'credit', jl.credit
                    ) ORDER BY jh.entry_date DESC
                ) FILTER (WHERE jl.id IS NOT NULL),
                '[]'::jsonb
            ) AS trans
        FROM public.accounts a
        LEFT JOIN public.journal_lines jl ON a.id = jl.account_id
        LEFT JOIN public.journal_headers jh ON jl.header_id = jh.id
            AND jh.status = 'posted'
            AND jh.entry_date >= p_date_from
            AND jh.entry_date <= p_date_to
        LEFT JOIN public.partners p ON jl.partner_id = p.id -- 🚀 الربط مع جدول الشركاء
        WHERE a.is_transactional = TRUE
        GROUP BY a.id
    )
    SELECT
        a.id, a.code, a.name, a.parent_id,
        COALESCE(a.is_transactional, true) AS is_transactional,
        a.account_type,
        COALESCE(ab.total_debit, 0) AS total_debit,
        COALESCE(ab.total_credit, 0) AS total_credit,
        COALESCE(ab.balance, 0) AS balance,
        COALESCE(atr.trans, '[]'::jsonb) AS transactions
    FROM public.accounts a
    LEFT JOIN aggregated_balances ab ON a.id = ab.id
    LEFT JOIN account_transactions atr ON a.id = atr.acc_id;
END;
$$;


--
-- Name: get_all_advances(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_all_advances(p_search_name text DEFAULT ''::text, p_start_date text DEFAULT ''::text, p_end_date text DEFAULT ''::text) RETURNS TABLE(id bigint, emp_name text, site text, amount numeric, date text, notes text)
    LANGUAGE plpgsql
    AS $_$
BEGIN
  RETURN QUERY
  SELECT
    v.id,
    v.emp_name,
    COALESCE(v.site, ''),
    -- تحويل المبلغ لرقم عشري بأمان
    CASE
      WHEN v.amount ~ '^[0-9.]+$' THEN v.amount::NUMERIC
      ELSE 0
    END as amount,
    v.date::TEXT,
    COALESCE(v.notes, '')
  FROM emp_adv v
  WHERE
    (p_search_name = '' OR v.emp_name ILIKE '%' || p_search_name || '%')
    AND (
      (p_start_date = '' OR v.date >= p_start_date)
      AND (p_end_date = '' OR v.date <= p_end_date)
    )
  ORDER BY v.date DESC, v.id DESC;
END; $_$;


--
-- Name: get_all_advances_v2(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_all_advances_v2(p_search_name text DEFAULT ''::text, p_start_date text DEFAULT ''::text, p_end_date text DEFAULT ''::text) RETURNS TABLE(id bigint, emp_name text, site text, amount numeric, date text, notes text)
    LANGUAGE plpgsql
    AS $_$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.emp_name::TEXT,
    COALESCE(t.site, '')::TEXT,
    -- التأكد من تحويل المبلغ لرقم صحيح للحسابات
    CASE
      WHEN t.amount ~ '^[0-9.]+$' THEN t.amount::NUMERIC
      ELSE 0
    END,
    t.date::TEXT,
    COALESCE(t.notes, '')::TEXT
  FROM emp_adv t
  WHERE
    (p_search_name = '' OR t.emp_name ILIKE '%' || p_search_name || '%')
    AND (p_start_date = '' OR t.date >= p_start_date)
    AND (p_end_date = '' OR t.date <= p_end_date)
  ORDER BY t.date DESC, t.id DESC;
END; $_$;


--
-- Name: get_all_advances_v3(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_all_advances_v3(p_search_name text DEFAULT ''::text, p_start_date text DEFAULT ''::text, p_end_date text DEFAULT ''::text) RETURNS TABLE(generated_id text, date text, emp_name text, amount double precision, site text, total_db_sum double precision, total_db_count bigint)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.ctid::TEXT as generated_id,
    e.date,
    e.emp_name,
    COALESCE(e.amount, 0)::FLOAT,
    e."Desc",
    SUM(COALESCE(e.amount, 0)) OVER()::FLOAT as total_db_sum,
    COUNT(*) OVER() as total_db_count -- بيحسب عدد الصفوف كلها قبل الـ 1000
  FROM emp_adv e
  WHERE
    (p_search_name = '' OR e.emp_name ILIKE '%' || p_search_name || '%')
    AND (
      (p_start_date = '' OR e.date >= p_start_date)
      AND
      (p_end_date = '' OR e.date <= p_end_date)
    )
  ORDER BY e.date DESC;
END; $$;


--
-- Name: get_all_advances_v4(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_all_advances_v4(p_search_name text DEFAULT ''::text, p_start_date text DEFAULT ''::text, p_end_date text DEFAULT ''::text) RETURNS TABLE(row_id text, emp_name text, amount double precision, date text, notes text)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- لو عندك عمود اسمه ID كبيتال جربه، لو مفيش خالص ctid ده رقم الصف في الداتابيز
    COALESCE(t.id::TEXT, t.ctid::TEXT),
    COALESCE(t.emp_name, '')::TEXT,
    COALESCE(t.amount, 0)::FLOAT8,
    t.date::TEXT,
    COALESCE(t.notes, '')::TEXT
  FROM emp_adv t
  WHERE
    (p_search_name = '' OR t.emp_name ILIKE '%' || p_search_name || '%')
    AND (
      (p_start_date = '' OR t.date >= p_start_date)
      AND (p_end_date = '' OR t.date <= p_end_date)
    )
  ORDER BY t.date DESC;
END; $$;


--
-- Name: get_all_employees_data(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_all_employees_data(p_search_name text DEFAULT ''::text, p_start_date text DEFAULT ''::text, p_end_date text DEFAULT ''::text) RETURNS TABLE(emp_id bigint, emp_name text, job_title text, total_production numeric, work_days numeric, attendance_count bigint, total_advances numeric, total_deductions numeric, total_housing numeric)
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_start DATE;
  v_end DATE;
BEGIN
  -- 1. تجهيز تواريخ الفلتر بأمان
  v_start := CASE WHEN NULLIF(p_start_date, '') IS NULL THEN '1900-01-01'::DATE ELSE p_start_date::DATE END;
  v_end := CASE WHEN NULLIF(p_end_date, '') IS NULL THEN '2099-12-31'::DATE ELSE p_end_date::DATE END;

  RETURN QUERY
  SELECT
    a.emp_id, a.emp_name, COALESCE(a.job_title, ''),

    -- المستحق (daily_report) - فيه تاريخ
    COALESCE((SELECT SUM(safe_numeric(d.d_w)) FROM daily_report d
              WHERE regexp_replace(d.emp_name, '\s+', '', 'g') = regexp_replace(a.emp_name, '\s+', '', 'g')
              AND (NULLIF(d.date, '')::DATE >= v_start AND NULLIF(d.date, '')::DATE <= v_end)), 0),

    -- أيام الدوام (daily_report) - فيه تاريخ
    COALESCE((SELECT SUM(safe_numeric(d.attendance)) FROM daily_report d
              WHERE regexp_replace(d.emp_name, '\s+', '', 'g') = regexp_replace(a.emp_name, '\s+', '', 'g')
              AND (NULLIF(d.date, '')::DATE >= v_start AND NULLIF(d.date, '')::DATE <= v_end)), 0),

    -- عدد الحضور
    COALESCE((SELECT COUNT(*) FROM daily_report d
              WHERE regexp_replace(d.emp_name, '\s+', '', 'g') = regexp_replace(a.emp_name, '\s+', '', 'g')
              AND safe_numeric(d.attendance) > 0
              AND (NULLIF(d.date, '')::DATE >= v_start AND NULLIF(d.date, '')::DATE <= v_end)), 0)::BIGINT,

    -- المستلم (emp_adv) - فيه تاريخ
    COALESCE((SELECT SUM(safe_numeric(v.amount)) FROM emp_adv v
              WHERE regexp_replace(v.emp_name, '\s+', '', 'g') = regexp_replace(a.emp_name, '\s+', '', 'g')
              AND (NULLIF(v.date, '')::DATE >= v_start AND NULLIF(v.date, '')::DATE <= v_end)), 0),

    -- الخصومات (emp_ded) - فيه تاريخ
    COALESCE((SELECT SUM(safe_numeric(de.amount)) FROM emp_ded de
              WHERE regexp_replace(de.emp_name, '\s+', '', 'g') = regexp_replace(a.emp_name, '\s+', '', 'g')
              AND (NULLIF(de.date, '')::DATE >= v_start AND NULLIF(de.date, '')::DATE <= v_end)), 0),

    -- السكن (housing) - تم إزالة فلتر التاريخ لأنه غير موجود بالجدول
    COALESCE((SELECT SUM(safe_numeric(h.amount)) FROM housing h
              WHERE regexp_replace(h.emp_name, '\s+', '', 'g') = regexp_replace(a.emp_name, '\s+', '', 'g')), 0)

  FROM all_emp a
  WHERE (p_search_name = '' OR a.emp_name ILIKE '%' || p_search_name || '%')
  ORDER BY a.emp_id ASC;
END; $$;


--
-- Name: get_all_employees_final_v10(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_all_employees_final_v10(p_search_name text DEFAULT ''::text, p_start_date text DEFAULT ''::text, p_end_date text DEFAULT ''::text) RETURNS TABLE(emp_id text, emp_name text, job_title text, total_production numeric, total_days_worked numeric, attendance_count bigint, total_advances numeric, total_deductions numeric, total_housing numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
BEGIN
  RETURN QUERY
  SELECT
    a.emp_id::TEXT,
    a.emp_name,
    COALESCE(a.job_title, '') as job_title,

    -- حساب الإنتاج (daily_report) باستخدام تنظيف الأسماء المكثف
    (SELECT COALESCE(SUM(NULLIF(REGEXP_REPLACE(d.prod::TEXT, '[^0-9.]', '', 'g'), '')::NUMERIC), 0)
     FROM daily_report d WHERE REGEXP_REPLACE(d.emp_name, '\s+', '', 'g') = REGEXP_REPLACE(a.emp_name, '\s+', '', 'g')
     AND (p_start_date = '' OR d.date >= p_start_date) AND (p_end_date = '' OR d.date <= p_end_date)),

    -- حساب أيام العمل d_w
    (SELECT COALESCE(SUM(NULLIF(REGEXP_REPLACE(d.d_w::TEXT, '[^0-9.]', '', 'g'), '')::NUMERIC), 0)
     FROM daily_report d WHERE REGEXP_REPLACE(d.emp_name, '\s+', '', 'g') = REGEXP_REPLACE(a.emp_name, '\s+', '', 'g')
     AND (p_start_date = '' OR d.date >= p_start_date) AND (p_end_date = '' OR d.date <= p_end_date)),

    -- حساب الحضور
    (SELECT COUNT(*) FROM daily_report d
     WHERE REGEXP_REPLACE(d.emp_name, '\s+', '', 'g') = REGEXP_REPLACE(a.emp_name, '\s+', '', 'g')
     AND (d.attendance::TEXT = '1' OR d.attendance::TEXT ILIKE '%حاضر%')
     AND (p_start_date = '' OR d.date >= p_start_date) AND (p_end_date = '' OR d.date <= p_end_date)),

    -- حساب السلف (emp_adv)
    (SELECT COALESCE(SUM(v.amount::NUMERIC), 0) FROM emp_adv v
     WHERE REGEXP_REPLACE(v.emp_name, '\s+', '', 'g') = REGEXP_REPLACE(a.emp_name, '\s+', '', 'g')
     AND (p_start_date = '' OR v.date >= p_start_date) AND (p_end_date = '' OR v.date <= p_end_date)),

    -- حساب الخصومات (emp_ded)
    (SELECT COALESCE(SUM(de.amount::NUMERIC), 0) FROM emp_ded de
     WHERE REGEXP_REPLACE(de.emp_name, '\s+', '', 'g') = REGEXP_REPLACE(a.emp_name, '\s+', '', 'g')
     AND (p_start_date = '' OR de.date >= p_start_date) AND (p_end_date = '' OR de.date <= p_end_date)),

    -- حساب السكن (housing)
    (SELECT COALESCE(SUM(h.amount::NUMERIC), 0) FROM housing h
     WHERE REGEXP_REPLACE(h.emp_name, '\s+', '', 'g') = REGEXP_REPLACE(a.emp_name, '\s+', '', 'g'))

  FROM all_emp a
  WHERE (p_search_name = '' OR a.emp_name ILIKE '%' || p_search_name || '%')
  ORDER BY CASE WHEN a.emp_id ~ '^\d+$' THEN a.emp_id::INTEGER ELSE 999 END ASC;
END;
$_$;


--
-- Name: get_all_employees_final_v11(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_all_employees_final_v11(p_search_name text DEFAULT ''::text, p_start_date text DEFAULT ''::text, p_end_date text DEFAULT ''::text) RETURNS TABLE(emp_id text, emp_name text, job_title text, total_production numeric, total_days_worked numeric, attendance_count bigint, total_advances numeric, total_deductions numeric, total_housing numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
BEGIN
  RETURN QUERY
  SELECT
    a.emp_id::TEXT,
    a.emp_name,
    COALESCE(a.job_title, '') as job_title,

    -- 1. الإنتاج (daily_report)
    COALESCE((SELECT SUM(NULLIF(REGEXP_REPLACE(d.prod::TEXT, '[^0-9.]', '', 'g'), '')::NUMERIC)
      FROM daily_report d WHERE REPLACE(d.emp_name, ' ', '') = REPLACE(a.emp_name, ' ', '')
      AND (p_start_date = '' OR d.date >= p_start_date) AND (p_end_date = '' OR d.date <= p_end_date)), 0),

    -- 2. أيام العمل (daily_report)
    COALESCE((SELECT SUM(NULLIF(REGEXP_REPLACE(d.d_w::TEXT, '[^0-9.]', '', 'g'), '')::NUMERIC)
      FROM daily_report d WHERE REPLACE(d.emp_name, ' ', '') = REPLACE(a.emp_name, ' ', '')
      AND (p_start_date = '' OR d.date >= p_start_date) AND (p_end_date = '' OR d.date <= p_end_date)), 0),

    -- 3. الحضور (daily_report)
    COALESCE((SELECT COUNT(*) FROM daily_report d
      WHERE REPLACE(d.emp_name, ' ', '') = REPLACE(a.emp_name, ' ', '')
      AND (d.attendance::TEXT = '1' OR d.attendance::TEXT ILIKE '%حاضر%')
      AND (p_start_date = '' OR d.date >= p_start_date) AND (p_end_date = '' OR d.date <= p_end_date)), 0)::BIGINT,

    -- 4. السلف (emp_adv)
    COALESCE((SELECT SUM(v.amount::NUMERIC) FROM emp_adv v
      WHERE REPLACE(v.emp_name, ' ', '') = REPLACE(a.emp_name, ' ', '')
      AND (p_start_date = '' OR v.date >= p_start_date) AND (p_end_date = '' OR v.date <= p_end_date)), 0),

    -- 5. الخصومات (emp_ded)
    COALESCE((SELECT SUM(de.amount::NUMERIC) FROM emp_ded de
      WHERE REPLACE(de.emp_name, ' ', '') = REPLACE(a.emp_name, ' ', '')
      AND (p_start_date = '' OR de.date >= p_start_date) AND (p_end_date = '' OR de.date <= p_end_date)), 0),

    -- 6. السكن (housing)
    COALESCE((SELECT SUM(h.amount::NUMERIC) FROM housing h
      WHERE REPLACE(h.emp_name, ' ', '') = REPLACE(a.emp_name, ' ', '')), 0)

  FROM all_emp a
  WHERE (p_search_name = '' OR a.emp_name ILIKE '%' || p_search_name || '%')
  ORDER BY CASE WHEN a.emp_id ~ '^\d+$' THEN a.emp_id::INTEGER ELSE 999 END ASC;
END;
$_$;


--
-- Name: get_all_employees_final_v12(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_all_employees_final_v12(p_search_name text DEFAULT ''::text, p_start_date text DEFAULT ''::text, p_end_date text DEFAULT ''::text) RETURNS TABLE(emp_id text, emp_name text, job_title text, total_production numeric, total_days_worked numeric, attendance_count bigint, total_advances numeric, total_deductions numeric, total_housing numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
BEGIN
  RETURN QUERY
  SELECT
    a.emp_id::TEXT,
    a.emp_name,
    COALESCE(a.job_title, '') as job_title,

    -- 1. الإنتاج: حذف المسافات من الاسم لضمان الربط
    COALESCE((SELECT SUM(NULLIF(REGEXP_REPLACE(d.prod::TEXT, '[^0-9.]', '', 'g'), '')::NUMERIC)
      FROM daily_report d WHERE REPLACE(d.emp_name, ' ', '') = REPLACE(a.emp_name, ' ', '')
      AND (p_start_date = '' OR d.date >= p_start_date) AND (p_end_date = '' OR d.date <= p_end_date)), 0),

    -- 2. أيام العمل (d_w)
    COALESCE((SELECT SUM(NULLIF(REGEXP_REPLACE(d.d_w::TEXT, '[^0-9.]', '', 'g'), '')::NUMERIC)
      FROM daily_report d WHERE REPLACE(d.emp_name, ' ', '') = REPLACE(a.emp_name, ' ', '')
      AND (p_start_date = '' OR d.date >= p_start_date) AND (p_end_date = '' OR d.date <= p_end_date)), 0),

    -- 3. الحضور
    COALESCE((SELECT COUNT(*) FROM daily_report d
      WHERE REPLACE(d.emp_name, ' ', '') = REPLACE(a.emp_name, ' ', '')
      AND (d.attendance::TEXT = '1' OR d.attendance::TEXT ILIKE '%حاضر%')
      AND (p_start_date = '' OR d.date >= p_start_date) AND (p_end_date = '' OR d.date <= p_end_date)), 0)::BIGINT,

    -- 4. السلف (emp_adv)
    COALESCE((SELECT SUM(v.amount::NUMERIC) FROM emp_adv v
      WHERE REPLACE(v.emp_name, ' ', '') = REPLACE(a.emp_name, ' ', '')
      AND (p_start_date = '' OR v.date >= p_start_date) AND (p_end_date = '' OR v.date <= p_end_date)), 0),

    -- 5. الخصومات (emp_ded)
    COALESCE((SELECT SUM(de.amount::NUMERIC) FROM emp_ded de
      WHERE REPLACE(de.emp_name, ' ', '') = REPLACE(a.emp_name, ' ', '')
      AND (p_start_date = '' OR de.date >= p_start_date) AND (p_end_date = '' OR de.date <= p_end_date)), 0),

    -- 6. السكن (housing)
    COALESCE((SELECT SUM(h.amount::NUMERIC) FROM housing h
      WHERE REPLACE(h.emp_name, ' ', '') = REPLACE(a.emp_name, ' ', '')), 0)

  FROM all_emp a
  WHERE (p_search_name = '' OR a.emp_name ILIKE '%' || p_search_name || '%')
  ORDER BY CASE WHEN a.emp_id ~ '^\d+$' THEN a.emp_id::INTEGER ELSE 999 END ASC;
END;
$_$;


--
-- Name: get_all_employees_final_v8(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_all_employees_final_v8(p_search_name text DEFAULT ''::text, p_start_date text DEFAULT ''::text, p_end_date text DEFAULT ''::text) RETURNS TABLE(emp_id text, emp_name text, job_title text, total_production numeric, total_days_worked numeric, attendance_count bigint, total_advances numeric, total_deductions numeric, total_housing numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
BEGIN
  RETURN QUERY
  SELECT
    a.emp_id::TEXT,
    a.emp_name,
    COALESCE(a.job_title, '') as job_title,

    -- حساب الإنتاج (daily_report)
    COALESCE((SELECT SUM(NULLIF(REGEXP_REPLACE(d.prod::TEXT, '[^0-9.]', '', 'g'), '')::NUMERIC)
      FROM daily_report d WHERE TRIM(d.emp_name) = TRIM(a.emp_name)
      AND (p_start_date = '' OR d.date >= p_start_date) AND (p_end_date = '' OR d.date <= p_end_date)), 0),

    -- مجموع أيام العمل d_w (daily_report)
    COALESCE((SELECT SUM(NULLIF(REGEXP_REPLACE(d.d_w::TEXT, '[^0-9.]', '', 'g'), '')::NUMERIC)
      FROM daily_report d WHERE TRIM(d.emp_name) = TRIM(a.emp_name)
      AND (p_start_date = '' OR d.date >= p_start_date) AND (p_end_date = '' OR d.date <= p_end_date)), 0),

    -- عدد الحضور (daily_report)
    COALESCE((SELECT COUNT(*) FROM daily_report d
      WHERE TRIM(d.emp_name) = TRIM(a.emp_name)
      AND (d.attendance::TEXT = '1' OR d.attendance::TEXT ILIKE '%حاضر%')
      AND (p_start_date = '' OR d.date >= p_start_date) AND (p_end_date = '' OR d.date <= p_end_date)), 0)::BIGINT,

    -- إجمالي السلف (emp_adv)
    COALESCE((SELECT SUM(amount::NUMERIC) FROM emp_adv v
      WHERE TRIM(v.emp_name) = TRIM(a.emp_name)
      AND (p_start_date = '' OR v.date >= p_start_date) AND (p_end_date = '' OR v.date <= p_end_date)), 0),

    -- إجمالي الخصومات (emp_ded)
    COALESCE((SELECT SUM(de.amount::NUMERIC) FROM emp_ded de
      WHERE TRIM(de.emp_name) = TRIM(a.emp_name)
      AND (p_start_date = '' OR de.date >= p_start_date) AND (p_end_date = '' OR de.date <= p_end_date)), 0),

    -- إجمالي السكن (housing)
    COALESCE((SELECT SUM(h.amount::NUMERIC) FROM housing h
      WHERE TRIM(h.emp_name) = TRIM(a.emp_name)), 0)

  FROM all_emp a
  WHERE (p_search_name = '' OR a.emp_name ILIKE '%' || p_search_name || '%')
  ORDER BY CASE WHEN a.emp_id ~ '^\d+$' THEN a.emp_id::INTEGER ELSE 999999 END ASC;
END;
$_$;


--
-- Name: get_all_employees_final_v9(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_all_employees_final_v9(p_search_name text DEFAULT ''::text, p_start_date text DEFAULT ''::text, p_end_date text DEFAULT ''::text) RETURNS TABLE(emp_id text, emp_name text, job_title text, total_production numeric, total_days_worked numeric, attendance_count bigint, total_advances numeric, total_deductions numeric, total_housing numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
BEGIN
  RETURN QUERY
  SELECT
    a.emp_id::TEXT,
    a.emp_name,
    COALESCE(a.job_title, '') as job_title,

    -- 1. الإنتاج: تنظيف النص وتحويله لرقم
    COALESCE((SELECT SUM(NULLIF(REGEXP_REPLACE(d.prod::TEXT, '[^0-9.]', '', 'g'), '')::NUMERIC)
      FROM daily_report d WHERE TRIM(BOTH ' ' FROM d.emp_name) = TRIM(BOTH ' ' FROM a.emp_name)
      AND (p_start_date = '' OR d.date >= p_start_date) AND (p_end_date = '' OR d.date <= p_end_date)), 0),

    -- 2. أيام العمل d_w
    COALESCE((SELECT SUM(NULLIF(REGEXP_REPLACE(d.d_w::TEXT, '[^0-9.]', '', 'g'), '')::NUMERIC)
      FROM daily_report d WHERE TRIM(BOTH ' ' FROM d.emp_name) = TRIM(BOTH ' ' FROM a.emp_name)
      AND (p_start_date = '' OR d.date >= p_start_date) AND (p_end_date = '' OR d.date <= p_end_date)), 0),

    -- 3. الحضور attendance
    COALESCE((SELECT COUNT(*) FROM daily_report d
      WHERE TRIM(BOTH ' ' FROM d.emp_name) = TRIM(BOTH ' ' FROM a.emp_name)
      AND (d.attendance::TEXT = '1' OR d.attendance::TEXT ILIKE '%حاضر%')
      AND (p_start_date = '' OR d.date >= p_start_date) AND (p_end_date = '' OR d.date <= p_end_date)), 0)::BIGINT,

    -- 4. السلف (emp_adv)
    COALESCE((SELECT SUM(v.amount::NUMERIC) FROM emp_adv v
      WHERE TRIM(BOTH ' ' FROM v.emp_name) = TRIM(BOTH ' ' FROM a.emp_name)
      AND (p_start_date = '' OR v.date >= p_start_date) AND (p_end_date = '' OR v.date <= p_end_date)), 0),

    -- 5. الخصومات (emp_ded)
    COALESCE((SELECT SUM(de.amount::NUMERIC) FROM emp_ded de
      WHERE TRIM(BOTH ' ' FROM de.emp_name) = TRIM(BOTH ' ' FROM a.emp_name)
      AND (p_start_date = '' OR de.date >= p_start_date) AND (p_end_date = '' OR de.date <= p_end_date)), 0),

    -- 6. السكن (housing)
    COALESCE((SELECT SUM(h.amount::NUMERIC) FROM housing h
      WHERE TRIM(BOTH ' ' FROM h.emp_name) = TRIM(BOTH ' ' FROM a.emp_name)), 0)

  FROM all_emp a
  WHERE (p_search_name = '' OR a.emp_name ILIKE '%' || p_search_name || '%')
  ORDER BY CASE WHEN a.emp_id ~ '^\d+$' THEN a.emp_id::INTEGER ELSE 999 END ASC;
END;
$_$;


--
-- Name: get_all_employees_full_financials_v7(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_all_employees_full_financials_v7(p_search_name text DEFAULT ''::text, p_start_date text DEFAULT ''::text, p_end_date text DEFAULT ''::text) RETURNS TABLE(emp_id text, emp_name text, job_title text, total_production numeric, total_days_worked numeric, attendance_count bigint, total_advances numeric, total_deductions numeric, total_housing numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.emp_id::TEXT,
    a.emp_name,
    COALESCE(a.job_title, '') as job_title,

    -- 1. الإنتاج (prod)
    COALESCE((SELECT SUM(NULLIF(REGEXP_REPLACE(d.prod::TEXT, '[^0-9.]', '', 'g'), '')::NUMERIC)
      FROM daily_report d WHERE TRIM(d.emp_name) = TRIM(a.emp_name)
      AND (p_start_date = '' OR d.date >= p_start_date) AND (p_end_date = '' OR d.date <= p_end_date)), 0),

    -- 2. مجموع d_w (أيام العمل)
    COALESCE((SELECT SUM(NULLIF(REGEXP_REPLACE(d.d_w::TEXT, '[^0-9.]', '', 'g'), '')::NUMERIC)
      FROM daily_report d WHERE TRIM(d.emp_name) = TRIM(a.emp_name)
      AND (p_start_date = '' OR d.date >= p_start_date) AND (p_end_date = '' OR d.date <= p_end_date)), 0),

    -- 3. عدد أيام الحضور (attendance)
    COALESCE((SELECT COUNT(*) FROM daily_report d
      WHERE TRIM(d.emp_name) = TRIM(a.emp_name)
      AND (d.attendance::TEXT = '1' OR d.attendance::TEXT ILIKE '%حاضر%')
      AND (p_start_date = '' OR d.date >= p_start_date) AND (p_end_date = '' OR d.date <= p_end_date)), 0)::BIGINT,

    -- 4. إجمالي السلف (من جدول emp_adv)
    COALESCE((SELECT SUM(v.amount::NUMERIC) FROM emp_adv v
      WHERE TRIM(v.emp_name) = TRIM(a.emp_name)
      AND (p_start_date = '' OR v.date >= p_start_date) AND (p_end_date = '' OR v.date <= p_end_date)), 0),

    -- 5. إجمالي الخصومات (من جدول emp_ded)
    COALESCE((SELECT SUM(de.amount::NUMERIC) FROM emp_ded de
      WHERE TRIM(de.emp_name) = TRIM(a.emp_name)
      AND (p_start_date = '' OR de.date >= p_start_date) AND (p_end_date = '' OR de.date <= p_end_date)), 0),

    -- 6. إجمالي السكن (من جدول housing)
    COALESCE((SELECT SUM(h.amount::NUMERIC) FROM housing h
      WHERE TRIM(h.emp_name) = TRIM(a.emp_name)
      AND (p_start_date = '' OR h.deduction_month::TEXT >= p_start_date OR h.deduction_month IS NOT NULL)), 0)

  FROM all_emp a
  WHERE (p_search_name = '' OR a.emp_name ILIKE '%' || p_search_name || '%')
  ORDER BY NULLIF(a.emp_id, '')::INTEGER ASC;
END;
$$;


--
-- Name: get_all_employees_stats_v5(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_all_employees_stats_v5(p_search_name text DEFAULT ''::text, p_start_date text DEFAULT ''::text, p_end_date text DEFAULT ''::text) RETURNS TABLE(emp_id text, emp_name text, job_title text, total_production numeric, total_days_worked numeric, attendance_count bigint, total_advances numeric, total_deductions numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
BEGIN
  RETURN QUERY
  SELECT
    a.emp_id::TEXT,
    a.emp_name,
    COALESCE(a.job_title, '') as job_title,

    -- 1. مجموع الإنتاج من daily_report (عمود prod)
    COALESCE((SELECT SUM(CASE WHEN d.prod ~ '^\d+(\.\d+)?$' THEN d.prod::NUMERIC ELSE 0 END)
      FROM daily_report d WHERE TRIM(d.emp_name) = TRIM(a.emp_name)
      AND (p_start_date = '' OR d.date >= p_start_date) AND (p_end_date = '' OR d.date <= p_end_date)), 0),

    -- 2. مجموع أيام العمل من daily_report (عمود d_w)
    COALESCE((SELECT SUM(CASE WHEN d.d_w ~ '^\d+(\.\d+)?$' THEN d.d_w::NUMERIC ELSE 0 END)
      FROM daily_report d WHERE TRIM(d.emp_name) = TRIM(a.emp_name)
      AND (p_start_date = '' OR d.date >= p_start_date) AND (p_end_date = '' OR d.date <= p_end_date)), 0),

    -- 3. عدد أيام الحضور (عمود attendance)
    COALESCE((SELECT COUNT(*) FROM daily_report d
      WHERE TRIM(d.emp_name) = TRIM(a.emp_name)
      AND (d.attendance::TEXT = '1' OR d.attendance::TEXT ILIKE '%حاضر%')
      AND (p_start_date = '' OR d.date >= p_start_date) AND (p_end_date = '' OR d.date <= p_end_date)), 0)::BIGINT,

    -- 4. إجمالي السلف من emp_adv
    COALESCE((SELECT SUM(amount::NUMERIC) FROM emp_adv v
      WHERE TRIM(v.emp_name) = TRIM(a.emp_name)
      AND (p_start_date = '' OR v.date >= p_start_date) AND (p_end_date = '' OR v.date <= p_end_date)), 0),

    -- 5. إجمالي الخصومات من emp_ded
    COALESCE((SELECT SUM(amount::NUMERIC) FROM emp_ded de
      WHERE TRIM(de.emp_name) = TRIM(a.emp_name)
      AND (p_start_date = '' OR de.date >= p_start_date) AND (p_end_date = '' OR de.date <= p_end_date)), 0)

  FROM all_emp a
  WHERE (p_search_name = '' OR a.emp_name ILIKE '%' || p_search_name || '%')
  ORDER BY a.emp_id::INTEGER ASC;
END;
$_$;


--
-- Name: get_all_employees_summary_v2(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_all_employees_summary_v2(p_search_name text DEFAULT ''::text, p_start_date text DEFAULT ''::text, p_end_date text DEFAULT ''::text) RETURNS TABLE(emp_name text, total_production numeric, total_days_worked numeric, attendance_count bigint, last_report_date text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
BEGIN
  RETURN QUERY
  SELECT
    d.emp_name,
    -- نفس منطق التنظيف والحساب اللي استعملناه في الدالة السابقة
    COALESCE(SUM(
      CASE
        WHEN REGEXP_REPLACE(d.prod::TEXT, '[^0-9.]', '', 'g') ~ '^\d+(\.\d+)?$'
        THEN REGEXP_REPLACE(d.prod::TEXT, '[^0-9.]', '', 'g')::NUMERIC
        ELSE 0
      END
    ), 0) as total_production,

    COALESCE(SUM(
      CASE
        WHEN REGEXP_REPLACE(d.d_w::TEXT, '[^0-9.]', '', 'g') ~ '^\d+(\.\d+)?$'
        THEN REGEXP_REPLACE(d.d_w::TEXT, '[^0-9.]', '', 'g')::NUMERIC
        ELSE 0
      END
    ), 0) as total_days_worked,

    COUNT(*) FILTER (
      WHERE d.attendance::TEXT ILIKE '%حاضر%'
      OR d.attendance::TEXT = '1'
    )::BIGINT as attendance_count,

    MAX(d.date)::TEXT as last_report_date -- عشان تعرف أخر يوم الموظف ده اشتغل فيه

  FROM daily_report d
  WHERE
    (NULLIF(p_search_name, '') IS NULL OR d.emp_name ILIKE '%' || p_search_name || '%') AND
    (NULLIF(p_start_date, '') IS NULL OR d.date >= p_start_date) AND
    (NULLIF(p_end_date, '') IS NULL OR d.date <= p_end_date)
  GROUP BY d.emp_name
  ORDER BY total_production DESC; -- ترتيب حسب الأكثر إنتاجاً
END;
$_$;


--
-- Name: get_all_employees_with_stats_v3(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_all_employees_with_stats_v3(p_search_name text DEFAULT ''::text, p_start_date text DEFAULT ''::text, p_end_date text DEFAULT ''::text) RETURNS TABLE(emp_id text, emp_name text, job_title text, total_production numeric, total_days_worked numeric, attendance_count bigint, last_report_date text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
BEGIN
  RETURN QUERY
  SELECT
    a.emp_id::TEXT,
    a.emp_name,
    COALESCE(a.job_title, 'بدون وظيفة') as job_title,

    -- حساب الإنتاج: استخدام NULLIF لتجنب أخطاء التحويل
    COALESCE(SUM(
      CASE
        WHEN d.prod IS NULL THEN 0
        WHEN REGEXP_REPLACE(d.prod::TEXT, '[^0-9.]', '', 'g') ~ '^\d+(\.\d+)?$'
        THEN REGEXP_REPLACE(d.prod::TEXT, '[^0-9.]', '', 'g')::NUMERIC
        ELSE 0
      END
    ), 0) as total_production,

    COALESCE(SUM(
      CASE
        WHEN d.d_w IS NULL THEN 0
        WHEN REGEXP_REPLACE(d.d_w::TEXT, '[^0-9.]', '', 'g') ~ '^\d+(\.\d+)?$'
        THEN REGEXP_REPLACE(d.d_w::TEXT, '[^0-9.]', '', 'g')::NUMERIC
        ELSE 0
      END
    ), 0) as total_days_worked,

    COUNT(d.id) FILTER (WHERE d.attendance::TEXT ILIKE '%حاضر%' OR d.attendance::TEXT = '1')::BIGINT,
    MAX(d.date)::TEXT

  FROM all_emp a
  -- استخدام LEFT JOIN يضمن ظهور الموظف حتى لو لم يوجد له سجلات
  LEFT JOIN daily_report d ON
    -- تنظيف الأسماء من المسافات تماماً قبل الربط
    REPLACE(a.emp_name, ' ', '') = REPLACE(d.emp_name, ' ', '')

  WHERE
    (p_search_name = '' OR a.emp_name ILIKE '%' || p_search_name || '%')
    -- تم إزالة فلاتر التاريخ من الـ WHERE مؤقتاً للتأكد من ظهور البيانات
  GROUP BY a.emp_id, a.emp_name, a.job_title
  ORDER BY a.emp_name ASC;
END;
$_$;


--
-- Name: get_comprehensive_dashboard(date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_comprehensive_dashboard(start_date date, end_date date) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
  exp_posted NUMERIC;
  exp_pending NUMERIC;
  pv_posted NUMERIC;
  pv_pending NUMERIC;
  rv_posted NUMERIC;
  rv_pending NUMERIC;
  inv_posted NUMERIC;
  inv_pending NUMERIC;
  labor_posted NUMERIC;
  labor_pending NUMERIC;
  advances NUMERIC;
  deductions NUMERIC;
  violations_amt NUMERIC;
BEGIN
  -- 1. المصروفات (expenses)
  SELECT COALESCE(SUM(total_price), 0) INTO exp_posted FROM expenses WHERE is_posted = true AND exp_date BETWEEN start_date AND end_date;
  SELECT COALESCE(SUM(total_price), 0) INTO exp_pending FROM expenses WHERE is_posted = false AND exp_date BETWEEN start_date AND end_date;

  -- 2. سندات الصرف (payment_vouchers)
  SELECT COALESCE(SUM(amount), 0) INTO pv_posted FROM payment_vouchers WHERE is_posted = true AND date BETWEEN start_date AND end_date;
  SELECT COALESCE(SUM(amount), 0) INTO pv_pending FROM payment_vouchers WHERE is_posted = false AND date BETWEEN start_date AND end_date;

  -- 3. سندات القبض (receipt_vouchers)
  SELECT COALESCE(SUM(amount), 0) INTO rv_posted FROM receipt_vouchers WHERE status = 'مرحل' AND date BETWEEN start_date AND end_date;
  SELECT COALESCE(SUM(amount), 0) INTO rv_pending FROM receipt_vouchers WHERE status != 'مرحل' AND date BETWEEN start_date AND end_date;

  -- 4. فواتير العملاء (invoices)
  SELECT COALESCE(SUM(total_amount), 0) INTO inv_posted FROM invoices WHERE status = 'مرحل' AND date BETWEEN start_date AND end_date;
  SELECT COALESCE(SUM(total_amount), 0) INTO inv_pending FROM invoices WHERE status != 'مرحل' AND date BETWEEN start_date AND end_date;

  -- 5. يوميات العمال (labor_daily_logs)
  SELECT COALESCE(SUM(daily_wage * attendance_value), 0) INTO labor_posted FROM labor_daily_logs WHERE is_posted = true AND work_date BETWEEN start_date AND end_date;
  SELECT COALESCE(SUM(daily_wage * attendance_value), 0) INTO labor_pending FROM labor_daily_logs WHERE is_posted = false AND work_date BETWEEN start_date AND end_date;

  -- 6. السلف والخصومات والمخالفات
  -- تم إزالة الجداول الخاصة بالسلف والخصومات لعدم الاستخدام
  advances := 0;
  deductions := 0;
  SELECT COALESCE(SUM(amount), 0) INTO violations_amt FROM violations WHERE is_posted = true AND date BETWEEN start_date AND end_date;

  -- إرجاع النتيجة ككائن JSON واحد
  RETURN json_build_object(
    'expenses', json_build_object('posted', exp_posted, 'pending', exp_pending, 'total', exp_posted + exp_pending),
    'payment_vouchers', json_build_object('posted', pv_posted, 'pending', pv_pending, 'total', pv_posted + pv_pending),
    'receipt_vouchers', json_build_object('posted', rv_posted, 'pending', rv_pending, 'total', rv_posted + rv_pending),
    'invoices', json_build_object('posted', inv_posted, 'pending', inv_pending, 'total', inv_posted + inv_pending),
    'labor', json_build_object('posted', labor_posted, 'pending', labor_pending, 'total', labor_posted + labor_pending),
    'hr', json_build_object('advances', advances, 'deductions', deductions, 'violations', violations_amt)
  );
END;
$$;


--
-- Name: get_cost_center_dashboard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_cost_center_dashboard() RETURNS TABLE(property_name text, total_cost numeric, total_vat numeric, expense_count bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(e.site_ref, 'مصروفات عامة (غير موجهة)') as property_name,
        SUM(e.total_price) as total_cost,
        SUM(e.vat_amount) as total_vat,
        COUNT(e.id) as expense_count
    FROM expenses e
    WHERE e.is_posted = true -- 🔥 بنسحب المصروفات المعتمدة والمُرحلة فقط
    GROUP BY COALESCE(e.site_ref, 'مصروفات عامة (غير موجهة)')
    ORDER BY total_cost DESC;
END;
$$;


--
-- Name: get_dashboard_totals(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_dashboard_totals() RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_total_expenses numeric := 0;
    v_total_paid numeric := 0;
    v_total_pending numeric := 0;
BEGIN
    SELECT COALESCE(SUM(total_price), 0) INTO v_total_expenses FROM public.expenses WHERE is_deleted = false;
    SELECT COALESCE(SUM(paid_amount), 0) INTO v_total_paid FROM public.expenses WHERE is_deleted = false;
    v_total_pending := v_total_expenses - v_total_paid;

    RETURN json_build_object(
        'total_expenses', v_total_expenses,
        'total_paid', v_total_paid,
        'total_pending', v_total_pending,
        'success', true
    );
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;


--
-- Name: get_emp_attendance_and_work_v5(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_emp_attendance_and_work_v5(p_search_name text DEFAULT ''::text, p_start_date text DEFAULT ''::text, p_end_date text DEFAULT ''::text) RETURNS TABLE(emp_id text, emp_name text, total_days_worked numeric, attendance_count bigint, job_title text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
BEGIN
  RETURN QUERY
  SELECT
    a.emp_id::TEXT,
    a.emp_name,

    -- 1. مجموع أيام العمل (d_w) من جدول daily_report
    COALESCE((
      SELECT SUM(
        CASE
          WHEN d.d_w::TEXT ~ '^\d+(\.\d+)?$' THEN d.d_w::NUMERIC
          ELSE 0
        END
      )
      FROM daily_report d
      WHERE TRIM(d.emp_name) = TRIM(a.emp_name)
      AND (NULLIF(p_start_date, '') IS NULL OR d.date >= p_start_date)
      AND (NULLIF(p_end_date, '') IS NULL OR d.date <= p_end_date)
    ), 0) as total_days_worked,

    -- 2. مجموع الحضور (attendance)
    COALESCE((
      SELECT COUNT(*)
      FROM daily_report d
      WHERE TRIM(d.emp_name) = TRIM(a.emp_name)
      AND (d.attendance::TEXT = '1' OR d.attendance::TEXT ILIKE '%حاضر%')
      AND (NULLIF(p_start_date, '') IS NULL OR d.date >= p_start_date)
      AND (NULLIF(p_end_date, '') IS NULL OR d.date <= p_end_date)
    ), 0)::BIGINT as attendance_count,

    a.job_title

  FROM all_emp a
  WHERE (NULLIF(p_search_name, '') IS NULL OR a.emp_name ILIKE '%' || p_search_name || '%')
  ORDER BY a.emp_id::INTEGER ASC;
END;
$_$;


--
-- Name: get_emp_ded_v1(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_emp_ded_v1(p_search_name text DEFAULT ''::text, p_search_date text DEFAULT ''::text) RETURNS TABLE(id integer, date text, emp_name text, amount double precision, reason text, notes text, total_db_sum double precision)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,                -- نستخدم الـ ID الحقيقي هنا
    e.date,
    e.emp_name,
    COALESCE(e.amount, 0)::FLOAT as amount,
    e.reason,
    e.notes,
    SUM(COALESCE(e.amount, 0)) OVER()::FLOAT as total_db_sum
  FROM emp_ded e
  WHERE
    (p_search_name = '' OR e.emp_name ILIKE '%' || p_search_name || '%')
    AND (p_search_date = '' OR e.date ILIKE '%' || p_search_date || '%')
  ORDER BY e.date DESC;
END; $$;


--
-- Name: get_employees_with_custom_totals_v2(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_employees_with_custom_totals_v2(p_search_name text DEFAULT ''::text, p_start_date text DEFAULT ''::text, p_end_date text DEFAULT ''::text) RETURNS TABLE(total_production numeric, total_days_worked numeric, total_attendance bigint, records_count bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
BEGIN
  RETURN QUERY
  SELECT
    -- معالجة الإنتاج: إزالة كل ما هو ليس أرقام، وإذا كانت النتيجة نقطة فقط أو فارغة تحول لـ 0
    COALESCE(SUM(
      CASE
        WHEN REGEXP_REPLACE(prod::TEXT, '[^0-9.]', '', 'g') ~ '^\d+(\.\d+)?$'
        THEN REGEXP_REPLACE(prod::TEXT, '[^0-9.]', '', 'g')::NUMERIC
        ELSE 0
      END
    ), 0) as total_production,

    -- معالجة أيام العمل D_W بنفس الطريقة
    COALESCE(SUM(
      CASE
        WHEN REGEXP_REPLACE(d_w::TEXT, '[^0-9.]', '', 'g') ~ '^\d+(\.\d+)?$'
        THEN REGEXP_REPLACE(d_w::TEXT, '[^0-9.]', '', 'g')::NUMERIC
        ELSE 0
      END
    ), 0) as total_days_worked,

    -- حساب الحضور
    COUNT(*) FILTER (
      WHERE attendance::TEXT ILIKE '%حاضر%'
      OR attendance::TEXT = '1'
    )::BIGINT as total_attendance,

    -- إجمالي السجلات
    COUNT(*)::BIGINT as records_count

  FROM daily_report
  WHERE
    (NULLIF(p_search_name, '') IS NULL OR emp_name ILIKE '%' || p_search_name || '%') AND
    (NULLIF(p_start_date, '') IS NULL OR date >= p_start_date) AND
    (NULLIF(p_end_date, '') IS NULL OR date <= p_end_date);
END;
$_$;


--
-- Name: get_housing_services_v1(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_housing_services_v1(p_search_name text DEFAULT ''::text, p_service_type text DEFAULT ''::text) RETURNS TABLE(generated_id text, emp_name text, deduction_month text, amount double precision, service_type text, notes text, total_db_sum double precision)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.ctid::TEXT as generated_id,
    e.emp_name,
    e.deduction_month,
    COALESCE(e.amount, 0)::FLOAT as amount,
    e.service_type,
    e.notes, -- تم التعديل للجمع بناءً على تنبيه سوبابيز الأخير
    SUM(COALESCE(e.amount, 0)) OVER()::FLOAT as total_db_sum
  FROM housing e
  WHERE
    (p_search_name = '' OR e.emp_name ILIKE '%' || p_search_name || '%')
    AND (p_service_type = '' OR e.service_type ILIKE '%' || p_service_type || '%')
  ORDER BY e.deduction_month DESC;
END; $$;


--
-- Name: get_journal_ghosts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_journal_ghosts() RETURNS TABLE(id text, entry_date date, description text, total_amount numeric, diagnosis text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        l.header_id::text,
        MAX(l.created_at)::date as entry_date,
        'سطور يتيمة ملهاش رأس قيد'::text as description,
        SUM(l.debit + l.credit)::numeric as total_amount,
        'Ghost Detected: Lines found without parent Header'::text as diagnosis
    FROM journal_lines l
    LEFT JOIN journal_headers h ON l.header_id = h.id
    WHERE h.id IS NULL
    GROUP BY l.header_id;
END;
$$;


--
-- Name: get_labor_calculations(text, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_labor_calculations(p_site_ref text DEFAULT NULL::text, p_work_date date DEFAULT NULL::date, p_work_item text DEFAULT NULL::text) RETURNS TABLE("الموقع" text, "البند_الرسمي" text, "إجمالي_التكلفة" numeric, "إجمالي_أيام_الحضور" numeric, "عدد_العمال" bigint, "تفاصيل_الإنتاجية" text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        site_ref AS "الموقع",
        work_item AS "البند_الرسمي",
        SUM(daily_wage) AS "إجمالي_التكلفة",
        SUM(attendance_value) AS "إجمالي_أيام_الحضور",
        COUNT(id) AS "عدد_العمال",
        -- تجميع نصوص الإنتاجية في سطر واحد عشان تقرأها بسهولة
        STRING_AGG(DISTINCT production_desc, ' | ') AS "تفاصيل_الإنتاجية"
    FROM
        public.labor_daily_logs
    WHERE
        -- السطر ده معناه: لو المبرمج مبعتش الفلتر، اعتبره "الكل"، لو بعته، فلتر بيه
        (p_site_ref IS NULL OR site_ref = p_site_ref)
        AND (p_work_date IS NULL OR work_date = p_work_date)
        AND (p_work_item IS NULL OR work_item = p_work_item)
    GROUP BY
        site_ref,
        work_item
    ORDER BY
        "إجمالي_التكلفة" DESC;
END;
$$;


--
-- Name: get_labor_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_labor_stats() RETURNS TABLE(total_wage_sum numeric, total_attendance_sum numeric, total_production_count bigint, total_records_count bigint)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(daily_wage), 0)::NUMERIC,
        COALESCE(SUM(attendance_value), 0)::NUMERIC,
        COUNT(production_desc)::BIGINT, -- بيعد الصفوف اللي فيها وصف إنتاجية بس
        COUNT(*)::BIGINT
    FROM public.labor_daily_logs;
END;
$$;


--
-- Name: get_payroll_balances_with_cutoff(integer, integer, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_payroll_balances_with_cutoff(p_month integer, p_year integer, p_cutoff_date date DEFAULT CURRENT_DATE) RETURNS TABLE(partner_id uuid, previous_unpaid_balance numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: get_project_dashboard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_project_dashboard() RETURNS TABLE(id uuid, "Property" text, client_name text, status text, contract_value numeric, estimated_budget numeric, total_material_cost numeric, total_direct_expenses numeric, direct_labor_cost numeric, allocated_labor_cost numeric, total_cost numeric, subcontractors jsonb, overall_completion_percentage numeric)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_total_general_labor_cost numeric; v_total_labor_logs numeric;
BEGIN
    SELECT COALESCE(SUM(COALESCE(NULLIF(ex.paid_amount, 0), ex.total_price, 0)), 0) INTO v_total_general_labor_cost FROM public.expenses ex WHERE ex.project_id IS NULL AND (ex.main_category LIKE '%عمال%' OR ex.main_category LIKE '%رواتب%' OR ex.main_category LIKE '%أجور%');
    SELECT COALESCE(SUM(attendance_value), 1) INTO v_total_labor_logs FROM public.labor_daily_logs;
    IF v_total_labor_logs <= 0 THEN v_total_labor_logs := 1; END IF;

    RETURN QUERY
    WITH MaterialCosts AS (
        SELECT mi.project_id, SUM(mil.total_price) as material_cost FROM public.material_issues mi JOIN public.material_issue_lines mil ON mi.id = mil.issue_id GROUP BY mi.project_id
    ),
    DirectExpenses AS (
        SELECT ex_dir.project_id, SUM(COALESCE(NULLIF(ex_dir.paid_amount, 0), ex_dir.total_price, 0)) as exp_cost FROM public.expenses ex_dir WHERE ex_dir.project_id IS NOT NULL GROUP BY ex_dir.project_id
    ),
    LaborLogs AS (
        SELECT ldl.project_id, SUM(ldl.attendance_value) as project_workers, SUM(COALESCE(ldl.attendance_value, 0) * COALESCE(ldl.daily_wage, 0)) as direct_labor FROM public.labor_daily_logs ldl GROUP BY ldl.project_id
    ),
    Subcontractors AS (
        SELECT sub_union.project_id, jsonb_agg(DISTINCT sub_union.sub_name) as subs FROM (
            SELECT e.project_id, p.name as sub_name FROM public.expenses e JOIN public.partners p ON e.payee_id = p.id WHERE e.project_id IS NOT NULL
            UNION SELECT m.project_id, p.name as sub_name FROM public.material_issues m JOIN public.partners p ON m.subcontractor_id = p.id WHERE m.project_id IS NOT NULL
            UNION SELECT ca.project_id, p.name as sub_name FROM public.contractor_assignments ca JOIN public.partners p ON ca.contractor_id = p.id WHERE ca.project_id IS NOT NULL
        ) sub_union WHERE sub_name IS NOT NULL GROUP BY sub_union.project_id
    ),
    BOQStats AS (
        SELECT
            b.project_id, COALESCE(AVG(b.completed_percentage), 0) as avg_completion,
            SUM(COALESCE(b.contract_quantity, 0) * COALESCE(b.unit_contract_price, 0)) as boq_contract_value,
            SUM(COALESCE(b.estimated_labor_cost, 0) + COALESCE(b.estimated_material_cost, 0) + COALESCE(b.estimated_expenses_cost, 0)) as boq_estimated_budget
        FROM public.boq_budget b
        WHERE NOT EXISTS (SELECT 1 FROM public.boq_budget child WHERE child.parent_id = b.id)
        GROUP BY b.project_id
    )
    SELECT
        p.id, p."Property"::text, p.client_name::text, p.status::text,
        COALESCE(NULLIF(bs.boq_contract_value, 0), p.contract_value, 0) as contract_value,
        COALESCE(NULLIF(bs.boq_estimated_budget, 0), p.estimated_budget, 0) as estimated_budget,
        COALESCE(mc.material_cost, 0) as total_material_cost, COALESCE(de.exp_cost, 0) as total_direct_expenses, COALESCE(ll.direct_labor, 0) as direct_labor_cost,
        ROUND((COALESCE(ll.project_workers, 0)::numeric / v_total_labor_logs) * v_total_general_labor_cost, 2) as allocated_labor_cost,
        (COALESCE(mc.material_cost, 0) + COALESCE(de.exp_cost, 0) + COALESCE(ll.direct_labor, 0) + ROUND((COALESCE(ll.project_workers, 0)::numeric / v_total_labor_logs) * v_total_general_labor_cost, 2)) as total_cost,
        COALESCE(s.subs, '[]'::jsonb) as subcontractors, COALESCE(bs.avg_completion, 0) as overall_completion_percentage
    FROM public.projects p
    LEFT JOIN MaterialCosts mc ON p.id = mc.project_id
    LEFT JOIN DirectExpenses de ON p.id = de.project_id
    LEFT JOIN LaborLogs ll ON p.id = ll.project_id
    LEFT JOIN Subcontractors s ON p.id = s.project_id
    LEFT JOIN BOQStats bs ON p.id = bs.project_id;
END;
$$;


--
-- Name: get_project_full_details(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_project_full_details(p_project_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_boq json;
    v_expenses json;
    v_materials json;
    v_invoices json;
    v_sub_claims json;
    v_contractor_assignments json;
BEGIN
    -- 1. بنود المقايسة
    SELECT COALESCE(json_agg(t), '[]'::json) INTO v_boq
    FROM (SELECT * FROM public.boq_budget WHERE project_id = p_project_id) t;

    -- 2. المصاريف واليوميات
    SELECT COALESCE(json_agg(t), '[]'::json) INTO v_expenses
    FROM (SELECT * FROM public.expenses WHERE project_id = p_project_id) t;

    -- 3. تجميع الخامات المصلح والمؤمن بالكامل بدون l.boq_id المكسور
    SELECT COALESCE(json_agg(t), '[]'::json) INTO v_materials
    FROM (
        -- حركات التوريد (تستخدم boq_item_id)
        SELECT id, item_name, quantity, unit, unit_price, total_price, boq_item_id AS boq_id, 'receipt' AS movement_type
        FROM public.material_receipt_lines
        WHERE project_id = p_project_id
        UNION ALL
        -- حركات الصرف (تستخدم boq_id)
        SELECT mil.id, mil.item_name, mil.quantity, mil.unit, mil.unit_price, mil.total_price, mil.boq_id, 'issue' AS movement_type
        FROM public.material_issue_lines mil
        JOIN public.material_issues mi ON mil.issue_id = mi.id
        WHERE mi.project_id = p_project_id
    ) t;

    -- 4. الفواتير والمستخلصات
    SELECT COALESCE(json_agg(t), '[]'::json) INTO v_invoices
    FROM (SELECT * FROM public.invoices WHERE project_ids @> array[p_project_id]) t;

    -- 5. مستخلصات مقاولي الباطن
    SELECT COALESCE(json_agg(t), '[]'::json) INTO v_sub_claims
    FROM (SELECT * FROM public.sub_claims WHERE project_id = p_project_id) t;

    -- 6. تكليفات المقاولين
    SELECT COALESCE(json_agg(t), '[]'::json) INTO v_contractor_assignments
    FROM (SELECT * FROM public.contractor_assignments WHERE project_id = p_project_id) t;

    -- إرجاع الداتا كاملة كـ Object مدمج
    RETURN json_build_object(
        'boq', v_boq,
        'expenses', v_expenses,
        'materials', v_materials,
        'invoices', v_invoices,
        'sub_claims', v_sub_claims,
        'contractor_assignments', v_contractor_assignments
    );
END;
$$;


--
-- Name: get_project_labor_costs_rpc(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_project_labor_costs_rpc() RETURNS TABLE(id text, project_id uuid, "اسم المشروع" text, "تاريخ اليومية" date, "الشهر المالي" text, "اسم البند المتأثر" text, "عدد العمال بالميدان" numeric, "تكلفة العمالة الفعلية" numeric)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.vw_project_labor_costs
  ORDER BY "تاريخ اليومية" DESC, id ASC;
END;
$$;


--
-- Name: get_real_totals(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_real_totals() RETURNS TABLE(total_expenses numeric, total_pending_vouchers numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT ROUND(SUM(COALESCE((quantity * unit_price), 0) + COALESCE(vat_amount, 0) - COALESCE(discount_amount, 0)), 2)
         FROM public.expenses WHERE is_posted = true),

        (SELECT ROUND(SUM(amount), 2)
         FROM public.payment_vouchers WHERE is_posted = false);
END;
$$;


--
-- Name: get_safe_advances(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_safe_advances() RETURNS TABLE(final_id bigint, final_name text, final_amount numeric, final_date date)
    LANGUAGE plpgsql
    AS $_$
BEGIN
  RETURN QUERY
  SELECT
    id,
    emp_name::TEXT,
    -- تحويل آمن: لو النص مش رقم، يحطه 0 بدل ما يضرب Error
    CASE
      WHEN amount ~ '^[0-9.]+$' THEN amount::NUMERIC
      ELSE 0
    END,
    -- تحويل التاريخ: لو النص مش تاريخ صح، يحط تاريخ قديم
    CASE
      WHEN date ~ '^\d{4}-\d{2}-\d{2}$' THEN date::DATE
      ELSE '1900-01-01'::DATE
    END
  FROM emp_adv;
END; $_$;


--
-- Name: get_subcontractor_pending_deductions(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_subcontractor_pending_deductions(p_sub_id uuid, p_proj_id uuid) RETURNS TABLE(deduction_type text, record_id uuid, entry_date date, statement text, amount numeric)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    -- 1. الخامات (يجب أن تطابق المقاول والمشروع حصراً)
    SELECT
        'material'::TEXT,
        mil.id,
        mi.issue_date,
        (mil.item_name || ' - كمية: ' || mil.quantity || ' ' || mil.unit)::TEXT,
        mil.total_price
    FROM material_issue_lines mil
    JOIN material_issues mi ON mil.issue_id = mi.id
    WHERE mi.subcontractor_id = p_sub_id
      AND mi.project_id = p_proj_id -- الخامات دايما مرتبطة بمشروع
      AND mi.is_posted = true
      AND mi.subcontractor_invoice_id IS NULL

    UNION ALL

    -- 2. المصروفات (لو فيه مشروع لازم يطابق، لو مافيش يسحبها عادي لأي مشروع)
    SELECT
        'expense'::TEXT,
        e.id,
        e.expense_date,
        e.notes::TEXT,
        e.amount
    FROM expenses e
    WHERE e.payee_id = p_sub_id
      AND (e.project_id = p_proj_id OR e.project_id IS NULL) -- 🎯 اللوجيك المطلوب هنا
      AND e.is_posted = true
      AND e.is_subcontractor_charge = true
      AND e.subcontractor_invoice_id IS NULL;
END;
$$;


--
-- Name: get_table_dependencies(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_table_dependencies(p_table_name text) RETURNS TABLE("نوع الارتباط (Type)" text, "اسم الكائن (Object Name)" text, "التفاصيل (Details)" text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- 1. كشف قيود الربط (Foreign Keys) الصادرة والواردة
    RETURN QUERY
    SELECT
        'قيد ربط (Foreign Key)'::text,
        c.conname::text,
        (CASE
            WHEN fk.relname = p_table_name THEN '⚠️ هذا الجدول يعتمد على جدول: ' || pk.relname
            ELSE '🛡️ جدول [' || fk.relname || '] يعتمد على هذا الجدول'
         END)::text
    FROM pg_constraint c
    JOIN pg_class fk ON c.conrelid = fk.oid
    LEFT JOIN pg_class pk ON c.confrelid = pk.oid
    WHERE c.contype = 'f' AND (fk.relname = p_table_name OR pk.relname = p_table_name);

    -- 2. كشف المشغلات (Triggers) المربوطة بالجدول
    RETURN QUERY
    SELECT
        'مُشغّل (Trigger)'::text,
        t.tgname::text,
        ('⚙️ يقوم بتشغيل الدالة الحية: ' || p.proname)::text
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_proc p ON t.tgfoid = p.oid
    WHERE c.relname = p_table_name AND NOT t.tgisinternal;

    -- 3. كشف شاشات العرض والتقارير (Views) التي تقرأ من هذا الجدول
    RETURN QUERY
    SELECT DISTINCT
        'تقرير / عرض (View)'::text,
        c.relname::text,
        '📊 شاشة أو تقرير يعتمد مباشرة على بيانات هذا الجدول'::text
    FROM pg_depend d
    JOIN pg_rewrite r ON d.objid = r.oid
    JOIN pg_class c ON r.ev_class = c.oid
    WHERE d.refobjid = to_regclass('public.' || p_table_name)
      AND c.relname <> p_table_name;

END;
$$;


--
-- Name: get_total_stats(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_total_stats(p_search_name text DEFAULT ''::text, p_start_date text DEFAULT ''::text, p_end_date text DEFAULT ''::text) RETURNS TABLE(total_production numeric, total_days_worked numeric, total_attendance bigint, records_count bigint)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(CAST(prod AS NUMERIC)), 0) as total_production,
    COALESCE(SUM(CAST(d_w AS NUMERIC)), 0) as total_days_worked,
    COUNT(*) FILTER (WHERE attendance LIKE '%حاضر%' OR attendance = '1') as total_attendance,
    COUNT(*) as records_count
  FROM daily_report
  WHERE
    (p_search_name = '' OR emp_name ILIKE '%' || p_search_name || '%') AND
    (p_start_date = '' OR date >= p_start_date) AND
    (p_end_date = '' OR date <= p_end_date);
END;
$$;


--
-- Name: get_trial_balance(date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_trial_balance(p_start_date date, p_end_date date) RETURNS TABLE(account_id uuid, account_code text, account_name text, account_type text, parent_id uuid, opening_debit numeric, opening_credit numeric, period_debit numeric, period_credit numeric, ending_debit numeric, ending_credit numeric)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY

  WITH opening_balances AS (
      SELECT
          jl.account_id,
          SUM(jl.debit) as op_debit,
          SUM(jl.credit) as op_credit
      FROM public.journal_lines jl
      JOIN public.journal_headers jh ON jl.header_id = jh.id
      WHERE jh.entry_date < p_start_date AND jh.status = 'posted'
      GROUP BY jl.account_id
  ),
  period_transactions AS (
      SELECT
          jl.account_id,
          SUM(jl.debit) as per_debit,
          SUM(jl.credit) as per_credit
      FROM public.journal_lines jl
      JOIN public.journal_headers jh ON jl.header_id = jh.id
      WHERE jh.entry_date >= p_start_date AND jh.entry_date <= p_end_date AND jh.status = 'posted'
      GROUP BY jl.account_id
  )

  -- عملية الـ SELECT مع الـ Casting الإجباري لكل عمود
  SELECT
      a.id::uuid as account_id,
      a.code::text as account_code,
      a.name::text as account_name,
      a.account_type::text as account_type,
      a.parent_id::uuid as parent_id,

      COALESCE(ob.op_debit, 0::numeric) as opening_debit,
      COALESCE(ob.op_credit, 0::numeric) as opening_credit,

      COALESCE(pt.per_debit, 0::numeric) as period_debit,
      COALESCE(pt.per_credit, 0::numeric) as period_credit,

      (CASE
          WHEN (COALESCE(ob.op_debit, 0::numeric) + COALESCE(pt.per_debit, 0::numeric)) > (COALESCE(ob.op_credit, 0::numeric) + COALESCE(pt.per_credit, 0::numeric))
          THEN (COALESCE(ob.op_debit, 0::numeric) + COALESCE(pt.per_debit, 0::numeric)) - (COALESCE(ob.op_credit, 0::numeric) + COALESCE(pt.per_credit, 0::numeric))
          ELSE 0::numeric
      END)::numeric as ending_debit,

      (CASE
          WHEN (COALESCE(ob.op_credit, 0::numeric) + COALESCE(pt.per_credit, 0::numeric)) > (COALESCE(ob.op_debit, 0::numeric) + COALESCE(pt.per_debit, 0::numeric))
          THEN (COALESCE(ob.op_credit, 0::numeric) + COALESCE(pt.per_credit, 0::numeric)) - (COALESCE(ob.op_debit, 0::numeric) + COALESCE(pt.per_debit, 0::numeric))
          ELSE 0::numeric
      END)::numeric as ending_credit

  FROM public.accounts a
  LEFT JOIN opening_balances ob ON a.id = ob.account_id
  LEFT JOIN period_transactions pt ON a.id = pt.account_id

  WHERE a.is_transactional = true
    AND (
        COALESCE(ob.op_debit, 0) > 0 OR COALESCE(ob.op_credit, 0) > 0
     OR COALESCE(pt.per_debit, 0) > 0 OR COALESCE(pt.per_credit, 0) > 0
    )
  ORDER BY a.code ASC;
END;
$$;


--
-- Name: handle_expense_status_on_payment(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_expense_status_on_payment() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- في حالة إضافة سند جديد (INSERT)
    IF TG_OP = 'INSERT' THEN
        IF NEW.related_expense_id IS NOT NULL THEN
            UPDATE public.expenses
            SET paid_amount = COALESCE(paid_amount, 0) + COALESCE(NEW.amount, 0)
            WHERE id = NEW.related_expense_id;
        END IF;
        RETURN NEW;

    -- في حالة حذف سند (DELETE)
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.related_expense_id IS NOT NULL THEN
            UPDATE public.expenses
            -- استخدام GREATEST عشان الرصيد مينزلش تحت الصفر بالغلط
            SET paid_amount = GREATEST(COALESCE(paid_amount, 0) - COALESCE(OLD.amount, 0), 0)
            WHERE id = OLD.related_expense_id;
        END IF;
        RETURN OLD;

    -- في حالة تعديل مبلغ السند (UPDATE)
    ELSIF TG_OP = 'UPDATE' THEN
        -- لو السند كان مربوط بفاتورة، ننقص المبلغ القديم الأول
        IF OLD.related_expense_id IS NOT NULL THEN
            UPDATE public.expenses
            SET paid_amount = GREATEST(COALESCE(paid_amount, 0) - COALESCE(OLD.amount, 0), 0)
            WHERE id = OLD.related_expense_id;
        END IF;

        -- وبعدين نضيف المبلغ الجديد للفاتورة الجديدة (أو نفس الفاتورة لو متعدلتش)
        IF NEW.related_expense_id IS NOT NULL THEN
            UPDATE public.expenses
            SET paid_amount = COALESCE(paid_amount, 0) + COALESCE(NEW.amount, 0)
            WHERE id = NEW.related_expense_id;
        END IF;
        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (id, full_name, email, role, permissions)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email,                                   -- 👈 إضافة الإيميل
    coalesce(new.raw_user_meta_data->>'role', 'client'),
    '{}'::jsonb
  );
  return new;
end;
$$;


--
-- Name: handle_payment_voucher_cash_flow(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_payment_voucher_cash_flow() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: handle_receipt_voucher_cash_flow(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_receipt_voucher_cash_flow() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: import_bulk_expenses(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.import_bulk_expenses(expense_data jsonb) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
    item jsonb;
    v_hdr_id UUID;
    v_acc_id UUID;
    v_proj_id UUID;
    v_part_id UUID;
    v_cash_id UUID;
BEGIN
    -- كود الحساب الدائن (الخزينة)
    SELECT id INTO v_cash_id FROM public.accounts WHERE code = '122' LIMIT 1;

    FOR item IN SELECT * FROM jsonb_array_elements(expense_data)
    LOOP
        -- جلب المعرفات بناءً على البيانات
        SELECT id INTO v_acc_id FROM public.accounts WHERE code = (item->>'acc_code') LIMIT 1;
        SELECT id INTO v_proj_id FROM public.projects WHERE "Property" = (item->>'partner_name') LIMIT 1;
        SELECT id INTO v_part_id FROM public.partners WHERE name = (item->>'partner_name') LIMIT 1;

        -- إنشاء رأس القيد
        INSERT INTO public.journal_headers (entry_date, description, status)
        VALUES ((item->>'entry_date')::date, (item->>'description'), 'posted')
        RETURNING id INTO v_hdr_id;

        -- سطر المصروف (مدين)
        INSERT INTO public.journal_lines (header_id, account_id, partner_id, project_id, item_name, quantity, unit_price, debit, credit, notes)
        VALUES (
            v_hdr_id,
            COALESCE(v_acc_id, '00000000-0000-0000-0000-000000000000'),
            v_part_id,
            v_proj_id,
            (item->>'item_name'),
            (item->>'quantity')::numeric,
            (item->>'unit_price')::numeric,
            (item->>'amount')::numeric,
            0,
            (item->>'notes')
        );

        -- سطر الخزينة (دائن)
        INSERT INTO public.journal_lines (header_id, account_id, debit, credit, notes)
        VALUES (v_hdr_id, v_cash_id, 0, (item->>'amount')::numeric, 'تسوية مصروف قديم');
    END LOOP;
    RETURN 'تم رفع جميع البيانات بنجاح';
END;
$$;


--
-- Name: link_record_to_project(text, uuid, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.link_record_to_project(target_table text, record_id uuid, p_project_id uuid, p_partner_id uuid DEFAULT NULL::uuid, p_account_id uuid DEFAULT NULL::uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    EXECUTE format(
        'UPDATE %I SET
            project_id = %L,
            payee_id = CASE WHEN %L IS NULL THEN payee_id ELSE %L END,
            creditor_account_id = CASE WHEN %L IS NULL THEN creditor_account_id ELSE %L END
         WHERE id = %L',
        target_table, p_project_id, p_partner_id, p_partner_id, p_account_id, p_account_id, record_id
    );
END;
$$;


--
-- Name: log_audit_event(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_audit_event() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    user_id uuid;
    user_role text;
    old_record jsonb := null;
    new_record jsonb := null;
    rec_id uuid := null;
BEGIN
    -- محاولة جلب المستخدم من الجلسة
    user_id := auth.uid();

    -- جلب دور المستخدم إذا كان موجوداً
    IF user_id IS NOT NULL THEN
        SELECT role INTO user_role FROM public.profiles WHERE id = user_id;

        -- 🛑 استثناء السوبر أدمن من المراقبة نهائياً لتوفير المساحة واستهلاك الداتا
        IF user_role = 'super_admin' THEN
            IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
            RETURN NEW;
        END IF;
    END IF;

    -- بقية كود المراقبة للمستخدمين العاديين
    IF TG_OP = 'DELETE' THEN
        old_record := row_to_json(OLD);
        BEGIN rec_id := (old_record->>'id')::uuid; EXCEPTION WHEN OTHERS THEN rec_id := null; END;

        INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
        VALUES (TG_TABLE_NAME, rec_id, TG_OP, old_record, null, user_id);

        RETURN OLD;

    ELSIF TG_OP = 'UPDATE' THEN
        old_record := row_to_json(OLD);
        new_record := row_to_json(NEW);
        BEGIN rec_id := (new_record->>'id')::uuid; EXCEPTION WHEN OTHERS THEN rec_id := null; END;

        -- تسجيل التعديل فقط لو فيه تغيير حقيقي
        IF old_record IS DISTINCT FROM new_record THEN
            INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
            VALUES (TG_TABLE_NAME, rec_id, TG_OP, old_record, new_record, user_id);
        END IF;

        RETURN NEW;

    ELSIF TG_OP = 'INSERT' THEN
        new_record := row_to_json(NEW);
        BEGIN rec_id := (new_record->>'id')::uuid; EXCEPTION WHEN OTHERS THEN rec_id := null; END;

        INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
        VALUES (TG_TABLE_NAME, rec_id, TG_OP, null, new_record, user_id);

        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$;


--
-- Name: maintain_boq_property_name(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.maintain_boq_property_name() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.project_id IS NOT NULL THEN
        SELECT "Property" INTO NEW."Property"
        FROM public.projects
        WHERE id = NEW.project_id;
    ELSE
        NEW."Property" := NULL;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: maintain_material_issue_boq_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.maintain_material_issue_boq_id() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_project_id UUID;
    v_boq_id UUID;
BEGIN
    -- 1) جلب الـ project_id (آيدي الفيلا) من الجدول الرئيسي material_issues بناءً على الـ issue_id الحالي
    SELECT project_id INTO v_project_id
    FROM public.material_issues
    WHERE id = NEW.issue_id;

    -- 2) التحقق من أن الفيلا والبند العام (boq_item_id) تم تحديدهم في السطر
    IF v_project_id IS NOT NULL AND NEW.boq_item_id IS NOT NULL THEN

        -- 3) البحث في الميزانية عن السطر الذي يجمع نفس الفيلا ونفس البند العام
        SELECT id INTO v_boq_id
        FROM public.boq_budget
        WHERE project_id = v_project_id
          AND boq_item_id = NEW.boq_item_id
        LIMIT 1;

        -- 4) إذا وجدنا السطر المطابق، نقوم بربط الـ boq_id تلقائياً قبل الحفظ
        IF v_boq_id IS NOT NULL THEN
            NEW.boq_id := v_boq_id;
        END IF;

    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: maintain_material_receipt_boq_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.maintain_material_receipt_boq_id() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- التأكد من وجود الخامة والفيلا في السطر قبل البحث
    IF NEW.item_id IS NOT NULL AND NEW.project_id IS NOT NULL THEN
        -- سحب معرف المقايسة (boq_budget.id) بمطابقة الدليل العام مع ميزانية الفيلا المحددة
        SELECT b.id INTO NEW.boq_item_id
        FROM public.boq_budget b
        JOIN public.material_items mi ON b.boq_item_id = mi.boq_item_id
        WHERE mi.id = NEW.item_id
          AND b.project_id = NEW.project_id
        LIMIT 1;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: post_expenses_bulk(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_expenses_bulk(p_ids uuid[]) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    exp RECORD;
    v_header_id uuid;
    v_total numeric;
    v_debit_acc_id uuid;
    v_credit_acc_id uuid;
    v_code_debit text;
    v_code_credit text;
BEGIN
    FOR exp IN SELECT * FROM public.expenses WHERE id = ANY(p_ids) AND (is_posted = false OR is_posted IS NULL) LOOP

        v_debit_acc_id := NULL;
        v_credit_acc_id := NULL;

        -- 1. حساب الإجمالي
        v_total := COALESCE((exp.quantity * exp.unit_price), 0) + COALESCE(exp.vat_amount, 0) - COALESCE(exp.discount_amount, 0);

        -- 🚀 2. الحل السحري: تخطي القيود الصفرية (عينات مجانية / بونص)
        IF v_total <= 0 THEN
            UPDATE public.expenses SET is_posted = true WHERE id = exp.id;
            CONTINUE; -- تخطى إنشاء القيد المحاسبي وانتقل للسجل التالي فوراً
        END IF;

        -- 3. استخراج الأكواد
        v_code_debit := split_part(exp.creditor_account, ' - ', 1);
        v_code_credit := split_part(exp.payment_account, ' - ', 1);

        -- 4. البحث عن حساب المدين والتحقق الصارم
        SELECT id INTO v_debit_acc_id FROM public.accounts WHERE code::text = v_code_debit LIMIT 1;
        IF v_debit_acc_id IS NULL THEN
            SELECT id INTO v_debit_acc_id FROM public.accounts WHERE name = exp.creditor_account LIMIT 1;
        END IF;
        IF v_debit_acc_id IS NULL THEN
            RAISE EXCEPTION 'خطأ في الترحيل: لم يتم العثور على حساب المدين (%) للمصروف: %', exp.creditor_account, exp.description;
        END IF;

        -- 5. البحث عن حساب الدائن والتحقق الصارم
        SELECT id INTO v_credit_acc_id FROM public.accounts WHERE code::text = v_code_credit LIMIT 1;
        IF v_credit_acc_id IS NULL THEN
            SELECT id INTO v_credit_acc_id FROM public.accounts WHERE name = exp.payment_account LIMIT 1;
        END IF;
        IF v_credit_acc_id IS NULL THEN
            RAISE EXCEPTION 'خطأ في الترحيل: لم يتم العثور على حساب الدائن (%) للمصروف: %', exp.payment_account, exp.description;
        END IF;

        -- 6. إنشاء رأس القيد
        INSERT INTO public.journal_headers (reference_id, entry_date, description, status, v_type)
        VALUES (exp.id, exp.exp_date::date, COALESCE(exp.description, 'قيد مصروف معتمد'), 'posted', 'expense')
        RETURNING id INTO v_header_id;

        -- 7. سطر المدين
        INSERT INTO public.journal_lines (header_id, account_id, debit, credit, partner_id)
        VALUES (v_header_id, v_debit_acc_id, v_total, 0, exp.payee_id);

        -- 8. سطر الدائن
        INSERT INTO public.journal_lines (header_id, account_id, debit, credit, partner_id)
        VALUES (v_header_id, v_credit_acc_id, 0, v_total, NULL);

        -- 9. تحديث حالة المصروف
        UPDATE public.expenses SET is_posted = true WHERE id = exp.id;

    END LOOP;
END;
$$;


--
-- Name: post_invoices_bulk(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_invoices_bulk(p_ids uuid[]) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_record RECORD;
    v_header_id UUID;
BEGIN
    FOR v_record IN
        SELECT * FROM invoices WHERE id = ANY(p_ids) AND status != 'معتمد'
    LOOP
        -- 1️⃣ إنشاء رأس القيد (Journal Header)
        INSERT INTO journal_headers (
            entry_date,
            description,
            reference_id,
            v_type,
            status
        ) VALUES (
            v_record.date,
            'ترحيل فاتورة مبيعات رقم: ' || v_record.invoice_number,
            v_record.id,
            'فاتورة مبيعات',
            'posted'
        ) RETURNING id INTO v_header_id;

        -- 2️⃣ سطر مديونية العميل (الصافي): نربط الـ partner_id هنا ✅
        INSERT INTO journal_lines (header_id, account_id, debit, credit, partner_id, notes)
        VALUES (
            v_header_id,
            v_record.debit_account_id,
            v_record.total_amount,
            0,
            v_record.partner_id,
            'استحقاق الفاتورة (صافي القيمة)'
        );

        -- 3️⃣ سطر محتجز ضمان الأعمال: نربط الـ partner_id هنا أيضاً ✅
        IF COALESCE(v_record.guarantee_amount, 0) > 0 THEN
            INSERT INTO journal_lines (header_id, account_id, debit, credit, partner_id, notes)
            VALUES (
                v_header_id,
                v_record.guarantee_acc_id,
                v_record.guarantee_amount,
                0,
                v_record.partner_id,
                'محتجز ضمان أعمال مسترد'
            );
        END IF;

        -- 4️⃣ سطر الإيرادات: نضع الـ partner_id بـ NULL لعدم الظهور في كشف حسابه ❌
        INSERT INTO journal_lines (header_id, account_id, debit, credit, partner_id, notes)
        VALUES (
            v_header_id,
            v_record.credit_account_id,
            0,
            v_record.taxable_amount,
            NULL, -- 🚀 تنظيف كشف حساب العميل
            'إيرادات مبيعات/مستخلصات'
        );

        -- 5️⃣ سطر الضريبة: نضع الـ partner_id بـ NULL لعدم الظهور في كشف حسابه ❌
        IF COALESCE(v_record.tax_amount, 0) > 0 THEN
            INSERT INTO journal_lines (header_id, account_id, debit, credit, partner_id, notes)
            VALUES (
                v_header_id,
                v_record.tax_acc_id,
                0,
                v_record.tax_amount,
                NULL, -- 🚀 تنظيف كشف حساب العميل
                'ضريبة قيمة مضافة مبيعات'
            );
        END IF;

        -- تحديث حالة الفاتورة
        UPDATE invoices SET status = 'معتمد' WHERE id = v_record.id;
    END LOOP;
END;
$$;


--
-- Name: post_labor_logs_bulk(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_labor_logs_bulk(p_ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_rec RECORD;
    v_header_id uuid;
    v_full_description TEXT;
    v_daily_wage NUMERIC;
    v_debit_acc uuid;
    v_credit_acc uuid;
BEGIN
    FOR v_rec IN
        SELECT * FROM public.labor_daily_logs
        WHERE id = ANY(p_ids) AND (is_posted = false OR is_posted IS NULL)
    LOOP
        v_daily_wage := COALESCE(v_rec.daily_wage, 0);

        v_debit_acc := COALESCE(v_rec.debit_account_id, '70d181ba-6385-4c1e-b0fc-d5b1f800dd2c'::uuid);
        v_credit_acc := COALESCE(v_rec.credit_account_id, '39f878cd-dc58-4a2a-a199-50f6fca983d4'::uuid);

        IF v_daily_wage > 0 THEN

            -- 🌟 بناء البيان المدمج (مع تحويل أي أرقام لنصوص لتجنب خطأ btrim)
            v_full_description := 'يومية عامل: ' || v_rec.worker_name;

            IF v_rec.site_ref IS NOT NULL AND TRIM(v_rec.site_ref::text) <> '' THEN
                v_full_description := v_full_description || ' - موقع: ' || v_rec.site_ref::text;
            END IF;

            IF v_rec.work_item IS NOT NULL AND TRIM(v_rec.work_item::text) <> '' THEN
                v_full_description := v_full_description || ' - بند: ' || v_rec.work_item::text;
            END IF;

            IF v_rec.tareeha IS NOT NULL AND TRIM(v_rec.tareeha::text) <> '' THEN
                v_full_description := v_full_description || ' - طريحة: ' || v_rec.tareeha::text;
            END IF;

            IF v_rec.productivity IS NOT NULL AND TRIM(v_rec.productivity::text) <> '' THEN
                v_full_description := v_full_description || ' - إنتاجية: ' || v_rec.productivity::text;
            END IF;

            IF v_rec.attendance_value IS NOT NULL THEN
                v_full_description := v_full_description || ' - حضور: ' || v_rec.attendance_value::text;
            END IF;

            -- 🚀 صمام الأمان: مسح القيود القديمة (لو فيه مسودة) عشان ميعملش دبلة
            DELETE FROM public.journal_lines WHERE header_id IN (SELECT id FROM public.journal_headers WHERE reference_id = v_rec.id AND v_type = 'labor_daily_logs');
            DELETE FROM public.journal_headers WHERE reference_id = v_rec.id AND v_type = 'labor_daily_logs';

            -- 1. إنشاء رأس القيد الجديد
            INSERT INTO public.journal_headers (reference_id, entry_date, description, v_type, status)
            VALUES (v_rec.id, v_rec.work_date, v_full_description, 'labor_daily_logs', 'posted')
            RETURNING id INTO v_header_id;

            -- 2. إثبات التكلفة (مدين)
            INSERT INTO public.journal_lines (header_id, account_id, debit, credit, partner_id, project_id, notes)
            VALUES (v_header_id, v_debit_acc, v_daily_wage, 0, NULL, v_rec.project_id, v_full_description);

            -- 3. إثبات الذمة (دائن)
            INSERT INTO public.journal_lines (header_id, account_id, debit, credit, partner_id, project_id, notes)
            VALUES (v_header_id, v_credit_acc, 0, v_daily_wage, v_rec.worker_partner_id, v_rec.project_id, v_full_description);

        END IF;

        -- تحديث حالة اليومية لتصبح مرحلة
        UPDATE public.labor_daily_logs SET is_posted = true WHERE id = v_rec.id;

    END LOOP;

    -- تنشيط الكاش عشان الواجهة تحس بالتغيير وتختفي الـ 404
    PERFORM pg_notify('pgrst', 'reload schema');
END;
$$;


--
-- Name: post_manual_journals_bulk(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_manual_journals_bulk(p_ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_id UUID;
    v_header_id UUID;
    v_journal RECORD;
BEGIN
    FOREACH v_id IN ARRAY p_ids
    LOOP
        SELECT * INTO v_journal
        FROM public.manual_journals
        WHERE id = v_id AND is_posted = false;

        IF FOUND THEN
            INSERT INTO public.journal_headers (
                reference_id,
                entry_date,
                description,
                status,
                v_type,
                job_order_id
            ) VALUES (
                v_journal.id,
                v_journal.entry_date,
                v_journal.description,
                'مرحل',
                'manual_journals',
                v_journal.job_order_id
            ) RETURNING id INTO v_header_id;

            INSERT INTO public.journal_lines (
                header_id, account_id, debit, credit, partner_id, project_id, notes
            ) VALUES (
                v_header_id, v_journal.debit_account_id, v_journal.amount, 0,
                v_journal.partner_id, v_journal.project_id, v_journal.description
            );

            INSERT INTO public.journal_lines (
                header_id, account_id, debit, credit, partner_id, project_id, notes
            ) VALUES (
                v_header_id, v_journal.credit_account_id, 0, v_journal.amount,
                v_journal.partner_id, v_journal.project_id, v_journal.description
            );

            UPDATE public.manual_journals
            SET is_posted = true, status = 'معتمد'
            WHERE id = v_id;
        END IF;
    END LOOP;
END;
$$;


--
-- Name: post_payment_vouchers_bulk(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_payment_vouchers_bulk(p_ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_rec RECORD;
    v_header_id uuid;
    v_full_description TEXT;
BEGIN
    FOR v_rec IN
        SELECT * FROM public.payment_vouchers
        WHERE id = ANY(p_ids) AND (is_posted = false OR is_posted IS NULL)
    LOOP

        -- 1️⃣ بناء البيان المدمج: (رقم السند + رقم الفاتورة/المرجع + بيان السند)
        v_full_description := 'سند صرف رقم: ' || v_rec.voucher_number;

        -- استخدام reference_no (والذي يمثل رقم فاتورة المورد أو المرجع)
        IF v_rec.reference_no IS NOT NULL AND TRIM(v_rec.reference_no) <> '' THEN
            v_full_description := v_full_description || ' - فاتورة/مرجع: ' || v_rec.reference_no;
        END IF;

        -- إضافة وصف السند الأصلي
        IF v_rec.description IS NOT NULL AND TRIM(v_rec.description) <> '' THEN
            v_full_description := v_full_description || ' - بيان: ' || v_rec.description;
        END IF;

        -- 2️⃣ إنشاء رأس القيد بالبيان الجديد المدمج
        INSERT INTO public.journal_headers (reference_id, entry_date, description, v_type, status)
        VALUES (v_rec.id, v_rec.date, v_full_description, 'payment_vouchers', 'posted')
        RETURNING id INTO v_header_id;

        -- 3️⃣ سطر المدين (المستفيد): بياخد الـ partner_id والبيان الجديد
        INSERT INTO public.journal_lines (header_id, account_id, partner_id, debit, credit, notes)
        VALUES (v_header_id, v_rec.debit_account_id, v_rec.partner_id, v_rec.amount, 0, v_full_description);

        -- 4️⃣ سطر الدائن (الخزنة/البنك): الـ partner_id يكون NULL والبيان الجديد
        INSERT INTO public.journal_lines (header_id, account_id, partner_id, debit, credit, notes)
        VALUES (v_header_id, v_rec.credit_account_id, NULL, 0, v_rec.amount, v_full_description);

        -- 5️⃣ تحديث حالة السند لمرحل
        UPDATE public.payment_vouchers SET is_posted = true, status = 'معتمد' WHERE id = v_rec.id;

    END LOOP;
END;
$$;


--
-- Name: post_receipt_vouchers_bulk(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_receipt_vouchers_bulk(p_ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_record RECORD;
    v_header_id UUID;
BEGIN
    FOR v_record IN
        SELECT * FROM receipt_vouchers WHERE id = ANY(p_ids) AND status = 'مسودة'
    FOR UPDATE
    LOOP
        -- إنشاء رأس القيد (Journal Header)
        INSERT INTO journal_headers (
            date,
            description,
            reference_id,
            source_module
        ) VALUES (
            v_record.date,
            COALESCE(v_record.notes, 'سند قبض رقم ' || v_record.receipt_number),
            v_record.id,
            'receipt_vouchers'
        ) RETURNING id INTO v_header_id;

        -- السطر المدين (الخزينة/البنك - safe_bank_acc_id)
        INSERT INTO journal_lines (
            header_id,
            account_id,
            debit,
            credit,
            partner_id
        ) VALUES (
            v_header_id,
            v_record.safe_bank_acc_id,
            v_record.amount,
            0,
            v_record.partner_id
        );

        -- السطر الدائن (العميل/الجهة - partner_acc_id)
        INSERT INTO journal_lines (
            header_id,
            account_id,
            debit,
            credit,
            partner_id
        ) VALUES (
            v_header_id,
            v_record.partner_acc_id,
            0,
            v_record.amount,
            v_record.partner_id
        );

        -- تحديث حالة السند
        UPDATE receipt_vouchers
        SET status = 'معتمد'
        WHERE id = v_record.id;
    END LOOP;
END;
$$;


--
-- Name: post_receipts_bulk(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_receipts_bulk(p_ids uuid[]) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_record RECORD;
    v_header_id UUID;
BEGIN
    FOR v_record IN
        SELECT * FROM receipt_vouchers WHERE id = ANY(p_ids) AND status != 'معتمد'
    LOOP
        INSERT INTO journal_headers (entry_date, description, reference_id, v_type, status)
        VALUES (v_record.date, 'سند قبض رقم: ' || v_record.receipt_number, v_record.id, 'سند قبض', 'posted')
        RETURNING id INTO v_header_id;

        -- المدين: الصندوق (لا يرتبط بالعميل NULL)
        INSERT INTO journal_lines (header_id, account_id, debit, credit, partner_id, notes)
        VALUES (v_header_id, v_record.safe_bank_acc_id, v_record.amount, 0, NULL, 'تحصيل نقدية');

        -- الدائن: حساب العميل (يرتبط بالعميل لخفيض مديونيته)
        INSERT INTO journal_lines (header_id, account_id, debit, credit, partner_id, notes)
        VALUES (v_header_id, v_record.partner_acc_id, 0, v_record.amount, v_record.partner_id, 'سداد من الحساب');

        UPDATE receipt_vouchers SET status = 'معتمد' WHERE id = v_record.id;
    END LOOP;
END;
$$;


--
-- Name: post_sub_claim(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_sub_claim(p_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_rec RECORD;
    v_jv_id UUID;
    v_contractor_earnings NUMERIC;
    v_project_account UUID;
    v_contractor_account UUID;
    v_retention_account UUID;
BEGIN
    SELECT sc.*, p.name as contractor_name
    FROM public.sub_claims sc
    JOIN public.partners p ON sc.contractor_id = p.id
    WHERE sc.id = p_id INTO v_rec;

    IF v_rec.id IS NULL THEN RAISE EXCEPTION 'خطأ: المستخلص غير موجود في النظام!'; END IF;
    IF v_rec.is_posted THEN RAISE EXCEPTION 'تنبيه: هذا المستخلص مرحل مسبقاً!'; END IF;

    -- ديناميكياً بدلاً من UUID
    SELECT id INTO v_project_account FROM public.accounts WHERE code = '513' LIMIT 1;
    SELECT id INTO v_contractor_account FROM public.accounts WHERE code = '212' LIMIT 1;
    SELECT id INTO v_retention_account FROM public.accounts WHERE code = '213' LIMIT 1;

    IF v_project_account IS NULL THEN RAISE EXCEPTION 'حساب تكاليف مقاولين (513) غير موجود'; END IF;
    IF v_contractor_account IS NULL THEN RAISE EXCEPTION 'حساب مقاولي باطن (212) غير موجود'; END IF;

    v_contractor_earnings := COALESCE(v_rec.total_amount, 0) - COALESCE(v_rec.retention_amount, 0);

    INSERT INTO public.journal_headers (entry_date, description, status, v_type, reference_id)
    VALUES (
        v_rec.date,
        'مستخلص أعمال رقم: ' || COALESCE(v_rec.claim_number, '') || ' - المقاول: ' || v_rec.contractor_name,
        'posted', 'مستخلص', v_rec.id
    ) RETURNING id INTO v_jv_id;

    IF COALESCE(v_rec.total_amount, 0) > 0 THEN
        INSERT INTO public.journal_lines (header_id, account_id, partner_id, project_id, debit, credit, notes)
        VALUES (v_jv_id, v_project_account, NULL, v_rec.project_id, v_rec.total_amount, 0, 'إجمالي تكلفة أعمال منفذة - مستخلص ' || v_rec.claim_number);
    END IF;

    IF COALESCE(v_rec.retention_amount, 0) > 0 THEN
        IF v_retention_account IS NULL THEN RAISE EXCEPTION 'حساب تأمينات محتجزة (213) غير موجود'; END IF;
        INSERT INTO public.journal_lines (header_id, account_id, partner_id, project_id, debit, credit, notes)
        VALUES (v_jv_id, v_retention_account, NULL, v_rec.project_id, 0, v_rec.retention_amount, 'حجز ضمان أعمال - مستخلص ' || v_rec.claim_number);
    END IF;

    IF v_contractor_earnings > 0 THEN
        INSERT INTO public.journal_lines (header_id, account_id, partner_id, project_id, debit, credit, notes)
        VALUES (v_jv_id, v_contractor_account, v_rec.contractor_id, v_rec.project_id, 0, v_contractor_earnings, 'استحقاق أعمال - مستخلص ' || v_rec.claim_number);
    ELSIF v_contractor_earnings < 0 THEN
        INSERT INTO public.journal_lines (header_id, account_id, partner_id, project_id, debit, credit, notes)
        VALUES (v_jv_id, v_contractor_account, v_rec.contractor_id, v_rec.project_id, ABS(v_contractor_earnings), 0, 'تسوية عكسية لأعمال سالبة - مستخلص ' || v_rec.claim_number);
    END IF;

    UPDATE public.sub_claims
    SET is_posted = true, status = 'معتمد', jv_header_id = v_jv_id, jv_id = v_jv_id
    WHERE id = p_id;
END;
$$;


--
-- Name: post_sub_claim_to_journal(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_sub_claim_to_journal(claim_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$DECLARE
    v_rec RECORD;
    v_jv_id uuid;
    v_project_account uuid := '70d181ba-6385-4c1e-b0fc-d5b1f800dd2c'; -- حساب تكاليف المشاريع
    v_contractor_account uuid := '39f878cd-dc58-4a2a-a199-50f6fca983d4'; -- حساب الموردين/المقاولين
    v_retention_account uuid := 'حط_هنا_اي_دي_حساب_محتجز_الضمان';
BEGIN
    -- 1. جلب بيانات المستخلص بالكامل مع اسم المقاول
    SELECT sc.*, p.name as contractor_name
    FROM public.sub_claims sc
    JOIN public.partners p ON sc.contractor_id = p.id
    WHERE sc.id = claim_id INTO v_rec;

    IF v_rec.is_posted THEN RAISE EXCEPTION 'هذا المستخلص مرحل بالفعل!'; END IF;

    -- 2. إنشاء رأس القيد
    INSERT INTO public.journal_headers (
        entry_date, description, status, v_type, reference_id
    ) VALUES (
        v_rec.date,
        'مستخلص أعمال رقم: ' || COALESCE(v_rec.claim_number, '') || ' - المقاول: ' || v_rec.contractor_name,
        'posted',
        'invoices',
        v_rec.id
    ) RETURNING id INTO v_jv_id;

    -- 3. السطر المدين (إجمالي الأعمال): 🚫 تم وضع NULL لمنع ظهوره في كشف حساب المقاول
    INSERT INTO public.journal_lines (
        header_id, account_id, partner_id, project_id, debit, credit, notes
    ) VALUES (
        v_jv_id, v_project_account, NULL, v_rec.project_id,
        v_rec.total_amount, 0, 'إثبات قيمة الأعمال المنفذة بمستخلص ' || v_rec.claim_number
    );

    -- 4. السطر الدائن (صافي ذمة المقاول): ✅ هنا فقط يتم رمي آيدي المقاول ليظهر كاستحقاق في كشف حسابه
    INSERT INTO public.journal_lines (
        header_id, account_id, partner_id, project_id, debit, credit, notes
    ) VALUES (
        v_jv_id, v_contractor_account, v_rec.contractor_id, v_rec.project_id,
        0, v_rec.net_amount, 'الصافي المستحق للمقاول بموجب المستخلص'
    );

    -- 5. السطر الدائن (محتجز الضمان): 🚫 تم وضع NULL لمنع التداخل مع حساب المقاول المباشر
    IF v_rec.retention_amount > 0 THEN
        INSERT INTO public.journal_lines (
            header_id, account_id, partner_id, project_id, debit, credit, notes
        ) VALUES (
            v_jv_id, v_retention_account, NULL, v_rec.project_id,
            0, v_rec.retention_amount, 'حجز ضمان أعمال من مستخلص ' || v_rec.claim_number
        );
    END IF;

    -- 6. تحديث حالة المستخلص وربطه بالقيد
    UPDATE public.sub_claims
    SET is_posted = true,
        status = 'معتمد',
        jv_header_id = v_jv_id
    WHERE id = claim_id;

END;$$;


--
-- Name: post_violations_bulk(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_violations_bulk(p_ids uuid[]) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_rec RECORD;
    v_header_id uuid;
    v_full_description TEXT;

    -- الحسابات الثابتة الافتراضية
    v_fixed_debit_acc UUID := '39f878cd-dc58-4a2a-a199-50f6fca983d4';  -- رواتب وأجور مستحقة (المدين دائماً)
    v_fixed_credit_acc UUID := '25998af5-dca4-4512-8f1a-3d0f9c6b8e98'; -- إيراد خصومات وجزاءات (الدائن الافتراضي)

    -- متغيرات للحسابات الديناميكية
    v_housing_recovery_acc UUID;
    v_actual_credit_acc UUID;
BEGIN
    -- 🔍 محاولة جلب الآي دي الخاص بحساب استرداد السكن من شجرة الحسابات تلقائياً
    SELECT id INTO v_housing_recovery_acc
    FROM public.accounts
    WHERE name LIKE '%استرداد مصروفات السكن%' OR name LIKE '%استرداد سكن%'
    LIMIT 1;

    FOR v_rec IN
        SELECT * FROM public.violations
        WHERE id = ANY(p_ids) AND (is_posted = false OR is_posted IS NULL)
    LOOP
        IF COALESCE(v_rec.amount, 0) > 0 THEN

            -- بناء البيان
            v_full_description := 'جزاء/استقطاع على: ' || COALESCE(v_rec.emp_name, 'موظف') ||
                                  ' - ' || COALESCE(v_rec.reason, 'خصم إداري');

            -- 🎯 توجيه الطرف الدائن (حساب الشركة) بذكاء
            IF v_rec.reason LIKE '%سكن%' AND v_housing_recovery_acc IS NOT NULL THEN
                v_actual_credit_acc := v_housing_recovery_acc;
            ELSE
                v_actual_credit_acc := v_fixed_credit_acc;
            END IF;

            -- 1. إنشاء رأس القيد
            INSERT INTO public.journal_headers (reference_id, entry_date, description, v_type, status)
            VALUES (v_rec.id, v_rec.date, v_full_description, 'violations', 'posted')
            RETURNING id INTO v_header_id;

            -- 2. الجانب المدين (رواتب وأجور مستحقة - ذمة الموظف)
            -- 🟢 هنا بنرمي آي دي البارتنر عشان يسمع في كشف حسابه
            INSERT INTO public.journal_lines (header_id, account_id, debit, credit, partner_id, project_id, notes)
            VALUES (v_header_id, v_fixed_debit_acc, v_rec.amount, 0, v_rec.partner_id, v_rec.project_id, v_full_description);

            -- 3. الجانب الدائن (استرداد سكن أو إيراد جزاءات - ذمة الشركة)
            -- 🔴 هنا خلينا الـ partner_id بـ NULL عشان ذمة الشركة تبقى فاضية
            INSERT INTO public.journal_lines (header_id, account_id, debit, credit, partner_id, project_id, notes)
            VALUES (v_header_id, v_actual_credit_acc, 0, v_rec.amount, NULL, v_rec.project_id, v_full_description);

            -- 4. تحديث حالة السجل إلى مرحل
            UPDATE public.violations SET
                is_posted = true,
                debit_account_id = v_fixed_debit_acc,
                credit_account_id = v_actual_credit_acc
            WHERE id = v_rec.id;

        END IF;
    END LOOP;
END;
$$;


--
-- Name: post_violations_bulk_journal(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_violations_bulk_journal(violation_ids uuid[]) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_id uuid;
    v_rec record;
    v_header_id uuid;
    v_housing_recovery_acc UUID;
    v_actual_credit_acc UUID;
    v_full_description TEXT;
BEGIN
    -- جلب حساب استرداد السكن تلقائياً
    SELECT id INTO v_housing_recovery_acc
    FROM public.accounts
    WHERE name LIKE '%استرداد مصروفات السكن%' OR name LIKE '%استرداد سكن%'
    LIMIT 1;

    FOREACH v_id IN ARRAY violation_ids
    LOOP
        SELECT * INTO v_rec FROM public.violations WHERE id = v_id AND is_posted = false;

        IF FOUND THEN
            -- توجيه الطرف الدائن
            IF v_rec.reason LIKE '%سكن%' AND v_housing_recovery_acc IS NOT NULL THEN
                v_actual_credit_acc := v_housing_recovery_acc;
            ELSE
                v_actual_credit_acc := v_rec.credit_account_id;
            END IF;

            -- بناء البيان التفصيلي
            v_full_description := 'استقطاع/جزاء: ' || COALESCE(v_rec.emp_name, 'موظف') ||
                                  ' - ' || COALESCE(v_rec.reason, 'بدون تفاصيل');

            -- 1. إنشاء رأس القيد (تم تصحيح الحالة هنا لتكون posted)
            INSERT INTO public.journal_headers (entry_date, description, reference_id, v_type, status)
            VALUES (
                v_rec.date,
                v_full_description,
                v_rec.id,
                'مخالفة',
                'posted' -- 🚀 تم التصحيح هنا لكي يقرأها ميزان المراجعة!
            ) RETURNING id INTO v_header_id;

            -- 2. إنشاء سطر المدين
            IF v_rec.debit_account_id IS NOT NULL THEN
                INSERT INTO public.journal_lines (header_id, account_id, debit, credit, notes, partner_id, project_id)
                VALUES (v_header_id, v_rec.debit_account_id, COALESCE(v_rec.amount, 0), 0, v_full_description, v_rec.partner_id, v_rec.project_id);
            END IF;

            -- 3. إنشاء سطر الدائن
            IF v_actual_credit_acc IS NOT NULL THEN
                INSERT INTO public.journal_lines (header_id, account_id, debit, credit, notes, partner_id, project_id)
                VALUES (v_header_id, v_actual_credit_acc, 0, COALESCE(v_rec.amount, 0), v_full_description, NULL, v_rec.project_id);
            END IF;

            -- 4. التحديث كـ مرحل
            UPDATE public.violations SET
                is_posted = true,
                credit_account_id = v_actual_credit_acc
            WHERE id = v_id;
        END IF;
    END LOOP;
END;
$$;


--
-- Name: post_violations_bulk_v3(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_violations_bulk_v3(violation_ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_rec RECORD;
BEGIN
    -- اللف على المخالفات المحددة وغير المرحلة
    FOR v_rec IN
        SELECT * FROM public.violations WHERE id = ANY(violation_ids) AND is_posted = false
    LOOP
        -- 🚀 توليد سند صرف/تسوية (يؤثر على ذمة البارتنر)
        INSERT INTO public.payment_vouchers (
            voucher_number,
            date,
            amount,
            partner_id,          -- 🎯 رمي المعرف في سطر الذمة
            debit_account_id,    -- الحساب المدين من المخالفة
            credit_account_id,   -- الحساب الدائن من المخالفة
            description,
            is_posted,
            status,
            related_violation_id -- المرجع للربط التسلسلي
        ) VALUES (
            'PV-VIOL-' || to_char(now(), 'YYMMDD') || '-' || substr(v_rec.id::text, 1, 4),
            v_rec.date,
            v_rec.amount,
            v_rec.partner_id,    -- ربط البارتنر بالسند
            v_rec.debit_account_id,
            v_rec.credit_account_id,
            'جزاء مخالفة: ' || COALESCE(v_rec.reason, v_rec.emp_name),
            true,               -- ترحيل تلقائي
            'معتمد',
            v_rec.id
        );

        -- تحديث المخالفة إنها اتمرحلت
        UPDATE public.violations SET is_posted = true WHERE id = v_rec.id;
    END LOOP;
END;
$$;


--
-- Name: protect_journal_headers(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_journal_headers() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- 🛑 منع تعديل القيود المرحلة
    IF TG_OP = 'UPDATE' THEN
        IF OLD.status IN ('مرحل', 'معتمد') THEN
            -- السماح للمستخدم بتغيير الحالة فقط إلى (مسودة) أو (ملغي) في حالة فك الترحيل
            -- مع منع تغيير أي بيانات جوهرية أخرى
            IF NEW.status NOT IN ('مرحل', 'معتمد') THEN
                IF NEW.entry_date != OLD.entry_date OR NEW.description != OLD.description THEN
                     RAISE EXCEPTION 'مرفوض: يجب فك الترحيل أولاً لتعديل البيانات الأساسية.';
                END IF;
                RETURN NEW;
            END IF;

            -- إذا حاول التعديل مع إبقاء الحالة "مرحل"
            IF NEW.description != OLD.description OR NEW.entry_date != OLD.entry_date OR NEW.reference_id != OLD.reference_id THEN
                RAISE EXCEPTION 'مرفوض: لا يمكن تعديل قيد حالته % (يرجى فك الترحيل أولاً)', OLD.status;
            END IF;
        END IF;
        RETURN NEW;
    END IF;

    -- تم السماح بعملية الـ DELETE من قاعدة البيانات لتسمح لنظام (فك الترحيل) بحذف القيد تلقائياً.
    -- (تم حظر الحذف اليدوي من شاشة الواجهة بشكل منفصل لعدم التلاعب).
    RETURN OLD;
END;
$$;


--
-- Name: protect_journal_lines(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_journal_lines() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_status VARCHAR;
BEGIN
    -- جلب حالة القيد
    SELECT status INTO v_status FROM journal_headers WHERE id = NEW.header_id;

    IF v_status IN ('مرحل', 'معتمد') THEN
        IF TG_OP = 'UPDATE' THEN
            RAISE EXCEPTION 'مرفوض: لا يمكن تعديل مبالغ أو حسابات لسطر في قيد مرحل';
        ELSIF TG_OP = 'INSERT' THEN
            RAISE EXCEPTION 'مرفوض: لا يمكن إضافة سطر جديد لقيد مرحل';
        END IF;
    END IF;

    -- تم تجاوز عملية DELETE هنا أيضاً للسماح بالـ CASCADE عندما يقوم النظام بمسح الرأس أثناء فك الترحيل
    RETURN NEW;
END;
$$;


--
-- Name: pull_payroll_module_data(integer, integer, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pull_payroll_module_data(p_month integer, p_year integer, p_cutoff_date date DEFAULT CURRENT_DATE) RETURNS TABLE(partner_id uuid, days_worked numeric, total_earned_wage numeric, total_violations numeric, total_payments numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: rpc_delete_claim(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rpc_delete_claim(p_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: rpc_delete_invoices(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rpc_delete_invoices(p_ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- 1. مسح قيود اليومية المرتبطة بالفواتير أولاً لتفادي مشاكل الربط (Foreign Keys)
    DELETE FROM journal_headers
    WHERE reference_id = ANY(p_ids);

    -- 2. مسح الفواتير نفسها
    DELETE FROM invoices
    WHERE id = ANY(p_ids);
END;
$$;


--
-- Name: rpc_delete_material_issue(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rpc_delete_material_issue(p_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- 1. فك الترحيل أولاً (لمسح القيود المحاسبية وتجنب أخطاء الدفاتر)
  PERFORM public.rpc_unpost_material_issue(p_id);

  -- 2. مسح إذن الصرف (سيتم مسح الأسطر التابعة له تلقائياً بسبب CASCADE)
  DELETE FROM public.material_issues WHERE id = p_id;
END;
$$;


--
-- Name: rpc_delete_material_receipt(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rpc_delete_material_receipt(p_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM public.rpc_unpost_material(p_id);
  DELETE FROM public.material_receipts WHERE id = p_id;
END;
$$;


--
-- Name: rpc_get_inventory_balances(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rpc_get_inventory_balances() RETURNS TABLE(item_id uuid, item_name text, available_quantity numeric, last_price numeric, unit text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        v.item_id::uuid,
        v.item_name::text,
        COALESCE(v.available_quantity, 0)::numeric,
        COALESCE(v.last_price, 0)::numeric,
        v.unit::text
    FROM public.vw_inventory_balances_v2 v;
END;
$$;


--
-- Name: rpc_lock_invoice_deductions(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rpc_lock_invoice_deductions(p_invoice_id uuid, p_sub_id uuid, p_proj_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- 1. قفل الخامات (للمشروع المحدد فقط)
    UPDATE material_issues
    SET claim_id = p_invoice_id
    WHERE subcontractor_id = p_sub_id
      AND project_id = p_proj_id
      AND is_posted = true
      AND claim_id IS NULL;

    -- 2. قفل المصروفات (المطابقة للمشروع + المصروفات العامة بدون مشروع)
    UPDATE expenses
    SET claim_id = p_invoice_id
    WHERE payee_id = p_sub_id
      AND (project_id = p_proj_id OR project_id IS NULL)
      AND is_posted = true
      AND is_deducted_from_contractor = true
      AND claim_id IS NULL;
END;
$$;


--
-- Name: rpc_post_claim(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rpc_post_claim(p_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$DECLARE
  v_claim RECORD;
  v_jv_id UUID;
  v_total_deductions NUMERIC;
BEGIN
  SELECT * INTO v_claim FROM sub_claims WHERE id = p_id;
  IF v_claim.is_posted THEN RETURN; END IF;

  -- 1. إنشاء رأس القيد (وربطه بالمستخلص)
  INSERT INTO journal_headers (entry_date, description, status, v_type, reference_id)
  VALUES (v_claim.date, 'إثبات مستخلص مقاول باطن رقم: ' || v_claim.claim_number, 'posted', 'invoices', p_id)
  RETURNING id INTO v_jv_id;

  -- 2. المدين (حساب التكاليف 513)
  -- 🚫 تم وضع NULL لمنع ظهوره في كشف الحساب
  INSERT INTO journal_lines (header_id, account_id, partner_id, project_id, debit, credit, notes)
  VALUES (v_jv_id, 'da2d6fcd-ef45-41f4-a8d1-a498b6954002', NULL, v_claim.project_id, v_claim.total_amount, 0, 'قيمة أعمال منفذة مستخلص ' || v_claim.claim_number);

  -- 3. الدائن (التزام المقاول 212)
  -- ✅ هنا فقط يتم رمي آيدي المقاول ليظهر كاستحقاق في كشف حسابه (الصافي)
  INSERT INTO journal_lines (header_id, account_id, partner_id, project_id, debit, credit, notes)
  VALUES (v_jv_id, '27f37adf-c0ec-4b40-80d0-2b36b853fd4b', v_claim.contractor_id, v_claim.project_id, 0, v_claim.net_amount, 'الصافي المستحق للصرف بموجب مستخلص ' || v_claim.claim_number);

  -- 4. محتجز الضمان
  -- 🚫 تم وضع NULL لمنع التداخل مع حساب المقاول الجاري
  IF v_claim.retention_amount > 0 THEN
    INSERT INTO journal_lines (header_id, account_id, partner_id, project_id, debit, credit, notes)
    VALUES (v_jv_id, '1e370e5b-4357-41a4-9271-7c98f9864205', NULL, v_claim.project_id, 0, v_claim.retention_amount, 'حجز ضمان أعمال مستخلص ' || v_claim.claim_number);
  END IF;

  -- 5. تسوية الاستقطاعات
  -- 🚫 تم وضع NULL لمنع تضخم كشف الحساب بالخصومات
  v_total_deductions := v_claim.total_amount - v_claim.net_amount - v_claim.retention_amount;
  IF v_total_deductions > 0 THEN
    INSERT INTO journal_lines (header_id, account_id, partner_id, project_id, debit, credit, notes)
    VALUES (v_jv_id, '27f37adf-c0ec-4b40-80d0-2b36b853fd4b', NULL, v_claim.project_id, 0, v_total_deductions, 'تسوية استقطاعات (دفعات مقدمة / خامات)');
  END IF;

  -- 6. تحديث حالة المستخلص
  UPDATE sub_claims
  SET is_posted = true, status = 'معتمد', jv_id = v_jv_id
  WHERE id = p_id;
END;$$;


--
-- Name: rpc_post_invoices(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rpc_post_invoices(p_ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_record RECORD;
    v_header_id UUID;
BEGIN
    FOR v_record IN
        SELECT * FROM invoices WHERE id = ANY(p_ids) AND status != 'معتمد'
    LOOP
        -- 1️⃣ إنشاء رأس القيد (Journal Header)
        INSERT INTO journal_headers (
            entry_date,
            description,
            reference_id,
            v_type,
            status
        ) VALUES (
            v_record.date,
            'ترحيل فاتورة مبيعات رقم: ' || v_record.invoice_number,
            v_record.id,
            'فاتورة مبيعات',
            'posted'
        ) RETURNING id INTO v_header_id;

        -- 2️⃣ سطر مديونية العميل بالصافي المستحق
        INSERT INTO journal_lines (header_id, account_id, debit, credit, partner_id, notes)
        VALUES (
            v_header_id,
            v_record.debit_account_id,
            v_record.total_amount,
            0,
            v_record.partner_id,
            'استحقاق الفاتورة (صافي القيمة)'
        );

        -- 3️⃣ سطر محتجز ضمان الأعمال
        IF COALESCE(v_record.guarantee_amount, 0) > 0 THEN
            INSERT INTO journal_lines (header_id, account_id, debit, credit, partner_id, notes)
            VALUES (
                v_header_id,
                v_record.guarantee_acc_id,
                v_record.guarantee_amount,
                0,
                v_record.partner_id,
                'محتجز ضمان أعمال مسترد'
            );
        END IF;

        -- 4️⃣ سطر خصم المواد 🚀
        IF COALESCE(v_record.materials_discount, 0) > 0 THEN
            INSERT INTO journal_lines (header_id, account_id, debit, credit, partner_id, notes)
            VALUES (
                v_header_id,
                v_record.materials_acc_id,
                v_record.materials_discount,
                0,
                NULL,
                'خصم مواد من الفاتورة'
            );
        END IF;

        -- 5️⃣ سطر الإيرادات بإجمالي الأعمال قبل خصم المواد 🚀
        INSERT INTO journal_lines (header_id, account_id, debit, credit, partner_id, notes)
        VALUES (
            v_header_id,
            v_record.credit_account_id,
            0,
            (v_record.taxable_amount + COALESCE(v_record.materials_discount, 0)),
            NULL,
            'إيرادات مبيعات/مستخلصات'
        );

        -- 6️⃣ سطر الضريبة
        IF COALESCE(v_record.tax_amount, 0) > 0 THEN
            INSERT INTO journal_lines (header_id, account_id, debit, credit, partner_id, notes)
            VALUES (
                v_header_id,
                v_record.tax_acc_id,
                0,
                v_record.tax_amount,
                NULL,
                'ضريبة قيمة مضافة مبيعات'
            );
        END IF;

        -- تحديث حالة الفاتورة
        UPDATE invoices SET status = 'معتمد' WHERE id = v_record.id;
    END LOOP;
END;
$$;


--
-- Name: rpc_post_material(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rpc_post_material(p_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_receipt RECORD;
  v_jv_id uuid;

  -- الحسابات الثابتة (تأكد من صحة الآيديهات في قاعدة بياناتك)
  v_inventory_acc uuid := 'c5efa035-c8d5-4d13-bf33-7c7cd854f393'; -- [المدين]: مخزون الخامات
  v_client_inventory_acc uuid := '85e61a6a-8c85-4219-a733-3b2180dfe043'; -- [الدائن]: المورد
BEGIN
  -- جلب بيانات السند
  SELECT * INTO v_receipt FROM public.material_receipts WHERE id = p_id;

  IF v_receipt.is_posted THEN
    RAISE EXCEPTION 'هذا السند مرحل محاسبياً بالفعل!';
  END IF;

  -- إنشاء رأس القيد
  INSERT INTO public.journal_headers (
    entry_date,
    reference_id,
    description,
    status,
    v_type,
    created_at
  ) VALUES (
    v_receipt.receipt_date, -- 🚀 متوافق مع السكيما
    v_receipt.id,
    'إثبات توريد خامات - فاتورة رقم: ' || v_receipt.receipt_number, -- 🚀 متوافق مع السكيما
    'posted',
    'inventory',
    now()
  ) RETURNING id INTO v_jv_id;

  -- [Debit] الطرف المدين: المخزون
  INSERT INTO public.journal_lines (
    header_id, account_id, project_id, partner_id, debit, credit, notes
  ) VALUES (
    v_jv_id, v_inventory_acc, v_receipt.project_id, NULL,
    v_receipt.total_amount, -- 🚀 متوافق مع السكيما
    0, 'دخول خامات للمخزن - فاتورة: ' || v_receipt.receipt_number
  );

  -- [Credit] الطرف الدائن: المورد
  INSERT INTO public.journal_lines (
    header_id, account_id, project_id, partner_id, debit, credit, notes
  ) VALUES (
    v_jv_id, v_client_inventory_acc, v_receipt.project_id, v_receipt.supplier_id,
    0, v_receipt.total_amount, -- 🚀 متوافق مع السكيما
    'استحقاق توريد خامات للمشروع - فاتورة: ' || v_receipt.receipt_number
  );

  -- تحديث حالة السند وربطه بالقيد
  UPDATE public.material_receipts
  SET is_posted = true, jv_id = v_jv_id
  WHERE id = p_id;
END;
$$;


--
-- Name: rpc_post_material_claim(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rpc_post_material_claim(p_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_rec RECORD;
    v_jv_id UUID;

    -- 🚀 الحسابات المعتمدة بالـ UUIDs المطابقة لشجرة حسابات شركتك الحقيقية بالمللي
    v_project_account     UUID := 'da2d6fcd-ef45-41f4-a8d1-a498b6954002'; -- كود 513: تكاليف مقاولين باطن
    v_contractor_account  UUID := '27f37adf-c0ec-4b40-80d0-2b36b853fd4b'; -- كود 212: التزام مقاولي الباطن (المقاول الجاري)
    v_retention_account   UUID := '1e370e5b-4357-41a4-9271-7c98f9864205'; -- كود 213: تأمينات محتجزة لمقاولي الباطن (الضمان)
    v_advance_account     UUID := '39f878cd-dc58-4a2a-a199-50f6fca983d4'; -- كود 216: سلف مقاولين
    v_other_deduct_acc    UUID := '25998af5-dca4-4512-8f1a-3d0f9c6b8e98'; -- كود 46: إيراد خصومات وجزاءات

    -- 📦 حساب المخزون الحقيقي من ملف الـ SQL الخاص بك
    v_materials_inventory UUID := 'c5efa035-c8d5-4d13-bf33-7c7cd854f393'; -- كود 126: مخزون الخامات والمواد (الذي يجب أن ينزل)
BEGIN
    -- 1. جلب بيانات المستخلص بالكامل من الجدول
    SELECT sc.*, p.name as contractor_name
    FROM public.sub_claims sc
    JOIN public.partners p ON sc.contractor_id = p.id
    WHERE sc.id = p_id INTO v_rec;

    IF v_rec.id IS NULL THEN
        RAISE EXCEPTION 'خطأ: المستخلص غير موجود في النظام!';
    END IF;

    IF v_rec.is_posted THEN
        RAISE EXCEPTION 'تنبيه: هذا المستخلص مرحل مسبقاً!';
    END IF;

    -- 2. إنشاء رأس القيد في الجورنال
    INSERT INTO public.journal_headers (entry_date, description, status, v_type, reference_id)
    VALUES (
        v_rec.date,
        'مستخلص أعمال رقم: ' || COALESCE(v_rec.claim_number, '') || ' - المقاول: ' || v_rec.contractor_name,
        'posted',
        'مستخلص',
        v_rec.id
    ) RETURNING id INTO v_jv_id;

    -- 3. [الطرف المدين] إثبات قيمة التكلفة الكاملة للأعمال (حساب التكاليف 513)
    INSERT INTO public.journal_lines (header_id, account_id, partner_id, project_id, debit, credit, notes)
    VALUES (v_jv_id, v_project_account, NULL, v_rec.project_id, COALESCE(v_rec.total_amount, 0), 0, 'قيمة أعمال منفذة مستخلص ' || v_rec.claim_number);

    -- 4. [الطرف الدائن] الصافي المستحق الفعلي للمقاول كاش (نأخذه جاهزاً من الجدول دون تعديل لحماية الحسبة)
    IF COALESCE(v_rec.net_amount, 0) > 0 THEN
        INSERT INTO public.journal_lines (header_id, account_id, partner_id, project_id, debit, credit, notes)
        VALUES (v_jv_id, v_contractor_account, v_rec.contractor_id, v_rec.project_id, 0, v_rec.net_amount, 'الصافي المستحق للمقاول مستخلص ' || v_rec.claim_number);
    END IF;

    -- 5. [الطرف الدائن] 🎯 خفض المخزن بقيمة الخامات المستقطعة (كود 126) ليقفل الحساب فوراً
    IF COALESCE(v_rec.materials_deduction, 0) > 0 THEN
        INSERT INTO public.journal_lines (header_id, account_id, partner_id, project_id, debit, credit, notes)
        VALUES (v_jv_id, v_materials_inventory, v_rec.contractor_id, v_rec.project_id, 0, v_rec.materials_deduction, 'إقفال وتخفيض خامات منصرفة مستخلص ' || v_rec.claim_number);
    END IF;

    -- 6. [الطرف الدائن] محتجز ضمان الأعمال (حساب 213)
    IF COALESCE(v_rec.retention_amount, 0) > 0 THEN
        INSERT INTO public.journal_lines (header_id, account_id, partner_id, project_id, debit, credit, notes)
        VALUES (v_jv_id, v_retention_account, v_rec.contractor_id, v_rec.project_id, 0, v_rec.retention_amount, 'حجز ضمان أعمال مستخلص ' || v_rec.claim_number);
    END IF;

    -- 7. [الطرف الدائن] استرداد السلف والدفعات المقدمة (حساب 216)
    IF COALESCE(v_rec.advance_payment, 0) > 0 THEN
        INSERT INTO public.journal_lines (header_id, account_id, partner_id, project_id, debit, credit, notes)
        VALUES (v_jv_id, v_advance_account, v_rec.contractor_id, v_rec.project_id, 0, v_rec.advance_payment, 'استرداد دفعة مقدمة مستخلص ' || v_rec.claim_number);
    END IF;

    -- 8. [الطرف الدائن] الجزاءات والخصومات الأخرى (حساب الإيرادات 46)
    IF (COALESCE(v_rec.deductions_amount, 0) + COALESCE(v_rec.other_deductions, 0)) > 0 THEN
        INSERT INTO public.journal_lines (header_id, account_id, partner_id, project_id, debit, credit, notes)
        VALUES (v_jv_id, v_other_deduct_acc, v_rec.contractor_id, v_rec.project_id, 0, (COALESCE(v_rec.deductions_amount, 0) + COALESCE(v_rec.other_deductions, 0)), 'خصومات وجزاءات مستخلص ' || v_rec.claim_number);
    END IF;

    -- 9. تحديث حالة المستخلص وربطه بالقيد نهائياً وتأكيد الترحيل
    UPDATE public.sub_claims
    SET is_posted = true,
        status = 'معتمد',
        jv_header_id = v_jv_id,
        jv_id = v_jv_id
    WHERE id = p_id;

END;
$$;


--
-- Name: rpc_post_material_issue(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rpc_post_material_issue(p_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_issue RECORD;
  v_jv_id uuid;
  v_safe_amount numeric(15,2);
  v_inventory_acc uuid;
  v_subcontractor_acc uuid;
  v_expense_acc uuid;
BEGIN
  SELECT * INTO v_issue FROM public.material_issues WHERE id = p_id;
  IF v_issue.is_posted THEN RAISE EXCEPTION 'مرحل بالفعل!'; END IF;

  v_safe_amount := COALESCE(v_issue.total_amount, 0);

  -- استدعاء الحسابات بناءً على الـ Code بدلاً من UUID الثابت
  SELECT id INTO v_inventory_acc FROM public.accounts WHERE code = '126' LIMIT 1;
  SELECT id INTO v_subcontractor_acc FROM public.accounts WHERE code = '212' LIMIT 1;
  SELECT id INTO v_expense_acc FROM public.accounts WHERE code = '511' LIMIT 1;

  IF v_inventory_acc IS NULL THEN RAISE EXCEPTION 'حساب مخزون الخامات (126) غير موجود في الدليل المحاسبي'; END IF;

  INSERT INTO public.journal_headers (
    entry_date, reference_id, description, status, v_type, created_at
  ) VALUES (
    v_issue.issue_date, v_issue.id,
    'إثبات صرف خامات - إذن رقم: ' || COALESCE(v_issue.issue_number, 'بدون رقم'),
    'posted', 'إذن صرف', now()
  ) RETURNING id INTO v_jv_id;

  INSERT INTO public.journal_lines (
    header_id, account_id, project_id, partner_id, debit, credit, notes
  ) VALUES (
    v_jv_id, v_inventory_acc, v_issue.project_id, NULL,
    0, v_safe_amount,
    'صرف خامات من المخزن - إذن: ' || COALESCE(v_issue.issue_number, 'بدون رقم')
  );

  IF v_issue.issue_type = 'صرف لمقاول' AND v_issue.subcontractor_id IS NOT NULL THEN
      IF v_subcontractor_acc IS NULL THEN RAISE EXCEPTION 'حساب التزام مقاولي الباطن (212) غير موجود'; END IF;
      INSERT INTO public.journal_lines (
        header_id, account_id, project_id, partner_id, debit, credit, notes
      ) VALUES (
        v_jv_id, v_subcontractor_acc, v_issue.project_id, v_issue.subcontractor_id,
        v_safe_amount, 0,
        'تحميل خامات عهدة على المقاول - إذن: ' || COALESCE(v_issue.issue_number, 'بدون رقم')
      );
  ELSE
      IF v_expense_acc IS NULL THEN RAISE EXCEPTION 'حساب تكلفة مواد وخامات (511) غير موجود'; END IF;
      INSERT INTO public.journal_lines (
        header_id, account_id, project_id, partner_id, debit, credit, notes
      ) VALUES (
        v_jv_id, v_expense_acc, v_issue.project_id, NULL,
        v_safe_amount, 0,
        'استهلاك خامات للمشروع - إذن: ' || COALESCE(v_issue.issue_number, 'بدون رقم')
      );
  END IF;

  UPDATE public.material_issues SET is_posted = true, jv_id = v_jv_id WHERE id = p_id;
END;
$$;


--
-- Name: rpc_post_material_receipt(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rpc_post_material_receipt(p_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_receipt RECORD;
  v_jv_id uuid;
  v_inventory_acc uuid;
  v_client_inventory_acc uuid;
BEGIN
  SELECT * INTO v_receipt FROM public.material_receipts WHERE id = p_id;
  IF v_receipt.is_posted THEN RAISE EXCEPTION 'هذا السند مرحل محاسبياً بالفعل!'; END IF;

  SELECT id INTO v_inventory_acc FROM public.accounts WHERE code = '126' LIMIT 1;
  SELECT id INTO v_client_inventory_acc FROM public.accounts WHERE code = '211' LIMIT 1;

  IF v_inventory_acc IS NULL THEN RAISE EXCEPTION 'حساب المخزون (126) غير موجود'; END IF;
  IF v_client_inventory_acc IS NULL THEN RAISE EXCEPTION 'حساب الموردين (211) غير موجود'; END IF;

  INSERT INTO public.journal_headers (
    entry_date, reference_id, description, status, v_type, created_at
  ) VALUES (
    v_receipt.receipt_date, v_receipt.id,
    'إثبات توريد خامات - سند رقم: ' || v_receipt.receipt_number,
    'posted', 'inventory', now()
  ) RETURNING id INTO v_jv_id;

  INSERT INTO public.journal_lines (
    header_id, account_id, project_id, partner_id, debit, credit, notes
  ) VALUES (
    v_jv_id, v_inventory_acc, v_receipt.project_id, NULL,
    v_receipt.total_amount, 0, 'دخول خامات للمخزن - سند: ' || v_receipt.receipt_number
  );

  INSERT INTO public.journal_lines (
    header_id, account_id, project_id, partner_id, debit, credit, notes
  ) VALUES (
    v_jv_id, v_client_inventory_acc, v_receipt.project_id, v_receipt.supplier_id,
    0, v_receipt.total_amount, 'استحقاق توريد خامات للمشروع - سند: ' || v_receipt.receipt_number
  );

  UPDATE public.material_receipts SET is_posted = true, jv_id = v_jv_id WHERE id = p_id;
END;
$$;


--
-- Name: rpc_unpost_claim(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rpc_unpost_claim(p_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: rpc_unpost_invoices(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rpc_unpost_invoices(p_ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_receipt_ids UUID[];
BEGIN
    -- 1️⃣ تجميع أرقام معرفات (IDs) كل سندات القبض المرتبطة بالفواتير دي
    SELECT array_agg(id) INTO v_receipt_ids
    FROM receipt_vouchers
    WHERE invoice_id = ANY(p_ids);

    -- 2️⃣ مسح قيود اليومية المرتبطة بسندات القبض (مع الحماية من الـ NULL)
    IF COALESCE(array_length(v_receipt_ids, 1), 0) > 0 THEN
        DELETE FROM journal_headers
        WHERE reference_id = ANY(v_receipt_ids);

        DELETE FROM receipt_vouchers
        WHERE id = ANY(v_receipt_ids);
    END IF;

    -- 3️⃣ مسح قيود اليومية المرتبطة بالفواتير نفسها
    DELETE FROM journal_headers
    WHERE reference_id = ANY(p_ids);

    -- 4️⃣ تصفير ميزان الفاتورة وإرجاع حالتها
    UPDATE invoices
    SET
        status = 'معلق',
        paid_amount = 0
    WHERE id = ANY(p_ids);
END;
$$;


--
-- Name: rpc_unpost_material(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rpc_unpost_material(p_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_jv UUID;
BEGIN
  SELECT jv_id INTO v_jv FROM public.material_receipts WHERE id = p_id;

  UPDATE public.material_receipts SET is_posted = false, jv_id = NULL WHERE id = p_id;

  IF v_jv IS NOT NULL THEN
    DELETE FROM public.journal_lines WHERE header_id = v_jv;
    DELETE FROM public.journal_headers WHERE id = v_jv;
  END IF;
END;
$$;


--
-- Name: rpc_unpost_material_issue(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rpc_unpost_material_issue(p_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_jv UUID;
BEGIN
  -- الحصول على رقم القيد المربوط بإذن الصرف
  SELECT jv_id INTO v_jv FROM public.material_issues WHERE id = p_id;

  -- تصفير الربط في إذن الصرف وإعادته لحالة (مسودة) أولاً لمنع أخطاء الـ Foreign Key
  UPDATE public.material_issues
  SET is_posted = false, jv_id = NULL
  WHERE id = p_id;

  IF v_jv IS NOT NULL THEN
    -- مسح سطور القيد المحاسبي
    DELETE FROM public.journal_lines WHERE header_id = v_jv;
    -- مسح رأس القيد المحاسبي
    DELETE FROM public.journal_headers WHERE id = v_jv;
  END IF;
END;
$$;


--
-- Name: rpc_unpost_material_receipt(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rpc_unpost_material_receipt(p_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_jv UUID;
BEGIN
  -- 1. الحصول على رقم القيد المربوط
  SELECT jv_id INTO v_jv FROM public.material_receipts WHERE id = p_id;

  -- 2. تصفير الربط في الفاتورة أولاً (لأمان قاعدة البيانات ومنع أخطاء Foreign Key)
  UPDATE public.material_receipts
  SET is_posted = false, jv_id = NULL
  WHERE id = p_id;

  -- 3. مسح القيد المحاسبي
  IF v_jv IS NOT NULL THEN
    DELETE FROM public.journal_lines WHERE header_id = v_jv;
    DELETE FROM public.journal_headers WHERE id = v_jv;
  END IF;
END;
$$;


--
-- Name: safe_numeric(double precision); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.safe_numeric(val double precision) RETURNS numeric
    LANGUAGE plpgsql IMMUTABLE
    AS $$
BEGIN
    RETURN val::numeric;
EXCEPTION WHEN OTHERS THEN
    RETURN 0;
END;
$$;


--
-- Name: safe_numeric(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.safe_numeric(val text) RETURNS numeric
    LANGUAGE plpgsql IMMUTABLE
    AS $$
BEGIN
    RETURN COALESCE(NULLIF(regexp_replace(val, '[^-0-9.]', '', 'g'), ''), '0')::numeric;
EXCEPTION WHEN OTHERS THEN
    RETURN 0;
END;
$$;


--
-- Name: save_expense_with_settlement(uuid, date, text, text, text, text, text, text, text, text, text, numeric, numeric, numeric, numeric, text, text, text, jsonb, boolean, uuid, uuid, uuid, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_expense_with_settlement(p_id uuid DEFAULT NULL::uuid, p_exp_date date DEFAULT NULL::date, p_main_category text DEFAULT NULL::text, p_sub_contractor text DEFAULT NULL::text, p_site_ref text DEFAULT NULL::text, p_creditor_account text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_payee_name text DEFAULT NULL::text, p_payment_method text DEFAULT NULL::text, p_payment_account text DEFAULT NULL::text, p_employee_name text DEFAULT NULL::text, p_quantity numeric DEFAULT 1, p_unit_price numeric DEFAULT 0, p_vat_amount numeric DEFAULT 0, p_discount_amount numeric DEFAULT 0, p_discount_account text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_invoice_image text DEFAULT NULL::text, p_lines_data jsonb DEFAULT '[]'::jsonb, p_is_auto_distributed boolean DEFAULT false, p_user_id uuid DEFAULT NULL::uuid, p_project_id uuid DEFAULT NULL::uuid, p_payee_id uuid DEFAULT NULL::uuid, p_job_order_id uuid DEFAULT NULL::uuid, p_is_deducted_from_contractor boolean DEFAULT false) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_exp_id uuid;
    v_total_amount numeric;
    v_paid_amount numeric;
BEGIN
    -- حساب الإجمالي داخلياً لتحديد قيمة التسوية فقط (لن نرسله للعمود المحسوب)
    v_total_amount := (p_quantity * p_unit_price) + p_vat_amount - p_discount_amount;

    IF p_payment_method = 'تسوية داخلية' THEN
        v_paid_amount := v_total_amount;
    ELSE
        v_paid_amount := 0;
    END IF;

    IF p_id IS NOT NULL THEN
        UPDATE public.expenses SET
            exp_date = p_exp_date,
            main_category = p_main_category,
            sub_contractor = p_sub_contractor,
            site_ref = p_site_ref,
            creditor_account = p_creditor_account,
            description = p_description,
            payee_name = p_payee_name,
            payment_method = p_payment_method,
            payment_account = p_payment_account,
            employee_name = p_employee_name,
            quantity = p_quantity,
            unit_price = p_unit_price,
            vat_amount = p_vat_amount,
            discount_amount = p_discount_amount,
            discount_account = p_discount_account,
            -- ❌ تم إزالة total_price ليتم حسابه آلياً من قاعدة البيانات
            notes = p_notes,
            invoice_image = p_invoice_image,
            lines_data = p_lines_data,
            is_auto_distributed = p_is_auto_distributed,
            paid_amount = v_paid_amount,
            is_posted = false,
            project_id = p_project_id,
            payee_id = p_payee_id,
            job_order_id = p_job_order_id,
            is_deducted_from_contractor = p_is_deducted_from_contractor
        WHERE id = p_id RETURNING id INTO v_exp_id;
    ELSE
        INSERT INTO public.expenses (
            exp_date, main_category, sub_contractor, site_ref, creditor_account, description, payee_name,
            payment_method, payment_account, employee_name, quantity, unit_price, vat_amount,
            discount_amount, discount_account, notes, invoice_image, lines_data, is_auto_distributed,
            paid_amount, is_posted, created_by, project_id, payee_id, job_order_id, is_deducted_from_contractor
            -- ❌ تم إزالة total_price
        ) VALUES (
            p_exp_date, p_main_category, p_sub_contractor, p_site_ref, p_creditor_account, p_description, p_payee_name,
            p_payment_method, p_payment_account, p_employee_name, p_quantity, p_unit_price, p_vat_amount,
            p_discount_amount, p_discount_account, p_notes, p_invoice_image, p_lines_data, p_is_auto_distributed,
            v_paid_amount, false, p_user_id, p_project_id, p_payee_id, p_job_order_id, p_is_deducted_from_contractor
        ) RETURNING id INTO v_exp_id;
    END IF;

    RETURN json_build_object('success', true, 'id', v_exp_id);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;


--
-- Name: set_site_ref_auto(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_site_ref_auto() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- إذا تم إدخال أو تعديل معرف المشروع وقيمته ليست فارغة
    IF NEW.project_id IS NOT NULL THEN
        SELECT "Property" INTO NEW.site_ref
        FROM public.projects
        WHERE id = NEW.project_id;
    ELSE
        -- إذا تم مسح المشروع، نجعل خانة الموقع فارغة أيضاً
        NEW.site_ref := NULL;
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: set_villa_name_auto(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_villa_name_auto() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- إذا تم إدخال أو تعديل مشروع، اسحب بياناته
    IF NEW.project_id IS NOT NULL THEN
        SELECT "Property", project_code
        INTO NEW.villa_name, NEW.villa_number
        FROM public.projects
        WHERE id = NEW.project_id;
    ELSE
        NEW.villa_name := NULL;
        NEW.villa_number := NULL;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: smart_audit_delete(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.smart_audit_delete(p_error_id uuid, p_table_name text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_ref_id uuid;
    v_type_val text;
BEGIN
    -- 🚀 السيناريو الأول: الخطأ من جدول القيود (journal_headers)
    IF p_table_name = 'journal_headers' THEN
        SELECT reference_id, v_type INTO v_ref_id, v_type_val
        FROM public.journal_headers WHERE id = p_error_id;

        IF v_type_val = 'labor_daily_logs' AND v_ref_id IS NOT NULL THEN
            -- مسح القيد المضروب من الجورنال
            DELETE FROM public.journal_lines WHERE header_id = p_error_id;
            DELETE FROM public.journal_headers WHERE id = p_error_id;
            -- 🛡️ تعليق اليومية (تحويلها لمسودة) بدل مسحها
            UPDATE public.labor_daily_logs SET is_posted = false WHERE id = v_ref_id;
        ELSE
            -- مسح قيد عادي
            DELETE FROM public.journal_lines WHERE header_id = p_error_id;
            DELETE FROM public.journal_headers WHERE id = p_error_id;
        END IF;

    -- 🚀 السيناريو الثاني: الخطأ من جدول العمالة نفسه (labor_daily_logs)
    ELSIF p_table_name = 'labor_daily_logs' THEN
        -- مسح قيود اليومية من الجورنال
        DELETE FROM public.journal_lines WHERE header_id IN (SELECT id FROM public.journal_headers WHERE reference_id = p_error_id AND v_type = 'labor_daily_logs');
        DELETE FROM public.journal_headers WHERE reference_id = p_error_id AND v_type = 'labor_daily_logs';
        -- 🛡️ تعليق اليومية بدل مسحها نهائياً
        UPDATE public.labor_daily_logs SET is_posted = false WHERE id = p_error_id;

    -- 🚀 السيناريو الثالث: الخطأ من جدول سطور القيود (journal_lines)
    ELSIF p_table_name = 'journal_lines' THEN
        EXECUTE format('DELETE FROM public.%I WHERE id = %L', p_table_name, p_error_id);

    -- 🧱 السيناريو الرابع (الجديد): الخطأ في أسطر استلام الخامات
    ELSIF p_table_name = 'material_receipt_lines' THEN
        -- مسح سطر الاستلام المعيب مباشرة
        DELETE FROM public.material_receipt_lines WHERE id = p_error_id;

    -- 💰 السيناريو الخامس (الجديد للحماية): الخطأ في المصروفات
    ELSIF p_table_name = 'expenses' THEN
        -- 🛡️ تعليق المصروف (is_posted = false) ليعود للمراجعة ولا يتم حذفه
        UPDATE public.expenses SET is_posted = false WHERE id = p_error_id;

    -- ⚠️ مسح من أي جدول آخر غير مصنف (Dynamic SQL)
    ELSE
        EXECUTE format('DELETE FROM public.%I WHERE id = %L', p_table_name, p_error_id);
    END IF;
END;
$$;


--
-- Name: suspend_mismatched_expenses(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suspend_mismatched_expenses() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_count INT := 0;
BEGIN
    -- تحديث المصروفات التي فيها اختلاف بين الإجمالي والمبلغ المدفوع أو سندات الصرف
    WITH mismatch AS (
        SELECT
            e.id
        FROM public.expenses e
        CROSS JOIN LATERAL (
            -- حساب الإجمالي الحقيقي للمصروف (الأساسي + الضريبة - الخصم)
            SELECT ROUND(
                (COALESCE(e.total_price, (e.quantity * e.unit_price)) + COALESCE(e.vat_amount, 0) - COALESCE(e.discount_amount, 0)),
                2
            ) AS expected_total
        ) calc
        WHERE e.is_posted = true -- نبحث فقط في الفواتير المعتمدة (المرحلة)
        AND (
            -- الشرط الأول: إجمالي الفاتورة لا يساوي المبلغ المسدد المسجل
            calc.expected_total <> ROUND(e.paid_amount, 2)
            OR
            -- الشرط الثاني: مجموع سندات الصرف الفعلي لا يساوي الإجمالي
            calc.expected_total <> (
                SELECT ROUND(COALESCE(SUM(amount), 0), 2)
                FROM public.payment_vouchers
                WHERE related_expense_id = e.id
            )
        )
    )
    UPDATE public.expenses
    SET is_posted = false -- 🚀 تحويلها لحالة "معلق" فقط
    WHERE id IN (SELECT id FROM mismatch);

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;


--
-- Name: sync_boq_from_logs_on_save(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_boq_from_logs_on_save() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.project_id IS NOT NULL THEN

        -- 1. العمالة المباشرة
        NEW.actual_quantity := (SELECT COALESCE(SUM(productivity), 0) FROM public.labor_daily_logs WHERE project_id = NEW.project_id AND (work_item_id = NEW.id OR work_item_id = NEW.boq_item_id));
        NEW.actual_labor_cost := (SELECT COALESCE(SUM(daily_wage), 0) FROM public.labor_daily_logs WHERE project_id = NEW.project_id AND (work_item_id = NEW.id OR work_item_id = NEW.boq_item_id));

        -- 2. الخامات المباشرة
        NEW.actual_material_cost := (SELECT COALESCE(SUM(mil.total_price), 0) FROM public.material_issue_lines mil JOIN public.material_issues mi ON mi.id = mil.issue_id WHERE mi.project_id = NEW.project_id AND (mil.boq_item_id = NEW.boq_item_id OR mil.boq_id = NEW.id));

        -- 3. المصروفات الموزعة (🚀 التعديل هنا: استخدام boq_budget_id بدلاً من boq_item_id للـ View)
        NEW.actual_expenses_cost := (
            SELECT COALESCE(SUM("المبلغ المحمل (ر.س)"), 0)
            FROM public.advanced_cost_allocation_view
            WHERE project_id = NEW.project_id
              AND (boq_budget_id = NEW.boq_item_id OR boq_budget_id = NEW.id)
        );

    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: sync_invoice_payments(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_invoice_payments() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: trg_refresh_financial_reports(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_refresh_financial_reports() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- We simply call the generator asynchronously or synchronously
    -- It takes a fraction of a second so running it synchronously is fine.
    PERFORM public.generate_financial_reports_json();
    RETURN NULL;
END;
$$;


--
-- Name: trigger_boq_update_from_expenses(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_boq_update_from_expenses() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_boq_id uuid;
BEGIN
    IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') AND OLD.job_order_id IS NOT NULL THEN
        SELECT boq_budget_id INTO v_boq_id FROM public.job_orders WHERE id = OLD.job_order_id;
        IF v_boq_id IS NOT NULL THEN
            UPDATE public.boq_budget SET id = id WHERE id = v_boq_id;
        END IF;
    END IF;

    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.job_order_id IS NOT NULL THEN
        SELECT boq_budget_id INTO v_boq_id FROM public.job_orders WHERE id = NEW.job_order_id;
        IF v_boq_id IS NOT NULL THEN
            UPDATE public.boq_budget SET id = id WHERE id = v_boq_id;
        END IF;
    END IF;

    IF (TG_OP = 'DELETE') THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;


--
-- Name: trigger_message_notification(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_message_notification() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  sender_name text;
BEGIN
  SELECT full_name INTO sender_name FROM public.profiles WHERE id = NEW.sender_id;

  -- قمنا بملء كلا العمودين (message و content) لضمان عدم حدوث أي خطأ
  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    content,
    type,
    related_id
  ) VALUES (
    NEW.receiver_id,
    'رسالة جديدة',
    'لديك رسالة جديدة من ' || COALESCE(sender_name, 'مستخدم'),
    'لديك رسالة جديدة من ' || COALESCE(sender_name, 'مستخدم'),
    'message',
    NEW.id
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- تجاهل الخطأ لكي لا يتعطل إرسال الرسالة
    RETURN NEW;
END;
$$;


--
-- Name: unpost_expenses_bulk(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unpost_expenses_bulk(record_ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: unpost_invoices_bulk(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unpost_invoices_bulk(p_ids uuid[]) RETURNS void
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: unpost_labor_daily_log(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unpost_labor_daily_log(p_log_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- أ. مسح سطور القيد من الجورنال أولاً
    DELETE FROM public.journal_lines
    WHERE header_id IN (
        SELECT id FROM public.journal_headers WHERE reference_id = p_log_id AND v_type = 'labor_daily_logs'
    );

    -- ب. مسح رأس القيد من الجورنال بالكامل
    DELETE FROM public.journal_headers
    WHERE reference_id = p_log_id AND v_type = 'labor_daily_logs';

    -- ج. تعليق اليومية في جدول العمالة لتصبح مسودة
    UPDATE public.labor_daily_logs
    SET is_posted = false
    WHERE id = p_log_id;

    -- تنشيط كاش الواجهة الأمامية
    PERFORM pg_notify('pgrst', 'reload schema');
    RETURN TRUE;
END;
$$;


--
-- Name: unpost_labor_logs_bulk(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unpost_labor_logs_bulk(record_ids uuid[]) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- أ. مسح سطور القيود المجمعة من الجورنال
    DELETE FROM public.journal_lines
    WHERE header_id IN (
        SELECT id FROM public.journal_headers WHERE reference_id = ANY(record_ids) AND v_type = 'labor_daily_logs'
    );

    -- ب. مسح رؤوس القيود المجمعة من الجورنال بالكامل
    DELETE FROM public.journal_headers
    WHERE reference_id = ANY(record_ids) AND v_type = 'labor_daily_logs';

    -- ج. تعليق اليوميات في جدول العمالة لتصبح مسودة
    UPDATE public.labor_daily_logs
    SET is_posted = false
    WHERE id = ANY(record_ids);

    -- تنشيط كاش الواجهة الأمامية
    PERFORM pg_notify('pgrst', 'reload schema');
    RETURN true;
END;
$$;


--
-- Name: unpost_payment_vouchers_bulk(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unpost_payment_vouchers_bulk(p_ids uuid[]) RETURNS void
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: unpost_receipt_vouchers_bulk(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unpost_receipt_vouchers_bulk(record_ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    DELETE FROM journal_headers
    WHERE reference_id = ANY(record_ids) AND source_module = 'receipt_vouchers';

    UPDATE receipt_vouchers
    SET status = 'مسودة'
    WHERE id = ANY(record_ids);
END;
$$;


--
-- Name: unpost_receipts_bulk(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unpost_receipts_bulk(p_ids uuid[]) RETURNS void
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: unpost_universal_bulk(text, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unpost_universal_bulk(p_table_name text, p_ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
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
$_$;


--
-- Name: unpost_violations_bulk(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unpost_violations_bulk(p_ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    DELETE FROM public.journal_headers WHERE reference_id = ANY(p_ids) AND v_type = 'violations';
    UPDATE public.violations SET is_posted = false WHERE id = ANY(p_ids);
END;
$$;


--
-- Name: unpost_violations_bulk_journal(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unpost_violations_bulk_journal(violation_ids uuid[]) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_id uuid;
BEGIN
    FOREACH v_id IN ARRAY violation_ids
    LOOP
        -- 1. مسح أي سطور تابعة للقيد الخاص بهذه المخالفة
        DELETE FROM public.journal_lines WHERE header_id IN (SELECT id FROM public.journal_headers WHERE reference_id = v_id);

        -- 2. مسح رأس القيد نفسه
        DELETE FROM public.journal_headers WHERE reference_id = v_id;

        -- 3. إرجاع المخالفة لحالة "معلق"
        UPDATE public.violations SET is_posted = false WHERE id = v_id;
    END LOOP;
END;
$$;


--
-- Name: unpost_violations_bulk_v3(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unpost_violations_bulk_v3(violation_ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- 1. حذف السندات المربوطة تسلسلياً بهذه المخالفات مهما كان رقم السند
    DELETE FROM public.payment_vouchers
    WHERE related_violation_id = ANY(violation_ids);

    -- 2. إعادة حالة المخالفات إلى "غير مرحلة"
    UPDATE public.violations
    SET is_posted = false
    WHERE id = ANY(violation_ids);
END;
$$;


--
-- Name: update_boq_actual_quantity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_boq_actual_quantity() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- 🟢 أ: في حالة الإضافة (INSERT) أو التعديل (UPDATE)
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        IF NEW.project_id IS NOT NULL AND NEW.work_item_id IS NOT NULL THEN
            UPDATE public.boq_budget
            SET
                -- 🚀 تحديث الكمية المنجزة فعلياً مباشرة بعد أن أصبح العمود numeric
                actual_quantity = (
                    SELECT COALESCE(SUM(productivity), 0)
                    FROM public.labor_daily_logs
                    WHERE project_id = NEW.project_id AND work_item_id = NEW.work_item_id
                ),
                -- 🚀 تحديث تكلفة أجور العمالة الفعلية تلقائياً من واقع اليوميات
                actual_labor_cost = (
                    SELECT COALESCE(SUM(daily_wage), 0)
                    FROM public.labor_daily_logs
                    WHERE project_id = NEW.project_id AND work_item_id = NEW.work_item_id
                )
            WHERE project_id = NEW.project_id AND boq_item_id = NEW.work_item_id;
        END IF;
    END IF;

    -- 🔴 ب: في حالة الحذف (DELETE) أو نقل السجل لبند/فيلا أخرى
    IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') THEN
        IF OLD.project_id IS NOT NULL AND OLD.work_item_id IS NOT NULL THEN
            -- لا يشتغل إلا لو كانت عملية حذف، أو تعديل غيّر المشروع أو البند فعلياً
            IF (TG_OP = 'DELETE' OR OLD.project_id != NEW.project_id OR OLD.work_item_id != NEW.work_item_id) THEN
                UPDATE public.boq_budget
                SET
                    -- 🚀 تحديث الكمية المنجزة فعلياً للبند القديم
                    actual_quantity = (
                        SELECT COALESCE(SUM(productivity), 0)
                        FROM public.labor_daily_logs
                        WHERE project_id = OLD.project_id AND work_item_id = OLD.work_item_id
                    ),
                    -- 🚀 إعادة حساب وتنظيف أجور العمالة للبند القديم
                    actual_labor_cost = (
                        SELECT COALESCE(SUM(daily_wage), 0)
                        FROM public.labor_daily_logs
                        WHERE project_id = OLD.project_id AND work_item_id = OLD.work_item_id
                    )
                WHERE project_id = OLD.project_id AND boq_item_id = OLD.work_item_id;
            END IF;
        END IF;
    END IF;

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: update_boq_actuals(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_boq_actuals() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.project_id IS NOT NULL THEN

        -- 1. العمالة المباشرة
        NEW.actual_quantity := (SELECT COALESCE(SUM(productivity), 0) FROM public.labor_daily_logs WHERE project_id = NEW.project_id AND (work_item_id = NEW.id OR work_item_id = NEW.boq_item_id));
        NEW.actual_labor_cost := (SELECT COALESCE(SUM(daily_wage), 0) FROM public.labor_daily_logs WHERE project_id = NEW.project_id AND (work_item_id = NEW.id OR work_item_id = NEW.boq_item_id));

        -- 2. الخامات المباشرة
        NEW.actual_material_cost := (SELECT COALESCE(SUM(mil.total_price), 0) FROM public.material_issue_lines mil JOIN public.material_issues mi ON mi.id = mil.issue_id WHERE mi.project_id = NEW.project_id AND (mil.boq_item_id = NEW.boq_item_id OR mil.boq_id = NEW.id));

        -- 3. المصروفات الموزعة + المصروفات المباشرة المرتبطة بأوامر الشغل
        NEW.actual_expenses_cost := (
            SELECT COALESCE(SUM("المبلغ المحمل (ر.س)"), 0)
            FROM public.advanced_cost_allocation_view
            WHERE project_id = NEW.project_id
              AND (boq_budget_id = NEW.boq_item_id OR boq_budget_id = NEW.id)
        ) + (
            SELECT COALESCE(SUM(e.total_price), 0)
            FROM public.expenses e
            JOIN public.job_orders jo ON e.job_order_id = jo.id
            WHERE e.project_id = NEW.project_id
              AND (jo.boq_budget_id = NEW.id OR jo.boq_budget_id = NEW.boq_item_id)
        );

    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: update_boq_labor_cost_live(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_boq_labor_cost_live() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        UPDATE public.boq_budget
        SET actual_labor_cost = COALESCE((SELECT SUM(daily_wage) FROM public.labor_daily_logs WHERE project_id = OLD.project_id AND work_item_id = OLD.work_item_id), 0)
        WHERE project_id = OLD.project_id AND boq_item_id = OLD.work_item_id;
        RETURN OLD;
    ELSE
        UPDATE public.boq_budget
        SET actual_labor_cost = COALESCE((SELECT SUM(daily_wage) FROM public.labor_daily_logs WHERE project_id = NEW.project_id AND work_item_id = NEW.work_item_id), 0)
        WHERE project_id = NEW.project_id AND boq_item_id = NEW.work_item_id;
        RETURN NEW;
    END IF;
END;
$$;


--
-- Name: update_boq_material_cost(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_boq_material_cost() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- 🟢 أ: في حالة إضافة صنف (INSERT) أو تعديل سعر/بند (UPDATE)
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        IF NEW.boq_id IS NOT NULL THEN
            UPDATE public.boq_budget
            SET actual_material_cost = (
                SELECT COALESCE(SUM(total_price), 0)
                FROM public.material_issue_lines
                WHERE boq_id = NEW.boq_id
            )
            WHERE id = NEW.boq_id;
        END IF;
    END IF;

    -- 🔴 ب: في حالة حذف صنف (DELETE) أو نقل الصنف لبند آخر في المقايسة
    IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') THEN
        IF OLD.boq_id IS NOT NULL THEN
            -- يشتغل فقط في الحذف، أو لو التعديل غيّر الـ boq_id القديم فعلياً
            IF (TG_OP = 'DELETE' OR OLD.boq_id != NEW.boq_id) THEN
                UPDATE public.boq_budget
                SET actual_material_cost = (
                    SELECT COALESCE(SUM(total_price), 0)
                    FROM public.material_issue_lines
                    WHERE boq_id = OLD.boq_id
                )
                WHERE id = OLD.boq_id;
            END IF;
        END IF;
    END IF;

    -- إتمام العملية بأمان
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;


--
-- Name: update_boq_material_cost_live(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_boq_material_cost_live() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_project_id UUID;
    v_boq_item_id UUID;
    v_boq_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_boq_id := OLD.boq_id;
        v_boq_item_id := OLD.boq_item_id;
        SELECT project_id INTO v_project_id FROM public.material_issues WHERE id = OLD.issue_id;
    ELSE
        v_boq_id := NEW.boq_id;
        v_boq_item_id := NEW.boq_item_id;
        SELECT project_id INTO v_project_id FROM public.material_issues WHERE id = NEW.issue_id;

        IF v_boq_item_id IS NULL AND NEW.item_id IS NOT NULL THEN
            SELECT boq_item_id INTO v_boq_item_id FROM public.material_items WHERE id = NEW.item_id;
        END IF;
    END IF;

    -- إذا كان الـ boq_id فارغاً، نربطه أوتوماتيك بالمقايسة الصحيحة
    IF v_boq_id IS NULL AND v_project_id IS NOT NULL AND v_boq_item_id IS NOT NULL THEN
        SELECT id INTO v_boq_id FROM public.boq_budget WHERE project_id = v_project_id AND boq_item_id = v_boq_item_id;
    END IF;

    -- تحديث الحسبة فوراً
    IF v_boq_id IS NOT NULL THEN
        UPDATE public.boq_budget
        SET actual_material_cost = COALESCE((
            SELECT SUM(mil.total_price)
            FROM public.material_issue_lines mil
            JOIN public.material_issues mi ON mi.id = mil.issue_id
            WHERE mil.boq_id = v_boq_id
               OR (mi.project_id = v_project_id AND mil.boq_item_id = v_boq_item_id)
        ), 0)
        WHERE id = v_boq_id;
    END IF;

    RETURN NULL;
END;
$$;


--
-- Name: update_boq_revenue_from_invoice_live(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_boq_revenue_from_invoice_live() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_project_ids UUID[];
    v_pid UUID;
BEGIN
    -- تجميع الـ project_ids المتأثرة بالعملية
    IF TG_OP = 'DELETE' THEN
        v_project_ids := OLD.project_ids;
    ELSIF TG_OP = 'UPDATE' THEN
        v_project_ids := ARRAY(SELECT DISTINCT unnest(OLD.project_ids || NEW.project_ids));
    ELSE
        v_project_ids := NEW.project_ids;
    END IF;

    -- إعادة الحساب للمشاريع المتأثرة فقط لضمان سرعة السيرفر
    IF v_project_ids IS NOT NULL AND array_length(v_project_ids, 1) > 0 THEN
        FOREACH v_pid IN ARRAY v_project_ids LOOP

            UPDATE public.boq_budget b
            SET actual_revenue = COALESCE(
                -- 1) محاولة البحث عن تطابق صريح بالـ boq_id
                (
                    SELECT SUM((line->>'total_price')::numeric)
                    FROM public.invoices i,
                    jsonb_array_elements(i.lines_data) AS line
                    WHERE (i.status LIKE '%عتمد%' OR i.status LIKE '%مدفوع%')
                      AND (line->>'boq_id')::uuid = b.id
                ),
                -- 2) البديل في حال عدم وجود تطابق بالـ ID ولكن العمارة موجودة في الفاتورة
                CASE
                    WHEN EXISTS (
                        SELECT 1
                        FROM public.invoices i
                        WHERE v_pid = ANY(i.project_ids)
                          AND (i.status LIKE '%عتمد%' OR i.status LIKE '%مدفوع%')
                    ) THEN
                        COALESCE(b.total_contract_amount, (COALESCE(b.contract_quantity, 0) * COALESCE(b.unit_contract_price, 0)))
                        - COALESCE(b.actual_retention_amount, 0)
                    ELSE 0
                END
            )
            WHERE b.project_id = v_pid;

        END LOOP;
    END IF;

    RETURN NULL;
END;
$$;


--
-- Name: update_transaction_links(text, uuid, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_transaction_links(target_table text, row_id uuid, p_project_id uuid DEFAULT NULL::uuid, p_partner_id uuid DEFAULT NULL::uuid, p_account_id uuid DEFAULT NULL::uuid) RETURNS void
    LANGUAGE plpgsql
    AS $_$
BEGIN
    EXECUTE format(
        'UPDATE %I SET
            project_id = COALESCE($1, project_id),
            payee_id = COALESCE($2, payee_id),
            creditor_account_id = COALESCE($3, creditor_account_id)
         WHERE id = $4',
        target_table
    ) USING p_project_id, p_partner_id, p_account_id, row_id;
END;
$_$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    account_type character varying(50) NOT NULL,
    parent_id uuid,
    is_transactional boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: boq_budget_code_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.boq_budget_code_seq
    START WITH 1000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: boq_budget; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.boq_budget (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    parent_id uuid,
    item_type character varying(50) DEFAULT 'رئيسي'::character varying,
    work_item text NOT NULL,
    contract_quantity numeric DEFAULT 0,
    unit text DEFAULT 'مقطوعية'::text,
    unit_contract_price numeric DEFAULT 0,
    estimated_labor_cost numeric DEFAULT 0,
    main_category character varying(100),
    sub_category character varying(100),
    estimated_expenses_cost numeric(15,2) DEFAULT 0,
    boq_item_id uuid,
    start_date date,
    end_date date,
    actual_quantity numeric DEFAULT 0,
    "Property" text,
    estimated_material_cost numeric(15,2) DEFAULT 0,
    actual_labor_cost numeric DEFAULT 0,
    actual_expenses_cost numeric(15,2) DEFAULT 0,
    actual_material_cost numeric(15,2) DEFAULT 0,
    retention_percentage numeric(5,2) DEFAULT 10,
    total_contract_amount numeric(15,2) GENERATED ALWAYS AS ((contract_quantity * unit_contract_price)) STORED,
    actual_retention_amount numeric(15,2) GENERATED ALWAYS AS (((contract_quantity * unit_contract_price) * (retention_percentage / 100.0))) STORED,
    material_variance numeric(15,2) GENERATED ALWAYS AS ((COALESCE(estimated_material_cost, (0)::numeric) - COALESCE(actual_material_cost, (0)::numeric))) STORED,
    expenses_variance numeric(15,2) GENERATED ALWAYS AS ((COALESCE(estimated_expenses_cost, (0)::numeric) - COALESCE(actual_expenses_cost, (0)::numeric))) STORED,
    actual_revenue numeric(15,2) DEFAULT 0.00,
    completed_percentage numeric GENERATED ALWAYS AS (
CASE
    WHEN (contract_quantity > (0)::numeric) THEN ((actual_quantity / contract_quantity) * (100)::numeric)
    ELSE (0)::numeric
END) STORED,
    labor_variance numeric GENERATED ALWAYS AS ((COALESCE(estimated_labor_cost, (0)::numeric) - COALESCE(actual_labor_cost, (0)::numeric))) STORED,
    created_at timestamp with time zone DEFAULT now(),
    execution_status character varying(50) DEFAULT 'لم يتم البدئ'::character varying,
    item_net_profit numeric GENERATED ALWAYS AS ((((((contract_quantity * unit_contract_price) - ((contract_quantity * unit_contract_price) * (retention_percentage / 100.0))) - COALESCE(actual_expenses_cost, (0)::numeric)) - COALESCE(actual_material_cost, (0)::numeric)) - COALESCE(actual_labor_cost, (0)::numeric))) STORED,
    total_budget_variance numeric GENERATED ALWAYS AS ((((COALESCE(estimated_material_cost, (0)::numeric) + COALESCE(estimated_expenses_cost, (0)::numeric)) + COALESCE(estimated_labor_cost, (0)::numeric)) - ((COALESCE(actual_material_cost, (0)::numeric) + COALESCE(actual_expenses_cost, (0)::numeric)) + COALESCE(actual_labor_cost, (0)::numeric)))) STORED,
    budget_code text DEFAULT ('BGT-'::text || nextval('public.boq_budget_code_seq'::regclass)),
    loaded_amount_egp numeric(15,2) DEFAULT 0,
    loaded_amount numeric(15,2) DEFAULT 0
);


--
-- Name: COLUMN boq_budget.retention_percentage; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.boq_budget.retention_percentage IS 'النسبة المئوية المحجوزة كضمان أعمال للبند';


--
-- Name: COLUMN boq_budget.total_contract_amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.boq_budget.total_contract_amount IS 'إجمالي قيمة البند التعاقدية = الكمية التعاقدية × سعر وحدة العقد';


--
-- Name: COLUMN boq_budget.actual_retention_amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.boq_budget.actual_retention_amount IS 'قيمة ضمان الأعمال المحسوبة تلقائياً = إجمالي قيمة العقد × (نسبة الضمان / 100)';


--
-- Name: COLUMN boq_budget.material_variance; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.boq_budget.material_variance IS 'انحراف الخامات = التقديري - الفعلي';


--
-- Name: COLUMN boq_budget.expenses_variance; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.boq_budget.expenses_variance IS 'انحراف المصروفات = التقديري - الفعلي';


--
-- Name: COLUMN boq_budget.actual_revenue; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.boq_budget.actual_revenue IS 'الإيراد الفعلي المفوتر المستحق لهذا البند من واقع سطور فواتير العملاء';


--
-- Name: expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    exp_date date DEFAULT CURRENT_DATE NOT NULL,
    sub_contractor text,
    payee_id uuid,
    creditor_account text,
    description text NOT NULL,
    quantity numeric(10,2) DEFAULT 1 NOT NULL,
    unit_price numeric(15,2) NOT NULL,
    vat_amount numeric(15,2) DEFAULT 0,
    discount_amount numeric(15,2) DEFAULT 0,
    discount_account character varying(255),
    paid_amount numeric(15,2) DEFAULT 0 NOT NULL,
    payment_method text DEFAULT 'كاش'::text,
    payment_account text DEFAULT '125 - عُهد الموظفين والمواقع'::text,
    notes text,
    is_posted boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    site_ref text,
    payee_name text,
    project_id uuid,
    employee_name character varying(255),
    invoice_image text,
    lines_data jsonb DEFAULT '[]'::jsonb,
    is_deducted_in_claim boolean DEFAULT false,
    claim_id uuid,
    is_auto_distributed boolean DEFAULT false,
    total_price numeric(15,2) GENERATED ALWAYS AS ((quantity * unit_price)) STORED,
    main_category text,
    is_deleted boolean DEFAULT false,
    job_order_id uuid,
    is_deducted_from_contractor boolean DEFAULT false,
    created_by uuid,
    CONSTRAINT expenses_payment_method_check CHECK ((payment_method = ANY (ARRAY['كاش'::text, 'تحويل بنكي'::text, 'شيك'::text, 'عُهدة'::text, 'آجل'::text, 'تسوية داخلية'::text]))),
    CONSTRAINT expenses_quantity_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT expenses_unit_price_check CHECK ((unit_price >= (0)::numeric)),
    CONSTRAINT expenses_vat_amount_check CHECK ((vat_amount >= (0)::numeric))
);


--
-- Name: job_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_number text NOT NULL,
    project_id uuid,
    boq_budget_id uuid,
    executor_type text DEFAULT 'تنفيذ ذاتي'::text,
    contractor_id uuid,
    assigned_qty numeric(15,2) DEFAULT 0,
    unit_price numeric(15,2) DEFAULT 0,
    status text DEFAULT 'جاري التنفيذ'::text,
    start_date date DEFAULT CURRENT_DATE,
    end_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT check_contractor_logic CHECK (((executor_type = 'تنفيذ ذاتي'::text) OR ((executor_type = 'مقاول باطن'::text) AND (contractor_id IS NOT NULL)))),
    CONSTRAINT job_orders_executor_type_check CHECK ((executor_type = ANY (ARRAY['تنفيذ ذاتي'::text, 'مقاول باطن'::text]))),
    CONSTRAINT job_orders_status_check CHECK ((status = ANY (ARRAY['مسودة'::text, 'جاري التنفيذ'::text, 'مكتمل'::text, 'موقوف'::text, 'جاري التسليم'::text, 'مفوتر'::text, 'تم التحصيل'::text])))
);


--
-- Name: labor_daily_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.labor_daily_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    work_date date NOT NULL,
    worker_name text NOT NULL,
    site_ref text,
    work_item text,
    unit text,
    skill_level text,
    daily_wage numeric DEFAULT 0,
    attendance_value numeric DEFAULT 0,
    sub_contractor text,
    notes text,
    project_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    worker_partner_id uuid,
    sub_contractor_id uuid,
    is_posted boolean DEFAULT false,
    work_item_id uuid,
    tareeha numeric,
    productivity numeric,
    completion_percentage numeric,
    credit_account_id uuid DEFAULT '39f878cd-dc58-4a2a-a199-50f6fca983d4'::uuid,
    debit_account_id uuid DEFAULT '70d181ba-6385-4c1e-b0fc-d5b1f800dd2c'::uuid,
    production_desc text,
    completed_quantity numeric(15,2) DEFAULT 0,
    number_of_workers integer DEFAULT 1,
    job_order_id uuid
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_code character varying(50),
    "Property" character varying(255) NOT NULL,
    client_name character varying(255),
    contract_value numeric(15,2) DEFAULT 0,
    estimated_budget numeric(15,2) DEFAULT 0,
    down_payment numeric(15,2) DEFAULT 0,
    start_date date,
    end_date date,
    actual_completion_date date,
    location_address text,
    location_url text,
    project_manager text,
    status character varying(50) DEFAULT 'قيد الدراسة'::character varying,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    project_name text,
    client_id uuid,
    current_stage character varying(100) DEFAULT 'تجهيز الموقع'::character varying,
    unit_type character varying(50),
    unit_area numeric(10,2) DEFAULT 0,
    engineer_in_charge character varying,
    engineer_phone character varying
);


--
-- Name: advanced_cost_allocation_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.advanced_cost_allocation_view AS
 WITH excluded_projects AS (
         SELECT unnest(ARRAY['b19f5217-a90d-48c9-9f97-45d27f22c7b9'::uuid, 'cccf3b65-df7b-478f-83be-f7adfb1224ad'::uuid, 'efd6b3f0-027c-4031-9dd3-a35679704701'::uuid]) AS proj_id
        ), daily_labor_by_jo AS (
         SELECT l.work_date,
            l.project_id,
            l.job_order_id,
            sum(COALESCE(l.number_of_workers, 1)) AS jo_daily_workers
           FROM public.labor_daily_logs l
          WHERE ((l.project_id IS NOT NULL) AND (l.job_order_id IS NOT NULL) AND (NOT (l.project_id IN ( SELECT excluded_projects.proj_id
                   FROM excluded_projects))))
          GROUP BY l.work_date, l.project_id, l.job_order_id
        ), daily_company_total_labor AS (
         SELECT daily_labor_by_jo.work_date,
            sum(daily_labor_by_jo.jo_daily_workers) AS company_total_daily_workers
           FROM daily_labor_by_jo
          GROUP BY daily_labor_by_jo.work_date
        ), monthly_labor_by_jo AS (
         SELECT to_char((l.work_date)::timestamp with time zone, 'YYYY-MM'::text) AS project_month,
            l.project_id,
            l.job_order_id,
            sum(COALESCE(l.number_of_workers, 1)) AS jo_monthly_man_days
           FROM public.labor_daily_logs l
          WHERE ((l.project_id IS NOT NULL) AND (l.job_order_id IS NOT NULL) AND (NOT (l.project_id IN ( SELECT excluded_projects.proj_id
                   FROM excluded_projects))))
          GROUP BY (to_char((l.work_date)::timestamp with time zone, 'YYYY-MM'::text)), l.project_id, l.job_order_id
        ), monthly_company_total_labor AS (
         SELECT monthly_labor_by_jo.project_month,
            sum(monthly_labor_by_jo.jo_monthly_man_days) AS company_monthly_man_days
           FROM monthly_labor_by_jo
          GROUP BY monthly_labor_by_jo.project_month
        ), categorizedexpenses AS (
         SELECT expenses.id,
            expenses.exp_date,
            to_char((expenses.exp_date)::timestamp with time zone, 'YYYY-MM'::text) AS expense_month,
            expenses.main_category,
            expenses.description,
            expenses.total_price AS original_amount,
                CASE
                    WHEN ((expenses.main_category ~~ '%محروق%'::text) OR (expenses.main_category ~~ '%نتقال%'::text) OR (expenses.main_category ~~ '%عاش%'::text) OR (expenses.main_category ~~ '%تغذي%'::text)) THEN 'DAILY_ALLOCATION'::text
                    ELSE 'MONTHLY_ALLOCATION'::text
                END AS allocation_strategy
           FROM public.expenses
          WHERE ((expenses.project_id IS NULL) AND (expenses.payee_id IS NULL) AND (expenses.is_deleted = false))
        ), daily_allocated AS (
         SELECT ce.id AS source_id,
            ce.exp_date,
            ce.expense_month,
            dl.project_id,
            dl.job_order_id,
            ce.main_category,
            ce.description,
            ce.original_amount,
            dl.jo_daily_workers AS jo_workers,
            dctl.company_total_daily_workers AS company_workers,
            NULL::numeric AS monthly_man_days,
            round((ce.original_amount * ((dl.jo_daily_workers)::numeric / NULLIF(dctl.company_total_daily_workers, (0)::numeric))), 2) AS allocated_amount,
            'توزيع يومي ثابت (تم على عمالة نفس اليوم)'::text AS mechanism
           FROM ((categorizedexpenses ce
             JOIN daily_labor_by_jo dl ON ((ce.exp_date = dl.work_date)))
             JOIN daily_company_total_labor dctl ON ((ce.exp_date = dctl.work_date)))
          WHERE (ce.allocation_strategy = 'DAILY_ALLOCATION'::text)
        ), monthly_allocated AS (
         SELECT ce.id AS source_id,
            ce.exp_date,
            ce.expense_month,
            ml.project_id,
            ml.job_order_id,
            ce.main_category,
            ce.description,
            ce.original_amount,
            NULL::numeric AS jo_workers,
            NULL::numeric AS company_workers,
            ml.jo_monthly_man_days AS monthly_man_days,
            round((ce.original_amount * ((ml.jo_monthly_man_days)::numeric / NULLIF(mctl.company_monthly_man_days, (0)::numeric))), 2) AS allocated_amount,
            'توزيع شهري مرن (بناءً على إجمالي يوميات الشهر)'::text AS mechanism
           FROM ((categorizedexpenses ce
             JOIN monthly_labor_by_jo ml ON ((ce.expense_month = ml.project_month)))
             JOIN monthly_company_total_labor mctl ON ((ce.expense_month = mctl.project_month)))
          WHERE (ce.allocation_strategy = 'MONTHLY_ALLOCATION'::text)
        UNION ALL
         SELECT ce.id AS source_id,
            ce.exp_date,
            ce.expense_month,
            ml.project_id,
            ml.job_order_id,
            ce.main_category,
            ce.description,
            ce.original_amount,
            NULL::numeric AS jo_workers,
            NULL::numeric AS company_workers,
            ml.jo_monthly_man_days AS monthly_man_days,
            round((ce.original_amount * ((ml.jo_monthly_man_days)::numeric / NULLIF(mctl.company_monthly_man_days, (0)::numeric))), 2) AS allocated_amount,
            'توزيع يومي تم تحويله لشهري (لا يوجد عمال في هذا اليوم)'::text AS mechanism
           FROM ((categorizedexpenses ce
             JOIN monthly_labor_by_jo ml ON ((ce.expense_month = ml.project_month)))
             JOIN monthly_company_total_labor mctl ON ((ce.expense_month = mctl.project_month)))
          WHERE ((ce.allocation_strategy = 'DAILY_ALLOCATION'::text) AND (NOT (EXISTS ( SELECT 1
                   FROM daily_company_total_labor
                  WHERE (daily_company_total_labor.work_date = ce.exp_date)))))
        ), combinedallocations AS (
         SELECT daily_allocated.source_id,
            daily_allocated.exp_date,
            daily_allocated.expense_month,
            daily_allocated.project_id,
            daily_allocated.job_order_id,
            daily_allocated.main_category,
            daily_allocated.description,
            daily_allocated.original_amount,
            daily_allocated.jo_workers,
            daily_allocated.company_workers,
            daily_allocated.monthly_man_days,
            daily_allocated.allocated_amount,
            daily_allocated.mechanism
           FROM daily_allocated
        UNION ALL
         SELECT monthly_allocated.source_id,
            monthly_allocated.exp_date,
            monthly_allocated.expense_month,
            monthly_allocated.project_id,
            monthly_allocated.job_order_id,
            monthly_allocated.main_category,
            monthly_allocated.description,
            monthly_allocated.original_amount,
            monthly_allocated.jo_workers,
            monthly_allocated.company_workers,
            monthly_allocated.monthly_man_days,
            monthly_allocated.allocated_amount,
            monthly_allocated.mechanism
           FROM monthly_allocated
        )
 SELECT (((c.source_id)::text || '-'::text) || (c.job_order_id)::text) AS id,
    c.source_id AS "كود الحركة المرجعي",
    c.project_id,
    c.job_order_id,
    jo.order_number AS "رقم أمر التشغيل",
    jo.boq_budget_id,
    c.expense_month AS "شهر التحميل المالي",
    c.exp_date AS "تاريخ المصروف الأصلي",
    p."Property" AS "اسم الفيلا المحمل عليها",
    b.work_item AS "البند المحمل عليه",
    c.main_category AS "التصنيف الرئيسي",
    c.description AS "البيان / الوصف",
    c.original_amount AS "قيمة الفاتورة الأصلية (ر.س)",
    c.jo_workers AS "عمال اليوم للأمر",
    c.monthly_man_days AS "يوميات الشهر للأمر",
    round(((c.allocated_amount / NULLIF(c.original_amount, (0)::numeric)) * (100)::numeric), 2) AS "نسبة التحميل (%)",
    c.allocated_amount AS "المبلغ المحمل (ر.س)",
    c.mechanism AS "آلية التوزيع"
   FROM (((combinedallocations c
     LEFT JOIN public.projects p ON ((c.project_id = p.id)))
     LEFT JOIN public.job_orders jo ON ((c.job_order_id = jo.id)))
     LEFT JOIN public.boq_budget b ON ((jo.boq_budget_id = b.id)))
  WHERE (c.allocated_amount > (0)::numeric);


--
-- Name: journal_headers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_headers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entry_date date NOT NULL,
    description character varying(500) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    status character varying(50) DEFAULT 'draft'::character varying,
    reference_id uuid,
    v_type text,
    job_order_id uuid
);


--
-- Name: journal_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    header_id uuid NOT NULL,
    account_id uuid NOT NULL,
    partner_id uuid,
    item_name character varying(255),
    quantity numeric(15,2) DEFAULT 1,
    unit_price numeric(15,2) DEFAULT 0,
    debit numeric(15,2) DEFAULT 0 NOT NULL,
    credit numeric(15,2) DEFAULT 0 NOT NULL,
    notes text,
    project_id uuid,
    debit_account_id uuid DEFAULT '23623b40-72f8-460b-92f6-984457003a34'::uuid,
    tax_amount numeric DEFAULT 0,
    tax_rate numeric DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: partners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    partner_type character varying(50) NOT NULL,
    identity_number character varying(50),
    identity_expiry_date date,
    identity_image_url text,
    phone character varying(20),
    address text,
    vat_number character varying(15),
    created_at timestamp with time zone DEFAULT now(),
    job_role character varying(100),
    account_id uuid,
    is_active boolean DEFAULT true
);


--
-- Name: all_partners_account_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.all_partners_account_summary AS
 WITH financial_summary AS (
         SELECT jl.partner_id,
            sum(jl.credit) AS total_credit,
            sum(jl.debit) AS total_debit
           FROM (public.journal_lines jl
             JOIN public.journal_headers jh ON ((jl.header_id = jh.id)))
          WHERE (((jh.status)::text <> 'draft'::text) AND (jl.partner_id IS NOT NULL))
          GROUP BY jl.partner_id
        ), labor_summary AS (
         SELECT labor_daily_logs.worker_partner_id AS partner_id,
            sum(COALESCE(labor_daily_logs.attendance_value, (0)::numeric)) AS total_work_days
           FROM public.labor_daily_logs
          WHERE (labor_daily_logs.is_posted = true)
          GROUP BY labor_daily_logs.worker_partner_id
        )
 SELECT p.id AS partner_id,
    p.code AS partner_code,
    p.name AS partner_name,
    p.partner_type,
    p.is_active,
    COALESCE(f.total_credit, (0)::numeric) AS total_credit,
    COALESCE(f.total_debit, (0)::numeric) AS total_debit,
    (COALESCE(f.total_credit, (0)::numeric) - COALESCE(f.total_debit, (0)::numeric)) AS net_balance,
    COALESCE(l.total_work_days, (0)::numeric) AS total_work_days
   FROM ((public.partners p
     LEFT JOIN financial_summary f ON ((p.id = f.partner_id)))
     LEFT JOIN labor_summary l ON ((p.id = l.partner_id)));


--
-- Name: contractor_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contractor_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contractor_id uuid,
    project_id uuid,
    boq_item_id uuid,
    assigned_qty numeric(15,2),
    unit_price numeric(15,2),
    status text DEFAULT 'جاري التنفيذ'::text,
    boq_budget_id uuid,
    claim_id uuid,
    villa_name text,
    villa_number text,
    job_order_id uuid
);


--
-- Name: material_issue_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_issue_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    issue_id uuid,
    item_name character varying(255) NOT NULL,
    quantity numeric(10,2) DEFAULT 1 NOT NULL,
    unit character varying(50) DEFAULT 'وحدة'::character varying,
    unit_price numeric(15,2) DEFAULT 0,
    total_price numeric(15,2) DEFAULT 0,
    boq_id uuid,
    boq_item_id uuid,
    item_id uuid,
    job_order_id uuid,
    is_deducted_from_contractor boolean DEFAULT false,
    claim_id uuid
);


--
-- Name: assignment_details_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.assignment_details_view AS
 SELECT ca.id AS assignment_id,
    ca.job_order_id,
    ca.contractor_id,
    'خامات'::text AS record_type,
    mil.item_name AS item_description,
    mil.quantity AS qty,
    mil.total_price AS cost,
    true AS is_deductible
   FROM (public.contractor_assignments ca
     JOIN public.material_issue_lines mil ON ((ca.job_order_id = mil.job_order_id)))
UNION ALL
 SELECT ca.id AS assignment_id,
    ca.job_order_id,
    ca.contractor_id,
    'مصروفات'::text AS record_type,
    e.description AS item_description,
    e.quantity AS qty,
    e.total_price AS cost,
    e.is_deducted_from_contractor AS is_deductible
   FROM (public.contractor_assignments ca
     JOIN public.expenses e ON ((ca.job_order_id = e.job_order_id)))
  WHERE (e.is_deleted = false);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    table_name text NOT NULL,
    record_id uuid,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: boq_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.boq_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_code character varying(50) NOT NULL,
    main_category character varying(100) NOT NULL,
    sub_category character varying(100) NOT NULL,
    item_name text NOT NULL,
    unit_of_measure character varying(50) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    tareeha numeric(15,2) DEFAULT 0.00
);


--
-- Name: boq_budget_distinct; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.boq_budget_distinct AS
 SELECT DISTINCT ON (b.project_id, b.boq_item_id) b.id,
    b.project_id,
    b.boq_item_id,
    TRIM(BOTH FROM COALESCE(NULLIF(b.work_item, ''::text), i.item_name)) AS work_item,
    b.unit,
    i.tareeha,
    b.contract_quantity,
    b.unit_contract_price,
    (p."Property")::text AS "Property",
    b.budget_code,
    b.start_date,
    concat(TRIM(BOTH FROM COALESCE(NULLIF(b.work_item, ''::text), i.item_name)), ' (', COALESCE(b.budget_code, (i.tareeha)::text, 'بدون كود'::text), ')') AS display_name
   FROM ((public.boq_budget b
     LEFT JOIN public.boq_items i ON ((b.boq_item_id = i.id)))
     LEFT JOIN public.projects p ON ((b.project_id = p.id)))
  WHERE (((b.work_item IS NOT NULL) AND (b.work_item <> ''::text)) OR (i.item_name IS NOT NULL))
  ORDER BY b.project_id, b.boq_item_id, b.created_at DESC;


--
-- Name: cash_flows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cash_flows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    transaction_date date DEFAULT CURRENT_DATE NOT NULL,
    flow_type character varying(20) NOT NULL,
    amount numeric(15,2) NOT NULL,
    category character varying(100) NOT NULL,
    sub_category text,
    payment_method character varying(50) DEFAULT 'نقدي'::character varying,
    reference_number character varying(100),
    description text,
    account_id uuid,
    project_id uuid,
    partner_id uuid,
    is_reconciled boolean DEFAULT false,
    reconciled_date date,
    created_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    source_id uuid,
    source_type character varying(50),
    CONSTRAINT cash_flows_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT cash_flows_flow_type_check CHECK (((flow_type)::text = ANY ((ARRAY['inflow'::character varying, 'outflow'::character varying])::text[])))
);


--
-- Name: debug_daily_logs; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.debug_daily_logs AS
 SELECT id,
    worker_name,
    site_ref,
    daily_wage,
    attendance_value,
        CASE
            WHEN (worker_partner_id IS NULL) THEN '❌ اسم العامل مش مربوط'::text
            ELSE '✅ مربوط'::text
        END AS worker_status,
        CASE
            WHEN (project_id IS NULL) THEN '❌ المشروع مش مربوط'::text
            ELSE '✅ مربوط'::text
        END AS project_status,
        CASE
            WHEN ((daily_wage IS NULL) OR ((daily_wage)::text = ''::text)) THEN '❌ اليومية فاضية'::text
            WHEN ((daily_wage)::text !~ '^[0-9.]+$'::text) THEN '❌ اليومية فيها حروف مش أرقام'::text
            ELSE '✅ سليمة'::text
        END AS wage_value_status,
        CASE
            WHEN (is_posted = true) THEN '✅ تم الترحيل'::text
            ELSE '⏳ منتظر الترحيل'::text
        END AS posting_status
   FROM public.labor_daily_logs;


--
-- Name: field_live_radar; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.field_live_radar AS
 SELECT p.id AS project_id,
    p."Property" AS site_name,
    p.status,
    p.estimated_budget,
    p.client_name,
    COALESCE(l.workers_count, (0)::bigint) AS today_workers_count,
    COALESCE(l.labor_cost, (0)::numeric) AS today_labor_cost,
    COALESCE(e.expenses_cost, (0)::numeric) AS today_expenses_cost,
    l.active_tasks
   FROM ((public.projects p
     LEFT JOIN ( SELECT labor_daily_logs.project_id,
            count(labor_daily_logs.id) AS workers_count,
            sum(COALESCE((labor_daily_logs.attendance_value * labor_daily_logs.daily_wage), labor_daily_logs.attendance_value, (0)::numeric)) AS labor_cost,
            string_agg(DISTINCT labor_daily_logs.work_item, ', '::text) AS active_tasks
           FROM public.labor_daily_logs
          WHERE (labor_daily_logs.work_date = CURRENT_DATE)
          GROUP BY labor_daily_logs.project_id) l ON ((p.id = l.project_id)))
     LEFT JOIN ( SELECT expenses.project_id,
            sum(COALESCE(expenses.total_price, (expenses.quantity * expenses.unit_price), (0)::numeric)) AS expenses_cost
           FROM public.expenses
          WHERE ((expenses.exp_date = CURRENT_DATE) AND (expenses.is_deleted = false))
          GROUP BY expenses.project_id) e ON ((p.id = e.project_id)));


--
-- Name: financial_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_year integer NOT NULL,
    plan_month integer NOT NULL,
    category text NOT NULL,
    item_name text NOT NULL,
    planned_amount numeric DEFAULT 0,
    actual_amount numeric DEFAULT 0,
    notes text
);


--
-- Name: inventory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_name text NOT NULL,
    unit text,
    current_stock double precision DEFAULT 0,
    avg_price double precision DEFAULT 0
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_number character varying(50) NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    partner_id uuid,
    client_name character varying(255),
    project_ids uuid[],
    description text,
    materials_discount numeric(15,2) DEFAULT 0,
    taxable_amount numeric(15,2) DEFAULT 0,
    tax_amount numeric(15,2) DEFAULT 0,
    guarantee_percent numeric(5,2) DEFAULT 0,
    guarantee_amount numeric(15,2) DEFAULT 0,
    total_amount numeric(15,2) DEFAULT 0,
    debit_account_id uuid DEFAULT '4f828d0d-a1f4-4762-83e3-c17dafae802d'::uuid,
    credit_account_id uuid DEFAULT '6667f91a-9478-49ab-9721-521ee09381fa'::uuid,
    materials_acc_id uuid DEFAULT '4f828d0d-a1f4-4762-83e3-c17dafae802d'::uuid,
    guarantee_acc_id uuid DEFAULT '4f828d0d-a1f4-4762-83e3-c17dafae802d'::uuid,
    tax_acc_id uuid DEFAULT '6667f91a-9478-49ab-9721-521ee09381fa'::uuid,
    skip_zatca boolean DEFAULT false,
    status character varying(50) DEFAULT 'معلق'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    due_in_days integer DEFAULT 0,
    due_date date,
    paid_amount numeric DEFAULT 0,
    lines_data jsonb DEFAULT '[]'::jsonb
);


--
-- Name: material_issues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_issues (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    issue_number character varying(255) NOT NULL,
    project_id uuid,
    subcontractor_id uuid,
    issue_date date DEFAULT CURRENT_DATE NOT NULL,
    issue_type character varying(50) DEFAULT 'صرف لمقاول'::character varying,
    total_amount numeric(15,2) DEFAULT 0,
    notes text,
    jv_id uuid,
    is_posted boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    claim_id uuid,
    contractor_text_name character varying(255)
);


--
-- Name: job_order_ledger_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.job_order_ledger_view AS
 SELECT l.id AS source_id,
    l.job_order_id,
    l.work_date AS trans_date,
    'يوميات عمالة'::text AS trans_type,
    ((((('العامل: '::text || COALESCE(l.worker_name, 'غير محدد'::text)) || ' | إنتاجية: '::text) || COALESCE((bi.tareeha)::text, '0'::text)) || ' | بند: '::text) || COALESCE(b.work_item, 'غير محدد'::text)) AS trans_desc,
    l.number_of_workers AS qty,
    l.daily_wage AS amount
   FROM (((public.labor_daily_logs l
     LEFT JOIN public.job_orders jo ON ((l.job_order_id = jo.id)))
     LEFT JOIN public.boq_budget b ON ((jo.boq_budget_id = b.id)))
     LEFT JOIN public.boq_items bi ON ((b.boq_item_id = bi.id)))
  WHERE (l.job_order_id IS NOT NULL)
UNION ALL
 SELECT mil.id AS source_id,
    mil.job_order_id,
    mi.issue_date AS trans_date,
    'خامات مصروفة'::text AS trans_type,
    ('صرف خامات: '::text || (COALESCE(mil.item_name, 'غير محدد'::character varying))::text) AS trans_desc,
    mil.quantity AS qty,
    mil.total_price AS amount
   FROM (public.material_issue_lines mil
     JOIN public.material_issues mi ON ((mil.issue_id = mi.id)))
  WHERE (mil.job_order_id IS NOT NULL)
UNION ALL
 SELECT expenses.id AS source_id,
    expenses.job_order_id,
    expenses.exp_date AS trans_date,
        CASE
            WHEN (expenses.main_category ~~ '%مقاول%'::text) THEN 'دفعات مقاولين'::text
            ELSE 'مصروفات نثرية'::text
        END AS trans_type,
    COALESCE(expenses.description, expenses.main_category) AS trans_desc,
    1 AS qty,
    expenses.total_price AS amount
   FROM public.expenses
  WHERE (expenses.job_order_id IS NOT NULL);


--
-- Name: job_order_performance; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.job_order_performance AS
 SELECT id AS job_order_id,
    COALESCE((assigned_qty * unit_price), (0)::numeric) AS boq_total_budget,
    COALESCE(( SELECT sum(jol.amount) AS sum
           FROM public.job_order_ledger_view jol
          WHERE (jol.job_order_id = jo.id)), (0)::numeric) AS effective_cost,
    (COALESCE((assigned_qty * unit_price), (0)::numeric) - COALESCE(( SELECT sum(jol.amount) AS sum
           FROM public.job_order_ledger_view jol
          WHERE (jol.job_order_id = jo.id)), (0)::numeric)) AS total_profit_or_loss
   FROM public.job_orders jo;


--
-- Name: journal_errors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_errors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    error_type text,
    description text,
    is_fixed boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: journal_master_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.journal_master_view AS
 SELECT jl.id AS line_id,
    COALESCE(jl.debit, (0)::numeric) AS debit,
    COALESCE(jl.credit, (0)::numeric) AS credit,
    jl.notes AS line_notes,
    jl.item_name,
    jl.quantity,
    jl.unit_price,
    jl.tax_amount,
    jl.tax_rate,
    jl.created_at AS line_created_at,
    jh.id AS header_id,
    jh.entry_date,
    jh.description AS header_description,
    jh.reference_id,
    jh.status AS header_status,
    a.id AS account_id,
    a.name AS account_name,
    a.code AS account_code,
    p.id AS partner_id,
    p.name AS partner_name,
    p.partner_type,
    pr.id AS project_id,
    pr."Property" AS project_name
   FROM ((((public.journal_lines jl
     LEFT JOIN public.journal_headers jh ON ((jl.header_id = jh.id)))
     LEFT JOIN public.accounts a ON ((jl.account_id = a.id)))
     LEFT JOIN public.partners p ON ((jl.partner_id = p.id)))
     LEFT JOIN public.projects pr ON ((jl.project_id = pr.id)));


--
-- Name: manual_journals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manual_journals (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    voucher_number character varying(50) NOT NULL,
    entry_date date DEFAULT CURRENT_DATE NOT NULL,
    description text NOT NULL,
    debit_account_id uuid NOT NULL,
    credit_account_id uuid NOT NULL,
    amount numeric(15,2) NOT NULL,
    partner_id uuid,
    project_id uuid,
    status character varying(20) DEFAULT 'مسودة'::character varying,
    is_posted boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    created_by uuid,
    job_order_id uuid,
    CONSTRAINT manual_journals_amount_check CHECK ((amount > (0)::numeric))
);


--
-- Name: material_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_code character varying(50),
    item_name character varying(255) NOT NULL,
    main_category character varying(100),
    default_unit character varying(50) DEFAULT 'بالقطعة'::character varying,
    default_unit_price numeric(15,2) DEFAULT 0.00,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    boq_item_id uuid
);


--
-- Name: material_receipt_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_receipt_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    receipt_id uuid,
    item_name character varying(255) NOT NULL,
    quantity numeric(10,2) DEFAULT 1 NOT NULL,
    unit character varying(50) DEFAULT 'وحدة'::character varying,
    unit_price numeric(15,2) DEFAULT 0 NOT NULL,
    total_price numeric(15,2) DEFAULT 0 NOT NULL,
    boq_id uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    project_id uuid,
    item_id uuid,
    boq_item_id uuid
);


--
-- Name: material_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_receipts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    receipt_number character varying(50),
    project_id uuid,
    supplier_id uuid,
    account_id uuid,
    receipt_date date DEFAULT CURRENT_DATE NOT NULL,
    total_amount numeric(15,2) DEFAULT 0,
    status character varying(50) DEFAULT 'معتمد'::character varying,
    attachments text[],
    is_posted boolean DEFAULT false,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    receipt_type character varying(50) DEFAULT 'توريد شركة'::character varying,
    jv_id uuid
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sender_id uuid NOT NULL,
    receiver_id uuid NOT NULL,
    content text NOT NULL,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    read_at timestamp with time zone
);

ALTER TABLE ONLY public.messages REPLICA IDENTITY FULL;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    type text,
    message text NOT NULL,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    title text DEFAULT 'إشعار جديد'::text NOT NULL,
    content text DEFAULT 'يوجد تحديث جديد'::text NOT NULL,
    related_id uuid
);

ALTER TABLE ONLY public.notifications REPLICA IDENTITY FULL;


--
-- Name: partner_statement_ledger; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.partner_statement_ledger AS
 SELECT jl.partner_id,
    p.name AS partner_name,
    p.partner_type,
    jh.entry_date AS transaction_date,
    jh.description AS main_description,
    jl.notes AS line_details,
    COALESCE(jl.debit, (0)::numeric) AS debit,
    COALESCE(jl.credit, (0)::numeric) AS credit,
    sum((COALESCE(jl.credit, (0)::numeric) - COALESCE(jl.debit, (0)::numeric))) OVER (PARTITION BY jl.partner_id ORDER BY jh.entry_date, jl.created_at) AS running_balance
   FROM ((public.journal_lines jl
     JOIN public.journal_headers jh ON ((jl.header_id = jh.id)))
     JOIN public.partners p ON ((p.id = jl.partner_id)))
  WHERE ((jh.status)::text <> 'draft'::text);


--
-- Name: payment_vouchers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_vouchers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    voucher_number text NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    amount numeric(15,2) DEFAULT 0 NOT NULL,
    partner_id uuid,
    credit_account_id uuid,
    payment_method text,
    reference_no text,
    description text,
    notes text,
    status text DEFAULT 'مسودة'::text NOT NULL,
    is_posted boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    debit_account_id uuid,
    site_ref text,
    related_expense_id uuid,
    sub_claim_id uuid,
    project_ids uuid[],
    job_order_id uuid,
    CONSTRAINT payment_vouchers_amount_check CHECK ((amount > (0)::numeric))
);


--
-- Name: payroll_slips; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_slips (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    emp_id uuid,
    month text NOT NULL,
    basic_salary double precision DEFAULT 0,
    total_advances double precision DEFAULT 0,
    total_deductions double precision DEFAULT 0,
    net_salary double precision NOT NULL,
    is_posted boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    amount_to_pay numeric DEFAULT 0,
    allowances numeric DEFAULT 0,
    status text DEFAULT 'غير مدفوع'::text
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    username text,
    role text DEFAULT 'staff'::text,
    permissions jsonb DEFAULT '{}'::jsonb,
    signature_url text,
    linked_partner_id uuid,
    avatar_url text,
    nickname text,
    phone_number text,
    full_name text,
    email text,
    created_at timestamp with time zone DEFAULT now(),
    is_admin boolean DEFAULT false,
    is_active boolean DEFAULT true,
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'staff'::text, 'contractor'::text, 'client'::text])))
);


--
-- Name: property_expenses_report; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.property_expenses_report AS
 SELECT COALESCE(p.client_name, 'بدون عميل'::character varying) AS "العميل",
    COALESCE(p."Property", 'غير محدد'::character varying) AS "العقار_أو_الجهة",
    p.project_name AS "اسم_المشروع",
    COALESCE(pt.name, 'إدارة الموقع / بدون مقاول'::character varying) AS "المقاول",
    l.item_name AS "البند",
    sum(l.debit) AS "إجمالي_التكاليف",
    COALESCE(p.contract_value, (0)::numeric) AS "قيمة_العقد",
    COALESCE(p.estimated_budget, (0)::numeric) AS "الميزانية_التقديرية"
   FROM ((public.journal_lines l
     LEFT JOIN public.projects p ON ((l.project_id = p.id)))
     LEFT JOIN public.partners pt ON ((l.partner_id = pt.id)))
  WHERE (l.account_id = ( SELECT accounts.id
           FROM public.accounts
          WHERE ((accounts.code)::text = '512'::text)))
  GROUP BY p.client_name, p."Property", p.project_name, pt.name, l.item_name, p.contract_value, p.estimated_budget;


--
-- Name: receipt_vouchers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.receipt_vouchers (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    amount numeric(15,2) NOT NULL,
    payment_method text NOT NULL,
    notes text,
    partner_id uuid,
    invoice_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    receipt_number character varying(50),
    status character varying(50) DEFAULT 'مسودة'::character varying,
    safe_bank_acc_id uuid,
    partner_acc_id uuid,
    project_ids uuid[],
    reference_number text,
    attachment_url text,
    CONSTRAINT receipt_vouchers_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT receipt_vouchers_payment_method_check CHECK ((payment_method = ANY (ARRAY['نقدي (كاش)'::text, 'تحويل بنكي'::text, 'شيك'::text])))
);


--
-- Name: TABLE receipt_vouchers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.receipt_vouchers IS 'جدول سندات القبض والتحصيلات النقدية والبنكية';


--
-- Name: sub_claims; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sub_claims (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    claim_number text,
    contractor_id uuid,
    project_id uuid,
    date date DEFAULT CURRENT_DATE,
    total_amount numeric(15,2) DEFAULT 0,
    retention_amount numeric(15,2) DEFAULT 0,
    net_amount numeric(15,2) DEFAULT 0,
    status text DEFAULT 'مسودة'::text,
    is_posted boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    jv_header_id uuid,
    deductions_amount numeric(15,2) DEFAULT 0,
    advance_payment numeric(15,2) DEFAULT 0,
    materials_deduction numeric(15,2) DEFAULT 0,
    other_deductions numeric(15,2) DEFAULT 0,
    jv_id uuid,
    paid_amount numeric(15,2) DEFAULT 0,
    payment_period_days integer DEFAULT 14,
    job_order_id uuid,
    project_ids uuid[],
    project_names_text text
);


--
-- Name: subcontractor_claim_engine_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.subcontractor_claim_engine_view AS
 WITH material_deductions AS (
         SELECT mil.job_order_id,
            sum(COALESCE(mil.total_price, (0)::numeric)) AS total_materials
           FROM public.material_issue_lines mil
          WHERE (mil.job_order_id IS NOT NULL)
          GROUP BY mil.job_order_id
        ), expense_deductions AS (
         SELECT exp.job_order_id,
            exp.payee_id,
            sum(COALESCE(exp.total_price, (0)::numeric)) AS total_expenses
           FROM public.expenses exp
          WHERE ((exp.job_order_id IS NOT NULL) AND (exp.is_deleted = false) AND (exp.is_deducted_from_contractor = true))
          GROUP BY exp.job_order_id, exp.payee_id
        )
 SELECT ca.id AS assignment_id,
    ca.job_order_id,
    jo.order_number,
    ca.contractor_id,
    ca.project_id,
    b.work_item AS boq_item_name,
    ca.status AS assignment_status,
    ca.claim_id,
    COALESCE(ca.assigned_qty, (0)::numeric) AS executed_qty,
    COALESCE(ca.unit_price, (0)::numeric) AS contract_unit_price,
    (COALESCE(ca.assigned_qty, (0)::numeric) * COALESCE(ca.unit_price, (0)::numeric)) AS gross_total_amount,
    COALESCE(md.total_materials, (0)::numeric) AS materials_deduction,
    COALESCE(ed.total_expenses, (0)::numeric) AS expenses_deduction,
    (COALESCE(md.total_materials, (0)::numeric) + COALESCE(ed.total_expenses, (0)::numeric)) AS total_operational_deductions,
    ((COALESCE(ca.assigned_qty, (0)::numeric) * COALESCE(ca.unit_price, (0)::numeric)) - (COALESCE(md.total_materials, (0)::numeric) + COALESCE(ed.total_expenses, (0)::numeric))) AS net_before_financial_deductions
   FROM ((((public.contractor_assignments ca
     JOIN public.job_orders jo ON ((ca.job_order_id = jo.id)))
     LEFT JOIN public.boq_budget b ON ((ca.boq_budget_id = b.id)))
     LEFT JOIN material_deductions md ON ((ca.job_order_id = md.job_order_id)))
     LEFT JOIN expense_deductions ed ON (((ca.job_order_id = ed.job_order_id) AND (ca.contractor_id = ed.payee_id))));


--
-- Name: sys_financial_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sys_financial_reports (
    report_name character varying(50) NOT NULL,
    report_data jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    id uuid NOT NULL,
    theme_config jsonb DEFAULT '{"brand_gold": "#C5A059", "glass_blur": "15px", "bg_gradient": "linear-gradient(180deg, #43342E 0%, #8C6A5D 100%)", "glass_opacity": 0.7}'::jsonb,
    privacy_settings jsonb DEFAULT '{"show_activity_log": true, "show_online_status": true}'::jsonb,
    notifications jsonb DEFAULT '{"email_alerts": true, "push_notifications": false}'::jsonb,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);


--
-- Name: temp_labor_daily_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.temp_labor_daily_logs (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    work_date text,
    worker_name text,
    site_ref text,
    work_item text,
    unit text,
    skill_level text,
    daily_wage bigint,
    attendance_value double precision,
    sub_contractor text,
    notes text,
    project_id text,
    created_at text,
    worker_partner_id text,
    sub_contractor_id text,
    is_posted text,
    work_item_id text,
    tareeha text,
    productivity bigint,
    completion_percentage text,
    credit_account_id text,
    debit_account_id text,
    production_desc text,
    completed_quantity text,
    number_of_workers text
);


--
-- Name: user_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    type text NOT NULL,
    category text,
    subject text NOT NULL,
    details text,
    status text DEFAULT 'pending'::text,
    admin_note text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    title text NOT NULL,
    description text,
    status text DEFAULT 'pending'::text,
    priority text DEFAULT 'normal'::text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: view_boq_budget; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.view_boq_budget AS
 SELECT b.id,
    b.project_id,
    b.parent_id,
    b.item_type,
    b.work_item,
    b.contract_quantity,
    b.unit,
    b.unit_contract_price,
    b.estimated_labor_cost,
    b.main_category,
    b.sub_category,
    b.estimated_expenses_cost,
    b.boq_item_id,
    b.start_date,
    b.end_date,
    b.actual_quantity,
    b.completed_percentage,
    p."Property" AS villa_name
   FROM (public.boq_budget b
     LEFT JOIN public.projects p ON ((b.project_id = p.id)));


--
-- Name: violations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.violations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    date date DEFAULT CURRENT_DATE,
    partner_id uuid,
    emp_name text,
    profession text,
    project_id uuid,
    site_name text,
    reason text,
    amount numeric(10,2),
    image_url text,
    is_posted boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    debit_account_id uuid,
    credit_account_id uuid,
    violation_type text DEFAULT 'غرامة'::text,
    boq_item_id uuid,
    is_deleted boolean DEFAULT false
);


--
-- Name: vw_advanced_audit; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_advanced_audit AS
 SELECT jh.id AS error_id,
    jh.id AS header_id,
    'journal_headers'::text AS table_name,
    'قيد غير متزن محاسبياً'::text AS error_type,
    jh.entry_date AS error_date,
    ((('القيد غير متزن. مدين: '::text || COALESCE(sum(jl.debit), (0)::numeric)) || ' | دائن: '::text) || COALESCE(sum(jl.credit), (0)::numeric)) AS details,
    (COALESCE(sum(jl.debit), (0)::numeric) - COALESCE(sum(jl.credit), (0)::numeric)) AS diff_amount,
    COALESCE(jh.v_type, 'قيد يدوي/مباشر'::text) AS source_type,
    jh.reference_id AS source_id,
    jh.description AS info_description,
    ( SELECT p.name
           FROM (public.journal_lines line
             JOIN public.partners p ON ((line.partner_id = p.id)))
          WHERE ((line.header_id = jh.id) AND (line.partner_id IS NOT NULL))
         LIMIT 1) AS info_party
   FROM (public.journal_headers jh
     LEFT JOIN public.journal_lines jl ON ((jh.id = jl.header_id)))
  GROUP BY jh.id, jh.entry_date, jh.v_type, jh.reference_id, jh.description
 HAVING (COALESCE(sum(jl.debit), (0)::numeric) <> COALESCE(sum(jl.credit), (0)::numeric))
UNION ALL
 SELECT jh.id AS error_id,
    jh.id AS header_id,
    'journal_headers'::text AS table_name,
    'قيد شبح (بدون أسطر)'::text AS error_type,
    jh.entry_date AS error_date,
    'رأس قيد مسجل بالنظام ولا يحتوي على أي حركة مالية تحته.'::text AS details,
    0 AS diff_amount,
    COALESCE(jh.v_type, 'قيد يدوي/مباشر'::text) AS source_type,
    jh.reference_id AS source_id,
    jh.description AS info_description,
    'لا يوجد أسطر'::character varying AS info_party
   FROM (public.journal_headers jh
     LEFT JOIN public.journal_lines jl ON ((jh.id = jl.header_id)))
  WHERE (jl.id IS NULL)
UNION ALL
 SELECT jl.id AS error_id,
    jl.header_id,
    'journal_lines'::text AS table_name,
    'سطر يتيم (بدون رأس قيد)'::text AS error_type,
    COALESCE(jh.entry_date, CURRENT_DATE) AS error_date,
    'سطر مالي منفصل مفقود الرأس'::text AS details,
    0 AS diff_amount,
    COALESCE(jh.v_type, 'غير محدد'::text) AS source_type,
    jh.reference_id AS source_id,
    jl.notes AS info_description,
    ( SELECT partners.name
           FROM public.partners
          WHERE (partners.id = jl.partner_id)) AS info_party
   FROM (public.journal_lines jl
     LEFT JOIN public.journal_headers jh ON ((jl.header_id = jh.id)))
  WHERE (jh.id IS NULL)
UNION ALL
 SELECT jl.id AS error_id,
    jl.header_id,
    'journal_lines'::text AS table_name,
    'حساب مفقود أو مرجع مكسور'::text AS error_type,
    jh.entry_date AS error_date,
    'السطر المالي مسجل ولكن عمود الحساب فارغ.'::text AS details,
    0 AS diff_amount,
    COALESCE(jh.v_type, 'غير محدد'::text) AS source_type,
    jh.reference_id AS source_id,
    jl.notes AS info_description,
    ( SELECT partners.name
           FROM public.partners
          WHERE (partners.id = jl.partner_id)) AS info_party
   FROM (public.journal_lines jl
     JOIN public.journal_headers jh ON ((jl.header_id = jh.id)))
  WHERE (jl.account_id IS NULL)
UNION ALL
 SELECT pv.id AS error_id,
    pv.id AS header_id,
    'payment_vouchers'::text AS table_name,
    'حساب مفقود في السند'::text AS error_type,
    pv.date AS error_date,
    (('سند صرف رقم '::text || COALESCE(pv.voucher_number, 'غير محدد'::text)) || ' يفتقد لتحديد حساب المدين أو الدائن.'::text) AS details,
    pv.amount AS diff_amount,
    'سندات الصرف'::text AS source_type,
    pv.id AS source_id,
    pv.description AS info_description,
    ( SELECT partners.name
           FROM public.partners
          WHERE (partners.id = pv.partner_id)) AS info_party
   FROM public.payment_vouchers pv
  WHERE ((pv.debit_account_id IS NULL) OR (pv.credit_account_id IS NULL))
UNION ALL
 SELECT rv.id AS error_id,
    rv.id AS header_id,
    'receipt_vouchers'::text AS table_name,
    'حساب مفقود في السند'::text AS error_type,
    rv.date AS error_date,
    (('سند قبض رقم '::text || (COALESCE(rv.receipt_number, 'غير محدد'::character varying))::text) || ' يفتقد لتحديد حساب الخزينة/البنك أو العميل.'::text) AS details,
    rv.amount AS diff_amount,
    'سندات القبض'::text AS source_type,
    rv.id AS source_id,
    rv.notes AS info_description,
    ( SELECT partners.name
           FROM public.partners
          WHERE (partners.id = rv.partner_id)) AS info_party
   FROM public.receipt_vouchers rv
  WHERE ((rv.safe_bank_acc_id IS NULL) OR (rv.partner_acc_id IS NULL))
UNION ALL
 SELECT inv.id AS error_id,
    inv.id AS header_id,
    'invoices'::text AS table_name,
    'حساب مفقود في الفاتورة'::text AS error_type,
    inv.date AS error_date,
    (('فاتورة رقم '::text || (COALESCE(inv.invoice_number, 'غير محدد'::character varying))::text) || ' تفتقد لتوجيه الحسابات الأساسية أو الضرائب.'::text) AS details,
    inv.total_amount AS diff_amount,
    'شاشة الفواتير'::text AS source_type,
    inv.id AS source_id,
    inv.description AS info_description,
    inv.client_name AS info_party
   FROM public.invoices inv
  WHERE ((inv.debit_account_id IS NULL) OR (inv.credit_account_id IS NULL) OR (inv.tax_acc_id IS NULL))
UNION ALL
 SELECT ldl.id AS error_id,
    ldl.id AS header_id,
    'labor_daily_logs'::text AS table_name,
    'نقص في التوجيه المالي'::text AS error_type,
    ldl.work_date AS error_date,
    (('يومية للعامل '::text || COALESCE(ldl.worker_name, 'مجهول'::text)) || ' تفتقد التوجيه المحاسبي (مدين/دائن) أو الشريك.'::text) AS details,
    (ldl.attendance_value * ldl.daily_wage) AS diff_amount,
    'يوميات العمالة'::text AS source_type,
    ldl.id AS source_id,
    COALESCE(ldl.notes, ldl.production_desc) AS info_description,
    (((ldl.worker_name || ' ('::text) || COALESCE(ldl.sub_contractor, 'عمالة مباشرة'::text)) || ')'::text) AS info_party
   FROM public.labor_daily_logs ldl
  WHERE ((ldl.debit_account_id IS NULL) OR (ldl.credit_account_id IS NULL) OR (ldl.worker_partner_id IS NULL))
UNION ALL
 SELECT mi.id AS error_id,
    mi.id AS header_id,
    'material_issues'::text AS table_name,
    'إذن صرف شبح'::text AS error_type,
    mi.issue_date AS error_date,
    (('إذن صرف رقم '::text || (COALESCE(mi.issue_number, 'مجهول'::character varying))::text) || ' مسجل بدون أي أصناف محملة داخله.'::text) AS details,
    mi.total_amount AS diff_amount,
    'أذون صرف المخازن'::text AS source_type,
    mi.id AS source_id,
    mi.notes AS info_description,
    COALESCE(mi.contractor_text_name, ( SELECT partners.name
           FROM public.partners
          WHERE (partners.id = mi.subcontractor_id)), 'غير محدد'::character varying) AS info_party
   FROM (public.material_issues mi
     LEFT JOIN public.material_issue_lines mil ON ((mi.id = mil.issue_id)))
  WHERE (mil.id IS NULL)
UNION ALL
 SELECT v.id AS error_id,
    v.id AS header_id,
    'violations'::text AS table_name,
    'مخالفة غير مكتملة التوجيه'::text AS error_type,
    v.date AS error_date,
    'مخالفة تفتقد لحساب الخصم أو حساب إثبات الإيراد.'::text AS details,
    COALESCE(v.amount, (0)::numeric) AS diff_amount,
    'شاشة المخالفات'::text AS source_type,
    v.id AS source_id,
    v.reason AS info_description,
    v.emp_name AS info_party
   FROM public.violations v
  WHERE ((v.debit_account_id IS NULL) OR (v.credit_account_id IS NULL))
UNION ALL
 SELECT jh.id AS error_id,
    jh.id AS header_id,
    'journal_headers'::text AS table_name,
    'قيد شبح (مستند الأصل ممسوح من النظام)'::text AS error_type,
    jh.entry_date AS error_date,
    'تحذير: هذا القيد معلق بالرغم من حذف مستند الأصل بالكامل من النظام (الـ ID غير موجود في أي جدول).'::text AS details,
    ( SELECT COALESCE(sum(lines.debit), (0)::numeric) AS "coalesce"
           FROM public.journal_lines lines
          WHERE (lines.header_id = jh.id)) AS diff_amount,
    COALESCE(jh.v_type, 'غير محدد'::text) AS source_type,
    jh.reference_id AS source_id,
    jh.description AS info_description,
    COALESCE(( SELECT p.name
           FROM (public.journal_lines line
             JOIN public.partners p ON ((line.partner_id = p.id)))
          WHERE ((line.header_id = jh.id) AND (line.partner_id IS NOT NULL))
         LIMIT 1), 'شريك ممسوح أو غير محدد'::character varying) AS info_party
   FROM public.journal_headers jh
  WHERE ((jh.reference_id IS NOT NULL) AND (NOT (EXISTS ( SELECT 1
           FROM public.payment_vouchers
          WHERE (payment_vouchers.id = jh.reference_id)))) AND (NOT (EXISTS ( SELECT 1
           FROM public.receipt_vouchers
          WHERE (receipt_vouchers.id = jh.reference_id)))) AND (NOT (EXISTS ( SELECT 1
           FROM public.sub_claims
          WHERE (sub_claims.id = jh.reference_id)))) AND (NOT (EXISTS ( SELECT 1
           FROM public.invoices
          WHERE (invoices.id = jh.reference_id)))) AND (NOT (EXISTS ( SELECT 1
           FROM public.expenses
          WHERE (expenses.id = jh.reference_id)))) AND (NOT (EXISTS ( SELECT 1
           FROM public.labor_daily_logs
          WHERE (labor_daily_logs.id = jh.reference_id)))) AND (NOT (EXISTS ( SELECT 1
           FROM public.material_issues
          WHERE (material_issues.id = jh.reference_id)))) AND (NOT (EXISTS ( SELECT 1
           FROM public.violations
          WHERE (violations.id = jh.reference_id)))) AND (NOT (EXISTS ( SELECT 1
           FROM public.material_receipts
          WHERE (material_receipts.id = jh.reference_id)))));


--
-- Name: vw_cash_flow_audit; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_cash_flow_audit AS
 SELECT cf.id,
    cf.transaction_date AS "تاريخ الحركة",
        CASE
            WHEN (lower((cf.flow_type)::text) = ANY (ARRAY['inflow'::text, 'in'::text, 'وارد'::text, 'مقبوضات'::text, 'قبض'::text])) THEN '📥 وارد'::text
            WHEN (lower((cf.flow_type)::text) = ANY (ARRAY['outflow'::text, 'out'::text, 'منصرف'::text, 'مدفوعات'::text, 'صرف'::text])) THEN '📤 منصرف'::text
            WHEN (cf.amount > (0)::numeric) THEN '📥 وارد'::text
            WHEN (cf.amount < (0)::numeric) THEN '📤 منصرف'::text
            ELSE 'غير محدد'::text
        END AS "نوع الحركة",
        CASE
            WHEN (lower((cf.source_type)::text) = 'receipt_voucher'::text) THEN '🧾 سند قبض'::text
            WHEN (lower((cf.source_type)::text) = 'payment_voucher'::text) THEN '💸 سند صرف'::text
            WHEN ((cf.source_type IS NOT NULL) AND ((cf.source_type)::text <> ''::text)) THEN ('🔄 '::text || (cf.source_type)::text)
            ELSE '❓ مصدر غير مسجل (يدوي أو سيستم آخر)'::text
        END AS "مصدر الحركة",
    abs(cf.amount) AS "المبلغ",
    cf.reference_number AS "رقم المرجع",
    cf.description AS "البيان / الملاحظات",
    acc.name AS "الخزنة / البنك",
    p."Property" AS "المشروع",
    pr.name AS "الشريك"
   FROM (((public.cash_flows cf
     LEFT JOIN public.projects p ON ((cf.project_id = p.id)))
     LEFT JOIN public.partners pr ON ((cf.partner_id = pr.id)))
     LEFT JOIN public.accounts acc ON ((cf.account_id = acc.id)))
  ORDER BY cf.transaction_date DESC, cf.created_at DESC;


--
-- Name: vw_cash_flow_source_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_cash_flow_source_summary AS
 SELECT
        CASE
            WHEN (lower((source_type)::text) = 'receipt_voucher'::text) THEN '🧾 سندات القبض'::text
            WHEN (lower((source_type)::text) = 'payment_voucher'::text) THEN '💸 سندات الصرف'::text
            WHEN ((source_type IS NOT NULL) AND ((source_type)::text <> ''::text)) THEN ('🔄 '::text || (source_type)::text)
            ELSE '❓ مصادر غير محددة'::text
        END AS "المصدر_الرئيسي",
    count(id) AS "إجمالي_عدد_الحركات",
    sum(
        CASE
            WHEN ((lower((flow_type)::text) = ANY (ARRAY['inflow'::text, 'in'::text, 'وارد'::text, 'مقبوضات'::text, 'قبض'::text])) OR (amount > (0)::numeric)) THEN abs(amount)
            ELSE (0)::numeric
        END) AS "إجمالي_الوارد",
    sum(
        CASE
            WHEN ((lower((flow_type)::text) = ANY (ARRAY['outflow'::text, 'out'::text, 'منصرف'::text, 'مدفوعات'::text, 'صرف'::text])) OR (amount < (0)::numeric)) THEN abs(amount)
            ELSE (0)::numeric
        END) AS "إجمالي_المنصرف"
   FROM public.cash_flows
  GROUP BY
        CASE
            WHEN (lower((source_type)::text) = 'receipt_voucher'::text) THEN '🧾 سندات القبض'::text
            WHEN (lower((source_type)::text) = 'payment_voucher'::text) THEN '💸 سندات الصرف'::text
            WHEN ((source_type IS NOT NULL) AND ((source_type)::text <> ''::text)) THEN ('🔄 '::text || (source_type)::text)
            ELSE '❓ مصادر غير محددة'::text
        END;


--
-- Name: vw_cash_flow_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_cash_flow_summary AS
 SELECT COALESCE(sum(
        CASE
            WHEN ((flow_type)::text = 'inflow'::text) THEN amount
            ELSE (0)::numeric
        END), (0)::numeric) AS total_inflow,
    COALESCE(sum(
        CASE
            WHEN ((flow_type)::text = 'outflow'::text) THEN amount
            ELSE (0)::numeric
        END), (0)::numeric) AS total_outflow,
    COALESCE(sum(
        CASE
            WHEN ((flow_type)::text = 'inflow'::text) THEN amount
            ELSE (- amount)
        END), (0)::numeric) AS net_cash_flow
   FROM public.cash_flows;


--
-- Name: vw_contractor_assignment_net_cost; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_contractor_assignment_net_cost AS
 SELECT id AS assignment_id,
    project_id,
    contractor_id,
    boq_item_id,
    villa_name,
    villa_number,
    status,
    (assigned_qty * unit_price) AS gross_amount,
    COALESCE(( SELECT sum(mil.total_price) AS sum
           FROM ((public.material_issue_lines mil
             JOIN public.material_issues mi ON ((mi.id = mil.issue_id)))
             JOIN public.material_items m_item ON ((m_item.id = mil.item_id)))
          WHERE ((mi.project_id = ca.project_id) AND (mi.subcontractor_id = ca.contractor_id) AND (m_item.boq_item_id = ca.boq_item_id) AND (mi.is_posted = true))), (0)::numeric) AS material_deductions,
    ((assigned_qty * unit_price) - COALESCE(( SELECT sum(mil.total_price) AS sum
           FROM ((public.material_issue_lines mil
             JOIN public.material_issues mi ON ((mi.id = mil.issue_id)))
             JOIN public.material_items m_item ON ((m_item.id = mil.item_id)))
          WHERE ((mi.project_id = ca.project_id) AND (mi.subcontractor_id = ca.contractor_id) AND (m_item.boq_item_id = ca.boq_item_id) AND (mi.is_posted = true))), (0)::numeric)) AS net_amount
   FROM public.contractor_assignments ca;


--
-- Name: vw_inventory_balances; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_inventory_balances AS
 SELECT id AS item_id,
    item_code,
    item_name,
    default_unit AS unit,
    (COALESCE(( SELECT sum(mrl.quantity) AS sum
           FROM (public.material_receipt_lines mrl
             JOIN public.material_receipts mr ON ((mrl.receipt_id = mr.id)))
          WHERE ((mrl.item_id = mi.id) AND (mr.is_posted = true))), (0)::numeric) - COALESCE(( SELECT sum(mil.quantity) AS sum
           FROM (public.material_issue_lines mil
             JOIN public.material_issues mis ON ((mil.issue_id = mis.id)))
          WHERE ((mil.boq_item_id = mi.id) AND (mis.is_posted = true))), (0)::numeric)) AS available_quantity,
    COALESCE(( SELECT mrl.unit_price
           FROM (public.material_receipt_lines mrl
             JOIN public.material_receipts mr ON ((mrl.receipt_id = mr.id)))
          WHERE ((mrl.item_id = mi.id) AND (mr.is_posted = true))
          ORDER BY mr.receipt_date DESC, mr.created_at DESC
         LIMIT 1), default_unit_price, (0)::numeric) AS last_price
   FROM public.material_items mi;


--
-- Name: vw_inventory_balances_v2; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_inventory_balances_v2 AS
 SELECT mi.id AS item_id,
    mi.item_name,
    mi.default_unit AS unit,
    (COALESCE(r.total_received, (0)::numeric) - COALESCE(i.total_issued, (0)::numeric)) AS available_quantity,
    COALESCE(r.last_price, mi.default_unit_price, (0)::numeric) AS last_price
   FROM ((public.material_items mi
     LEFT JOIN ( SELECT l.item_id,
            sum(l.quantity) AS total_received,
            (array_agg(l.unit_price ORDER BY l.created_at DESC))[1] AS last_price
           FROM (public.material_receipt_lines l
             JOIN public.material_receipts h ON ((h.id = l.receipt_id)))
          WHERE ((h.is_posted = true) OR ((h.status)::text = ANY ((ARRAY['مرحل'::character varying, 'معتمد'::character varying])::text[])))
          GROUP BY l.item_id) r ON ((mi.id = r.item_id)))
     LEFT JOIN ( SELECT l.item_id,
            sum(l.quantity) AS total_issued
           FROM (public.material_issue_lines l
             JOIN public.material_issues h ON ((h.id = l.issue_id)))
          WHERE (h.is_posted = true)
          GROUP BY l.item_id) i ON ((mi.id = i.item_id)));


--
-- Name: vw_material_issues_details; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_material_issues_details AS
 SELECT mi.id,
    mi.issue_number,
    mi.issue_date,
    mi.issue_type,
    mi.total_amount,
    mi.is_posted,
    mi.notes,
    mi.project_id,
    p."Property" AS villa_name,
    p.project_code AS villa_code,
    mi.subcontractor_id,
    part.name AS subcontractor_name
   FROM ((public.material_issues mi
     LEFT JOIN public.projects p ON ((mi.project_id = p.id)))
     LEFT JOIN public.partners part ON ((mi.subcontractor_id = part.id)));


--
-- Name: vw_project_comprehensive_ledger; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_project_comprehensive_ledger AS
 SELECT (ll.id)::text AS id,
    ll.work_date AS "التاريخ",
    COALESCE(p.project_name, (p."Property")::text, 'غير محدد'::text) AS "اسم المشروع",
    ('يومية عمال - '::text || (COALESCE(pr.name, (ll.worker_name)::character varying, 'عامل'::character varying))::text) AS "البيان / البند",
    'عمالة مباشرة'::text AS "نوع التكلفة",
    ll.daily_wage AS "التكلفة المحملة (جنيه)"
   FROM ((public.labor_daily_logs ll
     LEFT JOIN public.projects p ON ((ll.project_id = p.id)))
     LEFT JOIN public.partners pr ON ((ll.worker_partner_id = pr.id)))
  WHERE (ll.is_posted = true)
UNION ALL
 SELECT (mi.id)::text AS id,
    mi.issue_date AS "التاريخ",
    COALESCE(p.project_name, (p."Property")::text, 'غير محدد'::text) AS "اسم المشروع",
    ('صرف خامات - '::text || COALESCE(mi.notes, 'بدون ملاحظات'::text)) AS "البيان / البند",
    'خامات ومواد'::text AS "نوع التكلفة",
    mi.total_amount AS "التكلفة المحملة (جنيه)"
   FROM (public.material_issues mi
     LEFT JOIN public.projects p ON ((mi.project_id = p.id)))
  WHERE (mi.is_posted = true)
UNION ALL
 SELECT (sc.id)::text AS id,
    sc.date AS "التاريخ",
    COALESCE(p.project_name, (p."Property")::text, 'غير محدد'::text) AS "اسم المشروع",
    ('مستخلص مقاول - '::text || (COALESCE(pr.name, 'غير محدد'::character varying))::text) AS "البيان / البند",
    'مصروفات مقاولين'::text AS "نوع التكلفة",
    sc.net_amount AS "التكلفة المحملة (جنيه)"
   FROM ((public.sub_claims sc
     LEFT JOIN public.projects p ON ((sc.project_id = p.id)))
     LEFT JOIN public.partners pr ON ((sc.contractor_id = pr.id)))
  WHERE ((sc.status = ANY (ARRAY['مرحل'::text, 'معتمد'::text])) OR (sc.is_posted = true))
UNION ALL
 SELECT (e.id)::text AS id,
    e.exp_date AS "التاريخ",
    COALESCE(p.project_name, (p."Property")::text, 'غير محدد'::text) AS "اسم المشروع",
    ('مصروف: '::text || e.description) AS "البيان / البند",
    'مصروفات عامة'::text AS "نوع التكلفة",
    e.total_price AS "التكلفة المحملة (جنيه)"
   FROM (public.expenses e
     LEFT JOIN public.projects p ON ((e.project_id = p.id)))
  WHERE ((e.is_posted = true) AND (e.project_id IS NOT NULL))
UNION ALL
 SELECT (i.id)::text AS id,
    i.date AS "التاريخ",
    COALESCE(p.project_name, (p."Property")::text, 'غير محدد'::text) AS "اسم المشروع",
    ('فاتورة مشتريات - '::text || (COALESCE(pr.name, 'مورد'::character varying))::text) AS "البيان / البند",
    'خامات ومواد'::text AS "نوع التكلفة",
    i.total_amount AS "التكلفة المحملة (جنيه)"
   FROM ((public.invoices i
     LEFT JOIN public.projects p ON (((p.id)::text = ANY ((i.project_ids)::text[]))))
     LEFT JOIN public.partners pr ON ((i.partner_id = pr.id)))
  WHERE (((i.status)::text = ANY ((ARRAY['مرحل'::character varying, 'معتمد'::character varying])::text[])) AND (i.project_ids IS NOT NULL) AND (array_length(i.project_ids, 1) > 0));


--
-- Name: vw_project_labor_costs; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_project_labor_costs AS
 SELECT (l.id)::text AS id,
    l.project_id,
    p."Property" AS "اسم المشروع",
    l.work_date AS "تاريخ اليومية",
    to_char((l.work_date)::timestamp with time zone, 'YYYY-MM'::text) AS "الشهر المالي",
    bi.item_name AS "اسم البند المتأثر",
    COALESCE(l.attendance_value, (l.number_of_workers)::numeric, (1)::numeric) AS "عدد العمال بالميدان",
    ((COALESCE(NULLIF(regexp_replace((l.daily_wage)::text, '[^0-9.]'::text, ''::text, 'g'::text), ''::text), '0'::text))::numeric * COALESCE(l.attendance_value, (l.number_of_workers)::numeric, (1)::numeric)) AS "تكلفة العمالة الفعلية"
   FROM ((public.labor_daily_logs l
     LEFT JOIN public.projects p ON ((l.project_id = p.id)))
     LEFT JOIN public.boq_items bi ON ((l.work_item_id = bi.id)))
  WHERE (l.project_id IS NOT NULL);


--
-- Name: vw_project_material_reconciliation; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_project_material_reconciliation AS
 SELECT COALESCE(r.project_id, i.project_id) AS project_id,
    p."Property" AS project_name,
    COALESCE(r.item_id, i.item_id) AS item_id,
    COALESCE(r.item_name, i.item_name) AS item_name,
    COALESCE(r.unit, i.unit) AS unit,
    COALESCE(r.total_qty_received, (0)::numeric) AS total_qty_received,
    COALESCE(i.total_qty_issued, (0)::numeric) AS total_qty_issued,
    (COALESCE(r.total_qty_received, (0)::numeric) - COALESCE(i.total_qty_issued, (0)::numeric)) AS remaining_qty_in_site,
    COALESCE(r.total_val_received, (0)::numeric) AS total_val_received,
    COALESCE(i.total_val_issued, (0)::numeric) AS total_val_issued
   FROM ((( SELECT mr.project_id,
            mrl.item_id,
            max(TRIM(BOTH FROM mrl.item_name)) AS item_name,
            max((mrl.unit)::text) AS unit,
            sum(mrl.quantity) AS total_qty_received,
            sum(mrl.total_price) AS total_val_received
           FROM (public.material_receipt_lines mrl
             JOIN public.material_receipts mr ON ((mr.id = mrl.receipt_id)))
          WHERE ((mr.is_posted = true) AND ((mr.status)::text = 'مُعتمد'::text) AND (mr.project_id IS NOT NULL))
          GROUP BY mr.project_id, mrl.item_id) r
     FULL JOIN ( SELECT mi.project_id,
            mil.item_id,
            max(TRIM(BOTH FROM mil.item_name)) AS item_name,
            max((mil.unit)::text) AS unit,
            sum(mil.quantity) AS total_qty_issued,
            sum(mil.total_price) AS total_val_issued
           FROM (public.material_issue_lines mil
             JOIN public.material_issues mi ON ((mi.id = mil.issue_id)))
          WHERE ((mi.is_posted = true) AND (mi.project_id IS NOT NULL))
          GROUP BY mi.project_id, mil.item_id) i ON (((r.project_id = i.project_id) AND (r.item_id = i.item_id))))
     LEFT JOIN public.projects p ON ((p.id = COALESCE(r.project_id, i.project_id))));


--
-- Name: vw_subcontractor_itemized_costs; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_subcontractor_itemized_costs AS
 SELECT (ca.id)::text AS id,
    ca.project_id,
    (((COALESCE(p."Property", 'مشروع غير محدد'::character varying))::text ||
        CASE
            WHEN (ca.villa_name IS NOT NULL) THEN (' - '::text || ca.villa_name)
            ELSE ''::text
        END) ||
        CASE
            WHEN (ca.villa_number IS NOT NULL) THEN ((' ('::text || ca.villa_number) || ')'::text)
            ELSE ''::text
        END) AS full_project_name,
    ca.contractor_id,
    c.name AS contractor_name,
    COALESCE(bb.work_item, bi.item_name, 'بند غير محدد'::text) AS item_name,
    sc.date AS claim_date,
    to_char((sc.date)::timestamp with time zone, 'YYYY-MM'::text) AS financial_month,
    sc.claim_number,
    ca.assigned_qty AS quantity,
    ca.unit_price,
    (ca.assigned_qty * ca.unit_price) AS gross_total,
    COALESCE(( SELECT sum(mil.total_price) AS sum
           FROM (public.material_issue_lines mil
             JOIN public.material_issues mi ON ((mi.id = mil.issue_id)))
          WHERE ((mi.project_id = ca.project_id) AND (mil.item_id = ca.boq_item_id) AND (mi.is_posted = true))), (0)::numeric) AS material_deduction,
    ((ca.assigned_qty * ca.unit_price) - COALESCE(( SELECT sum(mil.total_price) AS sum
           FROM (public.material_issue_lines mil
             JOIN public.material_issues mi ON ((mi.id = mil.issue_id)))
          WHERE ((mi.project_id = ca.project_id) AND (mil.item_id = ca.boq_item_id) AND (mi.is_posted = true))), (0)::numeric)) AS net_total
   FROM (((((public.contractor_assignments ca
     JOIN public.sub_claims sc ON ((ca.claim_id = sc.id)))
     LEFT JOIN public.projects p ON ((ca.project_id = p.id)))
     LEFT JOIN public.partners c ON ((ca.contractor_id = c.id)))
     LEFT JOIN public.boq_budget bb ON ((ca.boq_budget_id = bb.id)))
     LEFT JOIN public.boq_items bi ON ((ca.boq_item_id = bi.id)))
  WHERE ((sc.status = 'مُعتمد'::text) OR (sc.is_posted = true));


--
-- Name: vw_unpaid_invoices; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_unpaid_invoices AS
 SELECT i.invoice_number AS "رقم الفاتورة",
    i.date AS "تاريخ الفاتورة",
    p.name AS "اسم العميل",
    i.total_amount AS "إجمالي الفاتورة",
    i.paid_amount AS "ما تم تحصيله",
    (i.total_amount - i.paid_amount) AS "المبلغ المتبقي (المديونية)",
    i.due_date AS "تاريخ الاستحقاق",
    i.status AS "حالة الفاتورة"
   FROM (public.invoices i
     LEFT JOIN public.partners p ON ((i.partner_id = p.id)))
  WHERE ((i.total_amount > i.paid_amount) AND ((i.status)::text <> 'مسودة'::text))
  ORDER BY i.due_date;


--
-- Name: vw_unread_counts; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_unread_counts AS
 SELECT id AS user_id,
    ( SELECT count(*) AS count
           FROM public.messages m
          WHERE ((m.receiver_id = p.id) AND (m.is_read = false))) AS unread_messages,
    ( SELECT count(*) AS count
           FROM public.notifications n
          WHERE ((n.user_id = p.id) AND (n.is_read = false))) AS unread_notifications
   FROM public.profiles p;


--
-- Name: accounts accounts_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_code_key UNIQUE (code);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: boq_budget boq_budget_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boq_budget
    ADD CONSTRAINT boq_budget_code_unique UNIQUE (budget_code);


--
-- Name: boq_budget boq_budget_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boq_budget
    ADD CONSTRAINT boq_budget_pkey PRIMARY KEY (id);


--
-- Name: boq_items boq_items_item_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boq_items
    ADD CONSTRAINT boq_items_item_code_key UNIQUE (item_code);


--
-- Name: boq_items boq_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boq_items
    ADD CONSTRAINT boq_items_pkey PRIMARY KEY (id);


--
-- Name: cash_flows cash_flows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_flows
    ADD CONSTRAINT cash_flows_pkey PRIMARY KEY (id);


--
-- Name: contractor_assignments contractor_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contractor_assignments
    ADD CONSTRAINT contractor_assignments_pkey PRIMARY KEY (id);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: financial_plans financial_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_plans
    ADD CONSTRAINT financial_plans_pkey PRIMARY KEY (id);


--
-- Name: inventory inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_invoice_number_key UNIQUE (invoice_number);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: job_orders job_orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_orders
    ADD CONSTRAINT job_orders_order_number_key UNIQUE (order_number);


--
-- Name: job_orders job_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_orders
    ADD CONSTRAINT job_orders_pkey PRIMARY KEY (id);


--
-- Name: journal_errors journal_errors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_errors
    ADD CONSTRAINT journal_errors_pkey PRIMARY KEY (id);


--
-- Name: journal_headers journal_headers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_headers
    ADD CONSTRAINT journal_headers_pkey PRIMARY KEY (id);


--
-- Name: journal_lines journal_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_lines
    ADD CONSTRAINT journal_lines_pkey PRIMARY KEY (id);


--
-- Name: labor_daily_logs labor_daily_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.labor_daily_logs
    ADD CONSTRAINT labor_daily_logs_pkey PRIMARY KEY (id);


--
-- Name: manual_journals manual_journals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_journals
    ADD CONSTRAINT manual_journals_pkey PRIMARY KEY (id);


--
-- Name: manual_journals manual_journals_voucher_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_journals
    ADD CONSTRAINT manual_journals_voucher_number_key UNIQUE (voucher_number);


--
-- Name: material_issue_lines material_issue_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_issue_lines
    ADD CONSTRAINT material_issue_lines_pkey PRIMARY KEY (id);


--
-- Name: material_issues material_issues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_issues
    ADD CONSTRAINT material_issues_pkey PRIMARY KEY (id);


--
-- Name: material_items material_items_item_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_items
    ADD CONSTRAINT material_items_item_code_key UNIQUE (item_code);


--
-- Name: material_items material_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_items
    ADD CONSTRAINT material_items_pkey PRIMARY KEY (id);


--
-- Name: material_receipt_lines material_receipt_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_receipt_lines
    ADD CONSTRAINT material_receipt_lines_pkey PRIMARY KEY (id);


--
-- Name: material_receipts material_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_receipts
    ADD CONSTRAINT material_receipts_pkey PRIMARY KEY (id);


--
-- Name: material_receipts material_receipts_receipt_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_receipts
    ADD CONSTRAINT material_receipts_receipt_number_key UNIQUE (receipt_number);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: partners partners_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partners
    ADD CONSTRAINT partners_code_key UNIQUE (code);


--
-- Name: partners partners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partners
    ADD CONSTRAINT partners_pkey PRIMARY KEY (id);


--
-- Name: payment_vouchers payment_vouchers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_vouchers
    ADD CONSTRAINT payment_vouchers_pkey PRIMARY KEY (id);


--
-- Name: payment_vouchers payment_vouchers_voucher_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_vouchers
    ADD CONSTRAINT payment_vouchers_voucher_number_key UNIQUE (voucher_number);


--
-- Name: payroll_slips payroll_slips_emp_month_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_slips
    ADD CONSTRAINT payroll_slips_emp_month_unique UNIQUE (emp_id, month);


--
-- Name: payroll_slips payroll_slips_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_slips
    ADD CONSTRAINT payroll_slips_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_username_key UNIQUE (username);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: projects projects_project_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_project_code_key UNIQUE (project_code);


--
-- Name: receipt_vouchers receipt_vouchers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipt_vouchers
    ADD CONSTRAINT receipt_vouchers_pkey PRIMARY KEY (id);


--
-- Name: receipt_vouchers receipt_vouchers_receipt_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipt_vouchers
    ADD CONSTRAINT receipt_vouchers_receipt_number_key UNIQUE (receipt_number);


--
-- Name: sub_claims sub_claims_claim_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sub_claims
    ADD CONSTRAINT sub_claims_claim_number_key UNIQUE (claim_number);


--
-- Name: sub_claims sub_claims_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sub_claims
    ADD CONSTRAINT sub_claims_pkey PRIMARY KEY (id);


--
-- Name: sys_financial_reports sys_financial_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sys_financial_reports
    ADD CONSTRAINT sys_financial_reports_pkey PRIMARY KEY (report_name);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: temp_labor_daily_logs temp_labor_daily_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temp_labor_daily_logs
    ADD CONSTRAINT temp_labor_daily_logs_pkey PRIMARY KEY (id);


--
-- Name: material_items unique_material_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_items
    ADD CONSTRAINT unique_material_name_key UNIQUE (item_name);


--
-- Name: projects unique_project_name_idx; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT unique_project_name_idx UNIQUE ("Property");


--
-- Name: cash_flows unique_source_flow; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_flows
    ADD CONSTRAINT unique_source_flow UNIQUE (source_id, source_type);


--
-- Name: user_requests user_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_requests
    ADD CONSTRAINT user_requests_pkey PRIMARY KEY (id);


--
-- Name: user_tasks user_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_tasks
    ADD CONSTRAINT user_tasks_pkey PRIMARY KEY (id);


--
-- Name: violations violations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.violations
    ADD CONSTRAINT violations_pkey PRIMARY KEY (id);


--
-- Name: idx_boq_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_boq_parent ON public.boq_budget USING btree (parent_id);


--
-- Name: idx_boq_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_boq_project ON public.boq_budget USING btree (project_id);


--
-- Name: idx_cash_flows_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cash_flows_account ON public.cash_flows USING btree (account_id);


--
-- Name: idx_cash_flows_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cash_flows_date ON public.cash_flows USING btree (transaction_date);


--
-- Name: idx_cash_flows_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cash_flows_project ON public.cash_flows USING btree (project_id);


--
-- Name: idx_cash_flows_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cash_flows_type ON public.cash_flows USING btree (flow_type);


--
-- Name: idx_expenses_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_account ON public.expenses USING btree (creditor_account);


--
-- Name: idx_expenses_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_date ON public.expenses USING btree (exp_date);


--
-- Name: idx_labor_contractor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_labor_contractor ON public.labor_daily_logs USING btree (sub_contractor);


--
-- Name: idx_labor_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_labor_date ON public.labor_daily_logs USING btree (work_date);


--
-- Name: idx_labor_date_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_labor_date_item ON public.labor_daily_logs USING btree (work_date, project_id, work_item_id);


--
-- Name: idx_labor_site; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_labor_site ON public.labor_daily_logs USING btree (site_ref);


--
-- Name: idx_material_items_boq_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_material_items_boq_id ON public.material_items USING btree (boq_item_id);


--
-- Name: idx_material_items_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_material_items_search ON public.material_items USING btree (item_name, item_code);


--
-- Name: idx_partners_name_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partners_name_code ON public.partners USING btree (name, code);


--
-- Name: idx_pv_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pv_date ON public.payment_vouchers USING btree (date);


--
-- Name: idx_pv_partner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pv_partner ON public.payment_vouchers USING btree (partner_id);


--
-- Name: idx_pv_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pv_status ON public.payment_vouchers USING btree (status);


--
-- Name: idx_violations_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_violations_date ON public.violations USING btree (date);


--
-- Name: messages after_message_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER after_message_insert AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.trigger_message_notification();


--
-- Name: accounts audit_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_trigger AFTER INSERT OR DELETE OR UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: boq_budget audit_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_trigger AFTER INSERT OR DELETE OR UPDATE ON public.boq_budget FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: boq_items audit_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_trigger AFTER INSERT OR DELETE OR UPDATE ON public.boq_items FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: expenses audit_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_trigger AFTER INSERT OR DELETE OR UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: invoices audit_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_trigger AFTER INSERT OR DELETE OR UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: job_orders audit_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_trigger AFTER INSERT OR DELETE OR UPDATE ON public.job_orders FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: journal_headers audit_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_trigger AFTER INSERT OR DELETE OR UPDATE ON public.journal_headers FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: journal_lines audit_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_trigger AFTER INSERT OR DELETE OR UPDATE ON public.journal_lines FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: labor_daily_logs audit_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_trigger AFTER INSERT OR DELETE OR UPDATE ON public.labor_daily_logs FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: material_issues audit_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_trigger AFTER INSERT OR DELETE OR UPDATE ON public.material_issues FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: material_receipts audit_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_trigger AFTER INSERT OR DELETE OR UPDATE ON public.material_receipts FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: partners audit_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_trigger AFTER INSERT OR DELETE OR UPDATE ON public.partners FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: payment_vouchers audit_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_trigger AFTER INSERT OR DELETE OR UPDATE ON public.payment_vouchers FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: profiles audit_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_trigger AFTER INSERT OR DELETE OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: projects audit_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_trigger AFTER INSERT OR DELETE OR UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: receipt_vouchers audit_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_trigger AFTER INSERT OR DELETE OR UPDATE ON public.receipt_vouchers FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: sub_claims audit_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_trigger AFTER INSERT OR DELETE OR UPDATE ON public.sub_claims FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: expenses trg_auto_link_expense; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_auto_link_expense BEFORE INSERT OR UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.auto_link_expense_to_job_order();


--
-- Name: material_issue_lines trg_auto_link_material; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_auto_link_material BEFORE INSERT OR UPDATE ON public.material_issue_lines FOR EACH ROW EXECUTE FUNCTION public.auto_link_material_to_job_order();


--
-- Name: labor_daily_logs trg_auto_site_ref; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_auto_site_ref BEFORE INSERT OR UPDATE OF project_id ON public.labor_daily_logs FOR EACH ROW EXECUTE FUNCTION public.set_site_ref_auto();


--
-- Name: contractor_assignments trg_auto_villa_name; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_auto_villa_name BEFORE INSERT OR UPDATE OF project_id ON public.contractor_assignments FOR EACH ROW EXECUTE FUNCTION public.set_villa_name_auto();


--
-- Name: expenses trg_boq_update_from_expenses; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_boq_update_from_expenses AFTER INSERT OR DELETE OR UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.trigger_boq_update_from_expenses();


--
-- Name: temp_labor_daily_logs trg_fix_temp_import_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fix_temp_import_id BEFORE INSERT ON public.temp_labor_daily_logs FOR EACH ROW EXECUTE FUNCTION public.fix_temp_import_id();


--
-- Name: job_orders trg_job_order_to_assignment; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_job_order_to_assignment AFTER INSERT OR UPDATE ON public.job_orders FOR EACH ROW EXECUTE FUNCTION public.auto_create_contractor_assignment();


--
-- Name: payment_vouchers trg_payment_cash_flow; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_payment_cash_flow AFTER INSERT OR DELETE OR UPDATE ON public.payment_vouchers FOR EACH ROW EXECUTE FUNCTION public.handle_payment_voucher_cash_flow();


--
-- Name: journal_headers trg_protect_journal_headers; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_protect_journal_headers BEFORE UPDATE ON public.journal_headers FOR EACH ROW EXECUTE FUNCTION public.protect_journal_headers();


--
-- Name: journal_lines trg_protect_journal_lines; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_protect_journal_lines BEFORE INSERT OR UPDATE ON public.journal_lines FOR EACH ROW EXECUTE FUNCTION public.protect_journal_lines();


--
-- Name: receipt_vouchers trg_receipt_cash_flow; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_receipt_cash_flow AFTER INSERT OR DELETE OR UPDATE ON public.receipt_vouchers FOR EACH ROW EXECUTE FUNCTION public.handle_receipt_voucher_cash_flow();


--
-- Name: journal_headers trg_refresh_financial_reports_headers; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_refresh_financial_reports_headers AFTER UPDATE OF status ON public.journal_headers FOR EACH STATEMENT EXECUTE FUNCTION public.trg_refresh_financial_reports();


--
-- Name: journal_lines trg_refresh_financial_reports_lines; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_refresh_financial_reports_lines AFTER INSERT OR DELETE OR UPDATE ON public.journal_lines FOR EACH STATEMENT EXECUTE FUNCTION public.trg_refresh_financial_reports();


--
-- Name: receipt_vouchers trg_sync_invoice_payments; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_invoice_payments AFTER INSERT OR DELETE OR UPDATE ON public.receipt_vouchers FOR EACH ROW EXECUTE FUNCTION public.sync_invoice_payments();


--
-- Name: payment_vouchers trg_update_expense_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_expense_status AFTER INSERT OR DELETE OR UPDATE ON public.payment_vouchers FOR EACH ROW EXECUTE FUNCTION public.handle_expense_status_on_payment();


--
-- Name: expenses trigger_auto_bind_payee_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_auto_bind_payee_id BEFORE INSERT OR UPDATE OF sub_contractor ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.auto_bind_payee_id_from_subcontractor();


--
-- Name: violations trigger_auto_fill_violation_names; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_auto_fill_violation_names BEFORE INSERT OR UPDATE ON public.violations FOR EACH ROW EXECUTE FUNCTION public.auto_fill_violation_names();


--
-- Name: invoices trigger_invoice_revenue_recalc; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_invoice_revenue_recalc AFTER INSERT OR DELETE OR UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_boq_revenue_from_invoice_live();


--
-- Name: boq_budget trigger_maintain_boq_property_name; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_maintain_boq_property_name BEFORE INSERT OR UPDATE OF project_id ON public.boq_budget FOR EACH ROW EXECUTE FUNCTION public.maintain_boq_property_name();


--
-- Name: material_issue_lines trigger_maintain_material_issue_boq_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_maintain_material_issue_boq_id BEFORE INSERT OR UPDATE OF boq_item_id, item_name, boq_id ON public.material_issue_lines FOR EACH ROW EXECUTE FUNCTION public.maintain_material_issue_boq_id();


--
-- Name: boq_budget trigger_sync_boq_on_save; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_boq_on_save BEFORE INSERT OR UPDATE OF project_id, boq_item_id ON public.boq_budget FOR EACH ROW EXECUTE FUNCTION public.sync_boq_from_logs_on_save();


--
-- Name: labor_daily_logs trigger_update_boq_labor_cost; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_boq_labor_cost AFTER INSERT OR DELETE OR UPDATE OF daily_wage, project_id, work_item_id ON public.labor_daily_logs FOR EACH ROW EXECUTE FUNCTION public.update_boq_labor_cost_live();


--
-- Name: material_issue_lines trigger_update_boq_material_cost_live; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_boq_material_cost_live AFTER INSERT OR DELETE OR UPDATE OF total_price, boq_item_id, issue_id ON public.material_issue_lines FOR EACH ROW EXECUTE FUNCTION public.update_boq_material_cost_live();


--
-- Name: labor_daily_logs trigger_update_boq_quantity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_boq_quantity AFTER INSERT OR DELETE OR UPDATE OF completed_quantity, productivity ON public.labor_daily_logs FOR EACH ROW EXECUTE FUNCTION public.update_boq_actual_quantity();


--
-- Name: accounts accounts_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.accounts(id);


--
-- Name: audit_logs audit_logs_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: boq_budget boq_budget_boq_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boq_budget
    ADD CONSTRAINT boq_budget_boq_item_id_fkey FOREIGN KEY (boq_item_id) REFERENCES public.boq_items(id) ON DELETE SET NULL;


--
-- Name: boq_budget boq_budget_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boq_budget
    ADD CONSTRAINT boq_budget_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.boq_budget(id) ON DELETE CASCADE;


--
-- Name: boq_budget boq_budget_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boq_budget
    ADD CONSTRAINT boq_budget_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: cash_flows cash_flows_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_flows
    ADD CONSTRAINT cash_flows_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;


--
-- Name: cash_flows cash_flows_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_flows
    ADD CONSTRAINT cash_flows_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partners(id) ON DELETE SET NULL;


--
-- Name: cash_flows cash_flows_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_flows
    ADD CONSTRAINT cash_flows_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: contractor_assignments contractor_assignments_boq_budget_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contractor_assignments
    ADD CONSTRAINT contractor_assignments_boq_budget_id_fkey FOREIGN KEY (boq_budget_id) REFERENCES public.boq_budget(id) ON DELETE CASCADE;


--
-- Name: contractor_assignments contractor_assignments_boq_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contractor_assignments
    ADD CONSTRAINT contractor_assignments_boq_item_id_fkey FOREIGN KEY (boq_item_id) REFERENCES public.boq_items(id);


--
-- Name: contractor_assignments contractor_assignments_claim_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contractor_assignments
    ADD CONSTRAINT contractor_assignments_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES public.sub_claims(id) ON DELETE SET NULL;


--
-- Name: contractor_assignments contractor_assignments_contractor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contractor_assignments
    ADD CONSTRAINT contractor_assignments_contractor_id_fkey FOREIGN KEY (contractor_id) REFERENCES public.partners(id);


--
-- Name: contractor_assignments contractor_assignments_job_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contractor_assignments
    ADD CONSTRAINT contractor_assignments_job_order_id_fkey FOREIGN KEY (job_order_id) REFERENCES public.job_orders(id) ON DELETE SET NULL;


--
-- Name: contractor_assignments contractor_assignments_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contractor_assignments
    ADD CONSTRAINT contractor_assignments_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: expenses expenses_job_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_job_order_id_fkey FOREIGN KEY (job_order_id) REFERENCES public.job_orders(id) ON DELETE SET NULL;


--
-- Name: expenses expenses_payee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_payee_id_fkey FOREIGN KEY (payee_id) REFERENCES public.partners(id) ON DELETE SET NULL;


--
-- Name: expenses expenses_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: material_issue_lines fk_material_issue_item; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_issue_lines
    ADD CONSTRAINT fk_material_issue_item FOREIGN KEY (item_id) REFERENCES public.material_items(id) ON DELETE SET NULL;


--
-- Name: material_items fk_material_items_boq_item; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_items
    ADD CONSTRAINT fk_material_items_boq_item FOREIGN KEY (boq_item_id) REFERENCES public.boq_items(id) ON DELETE SET NULL;


--
-- Name: material_issue_lines fk_material_lines_claim; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_issue_lines
    ADD CONSTRAINT fk_material_lines_claim FOREIGN KEY (claim_id) REFERENCES public.sub_claims(id) ON DELETE SET NULL;


--
-- Name: material_receipt_lines fk_material_receipt_item; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_receipt_lines
    ADD CONSTRAINT fk_material_receipt_item FOREIGN KEY (item_id) REFERENCES public.material_items(id) ON DELETE SET NULL;


--
-- Name: material_receipt_lines fk_receipt_lines_boq_budget; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_receipt_lines
    ADD CONSTRAINT fk_receipt_lines_boq_budget FOREIGN KEY (boq_id) REFERENCES public.boq_budget(id) ON DELETE SET NULL;


--
-- Name: material_receipt_lines fk_receipt_lines_boq_items; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_receipt_lines
    ADD CONSTRAINT fk_receipt_lines_boq_items FOREIGN KEY (boq_item_id) REFERENCES public.boq_items(id) ON DELETE SET NULL;


--
-- Name: violations fk_violations_boq_item; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.violations
    ADD CONSTRAINT fk_violations_boq_item FOREIGN KEY (boq_item_id) REFERENCES public.boq_items(id) ON DELETE SET NULL;


--
-- Name: invoices invoices_credit_acc_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_credit_acc_fkey FOREIGN KEY (credit_account_id) REFERENCES public.accounts(id);


--
-- Name: invoices invoices_debit_acc_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_debit_acc_fkey FOREIGN KEY (debit_account_id) REFERENCES public.accounts(id);


--
-- Name: invoices invoices_guarantee_acc_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_guarantee_acc_fkey FOREIGN KEY (guarantee_acc_id) REFERENCES public.accounts(id);


--
-- Name: invoices invoices_materials_acc_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_materials_acc_fkey FOREIGN KEY (materials_acc_id) REFERENCES public.accounts(id);


--
-- Name: invoices invoices_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partners(id) ON DELETE SET NULL;


--
-- Name: invoices invoices_tax_acc_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_tax_acc_fkey FOREIGN KEY (tax_acc_id) REFERENCES public.accounts(id);


--
-- Name: job_orders job_orders_boq_budget_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_orders
    ADD CONSTRAINT job_orders_boq_budget_id_fkey FOREIGN KEY (boq_budget_id) REFERENCES public.boq_budget(id) ON DELETE RESTRICT;


--
-- Name: job_orders job_orders_contractor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_orders
    ADD CONSTRAINT job_orders_contractor_id_fkey FOREIGN KEY (contractor_id) REFERENCES public.partners(id);


--
-- Name: job_orders job_orders_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_orders
    ADD CONSTRAINT job_orders_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: journal_headers journal_headers_job_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_headers
    ADD CONSTRAINT journal_headers_job_order_id_fkey FOREIGN KEY (job_order_id) REFERENCES public.job_orders(id) ON DELETE SET NULL;


--
-- Name: journal_lines journal_lines_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_lines
    ADD CONSTRAINT journal_lines_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: journal_lines journal_lines_debit_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_lines
    ADD CONSTRAINT journal_lines_debit_account_id_fkey FOREIGN KEY (debit_account_id) REFERENCES public.accounts(id);


--
-- Name: journal_lines journal_lines_header_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_lines
    ADD CONSTRAINT journal_lines_header_id_fkey FOREIGN KEY (header_id) REFERENCES public.journal_headers(id) ON DELETE CASCADE;


--
-- Name: journal_lines journal_lines_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_lines
    ADD CONSTRAINT journal_lines_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partners(id) ON DELETE SET NULL;


--
-- Name: journal_lines journal_lines_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_lines
    ADD CONSTRAINT journal_lines_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: labor_daily_logs labor_daily_logs_debit_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.labor_daily_logs
    ADD CONSTRAINT labor_daily_logs_debit_account_id_fkey FOREIGN KEY (debit_account_id) REFERENCES public.accounts(id);


--
-- Name: labor_daily_logs labor_daily_logs_job_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.labor_daily_logs
    ADD CONSTRAINT labor_daily_logs_job_order_id_fkey FOREIGN KEY (job_order_id) REFERENCES public.job_orders(id) ON DELETE SET NULL;


--
-- Name: labor_daily_logs labor_daily_logs_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.labor_daily_logs
    ADD CONSTRAINT labor_daily_logs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: labor_daily_logs labor_daily_logs_sub_contractor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.labor_daily_logs
    ADD CONSTRAINT labor_daily_logs_sub_contractor_id_fkey FOREIGN KEY (sub_contractor_id) REFERENCES public.partners(id);


--
-- Name: labor_daily_logs labor_daily_logs_work_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.labor_daily_logs
    ADD CONSTRAINT labor_daily_logs_work_item_id_fkey FOREIGN KEY (work_item_id) REFERENCES public.boq_items(id);


--
-- Name: labor_daily_logs labor_daily_logs_worker_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.labor_daily_logs
    ADD CONSTRAINT labor_daily_logs_worker_partner_id_fkey FOREIGN KEY (worker_partner_id) REFERENCES public.partners(id);


--
-- Name: manual_journals manual_journals_credit_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_journals
    ADD CONSTRAINT manual_journals_credit_account_id_fkey FOREIGN KEY (credit_account_id) REFERENCES public.accounts(id);


--
-- Name: manual_journals manual_journals_debit_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_journals
    ADD CONSTRAINT manual_journals_debit_account_id_fkey FOREIGN KEY (debit_account_id) REFERENCES public.accounts(id);


--
-- Name: manual_journals manual_journals_job_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_journals
    ADD CONSTRAINT manual_journals_job_order_id_fkey FOREIGN KEY (job_order_id) REFERENCES public.job_orders(id) ON DELETE SET NULL;


--
-- Name: manual_journals manual_journals_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_journals
    ADD CONSTRAINT manual_journals_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partners(id);


--
-- Name: manual_journals manual_journals_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_journals
    ADD CONSTRAINT manual_journals_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: material_issue_lines material_issue_lines_boq_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_issue_lines
    ADD CONSTRAINT material_issue_lines_boq_id_fkey FOREIGN KEY (boq_id) REFERENCES public.boq_budget(id) ON DELETE SET NULL;


--
-- Name: material_issue_lines material_issue_lines_boq_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_issue_lines
    ADD CONSTRAINT material_issue_lines_boq_item_id_fkey FOREIGN KEY (boq_item_id) REFERENCES public.boq_items(id) ON DELETE SET NULL;


--
-- Name: material_issue_lines material_issue_lines_issue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_issue_lines
    ADD CONSTRAINT material_issue_lines_issue_id_fkey FOREIGN KEY (issue_id) REFERENCES public.material_issues(id) ON DELETE CASCADE;


--
-- Name: material_issue_lines material_issue_lines_job_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_issue_lines
    ADD CONSTRAINT material_issue_lines_job_order_id_fkey FOREIGN KEY (job_order_id) REFERENCES public.job_orders(id) ON DELETE SET NULL;


--
-- Name: material_issues material_issues_claim_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_issues
    ADD CONSTRAINT material_issues_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES public.sub_claims(id) ON DELETE SET NULL;


--
-- Name: material_issues material_issues_jv_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_issues
    ADD CONSTRAINT material_issues_jv_id_fkey FOREIGN KEY (jv_id) REFERENCES public.journal_headers(id) ON DELETE SET NULL;


--
-- Name: material_issues material_issues_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_issues
    ADD CONSTRAINT material_issues_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: material_issues material_issues_subcontractor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_issues
    ADD CONSTRAINT material_issues_subcontractor_id_fkey FOREIGN KEY (subcontractor_id) REFERENCES public.partners(id) ON DELETE SET NULL;


--
-- Name: material_receipt_lines material_receipt_lines_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_receipt_lines
    ADD CONSTRAINT material_receipt_lines_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: material_receipt_lines material_receipt_lines_receipt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_receipt_lines
    ADD CONSTRAINT material_receipt_lines_receipt_id_fkey FOREIGN KEY (receipt_id) REFERENCES public.material_receipts(id) ON DELETE CASCADE;


--
-- Name: material_receipts material_receipts_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_receipts
    ADD CONSTRAINT material_receipts_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: material_receipts material_receipts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_receipts
    ADD CONSTRAINT material_receipts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: material_receipts material_receipts_jv_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_receipts
    ADD CONSTRAINT material_receipts_jv_id_fkey FOREIGN KEY (jv_id) REFERENCES public.journal_headers(id) ON DELETE SET NULL;


--
-- Name: material_receipts material_receipts_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_receipts
    ADD CONSTRAINT material_receipts_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: material_receipts material_receipts_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_receipts
    ADD CONSTRAINT material_receipts_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.partners(id);


--
-- Name: messages messages_receiver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.profiles(id);


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id);


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: partners partners_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partners
    ADD CONSTRAINT partners_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: payment_vouchers payment_vouchers_credit_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_vouchers
    ADD CONSTRAINT payment_vouchers_credit_account_id_fkey FOREIGN KEY (credit_account_id) REFERENCES public.accounts(id);


--
-- Name: payment_vouchers payment_vouchers_debit_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_vouchers
    ADD CONSTRAINT payment_vouchers_debit_account_id_fkey FOREIGN KEY (debit_account_id) REFERENCES public.accounts(id);


--
-- Name: payment_vouchers payment_vouchers_job_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_vouchers
    ADD CONSTRAINT payment_vouchers_job_order_id_fkey FOREIGN KEY (job_order_id) REFERENCES public.job_orders(id) ON DELETE SET NULL;


--
-- Name: payment_vouchers payment_vouchers_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_vouchers
    ADD CONSTRAINT payment_vouchers_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partners(id);


--
-- Name: payment_vouchers payment_vouchers_related_expense_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_vouchers
    ADD CONSTRAINT payment_vouchers_related_expense_id_fkey FOREIGN KEY (related_expense_id) REFERENCES public.expenses(id);


--
-- Name: payment_vouchers payment_vouchers_sub_claim_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_vouchers
    ADD CONSTRAINT payment_vouchers_sub_claim_id_fkey FOREIGN KEY (sub_claim_id) REFERENCES public.sub_claims(id) ON DELETE CASCADE;


--
-- Name: payroll_slips payroll_slips_emp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_slips
    ADD CONSTRAINT payroll_slips_emp_id_fkey FOREIGN KEY (emp_id) REFERENCES public.partners(id);


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id);


--
-- Name: profiles profiles_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_partner_id_fkey FOREIGN KEY (linked_partner_id) REFERENCES public.partners(id);


--
-- Name: projects projects_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.partners(id) ON DELETE SET NULL;


--
-- Name: receipt_vouchers receipt_vouchers_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipt_vouchers
    ADD CONSTRAINT receipt_vouchers_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;


--
-- Name: receipt_vouchers receipt_vouchers_partner_acc_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipt_vouchers
    ADD CONSTRAINT receipt_vouchers_partner_acc_id_fkey FOREIGN KEY (partner_acc_id) REFERENCES public.accounts(id);


--
-- Name: receipt_vouchers receipt_vouchers_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipt_vouchers
    ADD CONSTRAINT receipt_vouchers_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partners(id) ON DELETE RESTRICT;


--
-- Name: receipt_vouchers receipt_vouchers_safe_bank_acc_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipt_vouchers
    ADD CONSTRAINT receipt_vouchers_safe_bank_acc_id_fkey FOREIGN KEY (safe_bank_acc_id) REFERENCES public.accounts(id);


--
-- Name: sub_claims sub_claims_contractor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sub_claims
    ADD CONSTRAINT sub_claims_contractor_id_fkey FOREIGN KEY (contractor_id) REFERENCES public.partners(id);


--
-- Name: sub_claims sub_claims_job_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sub_claims
    ADD CONSTRAINT sub_claims_job_order_id_fkey FOREIGN KEY (job_order_id) REFERENCES public.job_orders(id) ON DELETE SET NULL;


--
-- Name: sub_claims sub_claims_jv_header_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sub_claims
    ADD CONSTRAINT sub_claims_jv_header_id_fkey FOREIGN KEY (jv_header_id) REFERENCES public.journal_headers(id);


--
-- Name: sub_claims sub_claims_jv_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sub_claims
    ADD CONSTRAINT sub_claims_jv_id_fkey FOREIGN KEY (jv_id) REFERENCES public.journal_headers(id) ON DELETE SET NULL;


--
-- Name: sub_claims sub_claims_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sub_claims
    ADD CONSTRAINT sub_claims_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: system_settings system_settings_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id);


--
-- Name: user_requests user_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_requests
    ADD CONSTRAINT user_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: user_tasks user_tasks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_tasks
    ADD CONSTRAINT user_tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: violations violations_credit_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.violations
    ADD CONSTRAINT violations_credit_account_id_fkey FOREIGN KEY (credit_account_id) REFERENCES public.accounts(id);


--
-- Name: violations violations_debit_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.violations
    ADD CONSTRAINT violations_debit_account_id_fkey FOREIGN KEY (debit_account_id) REFERENCES public.accounts(id);


--
-- Name: violations violations_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.violations
    ADD CONSTRAINT violations_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partners(id);


--
-- Name: violations violations_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.violations
    ADD CONSTRAINT violations_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: material_receipt_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.material_receipt_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: material_receipts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.material_receipts ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;


-- Fresh-install access rules. No old business data is imported.
CREATE SCHEMA IF NOT EXISTS rawasi_private;
REVOKE ALL ON SCHEMA rawasi_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA rawasi_private TO authenticated, service_role;
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;

CREATE FUNCTION rawasi_private.can_access(module_name text, action_name text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.id = (SELECT auth.uid())
      AND COALESCE(p.is_active, true)
      AND (
        p.is_admin OR p.role IN ('admin', 'super_admin')
        OR CASE WHEN jsonb_typeof(p.permissions -> module_name) = 'array'
          THEN (p.permissions -> module_name) ? action_name
          ELSE p.permissions -> module_name ->> action_name = 'true'
        END
      )
  );
$$;

CREATE FUNCTION rawasi_private.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$ SELECT rawasi_private.can_access(NULL, NULL); $$;

-- Do not allow self-service signup metadata to assign administrative roles.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, permissions, is_admin, is_active)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name', NEW.email, 'client', '{}'::jsonb, false, true);
  RETURN NEW;
END;
$$;

-- Keep owner activity in the audit trail too.
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  old_record jsonb;
  new_record jsonb;
  record_uuid uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_record := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN new_record := to_jsonb(NEW); END IF;
  IF TG_OP = 'UPDATE' AND old_record IS NOT DISTINCT FROM new_record THEN RETURN NEW; END IF;
  BEGIN
    record_uuid := COALESCE(new_record ->> 'id', old_record ->> 'id')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN record_uuid := NULL;
  END;
  INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
  VALUES (TG_TABLE_NAME, record_uuid, TG_OP, old_record, new_record, auth.uid());
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- Trigger functions are internal implementation, not public RPC endpoints.
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS signature, p.proname
    FROM pg_proc AS p JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prorettype = 'pg_catalog.trigger'::regtype
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions, pg_temp', f.signature);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.signature);
    EXECUTE format('ALTER FUNCTION %s SECURITY DEFINER', f.signature);
    EXECUTE format('ALTER FUNCTION %s SET SCHEMA rawasi_private', f.signature);
  END LOOP;
END;
$$;

-- RPCs must obey table policies rather than bypassing them.
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc AS p JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
  LOOP
    EXECUTE format('ALTER FUNCTION %s SECURITY INVOKER', f.signature);
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions, pg_temp', f.signature);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f.signature);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_user_permission(module_id text, action_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$ SELECT rawasi_private.can_access(module_id, action_id); $$;

CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$ SELECT rawasi_private.is_admin(); $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA rawasi_private FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION rawasi_private.can_access(text, text), rawasi_private.is_admin()
  TO authenticated, service_role;

-- Authorize shared company records by their module permissions.
DO $$
DECLARE t record; action_name text; predicate text;
BEGIN
  FOR t IN SELECT * FROM (VALUES
    ('accounts', 'accounts'), ('boq_budget', 'boqbudget'), ('boq_items', 'boqcatalog'),
    ('expenses', 'expenses'), ('job_orders', 'projects'), ('labor_daily_logs', 'labor_logs'),
    ('projects', 'projects'), ('journal_headers', 'journal'), ('journal_lines', 'journal'),
    ('partners', 'partners'), ('contractor_assignments', 'subclaims'),
    ('material_issue_lines', 'material_issues'), ('cash_flows', 'cashflows'),
    ('financial_plans', 'financialplan'), ('inventory', 'materialitems'), ('invoices', 'invoices'),
    ('material_issues', 'material_issues'), ('journal_errors', 'journal_errors'),
    ('manual_journals', 'journal'), ('material_items', 'materialitems'),
    ('material_receipt_lines', 'materials'), ('material_receipts', 'materials'),
    ('payment_vouchers', 'payments'), ('payroll_slips', 'payroll'),
    ('receipt_vouchers', 'receipts'), ('sub_claims', 'subclaims'),
    ('sys_financial_reports', 'financial_statements'), ('system_settings', 'settings'),
    ('temp_labor_daily_logs', 'import'), ('violations', 'violations')
  ) AS modules(table_name, module_name)
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.table_name);
    EXECUTE format('CREATE POLICY module_view ON public.%I FOR SELECT TO authenticated USING (rawasi_private.can_access(%L, %L))', t.table_name, t.module_name, 'view');
    EXECUTE format('CREATE POLICY module_create ON public.%I FOR INSERT TO authenticated WITH CHECK (rawasi_private.can_access(%L, %L))', t.table_name, t.module_name, 'create');
    EXECUTE format('CREATE POLICY module_edit ON public.%I FOR UPDATE TO authenticated USING (rawasi_private.can_access(%L, %L)) WITH CHECK (rawasi_private.can_access(%L, %L))', t.table_name, t.module_name, 'edit', t.module_name, 'edit');
    EXECUTE format('CREATE POLICY module_delete ON public.%I FOR DELETE TO authenticated USING (rawasi_private.can_access(%L, %L))', t.table_name, t.module_name, 'delete');
  END LOOP;
END;
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profile_view ON public.profiles FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()) OR rawasi_private.can_access('team', 'view'));
CREATE POLICY profile_create ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (rawasi_private.is_admin() OR (id = (SELECT auth.uid()) AND role = 'client' AND NOT is_admin AND is_active AND permissions = '{}'::jsonb AND linked_partner_id IS NULL));
CREATE POLICY profile_edit ON public.profiles FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()) OR rawasi_private.is_admin())
  WITH CHECK (id = (SELECT auth.uid()) OR rawasi_private.is_admin());
CREATE POLICY profile_delete ON public.profiles FOR DELETE TO authenticated
  USING (rawasi_private.is_admin());

CREATE FUNCTION rawasi_private.protect_profile_privileges()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL AND current_setting('role', true) IN ('none', 'postgres', 'service_role') THEN RETURN NEW; END IF;
  IF rawasi_private.is_admin() THEN RETURN NEW; END IF;
  IF ROW(NEW.id, NEW.role, NEW.is_admin, NEW.permissions, NEW.is_active, NEW.linked_partner_id, NEW.email)
    IS DISTINCT FROM ROW(OLD.id, OLD.role, OLD.is_admin, OLD.permissions, OLD.is_active, OLD.linked_partner_id, OLD.email)
  THEN RAISE EXCEPTION 'Only an administrator can change account privileges' USING ERRCODE = '42501'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION rawasi_private.protect_profile_privileges() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER protect_profile_privileges BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.protect_profile_privileges();

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_view ON public.audit_logs FOR SELECT TO authenticated
  USING (rawasi_private.can_access('audit_logs', 'view'));
CREATE POLICY audit_insert ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (changed_by = (SELECT auth.uid()) AND (
    (action = 'LOGIN' AND table_name = 'profiles' AND record_id = (SELECT auth.uid()))
    OR action IN ('FAILED_POST', 'FAILED_UNPOST')
  ));
CREATE INDEX audit_logs_created_at_idx ON public.audit_logs (created_at DESC);
CREATE INDEX audit_logs_changed_by_idx ON public.audit_logs (changed_by);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY message_view ON public.messages FOR SELECT TO authenticated
  USING (sender_id = (SELECT auth.uid()) OR receiver_id = (SELECT auth.uid()) OR rawasi_private.is_admin());
CREATE POLICY message_create ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = (SELECT auth.uid()));
CREATE POLICY message_edit ON public.messages FOR UPDATE TO authenticated
  USING (receiver_id = (SELECT auth.uid()) OR rawasi_private.is_admin())
  WITH CHECK (receiver_id = (SELECT auth.uid()) OR rawasi_private.is_admin());

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notification_view ON public.notifications FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR rawasi_private.is_admin());
CREATE POLICY notification_edit ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()) OR rawasi_private.is_admin())
  WITH CHECK (user_id = (SELECT auth.uid()) OR rawasi_private.is_admin());

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['user_tasks', 'user_requests'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY own_records ON public.%I FOR ALL TO authenticated USING (user_id = (SELECT auth.uid()) OR rawasi_private.is_admin()) WITH CHECK (user_id = (SELECT auth.uid()) OR rawasi_private.is_admin())', t);
  END LOOP;
END;
$$;

DO $$
DECLARE v record;
BEGIN
  FOR v IN SELECT c.oid::regclass AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'v'
  LOOP EXECUTE format('ALTER VIEW %s SET (security_invoker = true)', v.name); END LOOP;
END;
$$;

GRANT USAGE ON SCHEMA public TO authenticated, service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
REVOKE UPDATE, DELETE ON public.audit_logs FROM authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.handle_new_user();

DO $$
DECLARE t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime' AND NOT puballtables) THEN
    FOREACH t IN ARRAY ARRAY['messages', 'notifications'] LOOP
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
SET row_security = on;
SET check_function_bodies = on;
SELECT pg_catalog.set_config('search_path', 'public, extensions', false);
