-- Migration: 20261105170007_custodies_and_cash_closings.sql
-- Description: Phase 3 - Site Custodies (حساب 125), Custody Settlements, and Daily Cash Closings with GL 527 reconciliations

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $preflight$
BEGIN
  IF to_regclass('public.companies') IS NULL THEN
    RAISE EXCEPTION 'Multi-company system is required before Phase 3';
  END IF;
  IF to_regclass('public.site_custodies') IS NOT NULL THEN
    RAISE EXCEPTION 'public.site_custodies already exists';
  END IF;
  IF to_regclass('public.daily_cash_closings') IS NOT NULL THEN
    RAISE EXCEPTION 'public.daily_cash_closings already exists';
  END IF;
END;
$preflight$;

BEGIN;

-- =============================================================================
-- 1. SITE CUSTODIES TABLE (عُهد المواقع والموظفين - حساب 125)
-- =============================================================================
CREATE TABLE public.site_custodies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT rawasi_private.current_company_id() REFERENCES public.companies(id) ON DELETE RESTRICT,
  custody_number text NOT NULL DEFAULT '',
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE RESTRICT,
  project_id uuid REFERENCES public.projects(id) ON DELETE RESTRICT,
  title text NOT NULL,
  opened_date date NOT NULL DEFAULT CURRENT_DATE,
  disbursed_amount numeric(15,2) NOT NULL DEFAULT 0 CHECK (disbursed_amount >= 0),
  spent_amount numeric(15,2) NOT NULL DEFAULT 0 CHECK (spent_amount >= 0),
  remaining_amount numeric(15,2) NOT NULL DEFAULT 0,
  max_days integer NOT NULL DEFAULT 30 CHECK (max_days > 0),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'settled', 'cancelled')),
  notes text,
  settlement_date date,
  settlement_type text CHECK (settlement_type IN ('cash_return', 'salary_deduction', 'carry_forward', 'cleared', NULL)),
  settlement_reference_id uuid,
  settlement_notes text,
  payment_voucher_id uuid REFERENCES public.payment_vouchers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  CONSTRAINT site_custodies_company_custody_no_uq UNIQUE (company_id, custody_number),
  CONSTRAINT site_custodies_company_id_uq UNIQUE (id, company_id)
);

COMMENT ON TABLE public.site_custodies IS 'سجل عُهد المواقع والمهندسين وتتبع مبالغها وتسوياتها (حساب 125)';

-- =============================================================================
-- 2. DAILY CASH CLOSINGS TABLE (إقفال الخزينة اليومي ومحاضر الجرد)
-- =============================================================================
CREATE TABLE public.daily_cash_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT rawasi_private.current_company_id() REFERENCES public.companies(id) ON DELETE RESTRICT,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  closing_date date NOT NULL DEFAULT CURRENT_DATE,
  closed_at timestamptz NOT NULL DEFAULT now(),
  system_balance numeric(15,2) NOT NULL DEFAULT 0,
  actual_cash numeric(15,2) NOT NULL DEFAULT 0,
  difference numeric(15,2) NOT NULL DEFAULT 0,
  difference_type text NOT NULL CHECK (difference_type IN ('exact', 'shortage', 'surplus')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  notes text,
  approved_by uuid,
  approved_at timestamptz,
  journal_header_id uuid REFERENCES public.journal_headers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  CONSTRAINT daily_cash_closings_safe_date_uq UNIQUE (company_id, account_id, closing_date),
  CONSTRAINT daily_cash_closings_company_id_uq UNIQUE (id, company_id)
);

COMMENT ON TABLE public.daily_cash_closings IS 'محاضر إقفال الخزينة اليومية ومقارنة الرصيد الدفتري بالفعلي ومعالجة الفروقات في 527';

-- =============================================================================
-- 3. LINK PAYMENT VOUCHERS & EXPENSES TO CUSTODIES
-- =============================================================================
ALTER TABLE public.payment_vouchers
  ADD COLUMN custody_id uuid;

ALTER TABLE public.payment_vouchers
  ADD CONSTRAINT payment_vouchers_custody_fkey
  FOREIGN KEY (custody_id, company_id) REFERENCES public.site_custodies(id, company_id) ON DELETE RESTRICT;

ALTER TABLE public.expenses
  ADD COLUMN custody_id uuid;

ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_custody_fkey
  FOREIGN KEY (custody_id, company_id) REFERENCES public.site_custodies(id, company_id) ON DELETE RESTRICT;

ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_payment_method_check;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_payment_method_check
  CHECK (payment_method IS NULL OR payment_method = ANY (ARRAY['كاش'::text, 'نقدي'::text, 'تحويل بنكي'::text, 'شيك'::text, 'عهدة'::text, 'عُهدة'::text, 'آجل'::text, 'تسوية داخلية'::text]));

