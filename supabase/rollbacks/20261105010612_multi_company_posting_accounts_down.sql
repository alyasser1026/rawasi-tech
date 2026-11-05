-- Undo 20261105010612_multi_company_posting_accounts.sql (multi-company step 3).
-- Kept outside supabase/migrations so the CLI never runs it by itself.
-- Puts back the step-2 statements generator and the original posting / report functions
-- (with the first company's fixed account ids). Run in the SQL editor, then delete version
-- 20261105010612 from supabase_migrations.schema_migrations.
BEGIN;
CREATE OR REPLACE FUNCTION public.generate_financial_reports_json(p_company_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_company uuid := COALESCE(p_company_id, rawasi_private.current_company_id());
  v_sections jsonb;
  v_total_revenue numeric;
  v_total_expense numeric;
  v_net_income numeric;
  v_total_assets numeric;
  v_total_liabilities numeric;
  v_total_equity numeric;
BEGIN
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'لم يتم تحديد الشركة' USING ERRCODE = '42501';
  END IF;
  IF auth.uid() IS NOT NULL AND v_company IS DISTINCT FROM rawasi_private.current_company_id() THEN
    RAISE EXCEPTION 'يمكن تحديث القوائم المالية للشركة التي تعمل عليها فقط' USING ERRCODE = '42501';
  END IF;

  -- Balance of every account with posted ('معتمد') movements, signed by account type.
  SELECT COALESCE(jsonb_object_agg(s.account_type, jsonb_build_object('lines', s.lines, 'total', s.total)), '{}'::jsonb)
  INTO v_sections
  FROM (
    SELECT a.account_type,
           jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'balance', x.balance) ORDER BY a.code) AS lines,
           SUM(x.balance) AS total
    FROM public.accounts AS a
    JOIN (
      SELECT jl.account_id, SUM(jl.debit) AS debit, SUM(jl.credit) AS credit
      FROM public.journal_lines AS jl
      JOIN public.journal_headers AS jh ON jh.id = jl.header_id
      WHERE jh.status = 'معتمد' AND jh.company_id = v_company AND jl.company_id = v_company
      GROUP BY jl.account_id
    ) AS b ON b.account_id = a.id
    CROSS JOIN LATERAL (
      SELECT CASE WHEN a.account_type IN ('أصول', 'مصروفات') THEN b.debit - b.credit ELSE b.credit - b.debit END AS balance
    ) AS x
    WHERE a.company_id = v_company AND x.balance <> 0
    GROUP BY a.account_type
  ) AS s;

  v_total_revenue := COALESCE((v_sections -> 'إيرادات' ->> 'total')::numeric, 0);
  v_total_expense := COALESCE((v_sections -> 'مصروفات' ->> 'total')::numeric, 0);
  v_net_income := v_total_revenue - v_total_expense;
  v_total_assets := COALESCE((v_sections -> 'أصول' ->> 'total')::numeric, 0);
  v_total_liabilities := COALESCE((v_sections -> 'التزامات' ->> 'total')::numeric, 0);
  v_total_equity := COALESCE((v_sections -> 'حقوق ملكية' ->> 'total')::numeric, 0);

  INSERT INTO public.sys_financial_reports (company_id, report_name, report_data, updated_at)
  VALUES
    (v_company, 'IncomeStatement', jsonb_build_object(
      'revenues', COALESCE(v_sections -> 'إيرادات' -> 'lines', '[]'::jsonb),
      'expenses', COALESCE(v_sections -> 'مصروفات' -> 'lines', '[]'::jsonb),
      'total_revenue', v_total_revenue,
      'total_expense', v_total_expense,
      'net_income', v_net_income), now()),
    (v_company, 'BalanceSheet', jsonb_build_object(
      'assets', COALESCE(v_sections -> 'أصول' -> 'lines', '[]'::jsonb),
      'liabilities', COALESCE(v_sections -> 'التزامات' -> 'lines', '[]'::jsonb),
      'equity', COALESCE(v_sections -> 'حقوق ملكية' -> 'lines', '[]'::jsonb),
      'total_assets', v_total_assets,
      'total_liabilities', v_total_liabilities,
      'total_equity', v_total_equity,
      'net_income', v_net_income,
      'total_liabilities_and_equity', v_total_liabilities + v_total_equity + v_net_income), now())
  ON CONFLICT (company_id, report_name) DO UPDATE
    SET report_data = EXCLUDED.report_data, updated_at = EXCLUDED.updated_at;
END;
$$;;

CREATE OR REPLACE FUNCTION public.bulk_disburse_expenses(p_expense_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.bulk_disburse_optimized(p_expense_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.bulk_disburse_v2(p_ids uuid[], p_user_id uuid)
 RETURNS TABLE(processed_count integer, total_amount numeric)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$DECLARE
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
END;$function$;

CREATE OR REPLACE FUNCTION public.post_labor_logs_bulk(p_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.post_sub_claim_to_journal(claim_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$DECLARE
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

END;$function$;

CREATE OR REPLACE FUNCTION public.post_violations_bulk(p_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.rpc_post_claim(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$DECLARE
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
END;$function$;

CREATE OR REPLACE FUNCTION public.rpc_post_material(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.rpc_post_material_claim(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_trial_balance(p_start_date date, p_end_date date)
 RETURNS TABLE(account_id uuid, account_code text, account_name text, account_type text, parent_id uuid, opening_debit numeric, opening_credit numeric, period_debit numeric, period_credit numeric, ending_debit numeric, ending_credit numeric)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_accounts_report(p_date_from date DEFAULT '1900-01-01'::date, p_date_to date DEFAULT '2099-12-31'::date)
 RETURNS TABLE(id uuid, code character varying, name character varying, parent_id uuid, is_transactional boolean, account_type character varying, total_debit numeric, total_credit numeric, balance numeric)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_accounts_report_with_lines(p_date_from date DEFAULT '1900-01-01'::date, p_date_to date DEFAULT '2099-12-31'::date)
 RETURNS TABLE(id uuid, code character varying, name character varying, parent_id uuid, is_transactional boolean, account_type character varying, total_debit numeric, total_credit numeric, balance numeric, transactions jsonb)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
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
$function$;

DROP FUNCTION IF EXISTS rawasi_private.require_company_account(text);
COMMIT;
