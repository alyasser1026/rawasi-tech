-- Migration: 20261111194500_fix_subclaims_safe_and_project_accounting.sql
-- Purpose:
--   1. Switch subcontractor claims default credit account from Bank (1291) to Main Safe (122 - الخزينة الرئيسية)
--      and update all existing subcontractor claim payment vouchers, journal lines, and cash flows.
--   2. Add tech_days, helper_days, and actual_subcontractor_cost to public.boq_budget and synchronize
--      all BOQ actuals (labor, materials, direct expenses, subcontractor claims, and client receipts).
--   3. Enhance public.get_project_full_details, public.get_project_dashboard, and public.job_order_ledger_view.

BEGIN;

-- ============================================================================
-- 1. Update public.pay_sub_claim & public.post_payment_vouchers_bulk
-- ============================================================================
CREATE OR REPLACE FUNCTION public.pay_sub_claim(p_request_id uuid, p_claim_id uuid, p_payment jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  claim public.sub_claims%ROWTYPE;
  old public.payment_vouchers%ROWTYPE;
  payment record;
  debit_account uuid;
  credit_account uuid;
  paid numeric;
  amount numeric;
  v_job_order_id uuid;
BEGIN
  IF NOT rawasi_private.can_access('payments','view') OR NOT rawasi_private.can_access('payments','create')
    OR NOT rawasi_private.can_access('payments','edit') OR NOT rawasi_private.can_access('subclaims','view')
    OR NOT rawasi_private.can_access('subclaims','edit') OR NOT rawasi_private.can_access('journal','create') THEN
    RAISE EXCEPTION 'لا توجد صلاحية صرف المستخلص وترحيله' USING ERRCODE='42501';
  END IF;

  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'رقم طلب الصرف مطلوب' USING ERRCODE='23514';
  END IF;

  SELECT * INTO payment FROM jsonb_to_record(p_payment) AS x(
    date date, amount numeric, payment_method text,
    debit_account_id uuid, credit_account_id uuid,
    description text, notes text, site_ref text, partner_id uuid
  );

  IF payment.amount IS NULL OR payment.amount <= 0 OR payment.amount >= 'Infinity'::numeric OR payment.date IS NULL THEN
    RAISE EXCEPTION 'أدخل تاريخًا ومبلغًا صحيحًا للصرف' USING ERRCODE='23514';
  END IF;

  amount := round(payment.amount, 2);
  IF amount <= 0 THEN
    RAISE EXCEPTION 'مبلغ الصرف أقل من أصغر وحدة مالية' USING ERRCODE='23514';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('rawasi:claim_payment:' || p_request_id::text, 0));

  SELECT * INTO claim FROM public.sub_claims WHERE id = p_claim_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'المستخلص غير موجود أو غير مسموح بعرضه' USING ERRCODE='42501';
  END IF;

  IF NOT COALESCE(claim.is_posted, false) THEN
    RAISE EXCEPTION 'رحّل المستخلص قبل الصرف' USING ERRCODE='23514';
  END IF;

  IF payment.partner_id IS NOT NULL AND payment.partner_id <> claim.contractor_id THEN
    RAISE EXCEPTION 'المستفيد لا يطابق مقاول المستخلص' USING ERRCODE='23514';
  END IF;

  SELECT * INTO old FROM public.payment_vouchers WHERE id = p_request_id FOR UPDATE;
  IF FOUND THEN
    IF old.is_posted AND old.sub_claim_id = p_claim_id AND old.partner_id = claim.contractor_id AND old.amount = amount
      AND old.date = payment.date AND old.payment_method IS NOT DISTINCT FROM payment.payment_method
      AND old.debit_account_id IS NOT DISTINCT FROM COALESCE(payment.debit_account_id, old.debit_account_id)
      AND old.credit_account_id IS NOT DISTINCT FROM COALESCE(payment.credit_account_id, old.credit_account_id) THEN
      RETURN old.id;
    END IF;
    RAISE EXCEPTION 'رقم طلب الصرف مستخدم؛ راجع السند قبل إعادة الإرسال' USING ERRCODE='23514';
  END IF;

  SELECT COALESCE(SUM(p.amount), 0) INTO paid
  FROM public.payment_vouchers p
  WHERE p.sub_claim_id = p_claim_id AND p.is_posted;

  IF amount > GREATEST(claim.net_amount - paid, 0) THEN
    RAISE EXCEPTION 'مبلغ الصرف أكبر من المتبقي في المستخلص' USING ERRCODE='23514';
  END IF;

  debit_account := payment.debit_account_id;
  credit_account := payment.credit_account_id;

  IF debit_account IS NULL THEN
    SELECT id INTO debit_account
    FROM public.accounts
    WHERE company_id = claim.company_id AND code = '212'
    LIMIT 1;
    IF debit_account IS NULL THEN
      SELECT id INTO STRICT debit_account FROM public.accounts WHERE code = '212' LIMIT 1;
    END IF;
  END IF;

  -- Default credit account: Main Safe (122 - الخزينة الرئيسية), fallback 121, then 1291
  IF credit_account IS NULL THEN
    SELECT id INTO credit_account
    FROM public.accounts
    WHERE company_id = claim.company_id AND code IN ('122', '121', '1291')
    ORDER BY CASE code WHEN '122' THEN 1 WHEN '121' THEN 2 ELSE 3 END
    LIMIT 1;
    IF credit_account IS NULL THEN
      SELECT id INTO STRICT credit_account
      FROM public.accounts
      WHERE code IN ('122', '121', '1291')
      ORDER BY CASE code WHEN '122' THEN 1 WHEN '121' THEN 2 ELSE 3 END
      LIMIT 1;
    END IF;
  END IF;

  v_job_order_id := claim.job_order_id;
  IF v_job_order_id IS NULL THEN
    SELECT ca.job_order_id INTO v_job_order_id
    FROM public.contractor_assignments ca
    WHERE ca.claim_id = p_claim_id AND ca.job_order_id IS NOT NULL
    LIMIT 1;
  END IF;

  INSERT INTO public.payment_vouchers(
    id, voucher_number, date, amount, partner_id, debit_account_id, credit_account_id,
    payment_method, project_ids, job_order_id, site_ref, description, notes,
    sub_claim_id, is_posted, status, created_by, company_id
  )
  VALUES(
    p_request_id, 'PV-' || p_request_id::text, payment.date, amount, claim.contractor_id,
    debit_account, credit_account, COALESCE(payment.payment_method, 'نقدي (الخزينة الرئيسية)'),
    COALESCE(claim.project_ids, CASE WHEN claim.project_id IS NOT NULL THEN ARRAY[claim.project_id] ELSE NULL END),
    v_job_order_id, payment.site_ref, payment.description, payment.notes,
    p_claim_id, false, 'مسودة', auth.uid(), claim.company_id
  );

  PERFORM public.post_payment_vouchers_bulk(ARRAY[p_request_id]);

  UPDATE public.sub_claims
  SET paid_amount = paid + amount,
      status = CASE WHEN paid + amount >= net_amount THEN 'مدفوع' ELSE 'مسدد جزئي' END
  WHERE id = p_claim_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'تعذر تحديث سداد المستخلص' USING ERRCODE='42501';
  END IF;

  RETURN p_request_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.post_payment_vouchers_bulk(p_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
    v_rec RECORD;
    v_header_id uuid;
    v_full_description TEXT;
    v_project_id uuid;
BEGIN
    FOR v_rec IN 
        SELECT * FROM public.payment_vouchers 
        WHERE id = ANY(p_ids) AND (is_posted = false OR is_posted IS NULL) 
    LOOP
        v_full_description := 'سند صرف رقم: ' || v_rec.voucher_number;
        
        IF v_rec.reference_no IS NOT NULL AND TRIM(v_rec.reference_no) <> '' THEN
            v_full_description := v_full_description || ' - فاتورة/مرجع: ' || v_rec.reference_no;
        END IF;

        IF v_rec.description IS NOT NULL AND TRIM(v_rec.description) <> '' THEN
            v_full_description := v_full_description || ' - بيان: ' || v_rec.description;
        END IF;

        v_project_id := NULL;
        IF v_rec.project_ids IS NOT NULL AND array_length(v_rec.project_ids, 1) > 0 THEN
            v_project_id := v_rec.project_ids[1];
        END IF;

        INSERT INTO public.journal_headers (reference_id, entry_date, description, v_type, status, company_id)
        VALUES (v_rec.id, v_rec.date, v_full_description, 'payment_vouchers', 'posted', v_rec.company_id)
        RETURNING id INTO v_header_id;

        INSERT INTO public.journal_lines (header_id, account_id, partner_id, project_id, job_order_id, debit, credit, notes, company_id)
        VALUES (v_header_id, v_rec.debit_account_id, v_rec.partner_id, v_project_id, v_rec.job_order_id, v_rec.amount, 0, v_full_description, v_rec.company_id);

        INSERT INTO public.journal_lines (header_id, account_id, partner_id, project_id, job_order_id, debit, credit, notes, company_id)
        VALUES (v_header_id, v_rec.credit_account_id, NULL, v_project_id, v_rec.job_order_id, 0, v_rec.amount, v_full_description, v_rec.company_id);

        UPDATE public.payment_vouchers SET is_posted = true, status = 'معتمد' WHERE id = v_rec.id;
    END LOOP;
END;
$function$;

-- ============================================================================
-- 2. Fix Existing Subcontractor Claim Payments, Journal Lines & Cash Flows
-- ============================================================================
ALTER TABLE public.sub_claims DISABLE TRIGGER USER;
ALTER TABLE public.payment_vouchers DISABLE TRIGGER USER;
ALTER TABLE public.journal_lines DISABLE TRIGGER USER;
ALTER TABLE public.cash_flows DISABLE TRIGGER USER;

-- 2A. Backfill job_order_id on sub_claims from contractor_assignments
UPDATE public.sub_claims sc
SET job_order_id = ca.job_order_id
FROM public.contractor_assignments ca
WHERE ca.claim_id = sc.id
  AND sc.job_order_id IS NULL
  AND ca.job_order_id IS NOT NULL;

-- 2B. Switch payment_vouchers from Bank (1291) to Main Safe (122 - الخزينة الرئيسية)
UPDATE public.payment_vouchers pv
SET credit_account_id = safe_acc.id,
    payment_method = CASE
      WHEN pv.payment_method IS NULL OR pv.payment_method = 'تحويل بنكي' THEN 'نقدي (الخزينة الرئيسية)'
      ELSE pv.payment_method
    END
FROM public.accounts old_acc
JOIN public.accounts safe_acc
  ON safe_acc.company_id = old_acc.company_id AND safe_acc.code = '122'
WHERE pv.credit_account_id = old_acc.id
  AND (old_acc.code = '1291' OR pv.sub_claim_id IS NOT NULL);

-- 2C. Switch journal_lines from Bank (1291) to Main Safe (122 - الخزينة الرئيسية)
UPDATE public.journal_lines jl
SET account_id = safe_acc.id
FROM public.accounts old_acc
JOIN public.accounts safe_acc
  ON safe_acc.company_id = old_acc.company_id AND safe_acc.code = '122'
WHERE jl.account_id = old_acc.id
  AND old_acc.code = '1291';

-- 2D. Backfill project_id on journal_lines from job_orders, payment_vouchers, receipt_vouchers, sub_claims
UPDATE public.journal_lines jl
SET project_id = jo.project_id
FROM public.job_orders jo
WHERE jl.job_order_id = jo.id
  AND jl.project_id IS NULL
  AND jo.project_id IS NOT NULL;

UPDATE public.journal_lines jl
SET project_id = pv.project_ids[1]
FROM public.journal_headers jh
JOIN public.payment_vouchers pv ON jh.reference_id = pv.id
WHERE jl.header_id = jh.id
  AND jl.project_id IS NULL
  AND pv.project_ids IS NOT NULL
  AND array_length(pv.project_ids, 1) > 0;

UPDATE public.journal_lines jl
SET project_id = rv.project_ids[1]
FROM public.journal_headers jh
JOIN public.receipt_vouchers rv ON jh.reference_id = rv.id
WHERE jl.header_id = jh.id
  AND jl.project_id IS NULL
  AND rv.project_ids IS NOT NULL
  AND array_length(rv.project_ids, 1) > 0;

UPDATE public.journal_lines jl
SET project_id = COALESCE(sc.project_id, sc.project_ids[1])
FROM public.journal_headers jh
JOIN public.sub_claims sc ON (jh.reference_id = sc.id OR jh.id = sc.jv_header_id)
WHERE jl.header_id = jh.id
  AND jl.project_id IS NULL
  AND COALESCE(sc.project_id, sc.project_ids[1]) IS NOT NULL;

-- 2E. Switch cash_flows from Bank (1291) to Main Safe (122 - الخزينة الرئيسية)
UPDATE public.cash_flows cf
SET account_id = safe_acc.id
FROM public.accounts old_acc
JOIN public.accounts safe_acc
  ON safe_acc.company_id = old_acc.company_id AND safe_acc.code = '122'
WHERE cf.account_id = old_acc.id
  AND old_acc.code = '1291';

ALTER TABLE public.sub_claims ENABLE TRIGGER USER;
ALTER TABLE public.payment_vouchers ENABLE TRIGGER USER;
ALTER TABLE public.journal_lines ENABLE TRIGGER USER;
ALTER TABLE public.cash_flows ENABLE TRIGGER USER;

-- Refresh financial report snapshots for all active companies
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.companies WHERE is_active LOOP
    PERFORM public.generate_financial_reports_json(r.id);
  END LOOP;
END $$;

-- ============================================================================
-- 3. Add tech_days, helper_days, actual_subcontractor_cost to public.boq_budget
-- ============================================================================
ALTER TABLE public.boq_budget
  ADD COLUMN IF NOT EXISTS tech_days numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS helper_days numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_subcontractor_cost numeric DEFAULT 0;

UPDATE public.boq_budget
SET tech_days = COALESCE(NULLIF(tech_days, 0), labor_days, 0),
    helper_days = COALESCE(NULLIF(helper_days, 0), labor_days, 0)
WHERE COALESCE(tech_days, 0) = 0 AND COALESCE(helper_days, 0) = 0 AND COALESCE(labor_days, 0) > 0;

-- ============================================================================
-- 4. Update BOQ Sync Functions & Triggers so Project Room is Always Accurate
-- ============================================================================
CREATE OR REPLACE FUNCTION rawasi_private.sync_boq_from_logs_on_save()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
    v_direct_expenses numeric := 0;
    v_sub_claims_cost numeric := 0;
    v_abc_cost numeric := 0;
    v_inv_revenue numeric := 0;
    v_rv_revenue numeric := 0;
BEGIN
    IF NEW.project_id IS NOT NULL THEN
        -- 1. العمالة المباشرة (مع مراعاة عدد الأيام / attendance_value والربط عبر أمر الشغل)
        NEW.actual_quantity := (
            SELECT COALESCE(SUM(COALESCE(l.productivity, l.completed_quantity, 0)), 0)
            FROM public.labor_daily_logs l
            LEFT JOIN public.job_orders jo ON l.job_order_id = jo.id
            WHERE l.project_id = NEW.project_id
              AND (l.work_item_id = NEW.id OR l.work_item_id = NEW.boq_item_id OR jo.boq_budget_id = NEW.id)
        );

        NEW.actual_labor_cost := (
            SELECT COALESCE(SUM(COALESCE(l.attendance_value, 1) * COALESCE(l.daily_wage, 0)), 0)
            FROM public.labor_daily_logs l
            LEFT JOIN public.job_orders jo ON l.job_order_id = jo.id
            WHERE l.project_id = NEW.project_id
              AND (l.work_item_id = NEW.id OR l.work_item_id = NEW.boq_item_id OR jo.boq_budget_id = NEW.id)
        );

        -- 2. الخامات المباشرة
        NEW.actual_material_cost := (
            SELECT COALESCE(SUM(mil.total_price), 0)
            FROM public.material_issue_lines mil
            JOIN public.material_issues mi ON mi.id = mil.issue_id
            LEFT JOIN public.job_orders jo ON mil.job_order_id = jo.id
            WHERE mi.project_id = NEW.project_id
              AND (mil.boq_item_id = NEW.boq_item_id OR mil.boq_id = NEW.id OR jo.boq_budget_id = NEW.id)
        );

        -- 3. مستخلصات مقاولي الباطن المرحلة المرتبطة بالبند أو بأمر الشغل
        SELECT COALESCE(SUM(sc.net_amount), 0) INTO v_sub_claims_cost
        FROM public.sub_claims sc
        WHERE COALESCE(sc.is_posted, false) = true
          AND (sc.project_id = NEW.project_id OR NEW.project_id = ANY(sc.project_ids))
          AND (
              EXISTS (
                  SELECT 1 FROM public.contractor_assignments ca
                  LEFT JOIN public.job_orders jo ON ca.job_order_id = jo.id
                  WHERE ca.claim_id = sc.id
                    AND (ca.boq_budget_id = NEW.id OR ca.boq_item_id = NEW.boq_item_id OR jo.boq_budget_id = NEW.id)
              )
              OR EXISTS (
                  SELECT 1 FROM public.job_orders jo
                  WHERE sc.job_order_id = jo.id
                    AND (jo.boq_budget_id = NEW.id OR jo.boq_budget_id = NEW.boq_item_id)
              )
          );

        NEW.actual_subcontractor_cost := v_sub_claims_cost;

        -- 4. المصروفات المباشرة المرتبطة بأمر الشغل أو البند
        SELECT COALESCE(SUM(COALESCE(NULLIF(e.total_price, 0), e.paid_amount, 0)), 0) INTO v_direct_expenses
        FROM public.expenses e
        LEFT JOIN public.job_orders jo ON e.job_order_id = jo.id
        WHERE NOT COALESCE(e.is_deleted, false)
          AND e.project_id = NEW.project_id
          AND (jo.boq_budget_id = NEW.id OR jo.boq_budget_id = NEW.boq_item_id);

        -- 5. المصروفات الموزعة (ABC)
        SELECT COALESCE(SUM("المبلغ المحمل (ر.س)"), 0) INTO v_abc_cost
        FROM public.advanced_cost_allocation_view
        WHERE project_id = NEW.project_id
          AND (boq_budget_id = NEW.boq_item_id OR boq_budget_id = NEW.id);

        NEW.actual_expenses_cost := v_direct_expenses + v_sub_claims_cost + v_abc_cost;

        -- 6. الإيرادات الفعلية المحصلة (من الفواتير المعتمدة + سندات القبض المرتبطة بأمر الشغل)
        SELECT COALESCE(SUM((line->>'total_price')::numeric), 0) INTO v_inv_revenue
        FROM public.invoices i,
        jsonb_array_elements(rawasi_private.json_array_or_empty(i.lines_data)) AS line
        WHERE (i.status LIKE '%عتمد%' OR i.status LIKE '%مدفوع%')
          AND ((line->>'boq_id') = NEW.id::text OR (line->>'boq_id') = NEW.boq_item_id::text);

        SELECT COALESCE(SUM(rv.amount), 0) INTO v_rv_revenue
        FROM public.receipt_vouchers rv
        JOIN public.job_orders jo ON rv.job_order_id = jo.id
        WHERE rv.invoice_id IS NULL
          AND (rv.status LIKE '%عتمد%' OR rv.status LIKE '%محصل%' OR rv.status LIKE '%مدفوع%')
          AND (jo.boq_budget_id = NEW.id OR jo.boq_budget_id = NEW.boq_item_id);

        NEW.actual_revenue := v_inv_revenue + v_rv_revenue;
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_sync_boq_on_save ON public.boq_budget;
CREATE TRIGGER trigger_sync_boq_on_save
BEFORE INSERT OR UPDATE ON public.boq_budget
FOR EACH ROW EXECUTE FUNCTION rawasi_private.sync_boq_from_logs_on_save();

CREATE OR REPLACE FUNCTION rawasi_private.update_boq_actuals()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
BEGIN
    RETURN rawasi_private.sync_boq_from_logs_on_save();
END;
$function$;

CREATE OR REPLACE FUNCTION rawasi_private.update_boq_labor_cost_live()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
BEGIN
    IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') AND OLD.project_id IS NOT NULL THEN
        UPDATE public.boq_budget SET id = id WHERE project_id = OLD.project_id;
    END IF;
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.project_id IS NOT NULL THEN
        UPDATE public.boq_budget SET id = id WHERE project_id = NEW.project_id;
    END IF;
    IF (TG_OP = 'DELETE') THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION rawasi_private.update_boq_actual_quantity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
BEGIN
    IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') AND OLD.project_id IS NOT NULL THEN
        UPDATE public.boq_budget SET id = id WHERE project_id = OLD.project_id;
    END IF;
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.project_id IS NOT NULL THEN
        UPDATE public.boq_budget SET id = id WHERE project_id = NEW.project_id;
    END IF;
    IF (TG_OP = 'DELETE') THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION rawasi_private.trigger_boq_update_from_subclaims()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
    v_pid uuid;
BEGIN
    IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') THEN
        IF OLD.project_id IS NOT NULL THEN
            UPDATE public.boq_budget SET id = id WHERE project_id = OLD.project_id;
        END IF;
        IF OLD.project_ids IS NOT NULL THEN
            FOREACH v_pid IN ARRAY OLD.project_ids LOOP
                UPDATE public.boq_budget SET id = id WHERE project_id = v_pid;
            END LOOP;
        END IF;
    END IF;
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        IF NEW.project_id IS NOT NULL THEN
            UPDATE public.boq_budget SET id = id WHERE project_id = NEW.project_id;
        END IF;
        IF NEW.project_ids IS NOT NULL THEN
            FOREACH v_pid IN ARRAY NEW.project_ids LOOP
                UPDATE public.boq_budget SET id = id WHERE project_id = v_pid;
            END LOOP;
        END IF;
    END IF;
    IF (TG_OP = 'DELETE') THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;

DROP TRIGGER IF EXISTS trg_boq_update_from_subclaims ON public.sub_claims;
CREATE TRIGGER trg_boq_update_from_subclaims
AFTER INSERT OR UPDATE OR DELETE ON public.sub_claims
FOR EACH ROW EXECUTE FUNCTION rawasi_private.trigger_boq_update_from_subclaims();

CREATE OR REPLACE FUNCTION rawasi_private.trigger_boq_update_from_receipts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
    v_pid uuid;
BEGIN
    IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') AND OLD.project_ids IS NOT NULL THEN
        FOREACH v_pid IN ARRAY OLD.project_ids LOOP
            UPDATE public.boq_budget SET id = id WHERE project_id = v_pid;
        END LOOP;
    END IF;
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.project_ids IS NOT NULL THEN
        FOREACH v_pid IN ARRAY NEW.project_ids LOOP
            UPDATE public.boq_budget SET id = id WHERE project_id = v_pid;
        END LOOP;
    END IF;
    IF (TG_OP = 'DELETE') THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;

DROP TRIGGER IF EXISTS trg_boq_update_from_receipts ON public.receipt_vouchers;
CREATE TRIGGER trg_boq_update_from_receipts
AFTER INSERT OR UPDATE OR DELETE ON public.receipt_vouchers
FOR EACH ROW EXECUTE FUNCTION rawasi_private.trigger_boq_update_from_receipts();

-- Recalculate all existing BOQ budget rows right now
UPDATE public.boq_budget SET id = id;

-- ============================================================================
-- 5. Update public.get_project_full_details & public.get_project_dashboard
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_project_full_details(p_project_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
    v_boq json;
    v_expenses json;
    v_labor_logs json;
    v_materials json;
    v_invoices json;
    v_receipt_vouchers json;
    v_sub_claims json;
    v_contractor_assignments json;
BEGIN
    -- 1. بنود المقايسة
    SELECT COALESCE(json_agg(t), '[]'::json) INTO v_boq
    FROM (SELECT * FROM public.boq_budget WHERE project_id = p_project_id ORDER BY created_at ASC) t;

    -- 2. المصاريف المباشرة
    SELECT COALESCE(json_agg(t), '[]'::json) INTO v_expenses
    FROM (
        SELECT e.*, jo.boq_budget_id AS job_order_boq_id, jo.order_number AS job_order_number
        FROM public.expenses e
        LEFT JOIN public.job_orders jo ON e.job_order_id = jo.id
        WHERE e.project_id = p_project_id AND NOT COALESCE(e.is_deleted, false)
        ORDER BY e.exp_date DESC, e.created_at DESC
    ) t;

    -- 3. يوميات العمالة الميدانية (الفنيين والمساعدين)
    SELECT COALESCE(json_agg(t), '[]'::json) INTO v_labor_logs
    FROM (
        SELECT l.*, p.code AS worker_code, p.job_role AS partner_job_role,
               jo.boq_budget_id AS job_order_boq_id, jo.order_number AS job_order_number
        FROM public.labor_daily_logs l
        LEFT JOIN public.partners p ON l.worker_partner_id = p.id
        LEFT JOIN public.job_orders jo ON l.job_order_id = jo.id
        WHERE l.project_id = p_project_id
        ORDER BY l.work_date DESC, l.created_at DESC
    ) t;

    -- 4. تجميع الخامات
    SELECT COALESCE(json_agg(t), '[]'::json) INTO v_materials
    FROM (
        SELECT id, item_name, quantity, unit, unit_price, total_price, boq_item_id AS boq_id, 'receipt' AS movement_type 
        FROM public.material_receipt_lines 
        WHERE project_id = p_project_id
        UNION ALL
        SELECT mil.id, mil.item_name, mil.quantity, mil.unit, mil.unit_price, mil.total_price, mil.boq_id, 'issue' AS movement_type 
        FROM public.material_issue_lines mil
        JOIN public.material_issues mi ON mil.issue_id = mi.id
        WHERE mi.project_id = p_project_id
    ) t;

    -- 5. فواتير ومستخلصات العملاء
    SELECT COALESCE(json_agg(t), '[]'::json) INTO v_invoices
    FROM (SELECT * FROM public.invoices WHERE project_ids @> array[p_project_id]) t;

    -- 6. سندات قبض العملاء المرتبطة بالمشروع
    SELECT COALESCE(json_agg(t), '[]'::json) INTO v_receipt_vouchers
    FROM (
        SELECT rv.*, p.name AS partner_name, jo.boq_budget_id AS job_order_boq_id, jo.order_number AS job_order_number
        FROM public.receipt_vouchers rv
        LEFT JOIN public.partners p ON rv.partner_id = p.id
        LEFT JOIN public.job_orders jo ON rv.job_order_id = jo.id
        WHERE rv.project_ids @> array[p_project_id]
        ORDER BY rv.date DESC, rv.created_at DESC
    ) t;

    -- 7. مستخلصات مقاولي الباطن
    SELECT COALESCE(json_agg(t), '[]'::json) INTO v_sub_claims
    FROM (
        SELECT sc.*, p.name AS contractor_name
        FROM public.sub_claims sc
        LEFT JOIN public.partners p ON sc.contractor_id = p.id
        WHERE sc.project_id = p_project_id OR sc.project_ids @> array[p_project_id]
        ORDER BY sc.date DESC, sc.created_at DESC
    ) t;

    -- 8. تكليفات المقاولين
    SELECT COALESCE(json_agg(t), '[]'::json) INTO v_contractor_assignments
    FROM (
        SELECT ca.*, p.name AS contractor_name
        FROM public.contractor_assignments ca
        LEFT JOIN public.partners p ON ca.contractor_id = p.id
        WHERE ca.project_id = p_project_id
    ) t;

    RETURN json_build_object(
        'boq', v_boq,
        'expenses', v_expenses,
        'labor_logs', v_labor_logs,
        'materials', v_materials,
        'invoices', v_invoices,
        'receipt_vouchers', v_receipt_vouchers,
        'sub_claims', v_sub_claims,
        'contractor_assignments', v_contractor_assignments
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_project_dashboard()
 RETURNS TABLE(
   id uuid,
   "Property" text,
   client_name text,
   status text,
   contract_value numeric,
   estimated_budget numeric,
   total_material_cost numeric,
   total_direct_expenses numeric,
   direct_labor_cost numeric,
   allocated_labor_cost numeric,
   total_cost numeric,
   subcontractors jsonb,
   overall_completion_percentage numeric
 )
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
    v_total_general_labor_cost numeric;
    v_total_labor_logs numeric;
BEGIN
    SELECT COALESCE(SUM(COALESCE(NULLIF(ex.paid_amount, 0), ex.total_price, 0)), 0)
    INTO v_total_general_labor_cost
    FROM public.expenses ex
    WHERE ex.project_id IS NULL
      AND NOT COALESCE(ex.is_deleted, false)
      AND (ex.main_category LIKE '%عمال%' OR ex.main_category LIKE '%رواتب%' OR ex.main_category LIKE '%أجور%');

    SELECT COALESCE(SUM(attendance_value), 1) INTO v_total_labor_logs FROM public.labor_daily_logs;
    IF v_total_labor_logs <= 0 THEN v_total_labor_logs := 1; END IF;

    RETURN QUERY
    WITH MaterialCosts AS (
        SELECT mi.project_id, SUM(mil.total_price) AS material_cost
        FROM public.material_issues mi
        JOIN public.material_issue_lines mil ON mi.id = mil.issue_id
        GROUP BY mi.project_id
    ),
    DirectExpenses AS (
        SELECT ex_dir.project_id, SUM(COALESCE(NULLIF(ex_dir.paid_amount, 0), ex_dir.total_price, 0)) AS exp_cost
        FROM public.expenses ex_dir
        WHERE ex_dir.project_id IS NOT NULL AND NOT COALESCE(ex_dir.is_deleted, false)
        GROUP BY ex_dir.project_id
    ),
    SubClaimCosts AS (
        SELECT sc.project_id, SUM(COALESCE(sc.net_amount, 0)) AS sub_cost
        FROM public.sub_claims sc
        WHERE sc.project_id IS NOT NULL AND COALESCE(sc.is_posted, false) = true
        GROUP BY sc.project_id
    ),
    LaborLogs AS (
        SELECT ldl.project_id,
               SUM(COALESCE(ldl.attendance_value, 1)) AS project_workers,
               SUM(COALESCE(ldl.attendance_value, 1) * COALESCE(ldl.daily_wage, 0)) AS direct_labor
        FROM public.labor_daily_logs ldl
        GROUP BY ldl.project_id
    ),
    Subcontractors AS (
        SELECT sub_union.project_id, jsonb_agg(DISTINCT sub_union.sub_name) AS subs
        FROM (
            SELECT e.project_id, p.name AS sub_name FROM public.expenses e JOIN public.partners p ON e.payee_id = p.id WHERE e.project_id IS NOT NULL
            UNION SELECT m.project_id, p.name AS sub_name FROM public.material_issues m JOIN public.partners p ON m.subcontractor_id = p.id WHERE m.project_id IS NOT NULL
            UNION SELECT ca.project_id, p.name AS sub_name FROM public.contractor_assignments ca JOIN public.partners p ON ca.contractor_id = p.id WHERE ca.project_id IS NOT NULL
            UNION SELECT sc.project_id, p.name AS sub_name FROM public.sub_claims sc JOIN public.partners p ON sc.contractor_id = p.id WHERE sc.project_id IS NOT NULL
        ) sub_union
        WHERE sub_name IS NOT NULL
        GROUP BY sub_union.project_id
    ),
    BOQStats AS (
        SELECT 
            b.project_id,
            COALESCE(AVG(b.completed_percentage), 0) AS avg_completion,
            SUM(COALESCE(b.contract_quantity, 0) * COALESCE(b.unit_contract_price, 0)) AS boq_contract_value,
            SUM(
              COALESCE(b.estimated_labor_cost, 0) +
              COALESCE(b.estimated_material_cost, 0) +
              COALESCE(b.estimated_expenses_cost, 0) +
              COALESCE(b.estimated_subcontractor_cost, 0)
            ) AS boq_estimated_budget
        FROM public.boq_budget b
        WHERE NOT EXISTS (SELECT 1 FROM public.boq_budget child WHERE child.parent_id = b.id)
        GROUP BY b.project_id
    )
    SELECT 
        p.id,
        p."Property"::text,
        p.client_name::text,
        p.status::text,
        COALESCE(NULLIF(bs.boq_contract_value, 0), p.contract_value, 0) AS contract_value,
        COALESCE(NULLIF(bs.boq_estimated_budget, 0), p.estimated_budget, 0) AS estimated_budget,
        COALESCE(mc.material_cost, 0) AS total_material_cost,
        (COALESCE(de.exp_cost, 0) + COALESCE(scc.sub_cost, 0)) AS total_direct_expenses,
        COALESCE(ll.direct_labor, 0) AS direct_labor_cost, 
        ROUND((COALESCE(ll.project_workers, 0)::numeric / v_total_labor_logs) * v_total_general_labor_cost, 2) AS allocated_labor_cost, 
        (
          COALESCE(mc.material_cost, 0) +
          COALESCE(de.exp_cost, 0) +
          COALESCE(scc.sub_cost, 0) +
          COALESCE(ll.direct_labor, 0) +
          ROUND((COALESCE(ll.project_workers, 0)::numeric / v_total_labor_logs) * v_total_general_labor_cost, 2)
        ) AS total_cost,
        COALESCE(s.subs, '[]'::jsonb) AS subcontractors,
        COALESCE(bs.avg_completion, 0) AS overall_completion_percentage
    FROM public.projects p
    LEFT JOIN MaterialCosts mc ON p.id = mc.project_id
    LEFT JOIN DirectExpenses de ON p.id = de.project_id
    LEFT JOIN SubClaimCosts scc ON p.id = scc.project_id
    LEFT JOIN LaborLogs ll ON p.id = ll.project_id
    LEFT JOIN Subcontractors s ON p.id = s.project_id
    LEFT JOIN BOQStats bs ON p.id = bs.project_id;
END;
$function$;

-- ============================================================================
-- 6. Update public.job_order_ledger_view (Include skill_level, attendance*wage, and دفعات مقاولين)
-- ============================================================================
CREATE OR REPLACE VIEW public.job_order_ledger_view AS
 SELECT l.id AS source_id,
    l.job_order_id,
    l.work_date AS trans_date,
    'يوميات عمالة'::text AS trans_type,
    (
      'العامل: '::text || COALESCE(l.worker_name, 'غير محدد'::text) ||
      ' ('::text || COALESCE(NULLIF(l.skill_level, ''), 'عامل'::text) || ')'::text ||
      ' | اليومية: '::text || COALESCE(l.daily_wage::text, '0'::text) ||
      ' | بند: '::text || COALESCE(b.work_item, l.work_item, 'غير محدد'::text)
    ) AS trans_desc,
    COALESCE(l.attendance_value, 1)::numeric AS qty,
    (COALESCE(l.attendance_value, 1) * COALESCE(l.daily_wage, 0))::numeric AS amount
   FROM public.labor_daily_logs l
     LEFT JOIN public.job_orders jo ON l.job_order_id = jo.id
     LEFT JOIN public.boq_budget b ON jo.boq_budget_id = b.id
     LEFT JOIN public.boq_items bi ON b.boq_item_id = bi.id
  WHERE l.job_order_id IS NOT NULL
UNION ALL
 SELECT mil.id AS source_id,
    mil.job_order_id,
    mi.issue_date AS trans_date,
    'خامات مصروفة'::text AS trans_type,
    'صرف خامات: '::text || COALESCE(mil.item_name, 'غير محدد'::character varying)::text AS trans_desc,
    mil.quantity AS qty,
    mil.total_price AS amount
   FROM public.material_issue_lines mil
     JOIN public.material_issues mi ON mil.issue_id = mi.id
  WHERE mil.job_order_id IS NOT NULL
UNION ALL
 SELECT e.id AS source_id,
    e.job_order_id,
    e.exp_date AS trans_date,
    'مصروفات نثرية'::text AS trans_type,
    COALESCE(e.description, e.main_category) AS trans_desc,
    1::numeric AS qty,
    e.total_price AS amount
   FROM public.expenses e
  WHERE e.job_order_id IS NOT NULL AND NOT COALESCE(e.is_deleted, false)
UNION ALL
 SELECT sc.id AS source_id,
    COALESCE(sc.job_order_id, ca.job_order_id) AS job_order_id,
    sc.date AS trans_date,
    'دفعات مقاولين'::text AS trans_type,
    (
      'مستخلص مقاول باطن رقم '::text || COALESCE(sc.claim_number, ''::text) ||
      ' - المقاول: '::text || COALESCE(p.name, 'مقاول باطن'::text) ||
      ' ('::text || COALESCE(sc.status, 'معتمد'::text) || ')'::text
    ) AS trans_desc,
    COALESCE(ca.assigned_qty, 1)::numeric AS qty,
    COALESCE(sc.net_amount, 0)::numeric AS amount
   FROM public.sub_claims sc
     LEFT JOIN public.partners p ON sc.contractor_id = p.id
     LEFT JOIN LATERAL (
       SELECT c.job_order_id, c.assigned_qty
       FROM public.contractor_assignments c
       WHERE c.claim_id = sc.id AND c.job_order_id IS NOT NULL
       LIMIT 1
     ) ca ON true
  WHERE COALESCE(sc.job_order_id, ca.job_order_id) IS NOT NULL
    AND COALESCE(sc.is_posted, false) = true
UNION ALL
 SELECT v.id AS source_id,
    v.job_order_id,
    v.date AS trans_date,
    'جزاءات'::text AS trans_type,
    ((COALESCE(v.violation_type, 'جزاء'::text) || ': '::text) || COALESCE(v.emp_name, 'غير محدد'::text)) || COALESCE(' - '::text || v.reason, ''::text) AS trans_desc,
    1::numeric AS qty,
    v.amount
   FROM public.violations v
  WHERE v.job_order_id IS NOT NULL AND NOT COALESCE(v.is_deleted, false)
UNION ALL
 SELECT inv.id AS source_id,
    NULLIF(line.value ->> 'job_order_id'::text, ''::text)::uuid AS job_order_id,
    inv.date AS trans_date,
    'فواتير'::text AS trans_type,
    (('فاتورة '::text || COALESCE(inv.invoice_number, ''::character varying)::text) || ': '::text) || COALESCE(line.value ->> 'description'::text, ''::text) AS trans_desc,
    rawasi_private.safe_numeric(line.value ->> 'quantity'::text) AS qty,
    rawasi_private.invoice_line_total(line.value) AS amount
   FROM public.invoices inv
     CROSS JOIN LATERAL jsonb_array_elements(rawasi_private.json_array_or_empty(inv.lines_data)) line(value)
  WHERE NULLIF(line.value ->> 'job_order_id'::text, ''::text) IS NOT NULL
UNION ALL
 SELECT r.id AS source_id,
    r.job_order_id,
    r.date AS trans_date,
    'سندات قبض'::text AS trans_type,
    ('سند قبض '::text || COALESCE(r.receipt_number, ''::character varying)::text) || COALESCE(' - '::text || r.notes, ''::text) AS trans_desc,
    1::numeric AS qty,
    r.amount
   FROM public.receipt_vouchers r
  WHERE r.job_order_id IS NOT NULL;

COMMIT;