ALTER TABLE public.receipt_vouchers DROP CONSTRAINT IF EXISTS receipt_vouchers_payment_method_check;
ALTER TABLE public.receipt_vouchers ADD CONSTRAINT receipt_vouchers_payment_method_check
  CHECK (payment_method IS NULL OR payment_method = ANY (ARRAY['نقدي (كاش)'::text, 'نقدي'::text, 'كاش'::text, 'تحويل بنكي'::text, 'شيك'::text]));

-- Register new tables in rawasi_private.company_scoped_tables
INSERT INTO rawasi_private.company_scoped_tables(table_name)
VALUES ('site_custodies'), ('daily_cash_closings');

-- Indexes
CREATE INDEX site_custodies_company_partner_idx ON public.site_custodies(company_id, partner_id);
CREATE INDEX site_custodies_company_project_idx ON public.site_custodies(company_id, project_id);
CREATE INDEX site_custodies_company_status_idx ON public.site_custodies(company_id, status);
CREATE INDEX daily_cash_closings_acc_date_idx ON public.daily_cash_closings(company_id, account_id, closing_date);
CREATE INDEX payment_vouchers_custody_idx ON public.payment_vouchers(company_id, custody_id);
CREATE INDEX expenses_custody_idx ON public.expenses(company_id, custody_id);

-- Triggers for company stamping and document numbering
CREATE TRIGGER aa_stamp_company_id BEFORE INSERT OR UPDATE OF company_id ON public.site_custodies
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id();

CREATE TRIGGER aa_stamp_company_id BEFORE INSERT OR UPDATE OF company_id ON public.daily_cash_closings
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id();

CREATE TRIGGER trg_custody_number BEFORE INSERT ON public.site_custodies
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.assign_document_number('CUST', 'custody_number', 'opened_date');

-- =============================================================================
-- 4. ROW LEVEL SECURITY POLICIES
-- =============================================================================
ALTER TABLE public.site_custodies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_cash_closings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.site_custodies, public.daily_cash_closings FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE ON public.site_custodies TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.daily_cash_closings TO authenticated;
GRANT ALL ON public.site_custodies, public.daily_cash_closings TO service_role;

CREATE POLICY site_custodies_read ON public.site_custodies FOR SELECT TO authenticated
  USING (
    (rawasi_private.can_access('expenses', 'view') OR rawasi_private.can_access('payments', 'view') OR rawasi_private.can_access('journal', 'view'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY site_custodies_insert ON public.site_custodies FOR INSERT TO authenticated
  WITH CHECK (
    (rawasi_private.can_access('expenses', 'create') OR rawasi_private.can_access('payments', 'create'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY site_custodies_update ON public.site_custodies FOR UPDATE TO authenticated
  USING (
    (rawasi_private.can_access('expenses', 'edit') OR rawasi_private.can_access('payments', 'edit'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY daily_cash_closings_read ON public.daily_cash_closings FOR SELECT TO authenticated
  USING (
    (rawasi_private.can_access('journal', 'view') OR rawasi_private.can_access('cashflows', 'view'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY daily_cash_closings_insert ON public.daily_cash_closings FOR INSERT TO authenticated
  WITH CHECK (
    (rawasi_private.can_access('journal', 'create') OR rawasi_private.can_access('cashflows', 'create'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY daily_cash_closings_update ON public.daily_cash_closings FOR UPDATE TO authenticated
  USING (
    (rawasi_private.can_access('journal', 'edit') OR rawasi_private.can_access('cashflows', 'edit'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

-- =============================================================================
-- 5. FUNCTION: SYNC CUSTODY EXPENSES ON EXPENSE POST/UNPOST
-- =============================================================================
CREATE OR REPLACE FUNCTION rawasi_private.sync_custody_spent()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_custody_id uuid;
  v_total_spent numeric(15,2);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_custody_id := OLD.custody_id;
  ELSE
    v_custody_id := NEW.custody_id;
  END IF;

  IF v_custody_id IS NOT NULL THEN
    SELECT coalesce(sum(coalesce(e.total_price, 0) + coalesce(e.vat_amount, 0) - coalesce(e.discount_amount, 0)), 0)
    INTO v_total_spent
    FROM public.expenses e
    WHERE e.custody_id = v_custody_id
      AND e.is_posted IS TRUE;

    UPDATE public.site_custodies
    SET spent_amount = v_total_spent,
        remaining_amount = round(disbursed_amount - v_total_spent, 2),
        updated_at = now()
    WHERE id = v_custody_id;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_sync_custody_spent
AFTER INSERT OR UPDATE OF custody_id, is_posted, total_price, vat_amount, discount_amount OR DELETE
ON public.expenses
FOR EACH ROW EXECUTE FUNCTION rawasi_private.sync_custody_spent();

-- =============================================================================
-- 6. RPC: CREATE SITE CUSTODY & DISBURSE CASH
-- =============================================================================
CREATE OR REPLACE FUNCTION public.create_site_custody(
  p_partner_id uuid,
  p_project_id uuid,
  p_title text,
  p_amount numeric,
  p_safe_acc_id uuid,
  p_payment_method text DEFAULT 'نقدي',
  p_notes text DEFAULT NULL,
  p_max_days integer DEFAULT 30
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_company uuid;
  v_custody_id uuid;
  v_acc_125 uuid;
  v_pv_id uuid;
  v_header_id uuid;
  v_partner_name text;
  v_voucher_number text;
BEGIN
  IF auth.uid() IS NULL AND current_setting('role', true) IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'يلزم تسجيل الدخول لإنشاء وصرف العهدة' USING ERRCODE = '42501';
  END IF;

  IF NOT (rawasi_private.can_access('payments', 'create') OR rawasi_private.can_access('expenses', 'create')) THEN
    RAISE EXCEPTION 'لا توجد صلاحية صرف عهدة جديدة' USING ERRCODE = '42501';
  END IF;

  IF p_partner_id IS NULL THEN
    RAISE EXCEPTION 'يلزم تحديد صاحب العهدة (المهندس أو المشرف)' USING ERRCODE = '23514';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'مبلغ العهدة يجب أن يكون أكبر من الصفر' USING ERRCODE = '23514';
  END IF;

  IF p_safe_acc_id IS NULL THEN
    RAISE EXCEPTION 'يلزم تحديد حساب الخزينة أو البنك المنصرف منه' USING ERRCODE = '23514';
  END IF;

  v_company := rawasi_private.current_company_id();
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'لم يتم تحديد الشركة الحالية' USING ERRCODE = '42501';
  END IF;

  -- Verify partner belongs to company
  SELECT name INTO v_partner_name FROM public.partners WHERE id = p_partner_id AND company_id = v_company;
  IF v_partner_name IS NULL THEN
    RAISE EXCEPTION 'الشريك المحدد غير موجود في الشركة' USING ERRCODE = '23503';
  END IF;

  -- Look up account 125
  v_acc_125 := rawasi_private.require_company_account('125');

  -- Verify safe account
  IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE id = p_safe_acc_id AND company_id = v_company) THEN
    RAISE EXCEPTION 'حساب الخزينة/البنك المحدد غير موجود في الشركة' USING ERRCODE = '23503';
  END IF;

  -- 1. Insert custody record
  INSERT INTO public.site_custodies (
    company_id, partner_id, project_id, title, opened_date,
    disbursed_amount, spent_amount, remaining_amount, max_days,
    status, notes
  ) VALUES (
    v_company, p_partner_id, p_project_id, btrim(p_title), CURRENT_DATE,
    round(p_amount, 2), 0, round(p_amount, 2), coalesce(p_max_days, 30),
    'open', p_notes
  ) RETURNING id INTO v_custody_id;

  -- 2. Insert payment voucher linked to custody
  INSERT INTO public.payment_vouchers (
    company_id, voucher_number, date, amount, partner_id,
    credit_account_id, debit_account_id, payment_method,
    description, notes, custody_id, project_ids, status
  ) VALUES (
    v_company, '', CURRENT_DATE, round(p_amount, 2), p_partner_id,
    p_safe_acc_id, v_acc_125, coalesce(p_payment_method, 'نقدي'),
    'صرف عهدة للمهندس: ' || v_partner_name || ' (' || btrim(p_title) || ')',
    p_notes, v_custody_id, CASE WHEN p_project_id IS NOT NULL THEN ARRAY[p_project_id] ELSE NULL END, 'مسودة'
  ) RETURNING id, voucher_number INTO v_pv_id, v_voucher_number;

  -- 3. Post payment voucher to journal (Debit 125 with partner_id, Credit safe/bank)
  INSERT INTO public.journal_headers (
    company_id, entry_date, description, reference_id, v_type, status
  ) VALUES (
    v_company, CURRENT_DATE, 'صرف عهدة رقم ' || v_voucher_number || ' - ' || v_partner_name,
    v_pv_id, 'payment_vouchers', 'posted'
  ) RETURNING id INTO v_header_id;

  -- Line 1: Debit 125 (عُهد الموظفين والمواقع) with partner_id
  INSERT INTO public.journal_lines (
    company_id, header_id, account_id, partner_id, project_id, debit, credit, notes
  ) VALUES (
    v_company, v_header_id, v_acc_125, p_partner_id, p_project_id, round(p_amount, 2), 0,
    'إثبات صرف عهدة: ' || btrim(p_title)
  );

  -- Line 2: Credit safe/bank (الخزينة/البنك)
  INSERT INTO public.journal_lines (
    company_id, header_id, account_id, partner_id, project_id, debit, credit, notes
  ) VALUES (
    v_company, v_header_id, p_safe_acc_id, NULL, p_project_id, 0, round(p_amount, 2),
    'صرف نقدية عهدة - سند صرف ' || v_voucher_number
  );

  -- Update payment voucher to posted
  UPDATE public.payment_vouchers
  SET is_posted = true, status = 'معتمد'
  WHERE id = v_pv_id;

  -- Update custody with payment voucher reference
  UPDATE public.site_custodies
  SET payment_voucher_id = v_pv_id
  WHERE id = v_custody_id;

  RETURN v_custody_id;
END;
$$;

-- =============================================================================
-- 7. RPC: SETTLE SITE CUSTODY (تسوية العهدة - رد نقدي / خصم راتب 216 / ترحيل)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.settle_site_custody(
  p_custody_id uuid,
  p_settlement_type text,
  p_destination_id uuid DEFAULT NULL,
  p_settlement_date date DEFAULT CURRENT_DATE,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_company uuid;
  v_custody public.site_custodies%ROWTYPE;
  v_acc_125 uuid;
  v_acc_216 uuid;
  v_spent numeric(15,2);
  v_remaining numeric(15,2);
  v_rv_id uuid;
  v_jh_id uuid;
  v_new_custody_id uuid;
  v_partner_name text;
  v_rv_number text;
BEGIN
  IF auth.uid() IS NULL AND current_setting('role', true) IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'يلزم تسجيل الدخول لتسوية العهدة' USING ERRCODE = '42501';
  END IF;

  IF NOT (rawasi_private.can_access('payments', 'edit') OR rawasi_private.can_access('expenses', 'edit') OR rawasi_private.can_access('journal', 'create')) THEN
    RAISE EXCEPTION 'لا توجد صلاحية تسوية العهد' USING ERRCODE = '42501';
  END IF;

  v_company := rawasi_private.current_company_id();

  SELECT * INTO v_custody
  FROM public.site_custodies
  WHERE id = p_custody_id AND company_id = v_company
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'العهدة غير موجودة أو غير تابعة للشركة الحالية' USING ERRCODE = '23503';
  END IF;

  IF v_custody.status <> 'open' THEN
    RAISE EXCEPTION 'العهدة مغلقة أو تمت تسويتها مسبقاً' USING ERRCODE = '23514';
  END IF;

  IF p_settlement_type NOT IN ('cash_return', 'salary_deduction', 'carry_forward', 'cleared') THEN
    RAISE EXCEPTION 'نوع التسوية غير صالح: %', p_settlement_type USING ERRCODE = '22023';
  END IF;

  SELECT name INTO v_partner_name FROM public.partners WHERE id = v_custody.partner_id AND company_id = v_company;
  v_acc_125 := rawasi_private.require_company_account('125');

  -- Recalculate exact posted expenses
  SELECT coalesce(sum(coalesce(total_price, 0) + coalesce(vat_amount, 0) - coalesce(discount_amount, 0)), 0)
  INTO v_spent
  FROM public.expenses
  WHERE custody_id = v_custody.id
    AND company_id = v_company
    AND is_posted IS TRUE;

  v_remaining := round(v_custody.disbursed_amount - v_spent, 2);

  IF v_remaining < 0 THEN
    RAISE EXCEPTION 'المصروفات المسجلة (%) تتجاوز إجمالي المبلغ المنصرف للعهدة (%)', v_spent, v_custody.disbursed_amount USING ERRCODE = '23514';
  END IF;

  -- If there is a remaining balance, execute chosen settlement action
  IF v_remaining > 0 THEN
    -- A) Cash Return (سند قبض - رد نقدي للخزينة/البنك)
    IF p_settlement_type = 'cash_return' THEN
      IF p_destination_id IS NULL THEN
        RAISE EXCEPTION 'يلزم تحديد حساب الخزينة أو البنك المردود إليه' USING ERRCODE = '23514';
      END IF;

      INSERT INTO public.receipt_vouchers (
        company_id, receipt_number, date, amount, partner_id,
        safe_bank_acc_id, partner_acc_id, payment_method, notes, status
      ) VALUES (
        v_company, '', coalesce(p_settlement_date, CURRENT_DATE), v_remaining, v_custody.partner_id,
        p_destination_id, v_acc_125, 'نقدي (كاش)',
        'رد متبقي عهدة رقم: ' || v_custody.custody_number || ' - المهندس: ' || v_partner_name, 'مسودة'
      ) RETURNING id, receipt_number INTO v_rv_id, v_rv_number;

      -- Post receipt voucher directly
      INSERT INTO public.journal_headers (
        company_id, entry_date, description, reference_id, v_type, status
      ) VALUES (
        v_company, coalesce(p_settlement_date, CURRENT_DATE),
        'رد متبقي عهدة رقم ' || v_custody.custody_number || ' بسند قبض ' || v_rv_number,
        v_rv_id, 'receipt_vouchers', 'posted'
      ) RETURNING id INTO v_jh_id;

      -- Debit safe/bank
      INSERT INTO public.journal_lines (
        company_id, header_id, account_id, partner_id, project_id, debit, credit, notes
      ) VALUES (
        v_company, v_jh_id, p_destination_id, NULL, v_custody.project_id, v_remaining, 0,
        'تحصيل متبقي عهدة ' || v_custody.custody_number
      );

      -- Credit 125 with partner_id
      INSERT INTO public.journal_lines (
        company_id, header_id, account_id, partner_id, project_id, debit, credit, notes
      ) VALUES (
        v_company, v_jh_id, v_acc_125, v_custody.partner_id, v_custody.project_id, 0, v_remaining,
        'تسوية متبقي عهدة ' || v_custody.custody_number
      );

      UPDATE public.receipt_vouchers SET status = 'معتمد' WHERE id = v_rv_id;

    -- B) Salary Deduction (خصم من الراتب على حساب 216 رواتب وأجور مستحقة)
    ELSIF p_settlement_type = 'salary_deduction' THEN
      v_acc_216 := rawasi_private.require_company_account('216');

      INSERT INTO public.journal_headers (
        company_id, entry_date, description, reference_id, v_type, status
      ) VALUES (
        v_company, coalesce(p_settlement_date, CURRENT_DATE),
        'تسوية متبقي عهدة ' || v_custody.custody_number || ' بالخصم من راتب: ' || v_partner_name,
        v_custody.id, 'manual_journals', 'posted'
      ) RETURNING id INTO v_jh_id;

      -- Debit 216 (أجور مستحقة) with partner_id
      INSERT INTO public.journal_lines (
        company_id, header_id, account_id, partner_id, project_id, debit, credit, notes
      ) VALUES (
        v_company, v_jh_id, v_acc_216, v_custody.partner_id, v_custody.project_id, v_remaining, 0,
        'خصم متبقي عهدة من مستحقات الراتب'
      );

      -- Credit 125 (عُهد الموظفين) with partner_id
      INSERT INTO public.journal_lines (
        company_id, header_id, account_id, partner_id, project_id, debit, credit, notes
      ) VALUES (
        v_company, v_jh_id, v_acc_125, v_custody.partner_id, v_custody.project_id, 0, v_remaining,
        'تسوية وقفل عهدة ' || v_custody.custody_number
      );

    -- C) Carry Forward (ترحيل لعهدة جديدة تالية)
    ELSIF p_settlement_type = 'carry_forward' THEN
      INSERT INTO public.site_custodies (
        company_id, partner_id, project_id, title, opened_date,
        disbursed_amount, spent_amount, remaining_amount, max_days,
        status, notes
      ) VALUES (
        v_company, v_custody.partner_id, coalesce(p_destination_id, v_custody.project_id),
        'مرحل من عهدة ' || v_custody.custody_number || ' - ' || v_custody.title,
        coalesce(p_settlement_date, CURRENT_DATE),
        v_remaining, 0, v_remaining, v_custody.max_days,
        'open', 'رصيد مرحل من العهدة السابقة: ' || v_custody.custody_number
      ) RETURNING id INTO v_new_custody_id;
    END IF;
  ELSE
    p_settlement_type := 'cleared';
  END IF;

  -- Mark current custody as settled
  UPDATE public.site_custodies
  SET status = 'settled',
      spent_amount = v_spent,
      remaining_amount = 0,
      settlement_date = coalesce(p_settlement_date, CURRENT_DATE),
      settlement_type = p_settlement_type,
      settlement_reference_id = coalesce(v_rv_id, v_jh_id, v_new_custody_id),
      settlement_notes = p_notes,
      updated_at = now()
  WHERE id = v_custody.id;

  RETURN jsonb_build_object(
    'custody_id', v_custody.id,
    'custody_number', v_custody.custody_number,
    'settlement_type', p_settlement_type,
    'disbursed_amount', v_custody.disbursed_amount,
    'spent_amount', v_spent,
    'remaining_settled', v_remaining,
    'receipt_voucher_id', v_rv_id,
    'journal_header_id', v_jh_id,
    'new_custody_id', v_new_custody_id
  );
END;
$$;

-- =============================================================================
-- 8. RPC: GET CUSTODIES SUMMARY & MONITORING
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_site_custodies_summary(
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_company uuid;
  v_result jsonb;
BEGIN
  v_company := rawasi_private.current_company_id();
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'لم يتم تحديد الشركة الحالية' USING ERRCODE = '42501';
  END IF;

  WITH custodies_data AS (
    SELECT 
      sc.id,
      sc.custody_number,
      sc.partner_id,
      p.code AS partner_code,
      p.name AS partner_name,
      p.phone AS partner_phone,
      sc.project_id,
      coalesce(pr."Property", 'غير محدد') AS project_name,
      sc.title,
      sc.opened_date,
      sc.disbursed_amount,
      sc.spent_amount,
      sc.remaining_amount,
      sc.max_days,
      sc.status,
      sc.notes,
      sc.settlement_date,
      sc.settlement_type,
      sc.settlement_notes,
      (CURRENT_DATE - sc.opened_date) AS days_open,
      CASE 
        WHEN sc.status = 'open' AND (CURRENT_DATE - sc.opened_date) > sc.max_days THEN true
        ELSE false
      END AS is_overdue,
      (
        SELECT count(*)::int 
        FROM public.expenses e 
        WHERE e.custody_id = sc.id AND e.company_id = sc.company_id
      ) AS expenses_count,
      (
        SELECT coalesce(jsonb_agg(
          jsonb_build_object(
            'id', e.id,
            'exp_date', e.exp_date,
            'description', e.description,
            'amount', (coalesce(e.total_price, 0) + coalesce(e.vat_amount, 0) - coalesce(e.discount_amount, 0)),
            'is_posted', e.is_posted
          ) ORDER BY e.exp_date DESC
        ), '[]'::jsonb)
        FROM public.expenses e
        WHERE e.custody_id = sc.id AND e.company_id = sc.company_id
      ) AS expenses
    FROM public.site_custodies sc
    JOIN public.partners p ON p.id = sc.partner_id AND p.company_id = sc.company_id
    LEFT JOIN public.projects pr ON pr.id = sc.project_id AND pr.company_id = sc.company_id
    WHERE sc.company_id = v_company
      AND (p_status IS NULL OR sc.status = p_status)
    ORDER BY sc.opened_date DESC, sc.created_at DESC
  ),
  kpi_agg AS (
    SELECT 
      count(*)::int AS total_custodies,
      count(*) FILTER (WHERE status = 'open')::int AS active_custodies,
      count(*) FILTER (WHERE is_overdue IS TRUE)::int AS overdue_custodies,
      coalesce(sum(disbursed_amount) FILTER (WHERE status = 'open'), 0) AS total_active_disbursed,
      coalesce(sum(spent_amount) FILTER (WHERE status = 'open'), 0) AS total_active_spent,
      coalesce(sum(remaining_amount) FILTER (WHERE status = 'open'), 0) AS total_active_remaining,
      coalesce(sum(remaining_amount) FILTER (WHERE is_overdue IS TRUE), 0) AS total_overdue_amount
    FROM custodies_data
  )
  SELECT jsonb_build_object(
    'kpis', to_jsonb(k),
    'custodies', coalesce((SELECT jsonb_agg(to_jsonb(c)) FROM custodies_data c), '[]'::jsonb)
  ) INTO v_result
  FROM kpi_agg k;

  RETURN v_result;
END;
$$;

-- =============================================================================
-- 9. RPC: GET CASH CLOSING PREVIEW (مقارنة رصيد الخزينة الدفتري بالجرد)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_cash_closing_preview(
  p_account_id uuid,
  p_closing_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_company uuid;
  v_as_of date := coalesce(p_closing_date, CURRENT_DATE);
  v_acc record;
  v_system_balance numeric(15,2);
  v_last_closing record;
  v_already_closed boolean;
BEGIN
  v_company := rawasi_private.current_company_id();
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'لم يتم تحديد الشركة الحالية' USING ERRCODE = '42501';
  END IF;

  SELECT id, code, name INTO v_acc
  FROM public.accounts
  WHERE id = p_account_id AND company_id = v_company;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'حساب الخزينة/البنك غير موجود في الشركة' USING ERRCODE = '23503';
  END IF;

  -- Cumulative posted GL balance for this safe up to v_as_of
  SELECT coalesce(sum(jl.debit - jl.credit), 0)
  INTO v_system_balance
  FROM public.journal_lines jl
  JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = jl.company_id
  WHERE jl.company_id = v_company
    AND jl.account_id = p_account_id
    AND jh.status IN ('posted', 'مرحل', 'معتمد')
    AND jh.entry_date <= v_as_of;

  -- Last closing
  SELECT closing_date, closed_at, system_balance, actual_cash, difference, status
  INTO v_last_closing
  FROM public.daily_cash_closings
  WHERE company_id = v_company AND account_id = p_account_id
  ORDER BY closing_date DESC, closed_at DESC
  LIMIT 1;

  -- Already closed today?
  SELECT EXISTS (
    SELECT 1 FROM public.daily_cash_closings
    WHERE company_id = v_company AND account_id = p_account_id AND closing_date = v_as_of
  ) INTO v_already_closed;

  RETURN jsonb_build_object(
    'account_id', v_acc.id,
    'account_code', v_acc.code,
    'account_name', v_acc.name,
    'closing_date', v_as_of,
    'system_balance', round(v_system_balance, 2),
    'is_already_closed_today', v_already_closed,
    'last_closing', CASE WHEN v_last_closing.closing_date IS NOT NULL THEN to_jsonb(v_last_closing) ELSE NULL END
  );
END;
$$;

-- =============================================================================
-- 10. RPC: CREATE DAILY CASH CLOSING (تسجيل محضر إقفال الخزينة)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.create_daily_cash_closing(
  p_account_id uuid,
  p_closing_date date,
  p_actual_cash numeric,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_company uuid;
  v_closing_date date := coalesce(p_closing_date, CURRENT_DATE);
  v_system_balance numeric(15,2);
  v_diff numeric(15,2);
  v_diff_type text;
  v_status text;
  v_closing_id uuid;
BEGIN
  IF auth.uid() IS NULL AND current_setting('role', true) IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'يلزم تسجيل الدخول لإقفال الخزينة' USING ERRCODE = '42501';
  END IF;

  IF NOT (rawasi_private.can_access('journal', 'create') OR rawasi_private.can_access('cashflows', 'create')) THEN
    RAISE EXCEPTION 'لا توجد صلاحية إقفال الخزينة' USING ERRCODE = '42501';
  END IF;

  v_company := rawasi_private.current_company_id();
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'لم يتم تحديد الشركة الحالية' USING ERRCODE = '42501';
  END IF;

  IF p_account_id IS NULL THEN
    RAISE EXCEPTION 'يلزم تحديد حساب الخزينة' USING ERRCODE = '23514';
  END IF;

  IF p_actual_cash IS NULL OR p_actual_cash < 0 THEN
    RAISE EXCEPTION 'المبلغ الفعلي لا يمكن أن يكون سالباً' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.daily_cash_closings
    WHERE company_id = v_company AND account_id = p_account_id AND closing_date = v_closing_date
  ) THEN
    RAISE EXCEPTION 'تم إقفال هذه الخزينة لهذا التاريخ مسبقاً' USING ERRCODE = '23505';
  END IF;

  -- Calculate GL balance
  SELECT coalesce(sum(jl.debit - jl.credit), 0)
  INTO v_system_balance
  FROM public.journal_lines jl
  JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = jl.company_id
  WHERE jl.company_id = v_company
    AND jl.account_id = p_account_id
    AND jh.status IN ('posted', 'مرحل', 'معتمد')
    AND jh.entry_date <= v_closing_date;

  v_diff := round(p_actual_cash - v_system_balance, 2);

  IF v_diff = 0 THEN
    v_diff_type := 'exact';
    v_status := 'approved'; -- Exactly matched, automatically approved
  ELSIF v_diff < 0 THEN
    v_diff_type := 'shortage'; -- عجز
    v_status := 'pending'; -- requires manager approval to post to 527
  ELSE
    v_diff_type := 'surplus'; -- زيادة
    v_status := 'pending';
  END IF;

  INSERT INTO public.daily_cash_closings (
    company_id, account_id, closing_date, closed_at,
    system_balance, actual_cash, difference, difference_type,
    status, notes
  ) VALUES (
    v_company, p_account_id, v_closing_date, now(),
    round(v_system_balance, 2), round(p_actual_cash, 2), v_diff, v_diff_type,
    v_status, p_notes
  ) RETURNING id INTO v_closing_id;

  RETURN v_closing_id;
END;
$$;

-- =============================================================================
-- 11. RPC: APPROVE CASH CLOSING & POST VARIANCE TO GL 527
-- =============================================================================
CREATE OR REPLACE FUNCTION public.approve_cash_closing(
  p_closing_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_company uuid;
  v_closing public.daily_cash_closings%ROWTYPE;
  v_acc_527 uuid;
  v_safe_name text;
  v_jh_id uuid;
  v_abs_diff numeric(15,2);
BEGIN
  IF auth.uid() IS NULL AND current_setting('role', true) IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'يلزم تسجيل الدخول لاعتماد إقفال الخزينة' USING ERRCODE = '42501';
  END IF;

  IF NOT (rawasi_private.can_access('journal', 'edit') OR rawasi_private.can_access('cashflows', 'edit')) THEN
    RAISE EXCEPTION 'لا توجد صلاحية اعتماد إقفال وفروقات الخزينة' USING ERRCODE = '42501';
  END IF;

  v_company := rawasi_private.current_company_id();

  SELECT * INTO v_closing
  FROM public.daily_cash_closings
  WHERE id = p_closing_id AND company_id = v_company
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'محضر إقفال الخزينة غير موجود' USING ERRCODE = '23503';
  END IF;

  IF v_closing.status = 'approved' THEN
    RETURN jsonb_build_object('closing_id', v_closing.id, 'status', 'approved', 'message', 'معتمد مسبقاً');
  END IF;

  SELECT name INTO v_safe_name FROM public.accounts WHERE id = v_closing.account_id AND company_id = v_company;
  v_acc_527 := rawasi_private.require_company_account('527');
  v_abs_diff := abs(v_closing.difference);

  IF v_closing.difference <> 0 THEN
    -- Post journal entry for difference
    INSERT INTO public.journal_headers (
      company_id, entry_date, description, reference_id, v_type, status
    ) VALUES (
      v_company, v_closing.closing_date,
      'تسوية فروق جرد خزينة: ' || v_safe_name || ' بتاريخ ' || v_closing.closing_date,
      v_closing.id, 'manual_journals', 'posted'
    ) RETURNING id INTO v_jh_id;

    -- Shortage (عجز: actual < system -> Debit 527 مصروف فروقات، Credit Safe الخزينة)
    IF v_closing.difference < 0 THEN
      -- Debit 527
      INSERT INTO public.journal_lines (
        company_id, header_id, account_id, partner_id, debit, credit, notes
      ) VALUES (
        v_company, v_jh_id, v_acc_527, NULL, v_abs_diff, 0,
        'عجز جرد خزينة ' || v_safe_name || ' في ' || v_closing.closing_date
      );
      -- Credit Safe
      INSERT INTO public.journal_lines (
        company_id, header_id, account_id, partner_id, debit, credit, notes
      ) VALUES (
        v_company, v_jh_id, v_closing.account_id, NULL, 0, v_abs_diff,
        'تخفيض رصيد الخزينة بموجب محضر الجرد المعتمد'
      );

    -- Surplus (زيادة: actual > system -> Debit Safe الخزينة، Credit 527 تسويات)
    ELSE
      -- Debit Safe
      INSERT INTO public.journal_lines (
        company_id, header_id, account_id, partner_id, debit, credit, notes
      ) VALUES (
        v_company, v_jh_id, v_closing.account_id, NULL, v_abs_diff, 0,
        'إثبات زيادة نقدية بجرد خزينة ' || v_safe_name || ' في ' || v_closing.closing_date
      );
      -- Credit 527
      INSERT INTO public.journal_lines (
        company_id, header_id, account_id, partner_id, debit, credit, notes
      ) VALUES (
        v_company, v_jh_id, v_acc_527, NULL, 0, v_abs_diff,
        'فروق جرد موجبة تسويات هللات'
      );
    END IF;
  END IF;

  UPDATE public.daily_cash_closings
  SET status = 'approved',
      approved_by = auth.uid(),
      approved_at = now(),
      journal_header_id = v_jh_id,
      notes = coalesce(p_notes, notes)
  WHERE id = v_closing.id;

  RETURN jsonb_build_object(
    'closing_id', v_closing.id,
    'status', 'approved',
    'journal_header_id', v_jh_id,
    'difference', v_closing.difference
  );
END;
$$;

-- =============================================================================
-- 12. RPC: GET CASH CLOSINGS HISTORY
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_daily_cash_closings_history(
  p_account_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_company uuid;
  v_list jsonb;
BEGIN
  v_company := rawasi_private.current_company_id();
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'لم يتم تحديد الشركة الحالية' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'account_id', c.account_id,
      'account_code', a.code,
      'account_name', a.name,
      'closing_date', c.closing_date,
      'closed_at', c.closed_at,
      'system_balance', c.system_balance,
      'actual_cash', c.actual_cash,
      'difference', c.difference,
      'difference_type', c.difference_type,
      'status', c.status,
      'notes', c.notes,
      'approved_at', c.approved_at,
      'journal_header_id', c.journal_header_id
    ) ORDER BY c.closing_date DESC, c.closed_at DESC
  ), '[]'::jsonb)
  INTO v_list
  FROM public.daily_cash_closings c
  JOIN public.accounts a ON a.id = c.account_id AND a.company_id = c.company_id
  WHERE c.company_id = v_company
    AND (p_account_id IS NULL OR c.account_id = p_account_id)
  LIMIT coalesce(p_limit, 50);

  RETURN v_list;
END;
$$;

COMMIT;
