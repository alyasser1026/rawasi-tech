-- =============================================================================
-- حزمة 2: الأصول الثابتة والإهلاك، المشتريات والمخازن، رادار السلامة وتنبيهات الوثائق، وربحية المشاريع
-- =============================================================================


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- FILE: 20261105170008_fixed_assets_and_depreciation.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- Migration: 20261105170008_fixed_assets_and_depreciation.sql
-- Description: Phase 4 - Fixed Assets, Monthly Depreciation Runs, Asset Transfers between Projects, and Operational Cost Tracking

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $preflight$
BEGIN
  IF to_regclass('public.companies') IS NULL THEN
    RAISE EXCEPTION 'Multi-company system is required before Phase 4';
  END IF;
  IF to_regclass('public.fixed_assets') IS NOT NULL THEN
    RAISE EXCEPTION 'public.fixed_assets already exists';
  END IF;
  IF to_regclass('public.asset_depreciation_runs') IS NOT NULL THEN
    RAISE EXCEPTION 'public.asset_depreciation_runs already exists';
  END IF;
END;
$preflight$;

BEGIN;

-- =============================================================================
-- 1. SEED DEPRECIATION & DISPOSAL ACCOUNTS (528, 529) IN COA IF MISSING
-- =============================================================================
INSERT INTO public.accounts (company_id, code, name, account_type, parent_id, is_transactional)
SELECT c.id, '528', 'مصروف إهلاك الأصول الثابتة', 'مصروفات',
       (SELECT id FROM public.accounts WHERE company_id = c.id AND code = '52' LIMIT 1), true
FROM public.companies c
ON CONFLICT (company_id, code) DO NOTHING;

INSERT INTO public.accounts (company_id, code, name, account_type, parent_id, is_transactional)
SELECT c.id, '529', 'خسائر بيع واستبعاد أصول', 'مصروفات',
       (SELECT id FROM public.accounts WHERE company_id = c.id AND code = '52' LIMIT 1), true
FROM public.companies c
ON CONFLICT (company_id, code) DO NOTHING;

-- =============================================================================
-- 2. FIXED ASSETS TABLE (سجل الأصول الثابتة والمعدات)
-- =============================================================================
CREATE TABLE public.fixed_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT rawasi_private.current_company_id() REFERENCES public.companies(id) ON DELETE RESTRICT,
  asset_number text NOT NULL DEFAULT '',
  name text NOT NULL,
  asset_type text NOT NULL CHECK (asset_type IN ('equipment', 'vehicle', 'furniture', 'building', 'other')),
  asset_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  depreciation_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  expense_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  purchase_cost numeric(15,2) NOT NULL CHECK (purchase_cost >= 0),
  salvage_value numeric(15,2) NOT NULL DEFAULT 0 CHECK (salvage_value >= 0 AND salvage_value <= purchase_cost),
  useful_life_months integer NOT NULL CHECK (useful_life_months > 0),
  monthly_depreciation numeric(15,2) NOT NULL DEFAULT 0 CHECK (monthly_depreciation >= 0),
  opening_accumulated_depreciation numeric(15,2) NOT NULL DEFAULT 0 CHECK (opening_accumulated_depreciation >= 0),
  accumulated_depreciation numeric(15,2) NOT NULL DEFAULT 0 CHECK (accumulated_depreciation >= 0),
  book_value numeric(15,2) NOT NULL DEFAULT 0 CHECK (book_value >= 0),
  current_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'depreciated', 'disposed', 'sold')),
  disposal_date date,
  disposal_amount numeric(15,2),
  disposal_notes text,
  serial_number text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  CONSTRAINT fixed_assets_company_asset_no_uq UNIQUE (company_id, asset_number),
  CONSTRAINT fixed_assets_company_id_uq UNIQUE (id, company_id)
);

-- =============================================================================
-- 3. ASSET TRANSFERS (سجل تنقل الأصل بين المشاريع)
-- =============================================================================
CREATE TABLE public.asset_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT rawasi_private.current_company_id() REFERENCES public.companies(id) ON DELETE RESTRICT,
  transfer_number text NOT NULL DEFAULT '',
  asset_id uuid NOT NULL,
  from_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  to_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  transfer_date date NOT NULL DEFAULT CURRENT_DATE,
  responsible_partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  CONSTRAINT asset_transfers_asset_fkey FOREIGN KEY (asset_id, company_id) REFERENCES public.fixed_assets(id, company_id) ON DELETE RESTRICT,
  CONSTRAINT asset_transfers_company_no_uq UNIQUE (company_id, transfer_number),
  CONSTRAINT asset_transfers_company_id_uq UNIQUE (id, company_id)
);

-- =============================================================================
-- 4. MONTHLY DEPRECIATION RUNS (سجل تشغيلات الإهلاك الشهري)
-- =============================================================================
CREATE TABLE public.asset_depreciation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT rawasi_private.current_company_id() REFERENCES public.companies(id) ON DELETE RESTRICT,
  run_number text NOT NULL DEFAULT '',
  period_year integer NOT NULL CHECK (period_year BETWEEN 2000 AND 2100),
  period_month integer NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  run_date date NOT NULL DEFAULT CURRENT_DATE,
  total_depreciation numeric(15,2) NOT NULL DEFAULT 0 CHECK (total_depreciation >= 0),
  assets_count integer NOT NULL DEFAULT 0 CHECK (assets_count >= 0),
  journal_header_id uuid REFERENCES public.journal_headers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'posted' CHECK (status IN ('posted', 'cancelled')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  CONSTRAINT dep_runs_company_period_uq UNIQUE (company_id, period_year, period_month),
  CONSTRAINT dep_runs_company_no_uq UNIQUE (company_id, run_number),
  CONSTRAINT dep_runs_company_id_uq UNIQUE (id, company_id)
);

-- =============================================================================
-- 5. ASSET DEPRECIATION LINES (تفاصيل إهلاك كل أصل في التشغيلة)
-- =============================================================================
CREATE TABLE public.asset_depreciation_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT rawasi_private.current_company_id() REFERENCES public.companies(id) ON DELETE RESTRICT,
  run_id uuid NOT NULL,
  asset_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  depreciation_amount numeric(15,2) NOT NULL CHECK (depreciation_amount >= 0),
  prior_accumulated numeric(15,2) NOT NULL CHECK (prior_accumulated >= 0),
  new_accumulated numeric(15,2) NOT NULL CHECK (new_accumulated >= 0),
  new_book_value numeric(15,2) NOT NULL CHECK (new_book_value >= 0),
  is_last_month boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dep_lines_run_fkey FOREIGN KEY (run_id, company_id) REFERENCES public.asset_depreciation_runs(id, company_id) ON DELETE CASCADE,
  CONSTRAINT dep_lines_asset_fkey FOREIGN KEY (asset_id, company_id) REFERENCES public.fixed_assets(id, company_id) ON DELETE RESTRICT,
  CONSTRAINT dep_lines_run_asset_uq UNIQUE (company_id, run_id, asset_id),
  CONSTRAINT dep_lines_company_id_uq UNIQUE (id, company_id)
);

-- =============================================================================
-- 6. LINK OPERATIONAL EXPENSES TO ASSETS (وقود، صيانة، إصلاحات)
-- =============================================================================
ALTER TABLE public.expenses
  ADD COLUMN asset_id uuid;

ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_asset_fkey
  FOREIGN KEY (asset_id, company_id) REFERENCES public.fixed_assets(id, company_id) ON DELETE SET NULL;

-- Register new tables in rawasi_private.company_scoped_tables
INSERT INTO rawasi_private.company_scoped_tables(table_name)
VALUES ('fixed_assets'), ('asset_transfers'), ('asset_depreciation_runs'), ('asset_depreciation_lines');

-- Indexes
CREATE INDEX fixed_assets_company_type_idx ON public.fixed_assets(company_id, asset_type);
CREATE INDEX fixed_assets_company_status_idx ON public.fixed_assets(company_id, status);
CREATE INDEX fixed_assets_company_project_idx ON public.fixed_assets(company_id, current_project_id);
CREATE INDEX asset_transfers_asset_idx ON public.asset_transfers(company_id, asset_id);
CREATE INDEX asset_dep_runs_period_idx ON public.asset_depreciation_runs(company_id, period_year, period_month);
CREATE INDEX asset_dep_lines_run_idx ON public.asset_depreciation_lines(company_id, run_id);
CREATE INDEX expenses_asset_idx ON public.expenses(company_id, asset_id);

-- Triggers for company stamping and document numbering
CREATE TRIGGER aa_stamp_company_id BEFORE INSERT OR UPDATE OF company_id ON public.fixed_assets
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id();

CREATE TRIGGER aa_stamp_company_id BEFORE INSERT OR UPDATE OF company_id ON public.asset_transfers
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id();

CREATE TRIGGER aa_stamp_company_id BEFORE INSERT OR UPDATE OF company_id ON public.asset_depreciation_runs
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id();

CREATE TRIGGER aa_stamp_company_id BEFORE INSERT OR UPDATE OF company_id ON public.asset_depreciation_lines
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id();

CREATE TRIGGER trg_doc_number BEFORE INSERT ON public.fixed_assets
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.assign_document_number('AST', 'asset_number', 'purchase_date');

CREATE TRIGGER trg_doc_number BEFORE INSERT ON public.asset_transfers
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.assign_document_number('TRF', 'transfer_number', 'transfer_date');

CREATE TRIGGER trg_doc_number BEFORE INSERT ON public.asset_depreciation_runs
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.assign_document_number('DEP', 'run_number', 'run_date');

-- Enable RLS
ALTER TABLE public.fixed_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_depreciation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_depreciation_lines ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fixed_assets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_transfers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_depreciation_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_depreciation_lines TO authenticated;
GRANT ALL ON public.fixed_assets, public.asset_transfers, public.asset_depreciation_runs, public.asset_depreciation_lines TO service_role;

-- RLS Policies
CREATE POLICY fixed_assets_select ON public.fixed_assets FOR SELECT TO authenticated
  USING (
    (rawasi_private.can_access('assets', 'view') OR rawasi_private.can_access('accounting', 'view') OR rawasi_private.can_access('journal', 'view'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY fixed_assets_insert ON public.fixed_assets FOR INSERT TO authenticated
  WITH CHECK (
    (rawasi_private.can_access('assets', 'create') OR rawasi_private.can_access('accounting', 'create'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY fixed_assets_update ON public.fixed_assets FOR UPDATE TO authenticated
  USING (
    (rawasi_private.can_access('assets', 'edit') OR rawasi_private.can_access('accounting', 'edit'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY asset_transfers_select ON public.asset_transfers FOR SELECT TO authenticated
  USING (
    (rawasi_private.can_access('assets', 'view') OR rawasi_private.can_access('projects', 'view'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY asset_transfers_insert ON public.asset_transfers FOR INSERT TO authenticated
  WITH CHECK (
    (rawasi_private.can_access('assets', 'create') OR rawasi_private.can_access('projects', 'create'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY dep_runs_select ON public.asset_depreciation_runs FOR SELECT TO authenticated
  USING (
    (rawasi_private.can_access('assets', 'view') OR rawasi_private.can_access('accounting', 'view'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY dep_runs_insert ON public.asset_depreciation_runs FOR INSERT TO authenticated
  WITH CHECK (
    (rawasi_private.can_access('assets', 'create') OR rawasi_private.can_access('accounting', 'create'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY dep_lines_select ON public.asset_depreciation_lines FOR SELECT TO authenticated
  USING (
    (rawasi_private.can_access('assets', 'view') OR rawasi_private.can_access('accounting', 'view'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY dep_lines_insert ON public.asset_depreciation_lines FOR INSERT TO authenticated
  WITH CHECK (
    (rawasi_private.can_access('assets', 'create') OR rawasi_private.can_access('accounting', 'create'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

-- =============================================================================
-- 7. STORED PROCEDURES & RPCS
-- =============================================================================

-- 7.1 CREATE FIXED ASSET
CREATE OR REPLACE FUNCTION public.create_fixed_asset(
  p_name text,
  p_asset_type text,
  p_purchase_cost numeric,
  p_useful_life_months integer,
  p_salvage_value numeric DEFAULT 0,
  p_purchase_date date DEFAULT CURRENT_DATE,
  p_current_project_id uuid DEFAULT NULL,
  p_serial_number text DEFAULT NULL,
  p_asset_account_id uuid DEFAULT NULL,
  p_depreciation_account_id uuid DEFAULT NULL,
  p_expense_account_id uuid DEFAULT NULL,
  p_opening_accumulated numeric DEFAULT 0,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company uuid := rawasi_private.current_company_id();
  v_asset_id uuid;
  v_asset_acc uuid := p_asset_account_id;
  v_dep_acc uuid := p_depreciation_account_id;
  v_exp_acc uuid := p_expense_account_id;
  v_monthly numeric(15,2);
  v_book numeric(15,2);
  v_status text := 'active';
  v_salvage numeric(15,2) := coalesce(p_salvage_value, 0);
  v_opening numeric(15,2) := coalesce(p_opening_accumulated, 0);
BEGIN
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'يلزم تحديد الشركة المفتوحة لإضافة الأصل' USING ERRCODE = '42501';
  END IF;

  IF NOT (rawasi_private.can_access('assets', 'create') OR rawasi_private.can_access('accounting', 'create')) THEN
    RAISE EXCEPTION 'ليس لديك صلاحية إضافة أصل جديد' USING ERRCODE = '42501';
  END IF;

  IF p_purchase_cost <= 0 THEN
    RAISE EXCEPTION 'تكلفة شراء الأصل يجب أن تكون أكبر من صفر' USING ERRCODE = '23514';
  END IF;

  IF p_useful_life_months <= 0 THEN
    RAISE EXCEPTION 'العمر الافتراضي للأصل يجب أن يكون شهراً واحداً على الأقل' USING ERRCODE = '23514';
  END IF;

  IF v_salvage < 0 OR v_salvage > p_purchase_cost THEN
    RAISE EXCEPTION 'قيمة الخردة لا يمكن أن تكون سالبة أو تتجاوز تكلفة الشراء' USING ERRCODE = '23514';
  END IF;

  -- Default Asset Accounts based on type if not provided
  IF v_asset_acc IS NULL THEN
    IF p_asset_type = 'equipment' THEN
      v_asset_acc := rawasi_private.require_company_account('111');
    ELSIF p_asset_type = 'vehicle' THEN
      v_asset_acc := rawasi_private.require_company_account('112');
    ELSIF p_asset_type = 'furniture' THEN
      v_asset_acc := rawasi_private.require_company_account('113');
    ELSE
      v_asset_acc := rawasi_private.require_company_account('111');
    END IF;
  END IF;

  IF v_dep_acc IS NULL THEN
    v_dep_acc := rawasi_private.require_company_account('114');
  END IF;

  IF v_exp_acc IS NULL THEN
    v_exp_acc := rawasi_private.require_company_account('528');
  END IF;

  -- Calculate straight-line monthly depreciation
  v_monthly := round((p_purchase_cost - v_salvage) / p_useful_life_months, 2);
  v_book := p_purchase_cost - v_opening;

  IF v_book <= v_salvage THEN
    v_status := 'depreciated';
  END IF;

  INSERT INTO public.fixed_assets (
    company_id, name, asset_type, asset_account_id, depreciation_account_id,
    expense_account_id, purchase_date, purchase_cost, salvage_value,
    useful_life_months, monthly_depreciation, opening_accumulated_depreciation,
    accumulated_depreciation, book_value, current_project_id, status,
    serial_number, notes
  ) VALUES (
    v_company, p_name, p_asset_type, v_asset_acc, v_dep_acc,
    v_exp_acc, coalesce(p_purchase_date, CURRENT_DATE), p_purchase_cost, v_salvage,
    p_useful_life_months, v_monthly, v_opening,
    v_opening, v_book, p_current_project_id, v_status,
    p_serial_number, p_notes
  ) RETURNING id INTO v_asset_id;

  -- If initial project provided, record transfer history
  IF p_current_project_id IS NOT NULL THEN
    INSERT INTO public.asset_transfers (
      company_id, asset_id, from_project_id, to_project_id, transfer_date, notes
    ) VALUES (
      v_company, v_asset_id, NULL, p_current_project_id, coalesce(p_purchase_date, CURRENT_DATE), 'تخصيص أولي للأصل عند الإنشاء'
    );
  END IF;

  RETURN v_asset_id;
END;
$$;

-- 7.2 PREVIEW MONTHLY DEPRECIATION
CREATE OR REPLACE FUNCTION public.calculate_monthly_depreciation_preview(
  p_year integer,
  p_month integer
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company uuid := rawasi_private.current_company_id();
  v_is_posted boolean := false;
  v_assets jsonb;
  v_total numeric(15,2) := 0;
  v_count integer := 0;
BEGIN
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'يلزم تحديد الشركة المفتوحة' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.asset_depreciation_runs
    WHERE company_id = v_company
      AND period_year = p_year
      AND period_month = p_month
      AND status = 'posted'
  ) INTO v_is_posted;

  WITH calculated AS (
    SELECT
      a.id AS asset_id,
      a.asset_number,
      a.name AS asset_name,
      a.asset_type,
      a.purchase_cost,
      a.salvage_value,
      a.accumulated_depreciation AS prior_accumulated,
      a.book_value AS prior_book_value,
      a.current_project_id,
      p."Property" AS project_name,
      a.expense_account_id,
      acc.code AS expense_account_code,
      acc.name AS expense_account_name,
      -- Remaining depreciable capacity
      greatest(0, (a.purchase_cost - a.salvage_value) - a.accumulated_depreciation) AS max_remaining,
      -- Monthly depreciation amount with final-month capping
      least(
        a.monthly_depreciation,
        greatest(0, (a.purchase_cost - a.salvage_value) - a.accumulated_depreciation)
      ) AS dep_amount,
      -- Check if this completes depreciation
      ((a.purchase_cost - a.salvage_value) - a.accumulated_depreciation) <= a.monthly_depreciation AS is_last_month
    FROM public.fixed_assets a
    LEFT JOIN public.projects p ON p.id = a.current_project_id
    LEFT JOIN public.accounts acc ON acc.id = a.expense_account_id
    WHERE a.company_id = v_company
      AND a.status = 'active'
      AND a.purchase_date <= (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::date
      AND (a.purchase_cost - a.salvage_value) > a.accumulated_depreciation
  )
  SELECT
    coalesce(jsonb_agg(
      jsonb_build_object(
        'asset_id', c.asset_id,
        'asset_number', c.asset_number,
        'asset_name', c.asset_name,
        'asset_type', c.asset_type,
        'purchase_cost', c.purchase_cost,
        'salvage_value', c.salvage_value,
        'prior_accumulated', c.prior_accumulated,
        'prior_book_value', c.prior_book_value,
        'project_id', c.current_project_id,
        'project_name', c.project_name,
        'expense_account_id', c.expense_account_id,
        'expense_account_code', c.expense_account_code,
        'expense_account_name', c.expense_account_name,
        'depreciation_amount', c.dep_amount,
        'new_accumulated', c.prior_accumulated + c.dep_amount,
        'new_book_value', c.prior_book_value - c.dep_amount,
        'is_last_month', c.is_last_month
      )
    ), '[]'::jsonb),
    coalesce(sum(c.dep_amount), 0),
    count(*)
  INTO v_assets, v_total, v_count
  FROM calculated c
  WHERE c.dep_amount > 0;

  RETURN jsonb_build_object(
    'period_year', p_year,
    'period_month', p_month,
    'is_already_posted', v_is_posted,
    'total_depreciation', v_total,
    'assets_count', v_count,
    'assets', v_assets
  );
END;
$$;

-- 7.3 POST MONTHLY DEPRECIATION
CREATE OR REPLACE FUNCTION public.post_monthly_depreciation(
  p_year integer,
  p_month integer,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company uuid := rawasi_private.current_company_id();
  v_run_id uuid;
  v_run_number text;
  v_jh_id uuid;
  v_dep_acc uuid;
  v_r record;
  v_dep_amount numeric(15,2);
  v_new_acc numeric(15,2);
  v_new_book numeric(15,2);
  v_is_last boolean;
  v_total numeric(15,2) := 0;
  v_count integer := 0;
  v_run_date date;
BEGIN
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'يلزم تحديد الشركة المفتوحة' USING ERRCODE = '42501';
  END IF;

  IF NOT (rawasi_private.can_access('assets', 'create') OR rawasi_private.can_access('accounting', 'create')) THEN
    RAISE EXCEPTION 'ليس لديك صلاحية ترحيل إهلاك الأصول' USING ERRCODE = '42501';
  END IF;

  IF p_month < 1 OR p_month > 12 OR p_year < 2000 OR p_year > 2100 THEN
    RAISE EXCEPTION 'تاريخ فترة الإهلاك غير صحيح (%/%)', p_year, p_month USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.asset_depreciation_runs
    WHERE company_id = v_company
      AND period_year = p_year
      AND period_month = p_month
      AND status = 'posted'
  ) THEN
    RAISE EXCEPTION 'تم ترحيل إهلاك شهر %-% مسبقاً، ولا يمكن ترحيل نفس الفترة مرتين', p_year, p_month USING ERRCODE = '23505';
  END IF;

  -- Run date is end of month
  v_run_date := (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::date;
  v_dep_acc := rawasi_private.require_company_account('114'); -- مجمع إهلاك الأصول الثابتة

  -- Create Depreciation Run Header
  INSERT INTO public.asset_depreciation_runs (
    company_id, period_year, period_month, run_date, total_depreciation,
    assets_count, status, notes
  ) VALUES (
    v_company, p_year, p_month, v_run_date, 0, 0, 'posted',
    coalesce(p_notes, 'قيد إهلاك أصول شهر ' || p_month || '/' || p_year)
  ) RETURNING id, run_number INTO v_run_id, v_run_number;

  -- Create Journal Header
  INSERT INTO public.journal_headers (
    company_id, entry_date, description, reference_id, v_type, status
  ) VALUES (
    v_company, v_run_date,
    'إهلاك الأصول الثابتة لشهر ' || p_month || '/' || p_year || ' بموجب كشف ' || v_run_number,
    v_run_id, 'depreciation', 'posted'
  ) RETURNING id INTO v_jh_id;

  -- Iterate over eligible assets
  FOR v_r IN
    SELECT
      a.id,
      a.name,
      a.asset_number,
      a.purchase_cost,
      a.salvage_value,
      a.accumulated_depreciation,
      a.book_value,
      a.monthly_depreciation,
      a.current_project_id,
      a.expense_account_id
    FROM public.fixed_assets a
    WHERE a.company_id = v_company
      AND a.status = 'active'
      AND a.purchase_date <= v_run_date
      AND (a.purchase_cost - a.salvage_value) > a.accumulated_depreciation
    ORDER BY a.asset_number
  LOOP
    -- Calculate exact amount for this month (capped at remaining depreciable amount)
    v_dep_amount := least(
      v_r.monthly_depreciation,
      greatest(0, (v_r.purchase_cost - v_r.salvage_value) - v_r.accumulated_depreciation)
    );

    IF v_dep_amount > 0 THEN
      v_new_acc := v_r.accumulated_depreciation + v_dep_amount;
      v_new_book := v_r.purchase_cost - v_new_acc;
      v_is_last := (v_new_acc >= (v_r.purchase_cost - v_r.salvage_value));

      -- Record line
      INSERT INTO public.asset_depreciation_lines (
        company_id, run_id, asset_id, project_id, depreciation_amount,
        prior_accumulated, new_accumulated, new_book_value, is_last_month
      ) VALUES (
        v_company, v_run_id, v_r.id, v_r.current_project_id, v_dep_amount,
        v_r.accumulated_depreciation, v_new_acc, v_new_book, v_is_last
      );

      -- Debit: Depreciation Expense Account (528) with project attribution
      INSERT INTO public.journal_lines (
        company_id, header_id, account_id, project_id, debit, credit, notes
      ) VALUES (
        v_company, v_jh_id, v_r.expense_account_id, v_r.current_project_id,
        v_dep_amount, 0, 'إهلاك ' || v_r.name || ' (' || v_r.asset_number || ')'
      );

      -- Credit: Accumulated Depreciation Account (114)
      INSERT INTO public.journal_lines (
        company_id, header_id, account_id, project_id, debit, credit, notes
      ) VALUES (
        v_company, v_jh_id, v_dep_acc, v_r.current_project_id,
        0, v_dep_amount, 'مجمع إهلاك ' || v_r.name
      );

      -- Update asset balances
      UPDATE public.fixed_assets
      SET accumulated_depreciation = v_new_acc,
          book_value = v_new_book,
          status = CASE WHEN v_is_last THEN 'depreciated' ELSE 'active' END,
          updated_at = now()
      WHERE id = v_r.id;

      v_total := v_total + v_dep_amount;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'لا توجد أصول نشطة مؤهلة لاحتساب الإهلاك في شهر %-%', p_year, p_month USING ERRCODE = 'P0002';
  END IF;

  -- Update run header with final totals
  UPDATE public.asset_depreciation_runs
  SET total_depreciation = v_total,
      assets_count = v_count,
      journal_header_id = v_jh_id
  WHERE id = v_run_id;

  RETURN jsonb_build_object(
    'run_id', v_run_id,
    'run_number', v_run_number,
    'journal_header_id', v_jh_id,
    'total_depreciation', v_total,
    'assets_count', v_count,
    'status', 'posted'
  );
END;
$$;

-- 7.4 DISPOSE FIXED ASSET (بيع أو استبعاد أصل)
CREATE OR REPLACE FUNCTION public.dispose_fixed_asset(
  p_asset_id uuid,
  p_disposal_date date,
  p_disposal_type text, -- 'sale', 'scrap', 'write_off'
  p_sale_amount numeric DEFAULT 0,
  p_safe_acc_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company uuid := rawasi_private.current_company_id();
  v_asset record;
  v_sale numeric(15,2) := coalesce(p_sale_amount, 0);
  v_gain_loss numeric(15,2);
  v_jh_id uuid;
  v_acc_114 uuid;
  v_acc_47 uuid;
  v_acc_529 uuid;
  v_new_status text;
BEGIN
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'يلزم تحديد الشركة المفتوحة' USING ERRCODE = '42501';
  END IF;

  IF NOT (rawasi_private.can_access('assets', 'edit') OR rawasi_private.can_access('accounting', 'edit')) THEN
    RAISE EXCEPTION 'ليس لديك صلاحية بيع أو استبعاد الأصول' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_asset
  FROM public.fixed_assets
  WHERE id = p_asset_id AND company_id = v_company
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الأصل غير موجود' USING ERRCODE = 'P0002';
  END IF;

  IF v_asset.status IN ('disposed', 'sold') THEN
    RAISE EXCEPTION 'الأصل مستبعد أو تم بيعه مسبقاً' USING ERRCODE = '23514';
  END IF;

  IF p_disposal_type NOT IN ('sale', 'scrap', 'write_off') THEN
    RAISE EXCEPTION 'نوع الاستبعاد غير صالح (sale, scrap, write_off)' USING ERRCODE = '23514';
  END IF;

  IF p_disposal_type = 'sale' AND v_sale > 0 AND p_safe_acc_id IS NULL THEN
    RAISE EXCEPTION 'يلزم تحديد حساب الخزينة أو البنك المحصل عليه قيمة بيع الأصل' USING ERRCODE = '23514';
  END IF;

  v_acc_114 := rawasi_private.require_company_account('114'); -- مجمع الإهلاك
  v_acc_47 := rawasi_private.require_company_account('47');   -- إيرادات أخرى / أرباح رأسمالية
  v_acc_529 := rawasi_private.require_company_account('529'); -- خسائر بيع واستبعاد أصول

  -- Gain or Loss = Sale Proceeds - Net Book Value
  v_gain_loss := v_sale - v_asset.book_value;
  v_new_status := CASE WHEN p_disposal_type = 'sale' THEN 'sold' ELSE 'disposed' END;

  -- Create Journal Entry for Asset Disposal
  INSERT INTO public.journal_headers (
    company_id, entry_date, description, reference_id, v_type, status
  ) VALUES (
    v_company, coalesce(p_disposal_date, CURRENT_DATE),
    CASE WHEN p_disposal_type = 'sale' THEN 'بيع أصل: ' ELSE 'استبعاد أصل: ' END || v_asset.name || ' (' || v_asset.asset_number || ')',
    p_asset_id, 'asset_disposal', 'posted'
  ) RETURNING id INTO v_jh_id;

  -- 1. Debit: Accumulated Depreciation (114) for full balance
  IF v_asset.accumulated_depreciation > 0 THEN
    INSERT INTO public.journal_lines (
      company_id, header_id, account_id, project_id, debit, credit, notes
    ) VALUES (
      v_company, v_jh_id, v_acc_114, v_asset.current_project_id,
      v_asset.accumulated_depreciation, 0, 'إقفال مجمع إهلاك ' || v_asset.name
    );
  END IF;

  -- 2. Debit: Cash/Bank if sold for money
  IF v_sale > 0 THEN
    INSERT INTO public.journal_lines (
      company_id, header_id, account_id, project_id, debit, credit, notes
    ) VALUES (
      v_company, v_jh_id, p_safe_acc_id, v_asset.current_project_id,
      v_sale, 0, 'متحصلات بيع أصل ' || v_asset.name
    );
  END IF;

  -- 3. Credit: Historical Cost on original Asset Account
  INSERT INTO public.journal_lines (
    company_id, header_id, account_id, project_id, debit, credit, notes
  ) VALUES (
    v_company, v_jh_id, v_asset.asset_account_id, v_asset.current_project_id,
    0, v_asset.purchase_cost, 'استبعاد التكلفة التاريخية لأصل ' || v_asset.name
  );

  -- 4. Balancing Line: Gain or Loss
  IF v_gain_loss > 0 THEN
    -- Capital Gain -> Credit 47
    INSERT INTO public.journal_lines (
      company_id, header_id, account_id, project_id, debit, credit, notes
    ) VALUES (
      v_company, v_jh_id, v_acc_47, v_asset.current_project_id,
      0, v_gain_loss, 'أرباح رأسمالية من بيع أصل ' || v_asset.name
    );
  ELSIF v_gain_loss < 0 THEN
    -- Capital Loss -> Debit 529
    INSERT INTO public.journal_lines (
      company_id, header_id, account_id, project_id, debit, credit, notes
    ) VALUES (
      v_company, v_jh_id, v_acc_529, v_asset.current_project_id,
      abs(v_gain_loss), 0, 'خسائر استبعاد وبيع أصل ' || v_asset.name
    );
  END IF;

  -- Update Asset status
  UPDATE public.fixed_assets
  SET status = v_new_status,
      book_value = 0,
      disposal_date = coalesce(p_disposal_date, CURRENT_DATE),
      disposal_amount = v_sale,
      disposal_notes = p_notes,
      updated_at = now()
  WHERE id = p_asset_id;

  RETURN jsonb_build_object(
    'asset_id', p_asset_id,
    'status', v_new_status,
    'journal_header_id', v_jh_id,
    'gain_loss', v_gain_loss
  );
END;
$$;

-- 7.5 TRANSFER ASSET TO PROJECT
CREATE OR REPLACE FUNCTION public.transfer_asset_project(
  p_asset_id uuid,
  p_to_project_id uuid,
  p_transfer_date date DEFAULT CURRENT_DATE,
  p_partner_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company uuid := rawasi_private.current_company_id();
  v_asset record;
  v_trf_id uuid;
  v_trf_num text;
BEGIN
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'يلزم تحديد الشركة المفتوحة' USING ERRCODE = '42501';
  END IF;

  IF NOT (rawasi_private.can_access('assets', 'edit') OR rawasi_private.can_access('projects', 'edit')) THEN
    RAISE EXCEPTION 'ليس لديك صلاحية نقل الأصول بين المشاريع' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_asset
  FROM public.fixed_assets
  WHERE id = p_asset_id AND company_id = v_company
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الأصل غير موجود' USING ERRCODE = 'P0002';
  END IF;

  IF v_asset.status IN ('disposed', 'sold') THEN
    RAISE EXCEPTION 'لا يمكن نقل أصل مستبعد أو تم بيعه' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.asset_transfers (
    company_id, asset_id, from_project_id, to_project_id,
    transfer_date, responsible_partner_id, notes
  ) VALUES (
    v_company, p_asset_id, v_asset.current_project_id, p_to_project_id,
    coalesce(p_transfer_date, CURRENT_DATE), p_partner_id, p_notes
  ) RETURNING id, transfer_number INTO v_trf_id, v_trf_num;

  UPDATE public.fixed_assets
  SET current_project_id = p_to_project_id,
      updated_at = now()
  WHERE id = p_asset_id;

  RETURN jsonb_build_object(
    'transfer_id', v_trf_id,
    'transfer_number', v_trf_num,
    'asset_id', p_asset_id,
    'to_project_id', p_to_project_id
  );
END;
$$;

-- 7.6 GET ASSETS SUMMARY
CREATE OR REPLACE FUNCTION public.get_assets_summary(
  p_asset_type text DEFAULT 'all',
  p_project_id uuid DEFAULT NULL,
  p_status text DEFAULT 'all'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company uuid := rawasi_private.current_company_id();
  v_kpis jsonb;
  v_assets jsonb;
BEGIN
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'يلزم تحديد الشركة المفتوحة' USING ERRCODE = '42501';
  END IF;

  -- Aggregate KPIs for company
  SELECT jsonb_build_object(
    'total_assets', count(*),
    'active_assets', count(*) FILTER (WHERE status = 'active'),
    'depreciated_assets', count(*) FILTER (WHERE status = 'depreciated'),
    'disposed_assets', count(*) FILTER (WHERE status IN ('disposed', 'sold')),
    'total_purchase_cost', coalesce(sum(purchase_cost), 0),
    'total_accumulated_depreciation', coalesce(sum(accumulated_depreciation), 0),
    'total_book_value', coalesce(sum(book_value), 0),
    'monthly_depreciation_run_cost', coalesce(sum(monthly_depreciation) FILTER (WHERE status = 'active'), 0)
  ) INTO v_kpis
  FROM public.fixed_assets
  WHERE company_id = v_company;

  -- List filtered assets
  WITH asset_expenses AS (
    SELECT
      asset_id,
      coalesce(sum(paid_amount), 0) AS total_operational_expenses
    FROM public.expenses
    WHERE company_id = v_company
      AND asset_id IS NOT NULL
      AND is_posted = true
    GROUP BY asset_id
  )
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'asset_number', a.asset_number,
      'name', a.name,
      'asset_type', a.asset_type,
      'purchase_date', a.purchase_date,
      'purchase_cost', a.purchase_cost,
      'salvage_value', a.salvage_value,
      'useful_life_months', a.useful_life_months,
      'monthly_depreciation', a.monthly_depreciation,
      'accumulated_depreciation', a.accumulated_depreciation,
      'book_value', a.book_value,
      'current_project_id', a.current_project_id,
      'project_name', p."Property",
      'status', a.status,
      'serial_number', a.serial_number,
      'notes', a.notes,
      'operational_expenses', coalesce(ae.total_operational_expenses, 0)
    ) ORDER BY a.purchase_date DESC, a.asset_number DESC
  ), '[]'::jsonb) INTO v_assets
  FROM public.fixed_assets a
  LEFT JOIN public.projects p ON p.id = a.current_project_id
  LEFT JOIN asset_expenses ae ON ae.asset_id = a.id
  WHERE a.company_id = v_company
    AND (p_asset_type = 'all' OR a.asset_type = p_asset_type)
    AND (p_project_id IS NULL OR a.current_project_id = p_project_id)
    AND (p_status = 'all' OR a.status = p_status);

  RETURN jsonb_build_object(
    'kpis', v_kpis,
    'assets', v_assets
  );
END;
$$;

-- 7.7 GET ASSET OPERATIONAL COSTS BREAKDOWN
CREATE OR REPLACE FUNCTION public.get_asset_operational_costs(
  p_asset_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company uuid := rawasi_private.current_company_id();
  v_asset record;
  v_expenses jsonb;
  v_depreciations jsonb;
  v_transfers jsonb;
  v_total_expenses numeric(15,2);
  v_total_depreciation numeric(15,2);
BEGIN
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'يلزم تحديد الشركة المفتوحة' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_asset
  FROM public.fixed_assets
  WHERE id = p_asset_id AND company_id = v_company;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الأصل غير موجود' USING ERRCODE = 'P0002';
  END IF;

  -- Operational expenses (fuel, maintenance, etc.)
  SELECT
    coalesce(jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'date', e.exp_date,
        'description', e.description,
        'amount', e.paid_amount,
        'payment_method', e.payment_method,
        'project_id', e.project_id,
        'project_name', p."Property"
      ) ORDER BY e.exp_date DESC
    ), '[]'::jsonb),
    coalesce(sum(e.paid_amount), 0)
  INTO v_expenses, v_total_expenses
  FROM public.expenses e
  LEFT JOIN public.projects p ON p.id = e.project_id
  WHERE e.company_id = v_company
    AND e.asset_id = p_asset_id
    AND e.is_posted = true;

  -- Depreciation lines history
  SELECT
    coalesce(jsonb_agg(
      jsonb_build_object(
        'run_id', r.id,
        'run_number', r.run_number,
        'year', r.period_year,
        'month', r.period_month,
        'date', r.run_date,
        'amount', l.depreciation_amount,
        'project_id', l.project_id,
        'project_name', p."Property"
      ) ORDER BY r.period_year DESC, r.period_month DESC
    ), '[]'::jsonb),
    coalesce(sum(l.depreciation_amount), 0)
  INTO v_depreciations, v_total_depreciation
  FROM public.asset_depreciation_lines l
  JOIN public.asset_depreciation_runs r ON r.id = l.run_id
  LEFT JOIN public.projects p ON p.id = l.project_id
  WHERE l.company_id = v_company
    AND l.asset_id = p_asset_id
    AND r.status = 'posted';

  -- Transfer history
  SELECT
    coalesce(jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'transfer_number', t.transfer_number,
        'date', t.transfer_date,
        'from_project', p1."Property",
        'to_project', p2."Property",
        'responsible_partner', prt.name,
        'notes', t.notes
      ) ORDER BY t.transfer_date DESC
    ), '[]'::jsonb)
  INTO v_transfers
  FROM public.asset_transfers t
  LEFT JOIN public.projects p1 ON p1.id = t.from_project_id
  LEFT JOIN public.projects p2 ON p2.id = t.to_project_id
  LEFT JOIN public.partners prt ON prt.id = t.responsible_partner_id
  WHERE t.company_id = v_company
    AND t.asset_id = p_asset_id;

  RETURN jsonb_build_object(
    'asset_id', p_asset_id,
    'asset_number', v_asset.asset_number,
    'asset_name', v_asset.name,
    'purchase_cost', v_asset.purchase_cost,
    'accumulated_depreciation', v_asset.accumulated_depreciation,
    'book_value', v_asset.book_value,
    'total_operational_expenses', v_total_expenses,
    'total_posted_depreciation', v_total_depreciation,
    'total_ownership_cost', v_total_expenses + v_asset.purchase_cost,
    'expenses', v_expenses,
    'depreciations', v_depreciations,
    'transfers', v_transfers
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_fixed_asset(text, text, numeric, integer, numeric, date, uuid, text, uuid, uuid, uuid, numeric, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.calculate_monthly_depreciation_preview(integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.post_monthly_depreciation(integer, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dispose_fixed_asset(uuid, date, text, numeric, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.transfer_asset_project(uuid, uuid, date, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_assets_summary(text, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_asset_operational_costs(uuid) TO authenticated, service_role;

COMMIT;



-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- FILE: 20261105170009_purchases_and_three_way_matching.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- Migration: 20261105170009_purchases_and_three_way_matching.sql
-- Description: Phase 5 (Batch 1) - Purchase Orders, Material Receipt Linking, Supplier Invoices, and 3-Way Matching

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $preflight$
BEGIN
  IF to_regclass('public.companies') IS NULL THEN
    RAISE EXCEPTION 'Multi-company system is required before Phase 5';
  END IF;
  IF to_regclass('public.purchase_orders') IS NOT NULL THEN
    RAISE EXCEPTION 'public.purchase_orders already exists';
  END IF;
  IF to_regclass('public.supplier_invoices') IS NOT NULL THEN
    RAISE EXCEPTION 'public.supplier_invoices already exists';
  END IF;
END;
$preflight$;

-- =============================================================================
-- 1. PURCHASE ORDERS TABLE (أوامر الشراء للمشاريع)
-- =============================================================================
CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT rawasi_private.current_company_id() REFERENCES public.companies(id) ON DELETE RESTRICT,
  po_number text NOT NULL DEFAULT '',
  supplier_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE RESTRICT,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date date,
  subtotal numeric(15,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  tax_amount numeric(15,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount numeric(15,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'partially_received', 'received', 'closed', 'cancelled')),
  approved_by uuid,
  approved_at timestamptz,
  notes text,
  terms text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  CONSTRAINT purchase_orders_company_po_no_uq UNIQUE (company_id, po_number),
  CONSTRAINT purchase_orders_company_id_uq UNIQUE (id, company_id)
);

-- =============================================================================
-- 2. PURCHASE ORDER LINES TABLE (بنود أمر الشراء)
-- =============================================================================
CREATE TABLE public.purchase_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT rawasi_private.current_company_id() REFERENCES public.companies(id) ON DELETE RESTRICT,
  po_id uuid NOT NULL,
  item_id uuid REFERENCES public.material_items(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  description text,
  quantity numeric(15,3) NOT NULL CHECK (quantity > 0),
  received_quantity numeric(15,3) NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
  invoiced_quantity numeric(15,3) NOT NULL DEFAULT 0 CHECK (invoiced_quantity >= 0),
  unit text NOT NULL DEFAULT 'وحدة',
  unit_price numeric(15,2) NOT NULL CHECK (unit_price >= 0),
  total_price numeric(15,2) NOT NULL CHECK (total_price >= 0),
  tax_rate numeric(5,2) NOT NULL DEFAULT 15.00,
  tax_amount numeric(15,2) NOT NULL DEFAULT 0,
  boq_item_id uuid REFERENCES public.boq_budget(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT po_lines_po_fkey FOREIGN KEY (po_id, company_id) REFERENCES public.purchase_orders(id, company_id) ON DELETE CASCADE,
  CONSTRAINT po_lines_company_id_uq UNIQUE (id, company_id)
);

-- =============================================================================
-- 3. LINK MATERIAL RECEIPTS TO PURCHASE ORDERS
-- =============================================================================
ALTER TABLE public.material_receipts
  ADD COLUMN po_id uuid;

ALTER TABLE public.material_receipts
  ADD CONSTRAINT material_receipts_po_fkey
  FOREIGN KEY (po_id, company_id) REFERENCES public.purchase_orders(id, company_id) ON DELETE SET NULL;

ALTER TABLE public.material_receipt_lines
  ADD COLUMN po_line_id uuid;

ALTER TABLE public.material_receipt_lines
  ADD CONSTRAINT material_receipt_lines_po_line_fkey
  FOREIGN KEY (po_line_id, company_id) REFERENCES public.purchase_order_lines(id, company_id) ON DELETE SET NULL;

ALTER TABLE public.material_receipt_lines
  ADD CONSTRAINT material_receipt_lines_id_company_key
  UNIQUE (id, company_id);

-- =============================================================================
-- 4. SUPPLIER INVOICES (فواتير الموردين الضريبية)
-- =============================================================================
CREATE TABLE public.supplier_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT rawasi_private.current_company_id() REFERENCES public.companies(id) ON DELETE RESTRICT,
  invoice_number text NOT NULL DEFAULT '',
  supplier_invoice_ref text NOT NULL,
  supplier_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE RESTRICT,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  po_id uuid,
  receipt_id uuid,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  subtotal numeric(15,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  tax_amount numeric(15,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount numeric(15,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  paid_amount numeric(15,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'posted', 'paid', 'cancelled')),
  is_posted boolean NOT NULL DEFAULT false,
  journal_header_id uuid REFERENCES public.journal_headers(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  CONSTRAINT supplier_invoices_company_inv_no_uq UNIQUE (company_id, invoice_number),
  CONSTRAINT supplier_invoices_po_fkey FOREIGN KEY (po_id, company_id) REFERENCES public.purchase_orders(id, company_id) ON DELETE SET NULL,
  CONSTRAINT supplier_invoices_receipt_fkey FOREIGN KEY (receipt_id, company_id) REFERENCES public.material_receipts(id, company_id) ON DELETE SET NULL,
  CONSTRAINT supplier_invoices_company_id_uq UNIQUE (id, company_id)
);

-- =============================================================================
-- 5. SUPPLIER INVOICE LINES (بنود فاتورة المورد)
-- =============================================================================
CREATE TABLE public.supplier_invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT rawasi_private.current_company_id() REFERENCES public.companies(id) ON DELETE RESTRICT,
  invoice_id uuid NOT NULL,
  po_line_id uuid,
  receipt_line_id uuid,
  item_name text NOT NULL,
  quantity numeric(15,3) NOT NULL CHECK (quantity > 0),
  unit text NOT NULL DEFAULT 'وحدة',
  unit_price numeric(15,2) NOT NULL CHECK (unit_price >= 0),
  total_price numeric(15,2) NOT NULL CHECK (total_price >= 0),
  tax_rate numeric(5,2) NOT NULL DEFAULT 15.00,
  tax_amount numeric(15,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supp_inv_lines_inv_fkey FOREIGN KEY (invoice_id, company_id) REFERENCES public.supplier_invoices(id, company_id) ON DELETE CASCADE,
  CONSTRAINT supp_inv_lines_po_line_fkey FOREIGN KEY (po_line_id, company_id) REFERENCES public.purchase_order_lines(id, company_id) ON DELETE SET NULL,
  CONSTRAINT supp_inv_lines_receipt_line_fkey FOREIGN KEY (receipt_line_id, company_id) REFERENCES public.material_receipt_lines(id, company_id) ON DELETE SET NULL,
  CONSTRAINT supp_inv_lines_company_id_uq UNIQUE (id, company_id)
);

-- Register new tables in rawasi_private.company_scoped_tables
INSERT INTO rawasi_private.company_scoped_tables(table_name)
VALUES ('purchase_orders'), ('purchase_order_lines'), ('supplier_invoices'), ('supplier_invoice_lines');

-- Indexes
CREATE INDEX purchase_orders_company_supplier_idx ON public.purchase_orders(company_id, supplier_id);
CREATE INDEX purchase_orders_company_project_idx ON public.purchase_orders(company_id, project_id);
CREATE INDEX purchase_orders_company_status_idx ON public.purchase_orders(company_id, status);
CREATE INDEX po_lines_po_id_idx ON public.purchase_order_lines(company_id, po_id);
CREATE INDEX material_receipts_po_idx ON public.material_receipts(company_id, po_id);
CREATE INDEX material_receipt_lines_po_line_idx ON public.material_receipt_lines(company_id, po_line_id);
CREATE INDEX supplier_invoices_company_supp_idx ON public.supplier_invoices(company_id, supplier_id);
CREATE INDEX supplier_invoices_company_po_idx ON public.supplier_invoices(company_id, po_id);
CREATE INDEX supplier_invoices_company_status_idx ON public.supplier_invoices(company_id, status);
CREATE INDEX supplier_inv_lines_inv_idx ON public.supplier_invoice_lines(company_id, invoice_id);

-- Triggers for company stamping and document numbering
CREATE TRIGGER aa_stamp_company_id BEFORE INSERT OR UPDATE OF company_id ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id();

CREATE TRIGGER aa_stamp_company_id BEFORE INSERT OR UPDATE OF company_id ON public.purchase_order_lines
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id();

CREATE TRIGGER aa_stamp_company_id BEFORE INSERT OR UPDATE OF company_id ON public.supplier_invoices
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id();

CREATE TRIGGER aa_stamp_company_id BEFORE INSERT OR UPDATE OF company_id ON public.supplier_invoice_lines
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id();

CREATE TRIGGER trg_doc_number BEFORE INSERT ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.assign_document_number('PO', 'po_number', 'order_date');

CREATE TRIGGER trg_doc_number BEFORE INSERT ON public.supplier_invoices
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.assign_document_number('SINV', 'invoice_number', 'invoice_date');

-- Enable RLS
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_invoice_lines ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_lines TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_invoice_lines TO authenticated;
GRANT ALL ON public.purchase_orders, public.purchase_order_lines, public.supplier_invoices, public.supplier_invoice_lines TO service_role;

-- RLS Policies
CREATE POLICY po_select ON public.purchase_orders FOR SELECT TO authenticated
  USING (
    (rawasi_private.can_access('materials', 'view') OR rawasi_private.can_access('accounting', 'view'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY po_insert ON public.purchase_orders FOR INSERT TO authenticated
  WITH CHECK (
    (rawasi_private.can_access('materials', 'create') OR rawasi_private.can_access('accounting', 'create'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY po_update ON public.purchase_orders FOR UPDATE TO authenticated
  USING (
    (rawasi_private.can_access('materials', 'edit') OR rawasi_private.can_access('accounting', 'edit'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY po_lines_select ON public.purchase_order_lines FOR SELECT TO authenticated
  USING (
    (rawasi_private.can_access('materials', 'view') OR rawasi_private.can_access('accounting', 'view'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY po_lines_insert ON public.purchase_order_lines FOR INSERT TO authenticated
  WITH CHECK (
    (rawasi_private.can_access('materials', 'create') OR rawasi_private.can_access('accounting', 'create'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY supp_inv_select ON public.supplier_invoices FOR SELECT TO authenticated
  USING (
    (rawasi_private.can_access('materials', 'view') OR rawasi_private.can_access('accounting', 'view') OR rawasi_private.can_access('invoices', 'view'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY supp_inv_insert ON public.supplier_invoices FOR INSERT TO authenticated
  WITH CHECK (
    (rawasi_private.can_access('materials', 'create') OR rawasi_private.can_access('accounting', 'create') OR rawasi_private.can_access('invoices', 'create'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY supp_inv_update ON public.supplier_invoices FOR UPDATE TO authenticated
  USING (
    (rawasi_private.can_access('materials', 'edit') OR rawasi_private.can_access('accounting', 'edit') OR rawasi_private.can_access('invoices', 'edit'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY supp_inv_lines_select ON public.supplier_invoice_lines FOR SELECT TO authenticated
  USING (
    (rawasi_private.can_access('materials', 'view') OR rawasi_private.can_access('accounting', 'view'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY supp_inv_lines_insert ON public.supplier_invoice_lines FOR INSERT TO authenticated
  WITH CHECK (
    (rawasi_private.can_access('materials', 'create') OR rawasi_private.can_access('accounting', 'create'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

-- =============================================================================
-- 6. STORED PROCEDURES & RPCS
-- =============================================================================

-- 6.1 CREATE PURCHASE ORDER
CREATE OR REPLACE FUNCTION public.create_purchase_order(
  p_supplier_id uuid,
  p_project_id uuid DEFAULT NULL,
  p_order_date date DEFAULT CURRENT_DATE,
  p_expected_delivery date DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_terms text DEFAULT NULL,
  p_lines jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company uuid := rawasi_private.current_company_id();
  v_po_id uuid;
  v_item record;
  v_line_qty numeric;
  v_line_price numeric;
  v_line_total numeric;
  v_line_tax numeric;
  v_subtotal numeric(15,2) := 0;
  v_tax_total numeric(15,2) := 0;
BEGIN
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'يلزم تحديد الشركة المفتوحة لإصدار أمر الشراء' USING ERRCODE = '42501';
  END IF;

  IF NOT (rawasi_private.can_access('materials', 'create') OR rawasi_private.can_access('accounting', 'create')) THEN
    RAISE EXCEPTION 'ليس لديك صلاحية إنشاء أمر شراء' USING ERRCODE = '42501';
  END IF;

  IF jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'يلزم إضافة بند واحد على الأقل في أمر الشراء' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.purchase_orders (
    company_id, supplier_id, project_id, order_date, expected_delivery_date,
    subtotal, tax_amount, total_amount, status, notes, terms
  ) VALUES (
    v_company, p_supplier_id, p_project_id, coalesce(p_order_date, CURRENT_DATE),
    p_expected_delivery, 0, 0, 0, 'draft', p_notes, p_terms
  ) RETURNING id INTO v_po_id;

  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_lines) AS (
    item_id uuid,
    item_name text,
    description text,
    quantity numeric,
    unit text,
    unit_price numeric,
    tax_rate numeric,
    boq_item_id uuid,
    notes text
  )
  LOOP
    v_line_qty := coalesce(v_item.quantity, 0);
    v_line_price := coalesce(v_item.unit_price, 0);

    IF v_line_qty <= 0 THEN
      RAISE EXCEPTION 'الكمية المطلوبة للبند (%) يجب أن تكون أكبر من صفر', v_item.item_name USING ERRCODE = '23514';
    END IF;

    v_line_total := round(v_line_qty * v_line_price, 2);
    v_line_tax := round(v_line_total * (coalesce(v_item.tax_rate, 15.00) / 100.00), 2);

    INSERT INTO public.purchase_order_lines (
      company_id, po_id, item_id, item_name, description, quantity,
      unit, unit_price, total_price, tax_rate, tax_amount, boq_item_id, notes
    ) VALUES (
      v_company, v_po_id, v_item.item_id, v_item.item_name, v_item.description,
      v_line_qty, coalesce(v_item.unit, 'وحدة'), v_line_price, v_line_total,
      coalesce(v_item.tax_rate, 15.00), v_line_tax, v_item.boq_item_id, v_item.notes
    );

    v_subtotal := v_subtotal + v_line_total;
    v_tax_total := v_tax_total + v_line_tax;
  END LOOP;

  UPDATE public.purchase_orders
  SET subtotal = v_subtotal,
      tax_amount = v_tax_total,
      total_amount = v_subtotal + v_tax_total
  WHERE id = v_po_id;

  RETURN v_po_id;
END;
$$;

-- 6.2 APPROVE PURCHASE ORDER
CREATE OR REPLACE FUNCTION public.approve_purchase_order(
  p_po_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company uuid := rawasi_private.current_company_id();
  v_po record;
BEGIN
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'يلزم تحديد الشركة المفتوحة' USING ERRCODE = '42501';
  END IF;

  IF NOT (rawasi_private.can_access('materials', 'edit') OR rawasi_private.can_access('accounting', 'edit')) THEN
    RAISE EXCEPTION 'ليس لديك صلاحية اعتماد أمر الشراء' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_po
  FROM public.purchase_orders
  WHERE id = p_po_id AND company_id = v_company
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'أمر الشراء غير موجود' USING ERRCODE = 'P0002';
  END IF;

  IF v_po.status <> 'draft' THEN
    RAISE EXCEPTION 'أمر الشراء بحالة (%)- ولا يمكن اعتماده إلا من حالة مسودة', v_po.status USING ERRCODE = '23514';
  END IF;

  UPDATE public.purchase_orders
  SET status = 'approved',
      approved_by = auth.uid(),
      approved_at = now(),
      updated_at = now()
  WHERE id = p_po_id;

  RETURN jsonb_build_object(
    'po_id', p_po_id,
    'status', 'approved',
    'po_number', v_po.po_number
  );
END;
$$;

-- 6.3 RECEIVE MATERIALS FROM PURCHASE ORDER (استلام خامات من أمر الشراء وتوليد قيد المخزون)
CREATE OR REPLACE FUNCTION public.receive_materials_from_po(
  p_po_id uuid,
  p_receipt_date date DEFAULT CURRENT_DATE,
  p_lines jsonb DEFAULT '[]'::jsonb,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company uuid := rawasi_private.current_company_id();
  v_po record;
  v_receipt_id uuid;
  v_receipt_num text;
  v_jh_id uuid;
  v_acc_126 uuid; -- مخزون الخامات والمواد
  v_acc_218 uuid; -- بضاعة مستلمة غير مفوترة (GRNI)
  v_line record;
  v_po_line record;
  v_qty numeric;
  v_total_receipt numeric(15,2) := 0;
  v_all_received boolean := true;
  v_lines_count integer := 0;
BEGIN
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'يلزم تحديد الشركة المفتوحة' USING ERRCODE = '42501';
  END IF;

  IF NOT (rawasi_private.can_access('materials', 'create') OR rawasi_private.can_access('accounting', 'create')) THEN
    RAISE EXCEPTION 'ليس لديك صلاحية تسجيل استلام مواد' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_po
  FROM public.purchase_orders
  WHERE id = p_po_id AND company_id = v_company
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'أمر الشراء غير موجود' USING ERRCODE = 'P0002';
  END IF;

  IF v_po.status NOT IN ('approved', 'partially_received') THEN
    RAISE EXCEPTION 'لا يمكن الاستلام من أمر شراء بحالة (%)، يلزم اعتماده أولاً', v_po.status USING ERRCODE = '23514';
  END IF;

  v_acc_126 := rawasi_private.require_company_account('126');
  v_acc_218 := rawasi_private.require_company_account('218');

  -- Create Material Receipt Record
  INSERT INTO public.material_receipts (
    company_id, po_id, project_id, supplier_id, receipt_date,
    total_amount, status, receipt_type, is_posted, notes
  ) VALUES (
    v_company, p_po_id, v_po.project_id, v_po.supplier_id,
    coalesce(p_receipt_date, CURRENT_DATE), 0, 'معتمد', 'توريد خامات', true,
    coalesce(p_notes, 'استلام من أمر شراء رقم: ' || v_po.po_number)
  ) RETURNING id, receipt_number INTO v_receipt_id, v_receipt_num;

  -- Create Journal Header for Inventory Receipt
  INSERT INTO public.journal_headers (
    company_id, entry_date, description, reference_id, v_type, status
  ) VALUES (
    v_company, coalesce(p_receipt_date, CURRENT_DATE),
    'إثبات استلام مواد من أمر شراء ' || v_po.po_number || ' بسند استلام ' || v_receipt_num,
    v_receipt_id, 'material_receipts', 'posted'
  ) RETURNING id INTO v_jh_id;

  FOR v_line IN SELECT * FROM jsonb_to_recordset(p_lines) AS (
    po_line_id uuid,
    quantity numeric,
    notes text
  )
  LOOP
    v_qty := coalesce(v_line.quantity, 0);
    IF v_qty > 0 THEN
      SELECT * INTO v_po_line
      FROM public.purchase_order_lines
      WHERE id = v_line.po_line_id AND po_id = p_po_id AND company_id = v_company
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'بند أمر الشراء غير موجود' USING ERRCODE = 'P0002';
      END IF;

      -- Check remaining quantity
      IF (v_po_line.received_quantity + v_qty) > v_po_line.quantity THEN
        RAISE EXCEPTION 'الكمية المستلمة للبند (%) تتجاوز الكمية المطلوبة بأمر الشراء (المطلوب: %، المستلم سابقاً: %، المستلم حالياً: %)',
          v_po_line.item_name, v_po_line.quantity, v_po_line.received_quantity, v_qty USING ERRCODE = '23514';
      END IF;

      -- Insert receipt line
      INSERT INTO public.material_receipt_lines (
        company_id, receipt_id, po_line_id, item_id, item_name,
        quantity, unit, unit_price, total_price, project_id, boq_item_id
      ) VALUES (
        v_company, v_receipt_id, v_po_line.id, v_po_line.item_id, v_po_line.item_name,
        v_qty, v_po_line.unit, v_po_line.unit_price, round(v_qty * v_po_line.unit_price, 2),
        v_po.project_id, v_po_line.boq_item_id
      );

      -- Update PO line received quantity
      UPDATE public.purchase_order_lines
      SET received_quantity = received_quantity + v_qty
      WHERE id = v_po_line.id;

      v_total_receipt := v_total_receipt + round(v_qty * v_po_line.unit_price, 2);
      v_lines_count := v_lines_count + 1;
    END IF;
  END LOOP;

  IF v_lines_count = 0 THEN
    RAISE EXCEPTION 'يلزم استلام كمية واحدة على الأقل' USING ERRCODE = '23514';
  END IF;

  -- 1. Debit: Inventory Account (126) for exact received value
  INSERT INTO public.journal_lines (
    company_id, header_id, account_id, project_id, partner_id, debit, credit, notes
  ) VALUES (
    v_company, v_jh_id, v_acc_126, v_po.project_id, v_po.supplier_id,
    v_total_receipt, 0, 'إثبات إضافة المخزون بسند ' || v_receipt_num
  );

  -- 2. Credit: Goods Received Not Invoiced GRNI (218)
  INSERT INTO public.journal_lines (
    company_id, header_id, account_id, project_id, partner_id, debit, credit, notes
  ) VALUES (
    v_company, v_jh_id, v_acc_218, v_po.project_id, v_po.supplier_id,
    0, v_total_receipt, 'استحقاق توريد مواد غير مفوترة - أمر شراء ' || v_po.po_number
  );

  -- Update receipt totals and link to JV
  UPDATE public.material_receipts
  SET total_amount = v_total_receipt,
      jv_id = v_jh_id
  WHERE id = v_receipt_id;

  -- Check if all lines are fully received
  SELECT bool_and(received_quantity >= quantity) INTO v_all_received
  FROM public.purchase_order_lines
  WHERE po_id = p_po_id AND company_id = v_company;

  UPDATE public.purchase_orders
  SET status = CASE WHEN v_all_received THEN 'received' ELSE 'partially_received' END,
      updated_at = now()
  WHERE id = p_po_id;

  RETURN jsonb_build_object(
    'receipt_id', v_receipt_id,
    'receipt_number', v_receipt_num,
    'journal_header_id', v_jh_id,
    'total_amount', v_total_receipt,
    'po_status', CASE WHEN v_all_received THEN 'received' ELSE 'partially_received' END
  );
END;
$$;

-- 6.4 CREATE SUPPLIER INVOICE (فاتورة مورد مع مطابقة ثلاثية 3-Way Matching)
CREATE OR REPLACE FUNCTION public.create_supplier_invoice(
  p_supplier_id uuid,
  p_supplier_ref text,
  p_po_id uuid DEFAULT NULL,
  p_receipt_id uuid DEFAULT NULL,
  p_invoice_date date DEFAULT CURRENT_DATE,
  p_due_date date DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_lines jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company uuid := rawasi_private.current_company_id();
  v_inv_id uuid;
  v_item record;
  v_line_qty numeric;
  v_line_price numeric;
  v_line_total numeric;
  v_line_tax numeric;
  v_subtotal numeric(15,2) := 0;
  v_tax_total numeric(15,2) := 0;
  v_proj_id uuid;
BEGIN
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'يلزم تحديد الشركة المفتوحة' USING ERRCODE = '42501';
  END IF;

  IF NOT (rawasi_private.can_access('materials', 'create') OR rawasi_private.can_access('accounting', 'create') OR rawasi_private.can_access('invoices', 'create')) THEN
    RAISE EXCEPTION 'ليس لديك صلاحية تسجيل فاتورة مورد' USING ERRCODE = '42501';
  END IF;

  IF trim(coalesce(p_supplier_ref, '')) = '' THEN
    RAISE EXCEPTION 'يلزم تسجيل رقم فاتورة المورد الضريبية الأصلية' USING ERRCODE = '23514';
  END IF;

  IF jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'يلزم إضافة بند واحد على الأقل في فاتورة المورد' USING ERRCODE = '23514';
  END IF;

  -- Get project from PO if provided
  IF p_po_id IS NOT NULL THEN
    SELECT project_id INTO v_proj_id FROM public.purchase_orders WHERE id = p_po_id AND company_id = v_company;
  END IF;

  INSERT INTO public.supplier_invoices (
    company_id, supplier_invoice_ref, supplier_id, project_id, po_id, receipt_id,
    invoice_date, due_date, subtotal, tax_amount, total_amount, paid_amount,
    status, is_posted, notes
  ) VALUES (
    v_company, p_supplier_ref, p_supplier_id, v_proj_id, p_po_id, p_receipt_id,
    coalesce(p_invoice_date, CURRENT_DATE), p_due_date, 0, 0, 0, 0,
    'draft', false, p_notes
  ) RETURNING id INTO v_inv_id;

  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_lines) AS (
    po_line_id uuid,
    receipt_line_id uuid,
    item_name text,
    quantity numeric,
    unit text,
    unit_price numeric,
    tax_rate numeric,
    notes text
  )
  LOOP
    v_line_qty := coalesce(v_item.quantity, 0);
    v_line_price := coalesce(v_item.unit_price, 0);

    IF v_line_qty <= 0 THEN
      RAISE EXCEPTION 'الكمية للبند (%) يجب أن تكون أكبر من صفر', v_item.item_name USING ERRCODE = '23514';
    END IF;

    v_line_total := round(v_line_qty * v_line_price, 2);
    v_line_tax := round(v_line_total * (coalesce(v_item.tax_rate, 15.00) / 100.00), 2);

    INSERT INTO public.supplier_invoice_lines (
      company_id, invoice_id, po_line_id, receipt_line_id, item_name,
      quantity, unit, unit_price, total_price, tax_rate, tax_amount, notes
    ) VALUES (
      v_company, v_inv_id, v_item.po_line_id, v_item.receipt_line_id, v_item.item_name,
      v_line_qty, coalesce(v_item.unit, 'وحدة'), v_line_price, v_line_total,
      coalesce(v_item.tax_rate, 15.00), v_line_tax, v_item.notes
    );

    v_subtotal := v_subtotal + v_line_total;
    v_tax_total := v_tax_total + v_line_tax;
  END LOOP;

  UPDATE public.supplier_invoices
  SET subtotal = v_subtotal,
      tax_amount = v_tax_total,
      total_amount = v_subtotal + v_tax_total
  WHERE id = v_inv_id;

  RETURN v_inv_id;
END;
$$;

-- 6.5 POST SUPPLIER INVOICE (إقفال وسيط 218 وإثبات ذمة المورد 211 وضريبة المشتريات 215)
CREATE OR REPLACE FUNCTION public.post_supplier_invoice(
  p_invoice_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company uuid := rawasi_private.current_company_id();
  v_inv record;
  v_jh_id uuid;
  v_acc_211 uuid; -- الموردون
  v_acc_215 uuid; -- ضريبة القيمة المضافة
  v_acc_218 uuid; -- وسيط بضاعة مستلمة غير مفوترة
  v_line record;
  v_po_all_closed boolean := false;
BEGIN
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'يلزم تحديد الشركة المفتوحة' USING ERRCODE = '42501';
  END IF;

  IF NOT (rawasi_private.can_access('materials', 'edit') OR rawasi_private.can_access('accounting', 'create')) THEN
    RAISE EXCEPTION 'ليس لديك صلاحية ترحيل فاتورة المورد' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_inv
  FROM public.supplier_invoices
  WHERE id = p_invoice_id AND company_id = v_company
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'فاتورة المورد غير موجودة' USING ERRCODE = 'P0002';
  END IF;

  IF v_inv.is_posted THEN
    RAISE EXCEPTION 'فاتورة المورد مرحلة مسبقاً' USING ERRCODE = '23514';
  END IF;

  v_acc_211 := rawasi_private.require_company_account('211');
  v_acc_215 := rawasi_private.require_company_account('215');
  v_acc_218 := rawasi_private.require_company_account('218');

  -- Create Journal Entry for Supplier Invoice
  INSERT INTO public.journal_headers (
    company_id, entry_date, description, reference_id, v_type, status
  ) VALUES (
    v_company, v_inv.invoice_date,
    'إثبات فاتورة مورد ' || v_inv.supplier_invoice_ref || ' (رقم النظام: ' || v_inv.invoice_number || ')',
    v_inv.id, 'supplier_invoices', 'posted'
  ) RETURNING id INTO v_jh_id;

  -- 1. Debit: Goods Received Not Invoiced (218) for subtotal (إقفال وسيط الاستلام)
  INSERT INTO public.journal_lines (
    company_id, header_id, account_id, project_id, partner_id, debit, credit, notes
  ) VALUES (
    v_company, v_jh_id, v_acc_218, v_inv.project_id, v_inv.supplier_id,
    v_inv.subtotal, 0, 'إقفال وسيط الاستلام لفاتورة ' || v_inv.supplier_invoice_ref
  );

  -- 2. Debit: Input VAT Account (215)
  IF v_inv.tax_amount > 0 THEN
    INSERT INTO public.journal_lines (
      company_id, header_id, account_id, project_id, partner_id, debit, credit, notes
    ) VALUES (
      v_company, v_jh_id, v_acc_215, v_inv.project_id, v_inv.supplier_id,
      v_inv.tax_amount, 0, 'ضريبة مدخلات مشتريات 15% - فاتورة ' || v_inv.supplier_invoice_ref
    );
  END IF;

  -- 3. Credit: Supplier Liability Account (211) for full invoice total
  INSERT INTO public.journal_lines (
    company_id, header_id, account_id, project_id, partner_id, debit, credit, notes
  ) VALUES (
    v_company, v_jh_id, v_acc_211, v_inv.project_id, v_inv.supplier_id,
    0, v_inv.total_amount, 'إثبات استحقاق ذمة المورد - فاتورة ' || v_inv.supplier_invoice_ref
  );

  -- Update PO lines invoiced quantity if PO linked
  IF v_inv.po_id IS NOT NULL THEN
    FOR v_line IN
      SELECT po_line_id, sum(quantity) AS qty
      FROM public.supplier_invoice_lines
      WHERE invoice_id = v_inv.id AND po_line_id IS NOT NULL
      GROUP BY po_line_id
    LOOP
      UPDATE public.purchase_order_lines
      SET invoiced_quantity = invoiced_quantity + v_line.qty
      WHERE id = v_line.po_line_id;
    END LOOP;

    -- Check if PO is now fully closed
    SELECT bool_and(received_quantity >= quantity AND invoiced_quantity >= quantity) INTO v_po_all_closed
    FROM public.purchase_order_lines
    WHERE po_id = v_inv.po_id AND company_id = v_company;

    IF v_po_all_closed THEN
      UPDATE public.purchase_orders SET status = 'closed', updated_at = now() WHERE id = v_inv.po_id;
    END IF;
  END IF;

  UPDATE public.supplier_invoices
  SET is_posted = true,
      status = 'posted',
      journal_header_id = v_jh_id,
      updated_at = now()
  WHERE id = v_inv.id;

  RETURN jsonb_build_object(
    'invoice_id', v_inv.id,
    'invoice_number', v_inv.invoice_number,
    'journal_header_id', v_jh_id,
    'status', 'posted'
  );
END;
$$;

-- 6.6 GET PURCHASE ORDER 3-WAY MATCHING
CREATE OR REPLACE FUNCTION public.get_purchase_order_matching(
  p_po_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company uuid := rawasi_private.current_company_id();
  v_po record;
  v_lines jsonb;
  v_receipts jsonb;
  v_invoices jsonb;
BEGIN
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'يلزم تحديد الشركة المفتوحة' USING ERRCODE = '42501';
  END IF;

  SELECT po.*, p.name AS supplier_name, pr."Property" AS project_name
  INTO v_po
  FROM public.purchase_orders po
  JOIN public.partners p ON p.id = po.supplier_id
  LEFT JOIN public.projects pr ON pr.id = po.project_id
  WHERE po.id = p_po_id AND po.company_id = v_company;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'أمر الشراء غير موجود' USING ERRCODE = 'P0002';
  END IF;

  -- 1. Lines matching
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'line_id', l.id,
      'item_name', l.item_name,
      'ordered_qty', l.quantity,
      'received_qty', l.received_quantity,
      'invoiced_qty', l.invoiced_quantity,
      'remaining_to_receive', greatest(0, l.quantity - l.received_quantity),
      'remaining_to_invoice', greatest(0, l.quantity - l.invoiced_quantity),
      'unit', l.unit,
      'po_unit_price', l.unit_price,
      'po_total_price', l.total_price,
      'is_fully_received', (l.received_quantity >= l.quantity),
      'is_fully_invoiced', (l.invoiced_quantity >= l.quantity)
    ) ORDER BY l.item_name
  ), '[]'::jsonb) INTO v_lines
  FROM public.purchase_order_lines l
  WHERE l.po_id = p_po_id AND l.company_id = v_company;

  -- 2. Linked receipts
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'receipt_id', r.id,
      'receipt_number', r.receipt_number,
      'receipt_date', r.receipt_date,
      'total_amount', r.total_amount,
      'status', r.status,
      'is_posted', r.is_posted
    ) ORDER BY r.receipt_date DESC
  ), '[]'::jsonb) INTO v_receipts
  FROM public.material_receipts r
  WHERE r.po_id = p_po_id AND r.company_id = v_company;

  -- 3. Linked supplier invoices
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'invoice_id', si.id,
      'invoice_number', si.invoice_number,
      'supplier_ref', si.supplier_invoice_ref,
      'invoice_date', si.invoice_date,
      'subtotal', si.subtotal,
      'tax_amount', si.tax_amount,
      'total_amount', si.total_amount,
      'status', si.status,
      'is_posted', si.is_posted
    ) ORDER BY si.invoice_date DESC
  ), '[]'::jsonb) INTO v_invoices
  FROM public.supplier_invoices si
  WHERE si.po_id = p_po_id AND si.company_id = v_company;

  RETURN jsonb_build_object(
    'po_id', v_po.id,
    'po_number', v_po.po_number,
    'supplier_name', v_po.supplier_name,
    'project_name', v_po.project_name,
    'order_date', v_po.order_date,
    'status', v_po.status,
    'total_amount', v_po.total_amount,
    'lines', v_lines,
    'receipts', v_receipts,
    'invoices', v_invoices
  );
END;
$$;

-- 6.7 GET PURCHASE ORDERS SUMMARY
CREATE OR REPLACE FUNCTION public.get_purchase_orders_summary(
  p_status text DEFAULT 'all',
  p_project_id uuid DEFAULT NULL,
  p_supplier_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company uuid := rawasi_private.current_company_id();
  v_kpis jsonb;
  v_pos jsonb;
BEGIN
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'يلزم تحديد الشركة المفتوحة' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'total_pos', count(*),
    'draft_pos', count(*) FILTER (WHERE status = 'draft'),
    'approved_pos', count(*) FILTER (WHERE status = 'approved'),
    'partially_received_pos', count(*) FILTER (WHERE status = 'partially_received'),
    'received_pos', count(*) FILTER (WHERE status = 'received'),
    'closed_pos', count(*) FILTER (WHERE status = 'closed'),
    'total_orders_value', coalesce(sum(total_amount), 0)
  ) INTO v_kpis
  FROM public.purchase_orders
  WHERE company_id = v_company;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', po.id,
      'po_number', po.po_number,
      'order_date', po.order_date,
      'expected_delivery_date', po.expected_delivery_date,
      'supplier_id', po.supplier_id,
      'supplier_name', p.name,
      'project_id', po.project_id,
      'project_name', pr."Property",
      'subtotal', po.subtotal,
      'tax_amount', po.tax_amount,
      'total_amount', po.total_amount,
      'status', po.status,
      'notes', po.notes,
      'lines_count', (SELECT count(*) FROM public.purchase_order_lines pol WHERE pol.po_id = po.id)
    ) ORDER BY po.order_date DESC, po.po_number DESC
  ), '[]'::jsonb) INTO v_pos
  FROM public.purchase_orders po
  JOIN public.partners p ON p.id = po.supplier_id
  LEFT JOIN public.projects pr ON pr.id = po.project_id
  WHERE po.company_id = v_company
    AND (p_status = 'all' OR po.status = p_status)
    AND (p_project_id IS NULL OR po.project_id = p_project_id)
    AND (p_supplier_id IS NULL OR po.supplier_id = p_supplier_id);

  RETURN jsonb_build_object(
    'kpis', v_kpis,
    'orders', v_pos
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_purchase_order(uuid, uuid, date, date, text, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_purchase_order(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.receive_materials_from_po(uuid, date, jsonb, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_supplier_invoice(uuid, text, uuid, uuid, date, date, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.post_supplier_invoice(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_purchase_order_matching(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_purchase_orders_summary(text, uuid, uuid) TO authenticated, service_role;

COMMIT;



-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- FILE: 20261105170010_inventory_stocktaking_and_job_orders.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- Migration: 20261105170010_inventory_stocktaking_and_job_orders.sql
-- Description: Phase 5 (Batch 2) - Stocktaking Sessions, Item Cards, Moving Average Cost, Inventory Dashboard & Comprehensive Job Order (اوامر التشغيل) Links

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $preflight$
BEGIN
  IF to_regclass('public.purchase_orders') IS NULL THEN
    RAISE EXCEPTION 'Purchase orders system is required before Phase 5 Batch 2';
  END IF;
  IF to_regclass('public.stocktaking_sessions') IS NOT NULL THEN
    RAISE EXCEPTION 'public.stocktaking_sessions already exists';
  END IF;
END;
$preflight$;

-- =============================================================================
-- 1. LINK OPERATIONAL JOB ORDERS (أوامر التشغيل) TO PURCHASES, RECEIPTS & INVOICES
-- =============================================================================

-- A) Purchase Orders (أمر الشراء لكامل أمر التشغيل)
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS job_order_id uuid;

ALTER TABLE public.purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_job_order_fkey;

ALTER TABLE public.purchase_orders
  ADD CONSTRAINT purchase_orders_job_order_fkey
  FOREIGN KEY (job_order_id, company_id) REFERENCES public.job_orders(id, company_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS po_company_job_order_idx
  ON public.purchase_orders(company_id, job_order_id);

DROP TRIGGER IF EXISTS trg_job_order_link_po ON public.purchase_orders;
CREATE TRIGGER trg_job_order_link_po
  BEFORE INSERT OR UPDATE OF job_order_id, project_id ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.check_job_order_link('project_id');

-- B) Purchase Order Lines (بند أمر الشراء لأمر تشغيل محدد)
ALTER TABLE public.purchase_order_lines
  ADD COLUMN IF NOT EXISTS job_order_id uuid;

ALTER TABLE public.purchase_order_lines
  DROP CONSTRAINT IF EXISTS purchase_order_lines_job_order_fkey;

ALTER TABLE public.purchase_order_lines
  ADD CONSTRAINT purchase_order_lines_job_order_fkey
  FOREIGN KEY (job_order_id, company_id) REFERENCES public.job_orders(id, company_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS po_lines_company_job_order_idx
  ON public.purchase_order_lines(company_id, job_order_id);

-- C) Material Receipt Lines (سند استلام المواد مخصص لأمر تشغيل)
ALTER TABLE public.material_receipt_lines
  ADD COLUMN IF NOT EXISTS job_order_id uuid;

ALTER TABLE public.material_receipt_lines
  DROP CONSTRAINT IF EXISTS material_receipt_lines_job_order_fkey;

ALTER TABLE public.material_receipt_lines
  ADD CONSTRAINT material_receipt_lines_job_order_fkey
  FOREIGN KEY (job_order_id, company_id) REFERENCES public.job_orders(id, company_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS material_receipt_lines_job_order_idx
  ON public.material_receipt_lines(company_id, job_order_id);

-- D) Supplier Invoices & Lines (فاتورة المورد لأمر تشغيل)
ALTER TABLE public.supplier_invoices
  ADD COLUMN IF NOT EXISTS job_order_id uuid;

ALTER TABLE public.supplier_invoices
  DROP CONSTRAINT IF EXISTS supplier_invoices_job_order_fkey;

ALTER TABLE public.supplier_invoices
  ADD CONSTRAINT supplier_invoices_job_order_fkey
  FOREIGN KEY (job_order_id, company_id) REFERENCES public.job_orders(id, company_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS supplier_invoices_job_order_idx
  ON public.supplier_invoices(company_id, job_order_id);

DROP TRIGGER IF EXISTS trg_job_order_link_supp_inv ON public.supplier_invoices;
CREATE TRIGGER trg_job_order_link_supp_inv
  BEFORE INSERT OR UPDATE OF job_order_id, project_id ON public.supplier_invoices
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.check_job_order_link('project_id');

ALTER TABLE public.supplier_invoice_lines
  ADD COLUMN IF NOT EXISTS job_order_id uuid;

ALTER TABLE public.supplier_invoice_lines
  DROP CONSTRAINT IF EXISTS supplier_invoice_lines_job_order_fkey;

ALTER TABLE public.supplier_invoice_lines
  ADD CONSTRAINT supplier_invoice_lines_job_order_fkey
  FOREIGN KEY (job_order_id, company_id) REFERENCES public.job_orders(id, company_id) ON DELETE SET NULL;

-- =============================================================================
-- 2. EXTEND MATERIAL ITEMS (حدود الطلب، كمية إعادة الطلب، المتوسط المرجح للتكلفة)
-- =============================================================================
ALTER TABLE public.material_items
  ADD COLUMN IF NOT EXISTS min_order_level numeric(15,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reorder_qty numeric(15,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS moving_avg_cost numeric(15,2) NOT NULL DEFAULT 0;

-- =============================================================================
-- 3. STOCKTAKING SESSIONS (جلسات الجرد الميداني للمخازن والمواقع)
-- =============================================================================
CREATE TABLE public.stocktaking_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT rawasi_private.current_company_id() REFERENCES public.companies(id) ON DELETE RESTRICT,
  session_number text NOT NULL DEFAULT '',
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  job_order_id uuid,
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'counted', 'approved', 'posted', 'cancelled')),
  is_posted boolean NOT NULL DEFAULT false,
  journal_header_id uuid REFERENCES public.journal_headers(id) ON DELETE SET NULL,
  total_difference_amount numeric(15,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  CONSTRAINT stocktaking_sessions_company_session_no_uq UNIQUE (company_id, session_number),
  CONSTRAINT stocktaking_sessions_job_order_fkey FOREIGN KEY (job_order_id, company_id) REFERENCES public.job_orders(id, company_id) ON DELETE SET NULL,
  CONSTRAINT stocktaking_sessions_company_id_uq UNIQUE (id, company_id)
);

CREATE TRIGGER aa_stamp_company_id BEFORE INSERT OR UPDATE OF company_id ON public.stocktaking_sessions
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id();

CREATE TRIGGER trg_stocktaking_session_number BEFORE INSERT ON public.stocktaking_sessions
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.assign_document_number('STK', 'session_number', 'session_date');

CREATE TRIGGER trg_job_order_link_stk BEFORE INSERT OR UPDATE OF job_order_id, project_id ON public.stocktaking_sessions
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.check_job_order_link('project_id');

-- =============================================================================
-- 4. STOCKTAKING LINES (بنود الجرد الفعلي والفروق المحاسبية)
-- =============================================================================
CREATE TABLE public.stocktaking_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT rawasi_private.current_company_id() REFERENCES public.companies(id) ON DELETE RESTRICT,
  session_id uuid NOT NULL,
  item_id uuid NOT NULL,
  job_order_id uuid,
  system_quantity numeric(15,3) NOT NULL DEFAULT 0,
  actual_quantity numeric(15,3) NOT NULL DEFAULT 0 CHECK (actual_quantity >= 0),
  difference_quantity numeric(15,3) GENERATED ALWAYS AS (actual_quantity - system_quantity) STORED,
  unit_cost numeric(15,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  difference_amount numeric(15,2) GENERATED ALWAYS AS ((actual_quantity - system_quantity) * unit_cost) STORED,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stocktaking_lines_session_fkey FOREIGN KEY (session_id, company_id) REFERENCES public.stocktaking_sessions(id, company_id) ON DELETE CASCADE,
  CONSTRAINT stocktaking_lines_item_fkey FOREIGN KEY (item_id, company_id) REFERENCES public.material_items(id, company_id) ON DELETE RESTRICT,
  CONSTRAINT stocktaking_lines_job_order_fkey FOREIGN KEY (job_order_id, company_id) REFERENCES public.job_orders(id, company_id) ON DELETE SET NULL,
  CONSTRAINT stocktaking_lines_company_id_uq UNIQUE (id, company_id)
);

CREATE TRIGGER aa_stamp_company_id BEFORE INSERT OR UPDATE OF company_id ON public.stocktaking_lines
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id();

-- Register with company-scoped tables
INSERT INTO rawasi_private.company_scoped_tables(table_name)
VALUES ('stocktaking_sessions'), ('stocktaking_lines')
ON CONFLICT (table_name) DO NOTHING;

-- Indexes
CREATE INDEX stocktaking_sessions_company_proj_idx ON public.stocktaking_sessions(company_id, project_id);
CREATE INDEX stocktaking_sessions_company_jo_idx ON public.stocktaking_sessions(company_id, job_order_id);
CREATE INDEX stocktaking_sessions_company_status_idx ON public.stocktaking_sessions(company_id, status);
CREATE INDEX stocktaking_lines_session_idx ON public.stocktaking_lines(company_id, session_id);
CREATE INDEX stocktaking_lines_item_idx ON public.stocktaking_lines(company_id, item_id);

-- RLS & Grants
ALTER TABLE public.stocktaking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stocktaking_lines ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stocktaking_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stocktaking_lines TO authenticated;
GRANT ALL ON public.stocktaking_sessions, public.stocktaking_lines TO service_role;

CREATE POLICY stocktaking_sessions_select ON public.stocktaking_sessions FOR SELECT TO authenticated
  USING (
    (rawasi_private.can_access('materials', 'view') OR rawasi_private.can_access('accounting', 'view'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY stocktaking_sessions_insert ON public.stocktaking_sessions FOR INSERT TO authenticated
  WITH CHECK (
    (rawasi_private.can_access('materials', 'create') OR rawasi_private.can_access('accounting', 'create'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY stocktaking_sessions_update ON public.stocktaking_sessions FOR UPDATE TO authenticated
  USING (
    (rawasi_private.can_access('materials', 'edit') OR rawasi_private.can_access('accounting', 'edit'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY stocktaking_lines_select ON public.stocktaking_lines FOR SELECT TO authenticated
  USING (
    (rawasi_private.can_access('materials', 'view') OR rawasi_private.can_access('accounting', 'view'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY stocktaking_lines_insert ON public.stocktaking_lines FOR INSERT TO authenticated
  WITH CHECK (
    (rawasi_private.can_access('materials', 'create') OR rawasi_private.can_access('accounting', 'create'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

-- =============================================================================
-- 5. RPC: CREATE STOCKTAKING SESSION
-- =============================================================================
CREATE OR REPLACE FUNCTION public.create_stocktaking_session(
  p_project_id uuid,
  p_job_order_id uuid,
  p_session_date date,
  p_notes text,
  p_lines jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company uuid := rawasi_private.current_company_id();
  v_session_id uuid;
  v_line jsonb;
  v_item_id uuid;
  v_actual_qty numeric;
  v_system_qty numeric;
  v_unit_cost numeric;
  v_line_jo uuid;
BEGIN
  IF NOT (rawasi_private.can_access('materials', 'create') OR rawasi_private.can_access('accounting', 'create')) THEN
    RAISE EXCEPTION 'غير مصرح بإنشاء جلسات جرد المخزون' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.stocktaking_sessions (
    company_id, project_id, job_order_id, session_date, status, notes
  ) VALUES (
    v_company, p_project_id, p_job_order_id, coalesce(p_session_date, CURRENT_DATE), 'counted', p_notes
  ) RETURNING id INTO v_session_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_item_id := (v_line->>'item_id')::uuid;
    v_actual_qty := coalesce((v_line->>'actual_quantity')::numeric, 0);
    v_line_jo := coalesce((v_line->>'job_order_id')::uuid, p_job_order_id);

    -- Calculate system quantity in the company / project if not supplied
    IF (v_line ? 'system_quantity') THEN
      v_system_qty := (v_line->>'system_quantity')::numeric;
    ELSE
      -- Total receipts minus total issues for this item in this project
      SELECT coalesce(
        (SELECT sum(mrl.quantity) FROM public.material_receipt_lines mrl
         JOIN public.material_receipts mr ON mr.id = mrl.receipt_id
         WHERE mrl.company_id = v_company AND mrl.item_id = v_item_id AND mr.is_posted
           AND (p_project_id IS NULL OR mr.project_id = p_project_id)
           AND (v_line_jo IS NULL OR mrl.job_order_id = v_line_jo)), 0
      ) - coalesce(
        (SELECT sum(mil.quantity) FROM public.material_issue_lines mil
         JOIN public.material_issues mi ON mi.id = mil.issue_id
         WHERE mil.company_id = v_company AND mil.item_id = v_item_id AND mi.is_posted
           AND (p_project_id IS NULL OR mi.project_id = p_project_id)
           AND (v_line_jo IS NULL OR mil.job_order_id = v_line_jo)), 0
      ) INTO v_system_qty;
    END IF;

    -- Unit cost (from item moving average cost, or default unit price, or fallback)
    SELECT coalesce(
      nullif(moving_avg_cost, 0),
      nullif(default_unit_price, 0),
      (v_line->>'unit_cost')::numeric,
      0
    ) INTO v_unit_cost
    FROM public.material_items
    WHERE id = v_item_id AND company_id = v_company;

    INSERT INTO public.stocktaking_lines (
      company_id, session_id, item_id, job_order_id, system_quantity, actual_quantity, unit_cost, notes
    ) VALUES (
      v_company, v_session_id, v_item_id, v_line_jo, v_system_qty, v_actual_qty, v_unit_cost, v_line->>'notes'
    );
  END LOOP;

  -- Update total difference amount on session
  UPDATE public.stocktaking_sessions
  SET total_difference_amount = coalesce((
    SELECT sum(difference_amount) FROM public.stocktaking_lines WHERE session_id = v_session_id
  ), 0)
  WHERE id = v_session_id;

  RETURN v_session_id;
END;
$$;

-- =============================================================================
-- 6. RPC: POST STOCKTAKING SESSION (اعتماد وترحيل قيد التسوية الجردية)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.post_stocktaking_session(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company uuid := rawasi_private.current_company_id();
  v_session public.stocktaking_sessions%ROWTYPE;
  v_acc_126 uuid; -- مخزون الخامات والمواد
  v_acc_527 uuid; -- تسويات وفروق جردية
  v_jh_id uuid;
  v_tot_diff numeric;
  v_line record;
BEGIN
  IF NOT (rawasi_private.can_access('materials', 'edit') OR rawasi_private.can_access('accounting', 'edit')) THEN
    RAISE EXCEPTION 'غير مصرح بترحيل جلسات جرد المخزون' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_session
  FROM public.stocktaking_sessions
  WHERE id = p_session_id AND company_id = v_company
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'جلسة الجرد غير موجودة' USING ERRCODE = '23503';
  END IF;

  IF v_session.is_posted THEN
    RAISE EXCEPTION 'جلسة الجرد مرحلة مسبقاً' USING ERRCODE = '23514';
  END IF;

  v_acc_126 := rawasi_private.require_company_account('126');
  v_acc_527 := rawasi_private.require_company_account('527');

  -- Recalculate total difference
  SELECT coalesce(sum(difference_amount), 0) INTO v_tot_diff
  FROM public.stocktaking_lines
  WHERE session_id = p_session_id;

  -- Create GL Journal Entry if there is any difference
  IF v_tot_diff <> 0 THEN
    INSERT INTO public.journal_headers (
      company_id, entry_date, description, reference_id, v_type, status
    ) VALUES (
      v_company,
      v_session.session_date,
      'قيد تسوية فروق جرد مخزني - جلسة رقم ' || v_session.session_number || coalesce(' - مشروع ' || (SELECT "Property" FROM public.projects WHERE id = v_session.project_id), ''),
      p_session_id,
      'inventory_adjustment',
      'posted'
    ) RETURNING id INTO v_jh_id;

    IF v_tot_diff < 0 THEN
      -- Shortage (عجز جردي: الفعلي أقل من الدفتري)
      -- مدين: تسويات وفروق جردية (527)
      -- دائن: مخزون الخامات والمواد (126)
      INSERT INTO public.journal_lines (header_id, account_id, debit, credit, notes, job_order_id, company_id)
      VALUES (v_jh_id, v_acc_527, abs(v_tot_diff), 0, 'عجز جردي - جلسة ' || v_session.session_number, v_session.job_order_id, v_company);

      INSERT INTO public.journal_lines (header_id, account_id, debit, credit, notes, job_order_id, company_id)
      VALUES (v_jh_id, v_acc_126, 0, abs(v_tot_diff), 'تخفيض المخزون بالفارق الفعلي للجرد', v_session.job_order_id, v_company);
    ELSE
      -- Surplus (زيادة جردية: الفعلي أكبر من الدفتري)
      -- مدين: مخزون الخامات والمواد (126)
      -- دائن: تسويات وفروق جردية (527)
      INSERT INTO public.journal_lines (header_id, account_id, debit, credit, notes, job_order_id, company_id)
      VALUES (v_jh_id, v_acc_126, v_tot_diff, 0, 'إثبات زيادة جردية - جلسة ' || v_session.session_number, v_session.job_order_id, v_company);

      INSERT INTO public.journal_lines (header_id, account_id, debit, credit, notes, job_order_id, company_id)
      VALUES (v_jh_id, v_acc_527, 0, v_tot_diff, 'أرباح تسوية فروق الجرد', v_session.job_order_id, v_company);
    END IF;
  END IF;

  -- Update items' moving average cost
  FOR v_line IN SELECT item_id, unit_cost FROM public.stocktaking_lines WHERE session_id = p_session_id AND unit_cost > 0 LOOP
    UPDATE public.material_items
    SET moving_avg_cost = v_line.unit_cost
    WHERE id = v_line.item_id AND company_id = v_company;
  END LOOP;

  -- Mark session as posted
  UPDATE public.stocktaking_sessions
  SET is_posted = true,
      status = 'posted',
      journal_header_id = v_jh_id,
      total_difference_amount = v_tot_diff,
      updated_at = now()
  WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'session_id', p_session_id,
    'session_number', v_session.session_number,
    'total_difference_amount', v_tot_diff,
    'journal_header_id', v_jh_id,
    'status', 'posted'
  );
END;
$$;

-- =============================================================================
-- 7. RPC: GET ITEM STOCK CARD (كارت الصنف والحركة المخزنية الشاملة)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_item_stock_card(
  p_item_id uuid,
  p_project_id uuid DEFAULT NULL,
  p_job_order_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company uuid := rawasi_private.current_company_id();
  v_item record;
  v_movements jsonb;
  v_current_stock numeric := 0;
  v_total_in numeric := 0;
  v_total_out numeric := 0;
BEGIN
  IF NOT (rawasi_private.can_access('materials', 'view') OR rawasi_private.can_access('accounting', 'view')) THEN
    RAISE EXCEPTION 'غير مصرح بالاطلاع على كارت الصنف' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_item
  FROM public.material_items
  WHERE id = p_item_id AND company_id = v_company;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الصنف غير موجود' USING ERRCODE = '23503';
  END IF;

  WITH all_movements AS (
    -- 1. Inward Receipts (توريد مواد للمخزن أو المشروع)
    SELECT
      mr.receipt_date AS move_date,
      'توريد خامات (سند استلام)' AS doc_type,
      mr.receipt_number AS doc_number,
      mr.id AS doc_id,
      coalesce(mrl.job_order_id, mr.job_order_id) AS job_order_id,
      jo.order_number AS job_order_number,
      mr.project_id,
      p."Property" AS project_name,
      part.name AS entity_name,
      mrl.quantity AS qty_in,
      0::numeric AS qty_out,
      mrl.unit_price AS unit_cost,
      mrl.created_at AS sort_ts
    FROM public.material_receipt_lines mrl
    JOIN public.material_receipts mr ON mr.id = mrl.receipt_id
    LEFT JOIN public.projects p ON p.id = mr.project_id
    LEFT JOIN public.job_orders jo ON jo.id = coalesce(mrl.job_order_id, mr.job_order_id)
    LEFT JOIN public.partners part ON part.id = mr.supplier_id
    WHERE mrl.company_id = v_company
      AND mrl.item_id = p_item_id
      AND mr.is_posted
      AND (p_project_id IS NULL OR mr.project_id = p_project_id)
      AND (p_job_order_id IS NULL OR coalesce(mrl.job_order_id, mr.job_order_id) = p_job_order_id)

    UNION ALL

    -- 2. Outward Issues (صرف مواد لمشروع / أمر تشغيل مقاول باطن)
    SELECT
      mi.issue_date AS move_date,
      'صرف خامات (سند صرف)' AS doc_type,
      mi.issue_number AS doc_number,
      mi.id AS doc_id,
      coalesce(mil.job_order_id, mi.job_order_id) AS job_order_id,
      jo.order_number AS job_order_number,
      mi.project_id,
      p."Property" AS project_name,
      coalesce(part.name, mi.contractor_text_name) AS entity_name,
      0::numeric AS qty_in,
      mil.quantity AS qty_out,
      mil.unit_price AS unit_cost,
      mi.created_at AS sort_ts
    FROM public.material_issue_lines mil
    JOIN public.material_issues mi ON mi.id = mil.issue_id
    LEFT JOIN public.projects p ON p.id = mi.project_id
    LEFT JOIN public.job_orders jo ON jo.id = coalesce(mil.job_order_id, mi.job_order_id)
    LEFT JOIN public.partners part ON part.id = mi.subcontractor_id
    WHERE mil.company_id = v_company
      AND mil.item_id = p_item_id
      AND mi.is_posted
      AND (p_project_id IS NULL OR mi.project_id = p_project_id)
      AND (p_job_order_id IS NULL OR coalesce(mil.job_order_id, mi.job_order_id) = p_job_order_id)

    UNION ALL

    -- 3. Stocktaking Adjustments (تسويات جردية)
    SELECT
      st.session_date AS move_date,
      'تسوية جرد فعلي' AS doc_type,
      st.session_number AS doc_number,
      st.id AS doc_id,
      coalesce(stl.job_order_id, st.job_order_id) AS job_order_id,
      jo.order_number AS job_order_number,
      st.project_id,
      p."Property" AS project_name,
      'لجنة الجرد والمطابقة' AS entity_name,
      CASE WHEN stl.difference_quantity > 0 THEN stl.difference_quantity ELSE 0 END AS qty_in,
      CASE WHEN stl.difference_quantity < 0 THEN abs(stl.difference_quantity) ELSE 0 END AS qty_out,
      stl.unit_cost,
      stl.created_at AS sort_ts
    FROM public.stocktaking_lines stl
    JOIN public.stocktaking_sessions st ON st.id = stl.session_id
    LEFT JOIN public.projects p ON p.id = st.project_id
    LEFT JOIN public.job_orders jo ON jo.id = coalesce(stl.job_order_id, st.job_order_id)
    WHERE stl.company_id = v_company
      AND stl.item_id = p_item_id
      AND st.is_posted
      AND (p_project_id IS NULL OR st.project_id = p_project_id)
      AND (p_job_order_id IS NULL OR coalesce(stl.job_order_id, st.job_order_id) = p_job_order_id)
  ),
  movements_with_running AS (
    SELECT
      m.*,
      sum(m.qty_in - m.qty_out) OVER (ORDER BY m.move_date, m.sort_ts) AS running_qty
    FROM all_movements m
  )
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'move_date', m.move_date,
      'doc_type', m.doc_type,
      'doc_number', m.doc_number,
      'doc_id', m.doc_id,
      'job_order_id', m.job_order_id,
      'job_order_number', m.job_order_number,
      'project_id', m.project_id,
      'project_name', m.project_name,
      'entity_name', m.entity_name,
      'qty_in', m.qty_in,
      'qty_out', m.qty_out,
      'unit_cost', m.unit_cost,
      'running_qty', m.running_qty
    ) ORDER BY m.move_date DESC, m.sort_ts DESC
  ), '[]'::jsonb),
  coalesce(sum(m.qty_in), 0),
  coalesce(sum(m.qty_out), 0)
  INTO v_movements, v_total_in, v_total_out
  FROM movements_with_running m;

  v_current_stock := v_total_in - v_total_out;

  RETURN jsonb_build_object(
    'item', jsonb_build_object(
      'id', v_item.id,
      'code', v_item.item_code,
      'name', v_item.item_name,
      'unit', v_item.default_unit,
      'moving_avg_cost', v_item.moving_avg_cost,
      'min_order_level', v_item.min_order_level,
      'reorder_qty', v_item.reorder_qty,
      'total_in', v_total_in,
      'total_out', v_total_out,
      'current_stock', v_current_stock,
      'total_value', v_current_stock * v_item.moving_avg_cost
    ),
    'movements', v_movements
  );
END;
$$;

-- =============================================================================
-- 8. RPC: GET INVENTORY DASHBOARD SUMMARY (تقييم المخزون، حد الطلب، الركود)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_inventory_dashboard_summary(
  p_project_id uuid DEFAULT NULL,
  p_job_order_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company uuid := rawasi_private.current_company_id();
  v_kpis jsonb;
  v_low_stock jsonb;
  v_stagnant jsonb;
  v_stocktakes jsonb;
  v_gl_126_balance numeric := 0;
BEGIN
  IF NOT (rawasi_private.can_access('materials', 'view') OR rawasi_private.can_access('accounting', 'view')) THEN
    RAISE EXCEPTION 'غير مصرح بالاطلاع على تقارير المخزون' USING ERRCODE = '42501';
  END IF;

  -- 1. Account 126 GL Balance
  SELECT coalesce(sum(jl.debit - jl.credit), 0) INTO v_gl_126_balance
  FROM public.journal_lines jl
  JOIN public.accounts a ON a.id = jl.account_id
  JOIN public.journal_headers jh ON jh.id = jl.header_id
  WHERE a.company_id = v_company AND a.code = '126' AND jh.status IN ('posted', 'مرحل', 'معتمد');

  -- Item inventory calculations
  WITH item_balances AS (
    SELECT
      mi.id AS item_id,
      mi.item_code,
      mi.item_name,
      mi.default_unit,
      mi.min_order_level,
      mi.reorder_qty,
      mi.moving_avg_cost,
      coalesce(r.total_received, 0) - coalesce(i.total_issued, 0) + coalesce(s.total_adjustment, 0) AS current_stock,
      coalesce(r.last_receipt, i.last_issue) AS last_movement_date
    FROM public.material_items mi
    LEFT JOIN LATERAL (
      SELECT sum(mrl.quantity) AS total_received, max(mr.receipt_date) AS last_receipt
      FROM public.material_receipt_lines mrl
      JOIN public.material_receipts mr ON mr.id = mrl.receipt_id
      WHERE mrl.company_id = v_company AND mrl.item_id = mi.id AND mr.is_posted
        AND (p_project_id IS NULL OR mr.project_id = p_project_id)
        AND (p_job_order_id IS NULL OR coalesce(mrl.job_order_id, mr.job_order_id) = p_job_order_id)
    ) r ON true
    LEFT JOIN LATERAL (
      SELECT sum(mil.quantity) AS total_issued, max(mi2.issue_date) AS last_issue
      FROM public.material_issue_lines mil
      JOIN public.material_issues mi2 ON mi2.id = mil.issue_id
      WHERE mil.company_id = v_company AND mil.item_id = mi.id AND mi2.is_posted
        AND (p_project_id IS NULL OR mi2.project_id = p_project_id)
        AND (p_job_order_id IS NULL OR coalesce(mil.job_order_id, mi2.job_order_id) = p_job_order_id)
    ) i ON true
    LEFT JOIN LATERAL (
      SELECT sum(stl.difference_quantity) AS total_adjustment
      FROM public.stocktaking_lines stl
      JOIN public.stocktaking_sessions st ON st.id = stl.session_id
      WHERE stl.company_id = v_company AND stl.item_id = mi.id AND st.is_posted
        AND (p_project_id IS NULL OR st.project_id = p_project_id)
        AND (p_job_order_id IS NULL OR coalesce(stl.job_order_id, st.job_order_id) = p_job_order_id)
    ) s ON true
    WHERE mi.company_id = v_company
  )
  SELECT
    jsonb_build_object(
      'total_items_count', count(*),
      'total_inventory_valuation', coalesce(sum(current_stock * moving_avg_cost), 0),
      'gl_126_balance', v_gl_126_balance,
      'valuation_gl_variance', coalesce(sum(current_stock * moving_avg_cost), 0) - v_gl_126_balance,
      'low_stock_count', count(*) FILTER (WHERE current_stock <= min_order_level AND min_order_level > 0),
      'stagnant_count', count(*) FILTER (WHERE current_stock > 0 AND (last_movement_date IS NULL OR last_movement_date < CURRENT_DATE - 60))
    ),
    coalesce(jsonb_agg(
      jsonb_build_object(
        'item_id', item_id,
        'item_code', item_code,
        'item_name', item_name,
        'unit', default_unit,
        'current_stock', current_stock,
        'min_order_level', min_order_level,
        'reorder_qty', reorder_qty,
        'suggested_po_qty', greatest(reorder_qty, min_order_level * 2 - current_stock)
      )
    ) FILTER (WHERE current_stock <= min_order_level AND min_order_level > 0), '[]'::jsonb),
    coalesce(jsonb_agg(
      jsonb_build_object(
        'item_id', item_id,
        'item_code', item_code,
        'item_name', item_name,
        'unit', default_unit,
        'current_stock', current_stock,
        'moving_avg_cost', moving_avg_cost,
        'stagnant_value', current_stock * moving_avg_cost,
        'last_movement_date', last_movement_date,
        'days_dormant', CURRENT_DATE - coalesce(last_movement_date, CURRENT_DATE - 365)
      )
    ) FILTER (WHERE current_stock > 0 AND (last_movement_date IS NULL OR last_movement_date < CURRENT_DATE - 60)), '[]'::jsonb)
  INTO v_kpis, v_low_stock, v_stagnant
  FROM item_balances;

  -- Recent stocktaking sessions
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', st.id,
      'session_number', st.session_number,
      'session_date', st.session_date,
      'project_name', p."Property",
      'job_order_number', jo.order_number,
      'total_difference_amount', st.total_difference_amount,
      'status', st.status,
      'is_posted', st.is_posted
    ) ORDER BY st.session_date DESC, st.session_number DESC
  ), '[]'::jsonb) INTO v_stocktakes
  FROM public.stocktaking_sessions st
  LEFT JOIN public.projects p ON p.id = st.project_id
  LEFT JOIN public.job_orders jo ON jo.id = st.job_order_id
  WHERE st.company_id = v_company
    AND (p_project_id IS NULL OR st.project_id = p_project_id)
    AND (p_job_order_id IS NULL OR st.job_order_id = p_job_order_id)
  LIMIT 20;

  RETURN jsonb_build_object(
    'kpis', v_kpis,
    'low_stock_items', v_low_stock,
    'stagnant_items', v_stagnant,
    'recent_stocktakes', v_stocktakes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_stocktaking_session(uuid, uuid, date, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.post_stocktaking_session(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_item_stock_card(uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_inventory_dashboard_summary(uuid, uuid) TO authenticated, service_role;

COMMIT;



-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- FILE: 20261105170011_health_radar_document_expiry_and_notifications.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- =============================================================================
-- Migration: 20261105170011_health_radar_document_expiry_and_notifications.sql
-- Description: Phase 6: الرقابة والتنبيهات ورادار صحة البيانات وتتبع انتهاء المستندات والإشعارات
-- =============================================================================

-- 1. Upgrade Notifications Table with company isolation & deduplication
-- -----------------------------------------------------------------------------
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS dedup_key text;

CREATE INDEX IF NOT EXISTS idx_notifications_comp_user_read
  ON public.notifications (company_id, user_id, is_read);

CREATE INDEX IF NOT EXISTS idx_notifications_dedup
  ON public.notifications (company_id, dedup_key);

-- Update RLS policies on notifications to enforce company isolation
DROP POLICY IF EXISTS notification_view ON public.notifications;
DROP POLICY IF EXISTS notification_edit ON public.notifications;
DROP POLICY IF EXISTS notification_select ON public.notifications;
DROP POLICY IF EXISTS notification_insert ON public.notifications;
DROP POLICY IF EXISTS notification_update ON public.notifications;
DROP POLICY IF EXISTS notification_delete ON public.notifications;

CREATE POLICY notification_select ON public.notifications
  FOR SELECT TO authenticated
  USING (
    (user_id = (SELECT auth.uid()) OR rawasi_private.is_admin())
    AND (company_id IS NULL OR company_id = (SELECT rawasi_private.current_company_id()))
  );

CREATE POLICY notification_insert ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    (user_id = (SELECT auth.uid()) OR rawasi_private.is_admin())
    AND (company_id IS NULL OR company_id = (SELECT rawasi_private.current_company_id()))
  );

CREATE POLICY notification_update ON public.notifications
  FOR UPDATE TO authenticated
  USING (
    (user_id = (SELECT auth.uid()) OR rawasi_private.is_admin())
    AND (company_id IS NULL OR company_id = (SELECT rawasi_private.current_company_id()))
  )
  WITH CHECK (
    (user_id = (SELECT auth.uid()) OR rawasi_private.is_admin())
    AND (company_id IS NULL OR company_id = (SELECT rawasi_private.current_company_id()))
  );

CREATE POLICY notification_delete ON public.notifications
  FOR DELETE TO authenticated
  USING (
    (user_id = (SELECT auth.uid()) OR rawasi_private.is_admin())
    AND (company_id IS NULL OR company_id = (SELECT rawasi_private.current_company_id()))
  );

-- 2. Projects Enhancements for Warranty & Retention Release Tracking
-- -----------------------------------------------------------------------------
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS handover_date date,
  ADD COLUMN IF NOT EXISTS warranty_period_months integer DEFAULT 12 CHECK (warranty_period_months >= 0),
  ADD COLUMN IF NOT EXISTS retention_release_date date;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS retention_released boolean NOT NULL DEFAULT false;

ALTER TABLE public.sub_claims
  ADD COLUMN IF NOT EXISTS retention_released boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.projects.handover_date IS 'تاريخ الاستلام الابتدائي للمشروع وبدء فترة الضمان';
COMMENT ON COLUMN public.projects.warranty_period_months IS 'مدة ضمان الأعمال بالشهور (افتراضياً 12 شهراً)';
COMMENT ON COLUMN public.projects.retention_release_date IS 'تاريخ استحقاق فك المبالغ المحجوزة لضمان الأعمال';
COMMENT ON COLUMN public.invoices.retention_released IS 'هل تم فك مبالغ ضمان أعمال العميل المحجوزة';
COMMENT ON COLUMN public.sub_claims.retention_released IS 'هل تم فك مبالغ ضمان أعمال مقاول الباطن المحجوزة';

-- 3. Company Documents Table (تتبع الوثائق والتراخيص والإقامات)
-- -----------------------------------------------------------------------------
CREATE TABLE public.company_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT rawasi_private.current_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
  document_number text NOT NULL,
  title text NOT NULL,
  doc_type text NOT NULL CHECK (doc_type IN (
    'worker_iqama',             -- إقامة عامل
    'municipality_license',     -- رخصة بلدية
    'asset_insurance',          -- تأمين معدة / مركبة
    'letter_of_guarantee',      -- خطاب ضمان بنكي
    'project_contract',         -- عقد مشروع
    'commercial_registration',  -- سجل تجاري
    'tax_certificate',          -- شهادة الزكاة والضريبة
    'other'                     -- أخرى
  )),
  issue_date date,
  expiry_date date NOT NULL,
  alert_days_before integer NOT NULL DEFAULT 30 CHECK (alert_days_before >= 0),
  partner_id uuid,
  project_id uuid,
  asset_id uuid,
  attachment_url text,
  notes text,
  is_renewed boolean NOT NULL DEFAULT false,
  renewal_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_documents_company_id_uq UNIQUE (id, company_id),
  FOREIGN KEY (partner_id, company_id) REFERENCES public.partners(id, company_id) ON DELETE SET NULL,
  FOREIGN KEY (project_id, company_id) REFERENCES public.projects(id, company_id) ON DELETE SET NULL,
  FOREIGN KEY (asset_id, company_id) REFERENCES public.fixed_assets(id, company_id) ON DELETE SET NULL
);

INSERT INTO rawasi_private.company_scoped_tables (table_name)
VALUES ('company_documents')
ON CONFLICT DO NOTHING;

CREATE TRIGGER aa_stamp_company_id
  BEFORE INSERT ON public.company_documents
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id();

CREATE TRIGGER trg_company_documents_touch_updated_at
  BEFORE UPDATE ON public.company_documents
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.touch_updated_at();

ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY company_documents_view ON public.company_documents
  FOR SELECT TO authenticated
  USING (
    (rawasi_private.can_access('audit_logs', 'view') OR rawasi_private.can_access('accounting', 'view') OR rawasi_private.can_access('reports', 'view'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY company_documents_create ON public.company_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    (rawasi_private.can_access('audit_logs', 'create') OR rawasi_private.can_access('accounting', 'create') OR rawasi_private.can_access('reports', 'create'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY company_documents_edit ON public.company_documents
  FOR UPDATE TO authenticated
  USING (
    (rawasi_private.can_access('audit_logs', 'edit') OR rawasi_private.can_access('accounting', 'edit') OR rawasi_private.can_access('reports', 'edit'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  )
  WITH CHECK (
    (rawasi_private.can_access('audit_logs', 'edit') OR rawasi_private.can_access('accounting', 'edit') OR rawasi_private.can_access('reports', 'edit'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY company_documents_delete ON public.company_documents
  FOR DELETE TO authenticated
  USING (
    (rawasi_private.can_access('audit_logs', 'delete') OR rawasi_private.can_access('accounting', 'delete') OR rawasi_private.can_access('reports', 'delete'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

-- 4. RPC: get_system_health_radar() (رادار صحة البيانات والتشوهات)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_system_health_radar()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rawasi_private
AS $$
DECLARE
  v_company_id uuid;
  v_checks jsonb := '[]'::jsonb;
  v_total_issues integer := 0;
  v_critical_count integer := 0;
  v_medium_count integer := 0;
  v_warning_count integer := 0;

  -- 1. Zero amount journals
  v_c1_count integer := 0;
  v_c1_items jsonb := '[]'::jsonb;

  -- 2. Orphaned journal lines
  v_c2_count integer := 0;
  v_c2_items jsonb := '[]'::jsonb;

  -- 3. Zero amount invoices
  v_c3_count integer := 0;
  v_c3_items jsonb := '[]'::jsonb;

  -- 4. Unlinked receipt vouchers
  v_c4_count integer := 0;
  v_c4_items jsonb := '[]'::jsonb;

  -- 5. Unposted subclaims
  v_c5_count integer := 0;
  v_c5_items jsonb := '[]'::jsonb;

  -- 6. Negative stock
  v_c6_count integer := 0;
  v_c6_items jsonb := '[]'::jsonb;

  -- 7. Overdue site custodies
  v_c7_count integer := 0;
  v_c7_items jsonb := '[]'::jsonb;

  -- 8. Unclosed cash boxes
  v_c8_count integer := 0;
  v_c8_items jsonb := '[]'::jsonb;

  -- 9. Unbalanced journals
  v_c9_count integer := 0;
  v_c9_items jsonb := '[]'::jsonb;
BEGIN
  v_company_id := rawasi_private.current_company_id();
  IF NOT (rawasi_private.can_access('audit_logs', 'view') OR rawasi_private.can_access('accounting', 'view') OR rawasi_private.is_admin()) THEN
    RAISE EXCEPTION 'غير مصرح بعرض رادار صحة البيانات' USING ERRCODE = '42501';
  END IF;

  -- 1. Zero amount / empty journals
  SELECT count(*),
         COALESCE(jsonb_agg(sub.item), '[]'::jsonb)
  INTO v_c1_count, v_c1_items
  FROM (
    SELECT jsonb_build_object(
      'id', jh.id,
      'identifier', COALESCE(jh.v_type, 'قيد') || ' #' || substring(jh.id::text, 1, 8),
      'date', jh.entry_date,
      'description', COALESCE(jh.description, 'بدون بيان'),
      'amount', COALESCE(sum(jl.debit), 0)
    ) AS item
    FROM public.journal_headers jh
    LEFT JOIN public.journal_lines jl ON jl.header_id = jh.id
    WHERE jh.company_id = v_company_id
    GROUP BY jh.id, jh.v_type, jh.entry_date, jh.description
    HAVING COALESCE(sum(jl.debit), 0) = 0 OR count(jl.id) = 0
    LIMIT 20
  ) sub;

  -- 2. Orphaned journal lines
  SELECT count(*),
         COALESCE(jsonb_agg(sub.item), '[]'::jsonb)
  INTO v_c2_count, v_c2_items
  FROM (
    SELECT jsonb_build_object(
      'id', jl.id,
      'identifier', COALESCE(jl.notes, 'سطر يتيم'),
      'header_id', jl.header_id,
      'amount', COALESCE(jl.debit, jl.credit, 0)
    ) AS item
    FROM public.journal_lines jl
    WHERE jl.company_id = v_company_id
      AND (jl.header_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.journal_headers jh WHERE jh.id = jl.header_id AND jh.company_id = v_company_id
      ))
    LIMIT 20
  ) sub;

  -- 3. Zero amount invoices
  SELECT count(*),
         COALESCE(jsonb_agg(sub.item), '[]'::jsonb)
  INTO v_c3_count, v_c3_items
  FROM (
    SELECT jsonb_build_object(
      'id', inv.id,
      'identifier', inv.invoice_number,
      'date', inv.date,
      'description', COALESCE(inv.client_name, 'بدون عميل'),
      'amount', COALESCE(inv.total_amount, 0)
    ) AS item
    FROM public.invoices inv
    WHERE inv.company_id = v_company_id
      AND (inv.total_amount IS NULL OR inv.total_amount <= 0)
    LIMIT 20
  ) sub;

  -- 4. Unlinked receipt vouchers
  SELECT count(*),
         COALESCE(jsonb_agg(sub.item), '[]'::jsonb)
  INTO v_c4_count, v_c4_items
  FROM (
    SELECT jsonb_build_object(
      'id', rv.id,
      'identifier', COALESCE(rv.receipt_number, substring(rv.id::text, 1, 8)),
      'date', rv.date,
      'description', 'سند قبض غير مربوط بفاتورة أو شريك',
      'amount', rv.amount
    ) AS item
    FROM public.receipt_vouchers rv
    WHERE rv.company_id = v_company_id
      AND rv.partner_id IS NULL
      AND rv.invoice_id IS NULL
    LIMIT 20
  ) sub;

  -- 5. Unposted approved subclaims
  SELECT count(*),
         COALESCE(jsonb_agg(sub.item), '[]'::jsonb)
  INTO v_c5_count, v_c5_items
  FROM (
    SELECT jsonb_build_object(
      'id', sc.id,
      'identifier', sc.claim_number,
      'date', sc.date,
      'description', 'مستخلص معتمد بدون قيد محاسبي',
      'amount', COALESCE(sc.net_amount, sc.total_amount, 0)
    ) AS item
    FROM public.sub_claims sc
    WHERE sc.company_id = v_company_id
      AND sc.status IN ('approved', 'معتمد')
      AND (
        (sc.jv_header_id IS NULL AND sc.jv_id IS NULL)
        OR NOT EXISTS (
          SELECT 1 FROM public.journal_headers jh
          WHERE (jh.id = sc.jv_header_id OR jh.id = sc.jv_id) AND jh.company_id = v_company_id
        )
      )
    LIMIT 20
  ) sub;

  -- 6. Negative stock
  SELECT count(*),
         COALESCE(jsonb_agg(sub.item), '[]'::jsonb)
  INTO v_c6_count, v_c6_items
  FROM (
    WITH item_calc AS (
      SELECT
        mi.id,
        mi.item_code,
        mi.item_name,
        (
          COALESCE((
            SELECT sum(mrl.quantity)
            FROM public.material_receipt_lines mrl
            JOIN public.material_receipts mr ON mr.id = mrl.receipt_id
            WHERE mrl.company_id = v_company_id AND mrl.item_id = mi.id AND mr.is_posted
          ), 0)
          -
          COALESCE((
            SELECT sum(mil.quantity)
            FROM public.material_issue_lines mil
            JOIN public.material_issues mi2 ON mi2.id = mil.issue_id
            WHERE mil.company_id = v_company_id AND mil.item_id = mi.id AND mi2.is_posted
          ), 0)
          +
          COALESCE((
            SELECT sum(stl.difference_quantity)
            FROM public.stocktaking_lines stl
            JOIN public.stocktaking_sessions st ON st.id = stl.session_id
            WHERE stl.company_id = v_company_id AND stl.item_id = mi.id AND st.is_posted
          ), 0)
        ) AS current_stock
      FROM public.material_items mi
      WHERE mi.company_id = v_company_id
    )
    SELECT jsonb_build_object(
      'id', ic.id,
      'identifier', ic.item_code,
      'description', ic.item_name,
      'amount', ic.current_stock
    ) AS item
    FROM item_calc ic
    WHERE ic.current_stock < 0
    LIMIT 20
  ) sub;

  -- 7. Overdue site custodies (> 30 days)
  SELECT count(*),
         COALESCE(jsonb_agg(sub.item), '[]'::jsonb)
  INTO v_c7_count, v_c7_items
  FROM (
    SELECT jsonb_build_object(
      'id', sc.id,
      'identifier', sc.custody_number,
      'date', sc.opened_date,
      'description', COALESCE(p.name, sc.title, 'المهندس / المشرف'),
      'amount', sc.remaining_amount
    ) AS item
    FROM public.site_custodies sc
    LEFT JOIN public.partners p ON p.id = sc.partner_id
    WHERE sc.company_id = v_company_id
      AND sc.status = 'open'
      AND sc.opened_date < (CURRENT_DATE - (COALESCE(sc.max_days, 30) || ' days')::interval)
      AND sc.remaining_amount > 0
    LIMIT 20
  ) sub;

  -- 8. Unclosed cash boxes
  SELECT count(*),
         COALESCE(jsonb_agg(sub.item), '[]'::jsonb)
  INTO v_c8_count, v_c8_items
  FROM (
    WITH cash_accounts AS (
      SELECT a.id AS account_id, a.code, a.name
      FROM public.accounts a
      WHERE a.company_id = v_company_id AND a.code LIKE '122%'
    ),
    recent_tx AS (
      SELECT ca.account_id, ca.code, ca.name, max(jh.entry_date) AS last_tx_date
      FROM cash_accounts ca
      JOIN public.journal_lines jl ON jl.account_id = ca.account_id AND jl.company_id = v_company_id
      JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
      WHERE jh.entry_date >= (CURRENT_DATE - INTERVAL '7 days') AND jh.entry_date < CURRENT_DATE
      GROUP BY ca.account_id, ca.code, ca.name
    )
    SELECT jsonb_build_object(
      'id', rt.account_id,
      'identifier', rt.code,
      'date', rt.last_tx_date,
      'description', rt.name || ' (لم يتم إقفالها لآخر حركة)',
      'amount', 0
    ) AS item
    FROM recent_tx rt
    WHERE NOT EXISTS (
      SELECT 1 FROM public.daily_cash_closings dcc
      WHERE dcc.company_id = v_company_id
        AND dcc.account_id = rt.account_id
        AND dcc.closing_date = rt.last_tx_date
    )
    LIMIT 20
  ) sub;

  -- 9. Unbalanced journal entries
  SELECT count(*),
         COALESCE(jsonb_agg(sub.item), '[]'::jsonb)
  INTO v_c9_count, v_c9_items
  FROM (
    SELECT jsonb_build_object(
      'id', jh.id,
      'identifier', COALESCE(jh.v_type, 'قيد') || ' #' || substring(jh.id::text, 1, 8),
      'date', jh.entry_date,
      'description', COALESCE(jh.description, 'قيد غير متوازن'),
      'amount', ROUND(ABS(COALESCE(sum(jl.debit), 0) - COALESCE(sum(jl.credit), 0)), 2)
    ) AS item
    FROM public.journal_headers jh
    JOIN public.journal_lines jl ON jl.header_id = jh.id
    WHERE jh.company_id = v_company_id
    GROUP BY jh.id, jh.v_type, jh.entry_date, jh.description
    HAVING ABS(COALESCE(sum(jl.debit), 0) - COALESCE(sum(jl.credit), 0)) > 0.001
    LIMIT 20
  ) sub;

  -- Build check objects
  v_critical_count := v_c1_count + v_c2_count + v_c5_count + v_c6_count + v_c9_count;
  v_medium_count := v_c3_count + v_c7_count;
  v_warning_count := v_c4_count + v_c8_count;
  v_total_issues := v_critical_count + v_medium_count + v_warning_count;

  v_checks := jsonb_build_array(
    jsonb_build_object(
      'id', 'zero_amount_journals',
      'title_ar', 'قيود بمبالغ صفرية أو خالية من البنود',
      'severity', 'critical',
      'count', v_c1_count,
      'action_url', '/journal',
      'items', v_c1_items
    ),
    jsonb_build_object(
      'id', 'orphaned_journal_lines',
      'title_ar', 'سطور قيود يتيمة بدون رأس قيد',
      'severity', 'critical',
      'count', v_c2_count,
      'action_url', '/audit',
      'items', v_c2_items
    ),
    jsonb_build_object(
      'id', 'unbalanced_journals',
      'title_ar', 'قيود محاسبية غير متوازنة (المدين لا يساوي الدائن)',
      'severity', 'critical',
      'count', v_c9_count,
      'action_url', '/journal-errors',
      'items', v_c9_items
    ),
    jsonb_build_object(
      'id', 'unposted_subclaims',
      'title_ar', 'مستخلصات مقاولين معتمدة بدون قيد محاسبي',
      'severity', 'critical',
      'count', v_c5_count,
      'action_url', '/subclaims',
      'items', v_c5_items
    ),
    jsonb_build_object(
      'id', 'negative_stock',
      'title_ar', 'أرصدة أصناف مخزنية سالبة',
      'severity', 'critical',
      'count', v_c6_count,
      'action_url', '/inventory',
      'items', v_c6_items
    ),
    jsonb_build_object(
      'id', 'zero_amount_invoices',
      'title_ar', 'فواتير مبيعات بقيمة صفرية أو سالبة',
      'severity', 'medium',
      'count', v_c3_count,
      'action_url', '/invoices',
      'items', v_c3_items
    ),
    jsonb_build_object(
      'id', 'overdue_custodies',
      'title_ar', 'عهد مواقع مفتوحة تجاوزت 30 يوماً دون تسوية',
      'severity', 'medium',
      'count', v_c7_count,
      'action_url', '/custodies',
      'items', v_c7_items
    ),
    jsonb_build_object(
      'id', 'unlinked_receipt_vouchers',
      'title_ar', 'سندات قبض غير مربوطة بفاتورة أو شريك',
      'severity', 'warning',
      'count', v_c4_count,
      'action_url', '/ReceiptVouchers',
      'items', v_c4_items
    ),
    jsonb_build_object(
      'id', 'unclosed_cash_boxes',
      'title_ar', 'خزائن نقدية لم يتم إقفالها لآخر يوم عمل',
      'severity', 'warning',
      'count', v_c8_count,
      'action_url', '/cash-closing',
      'items', v_c8_items
    )
  );

  RETURN jsonb_build_object(
    'total_issues', v_total_issues,
    'critical_count', v_critical_count,
    'medium_count', v_medium_count,
    'warning_count', v_warning_count,
    'scanned_at', now(),
    'checks', v_checks
  );
END;
$$;

-- 5. RPC: get_document_expiry_alerts() (تنبيهات انتهاء المستندات وفك ضمان الأعمال)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_document_expiry_alerts(
  p_days_threshold integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rawasi_private
AS $$
DECLARE
  v_company_id uuid;
  v_docs jsonb := '[]'::jsonb;
  v_retentions jsonb := '[]'::jsonb;
  v_expired_count integer := 0;
  v_critical_count integer := 0;
  v_upcoming_count integer := 0;
  v_retention_due_count integer := 0;
  v_total_docs integer := 0;
BEGIN
  v_company_id := rawasi_private.current_company_id();
  IF NOT (rawasi_private.can_access('audit_logs', 'view') OR rawasi_private.can_access('accounting', 'view') OR rawasi_private.can_access('reports', 'view') OR rawasi_private.is_admin()) THEN
    RAISE EXCEPTION 'غير مصرح بعرض تنبيهات انتهاء المستندات' USING ERRCODE = '42501';
  END IF;

  -- 1. Documents
  SELECT
    COALESCE(jsonb_agg(sub.doc), '[]'::jsonb),
    COALESCE(count(*), 0),
    COALESCE(count(*) FILTER (WHERE sub.status = 'expired'), 0),
    COALESCE(count(*) FILTER (WHERE sub.status = 'critical'), 0),
    COALESCE(count(*) FILTER (WHERE sub.status = 'upcoming'), 0)
  INTO v_docs, v_total_docs, v_expired_count, v_critical_count, v_upcoming_count
  FROM (
    SELECT jsonb_build_object(
      'id', cd.id,
      'document_number', cd.document_number,
      'title', cd.title,
      'doc_type', cd.doc_type,
      'doc_type_ar', CASE cd.doc_type
        WHEN 'worker_iqama' THEN 'إقامة عامل'
        WHEN 'municipality_license' THEN 'رخصة بلدية'
        WHEN 'asset_insurance' THEN 'تأمين معدة / مركبة'
        WHEN 'letter_of_guarantee' THEN 'خطاب ضمان بنكي'
        WHEN 'project_contract' THEN 'عقد مشروع'
        WHEN 'commercial_registration' THEN 'سجل تجاري'
        WHEN 'tax_certificate' THEN 'شهادة الزكاة والضريبة'
        ELSE 'أخرى'
      END,
      'issue_date', cd.issue_date,
      'expiry_date', cd.expiry_date,
      'days_left', (cd.expiry_date - CURRENT_DATE),
      'status', CASE
        WHEN cd.is_renewed THEN 'renewed'
        WHEN cd.expiry_date < CURRENT_DATE THEN 'expired'
        WHEN (cd.expiry_date - CURRENT_DATE) <= 10 THEN 'critical'
        WHEN (cd.expiry_date - CURRENT_DATE) <= COALESCE(cd.alert_days_before, p_days_threshold) THEN 'upcoming'
        ELSE 'safe'
      END,
      'alert_days_before', cd.alert_days_before,
      'is_renewed', cd.is_renewed,
      'renewal_date', cd.renewal_date,
      'partner_id', cd.partner_id,
      'partner_name', p.name,
      'project_id', cd.project_id,
      'project_name', pr."Property",
      'asset_id', cd.asset_id,
      'asset_name', fa.name,
      'attachment_url', cd.attachment_url,
      'notes', cd.notes
    ) AS doc,
    CASE
      WHEN cd.is_renewed THEN 'renewed'
      WHEN cd.expiry_date < CURRENT_DATE THEN 'expired'
      WHEN (cd.expiry_date - CURRENT_DATE) <= 10 THEN 'critical'
      WHEN (cd.expiry_date - CURRENT_DATE) <= COALESCE(cd.alert_days_before, p_days_threshold) THEN 'upcoming'
      ELSE 'safe'
    END AS status
    FROM public.company_documents cd
    LEFT JOIN public.partners p ON p.id = cd.partner_id
    LEFT JOIN public.projects pr ON pr.id = cd.project_id
    LEFT JOIN public.fixed_assets fa ON fa.id = cd.asset_id
    WHERE cd.company_id = v_company_id
    ORDER BY cd.expiry_date ASC
  ) sub;

  -- 2. Project Retention Warranty Releases
  WITH proj_retentions AS (
    SELECT pr.id AS project_id,
           pr."Property" AS project_name,
           pr.client_name,
           pr.handover_date,
           COALESCE(pr.warranty_period_months, 12) AS warranty_months,
           COALESCE(
             pr.retention_release_date,
             (COALESCE(pr.handover_date, pr.actual_completion_date, CURRENT_DATE) + (COALESCE(pr.warranty_period_months, 12) || ' months')::interval)::date
           ) AS release_date,
           COALESCE((
             SELECT sum(inv.guarantee_amount)
             FROM public.invoices inv
             WHERE pr.id = ANY(inv.project_ids) AND inv.company_id = v_company_id AND inv.retention_released = false
           ), 0) AS client_retention_unreleased,
           COALESCE((
             SELECT sum(sc.retention_amount)
             FROM public.sub_claims sc
             WHERE ((sc.project_id = pr.id) OR (sc.project_ids IS NOT NULL AND pr.id = ANY(sc.project_ids))) AND sc.company_id = v_company_id AND sc.retention_released = false
           ), 0) AS sub_retention_unreleased
    FROM public.projects pr
    WHERE pr.company_id = v_company_id
  )
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'project_id', r.project_id,
      'project_name', r.project_name,
      'client_name', r.client_name,
      'handover_date', r.handover_date,
      'warranty_months', r.warranty_months,
      'release_date', r.release_date,
      'days_left', (r.release_date - CURRENT_DATE),
      'status', CASE
        WHEN r.release_date < CURRENT_DATE THEN 'overdue'
        WHEN (r.release_date - CURRENT_DATE) <= 30 THEN 'due_soon'
        ELSE 'active'
      END,
      'client_retention_unreleased', r.client_retention_unreleased,
      'sub_retention_unreleased', r.sub_retention_unreleased,
      'total_retention_unreleased', (r.client_retention_unreleased + r.sub_retention_unreleased)
    ) ORDER BY r.release_date ASC), '[]'::jsonb),
    COALESCE(count(*) FILTER (WHERE r.release_date <= (CURRENT_DATE + INTERVAL '30 days')), 0)
  INTO v_retentions, v_retention_due_count
  FROM proj_retentions r
  WHERE (r.client_retention_unreleased > 0 OR r.sub_retention_unreleased > 0);

  RETURN jsonb_build_object(
    'summary', jsonb_build_object(
      'total_documents', v_total_docs,
      'expired_count', v_expired_count,
      'critical_count', v_critical_count,
      'upcoming_count', v_upcoming_count,
      'retention_due_count', v_retention_due_count
    ),
    'documents', v_docs,
    'retention_guarantees', v_retentions
  );
END;
$$;

-- 6. RPC: Document Management (upsert and mark renewed)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_company_document(
  p_id uuid,
  p_document_number text,
  p_title text,
  p_doc_type text,
  p_expiry_date date,
  p_issue_date date DEFAULT NULL,
  p_alert_days_before integer DEFAULT 30,
  p_partner_id uuid DEFAULT NULL,
  p_project_id uuid DEFAULT NULL,
  p_asset_id uuid DEFAULT NULL,
  p_attachment_url text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rawasi_private
AS $$
DECLARE
  v_company_id uuid;
  v_res public.company_documents%ROWTYPE;
BEGIN
  v_company_id := rawasi_private.current_company_id();
  IF NOT (rawasi_private.can_access('audit_logs', 'create') OR rawasi_private.can_access('accounting', 'create') OR rawasi_private.can_access('reports', 'create') OR rawasi_private.is_admin()) THEN
    RAISE EXCEPTION 'غير مصرح بإضافة أو تعديل وثائق الشركة' USING ERRCODE = '42501';
  END IF;

  IF p_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.company_documents WHERE id = p_id AND company_id = v_company_id) THEN
    UPDATE public.company_documents
    SET document_number = p_document_number,
        title = p_title,
        doc_type = p_doc_type,
        issue_date = p_issue_date,
        expiry_date = p_expiry_date,
        alert_days_before = COALESCE(p_alert_days_before, 30),
        partner_id = p_partner_id,
        project_id = p_project_id,
        asset_id = p_asset_id,
        attachment_url = p_attachment_url,
        notes = p_notes,
        is_renewed = false,
        updated_at = now()
    WHERE id = p_id AND company_id = v_company_id
    RETURNING * INTO v_res;
  ELSE
    INSERT INTO public.company_documents (
      company_id, document_number, title, doc_type, issue_date, expiry_date,
      alert_days_before, partner_id, project_id, asset_id, attachment_url, notes
    ) VALUES (
      v_company_id, p_document_number, p_title, p_doc_type, p_issue_date, p_expiry_date,
      COALESCE(p_alert_days_before, 30), p_partner_id, p_project_id, p_asset_id, p_attachment_url, p_notes
    ) RETURNING * INTO v_res;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'document', row_to_json(v_res)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_company_document_renewed(
  p_document_id uuid,
  p_new_expiry_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rawasi_private
AS $$
DECLARE
  v_company_id uuid;
  v_doc public.company_documents%ROWTYPE;
BEGIN
  v_company_id := rawasi_private.current_company_id();
  IF NOT (rawasi_private.can_access('audit_logs', 'edit') OR rawasi_private.can_access('accounting', 'edit') OR rawasi_private.can_access('reports', 'edit') OR rawasi_private.is_admin()) THEN
    RAISE EXCEPTION 'غير مصرح بتحديث حالة المستند' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_doc FROM public.company_documents
  WHERE id = p_document_id AND company_id = v_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'المستند غير موجود في الشركة الحالية' USING ERRCODE = 'P0002';
  END IF;

  IF p_new_expiry_date IS NOT NULL THEN
    UPDATE public.company_documents
    SET expiry_date = p_new_expiry_date,
        is_renewed = false,
        renewal_date = CURRENT_DATE,
        updated_at = now()
    WHERE id = p_document_id AND company_id = v_company_id
    RETURNING * INTO v_doc;
  ELSE
    UPDATE public.company_documents
    SET is_renewed = true,
        renewal_date = CURRENT_DATE,
        updated_at = now()
    WHERE id = p_document_id AND company_id = v_company_id
    RETURNING * INTO v_doc;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'document_id', v_doc.id,
    'is_renewed', v_doc.is_renewed,
    'expiry_date', v_doc.expiry_date
  );
END;
$$;

-- 7. Trigger: trg_notify_subclaim_created (إشعار لحظي عند تسجيل مستخلص مقاول جديد)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rawasi_private.notify_subclaim_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rawasi_private
AS $$
DECLARE
  v_user_id uuid;
  v_claim_no text;
  v_amount numeric;
  v_partner_name text;
  v_dedup text;
BEGIN
  v_claim_no := COALESCE(NEW.claim_number, 'غير محدد');
  v_amount := COALESCE(NEW.net_amount, NEW.total_amount, 0);

  IF NEW.contractor_id IS NOT NULL THEN
    SELECT name INTO v_partner_name FROM public.partners WHERE id = NEW.contractor_id;
  END IF;
  v_dedup := 'subclaim_created:' || NEW.id;

  FOR v_user_id IN
    SELECT uc.user_id FROM public.user_companies uc
    WHERE uc.company_id = NEW.company_id AND uc.is_active = true
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.company_id = NEW.company_id AND n.user_id = v_user_id AND n.dedup_key = v_dedup
    ) THEN
      INSERT INTO public.notifications (
        company_id, user_id, type, title, message, content, related_id, dedup_key
      ) VALUES (
        NEW.company_id,
        v_user_id,
        'subclaim_new',
        'مستخلص مقاول جديد: ' || v_claim_no,
        'تم تسجيل مستخلص جديد للمقاول ' || COALESCE(v_partner_name, '') || ' بقيمة صافية ' || v_amount || ' ر.س.',
        'مستخلص مقاول جديد قيد التدقيق والمراجعة.',
        NEW.id,
        v_dedup
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_subclaim_created ON public.sub_claims;
CREATE TRIGGER trg_notify_subclaim_created
  AFTER INSERT ON public.sub_claims
  FOR EACH ROW
  EXECUTE FUNCTION rawasi_private.notify_subclaim_created();

-- 8. Daily Background Scan Engine (الفحص اليومي الشامل بدون تكرار)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rawasi_private.run_daily_health_and_expiry_scans()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rawasi_private
AS $$
DECLARE
  v_comp RECORD;
  v_user_id uuid;
  v_doc RECORD;
  v_inv RECORD;
  v_cust RECORD;
  v_proj RECORD;
  v_count integer := 0;
  v_dedup text;
  v_days_left integer;
BEGIN
  -- Loop over each active company
  FOR v_comp IN SELECT id, code, legal_name FROM public.companies WHERE is_active = true LOOP

    -- A. Document Expirations
    FOR v_doc IN
      SELECT cd.id, cd.title, cd.document_number, cd.expiry_date, cd.alert_days_before
      FROM public.company_documents cd
      WHERE cd.company_id = v_comp.id
        AND NOT cd.is_renewed
        AND cd.expiry_date <= (CURRENT_DATE + (COALESCE(cd.alert_days_before, 30) || ' days')::interval)
    LOOP
      v_days_left := (v_doc.expiry_date - CURRENT_DATE);
      v_dedup := 'doc_exp:' || v_doc.id || ':' || v_doc.expiry_date;

      FOR v_user_id IN
        SELECT uc.user_id FROM public.user_companies uc
        WHERE uc.company_id = v_comp.id AND uc.is_active = true
      LOOP
        IF NOT EXISTS (
          SELECT 1 FROM public.notifications n
          WHERE n.company_id = v_comp.id AND n.user_id = v_user_id AND n.dedup_key = v_dedup
        ) THEN
          INSERT INTO public.notifications (
            company_id, user_id, type, title, message, content, related_id, dedup_key
          ) VALUES (
            v_comp.id,
            v_user_id,
            'document_expiry',
            'تنبيه انتهاء مستند: ' || v_doc.title,
            'المستند رقم (' || v_doc.document_number || ') ' ||
              CASE WHEN v_days_left < 0 THEN 'منتهي الصلاحية منذ ' || ABS(v_days_left) || ' يوم.'
                   WHEN v_days_left = 0 THEN 'ينتهي اليوم!'
                   ELSE 'ينتهي خلال ' || v_days_left || ' يوم.' END,
            'وثيقة ومستند شركة بحاجة إلى تجديد عاجل.',
            v_doc.id,
            v_dedup
          );
          v_count := v_count + 1;
        END IF;
      END LOOP;
    END LOOP;

    -- B. Overdue Invoices
    FOR v_inv IN
      SELECT inv.id, inv.invoice_number, inv.due_date, inv.client_name,
             (inv.total_amount - COALESCE(inv.paid_amount, 0)) AS remaining
      FROM public.invoices inv
      WHERE inv.company_id = v_comp.id
        AND inv.due_date < CURRENT_DATE
        AND inv.status NOT IN ('paid', 'مدفوعة')
        AND (inv.total_amount - COALESCE(inv.paid_amount, 0)) > 0
    LOOP
      v_dedup := 'inv_overdue:' || v_inv.id || ':' || v_inv.due_date;
      FOR v_user_id IN
        SELECT uc.user_id FROM public.user_companies uc
        WHERE uc.company_id = v_comp.id AND uc.is_active = true
      LOOP
        IF NOT EXISTS (
          SELECT 1 FROM public.notifications n
          WHERE n.company_id = v_comp.id AND n.user_id = v_user_id AND n.dedup_key = v_dedup
        ) THEN
          INSERT INTO public.notifications (
            company_id, user_id, type, title, message, content, related_id, dedup_key
          ) VALUES (
            v_comp.id,
            v_user_id,
            'invoice_overdue',
            'فاتورة مبيعات متأخرة: ' || v_inv.invoice_number,
            'الفاتورة رقم (' || v_inv.invoice_number || ') للعميل ' || COALESCE(v_inv.client_name, 'العميل') ||
              ' بقيمة متبقية ' || v_inv.remaining || ' ر.س تجاوزت موعد استحقاقها (' || v_inv.due_date || ').',
            'مطالبة مالية متأخرة التحصيل تتطلب المتابعة مع العميل.',
            v_inv.id,
            v_dedup
          );
          v_count := v_count + 1;
        END IF;
      END LOOP;
    END LOOP;

    -- C. Overdue Site Custodies
    FOR v_cust IN
      SELECT sc.id, sc.custody_number, COALESCE(p.name, sc.title, 'الموظف') AS custodian_name, sc.opened_date, sc.remaining_amount
      FROM public.site_custodies sc
      LEFT JOIN public.partners p ON p.id = sc.partner_id
      WHERE sc.company_id = v_comp.id
        AND sc.status = 'open'
        AND sc.opened_date < (CURRENT_DATE - (COALESCE(sc.max_days, 30) || ' days')::interval)
        AND sc.remaining_amount > 0
    LOOP
      v_dedup := 'custody_overdue:' || v_cust.id;
      FOR v_user_id IN
        SELECT uc.user_id FROM public.user_companies uc
        WHERE uc.company_id = v_comp.id AND uc.is_active = true
      LOOP
        IF NOT EXISTS (
          SELECT 1 FROM public.notifications n
          WHERE n.company_id = v_comp.id AND n.user_id = v_user_id AND n.dedup_key = v_dedup
        ) THEN
          INSERT INTO public.notifications (
            company_id, user_id, type, title, message, content, related_id, dedup_key
          ) VALUES (
            v_comp.id,
            v_user_id,
            'custody_overdue',
            'عهدة موقع متأخرة: ' || v_cust.custody_number,
            'عهدة ' || v_cust.custodian_name || ' برصيد ' || v_cust.remaining_amount ||
              ' ر.س مفتوحة منذ تاريخ ' || v_cust.opened_date || ' (أكثر من 30 يوماً).',
            'عهدة موقع مفتوحة تتطلب التسوية أو الاسترداد.',
            v_cust.id,
            v_dedup
          );
          v_count := v_count + 1;
        END IF;
      END LOOP;
    END LOOP;

    -- D. Retention Warranty Releases Due
    FOR v_proj IN
      WITH r_summary AS (
        SELECT pr.id, pr."Property" AS project_name,
               COALESCE(
                 pr.retention_release_date,
                 (COALESCE(pr.handover_date, pr.actual_completion_date, CURRENT_DATE) + (COALESCE(pr.warranty_period_months, 12) || ' months')::interval)::date
               ) AS release_date,
               (
                 COALESCE((SELECT sum(inv.guarantee_amount) FROM public.invoices inv WHERE pr.id = ANY(inv.project_ids) AND inv.company_id = v_comp.id AND inv.retention_released = false), 0)
                 +
                 COALESCE((SELECT sum(sc.retention_amount) FROM public.sub_claims sc WHERE ((sc.project_id = pr.id) OR (sc.project_ids IS NOT NULL AND pr.id = ANY(sc.project_ids))) AND sc.company_id = v_comp.id AND sc.retention_released = false), 0)
               ) AS total_retention
        FROM public.projects pr
        WHERE pr.company_id = v_comp.id
      )
      SELECT * FROM r_summary
      WHERE total_retention > 0 AND release_date <= (CURRENT_DATE + INTERVAL '30 days')
    LOOP
      v_dedup := 'retention_due:' || v_proj.id || ':' || v_proj.release_date;
      FOR v_user_id IN
        SELECT uc.user_id FROM public.user_companies uc
        WHERE uc.company_id = v_comp.id AND uc.is_active = true
      LOOP
        IF NOT EXISTS (
          SELECT 1 FROM public.notifications n
          WHERE n.company_id = v_comp.id AND n.user_id = v_user_id AND n.dedup_key = v_dedup
        ) THEN
          INSERT INTO public.notifications (
            company_id, user_id, type, title, message, content, related_id, dedup_key
          ) VALUES (
            v_comp.id,
            v_user_id,
            'retention_due',
            'استحقاق فك ضمان أعمال: ' || v_proj.project_name,
            'مشروع ' || v_proj.project_name || ' اقترب موعد فك ضمان الأعمال (' || v_proj.release_date || ') بإجمالي محجوز ' || v_proj.total_retention || ' ر.س.',
            'ضمان أعمال مستحق الفك في الموعد المحدد.',
            v_proj.id,
            v_dedup
          );
          v_count := v_count + 1;
        END IF;
      END LOOP;
    END LOOP;

  END LOOP;

  RETURN v_count;
END;
$$;

-- Public wrapper to trigger scan manually from frontend
CREATE OR REPLACE FUNCTION public.run_daily_health_and_expiry_scans()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rawasi_private
AS $$
BEGIN
  IF NOT (rawasi_private.can_access('audit_logs', 'view') OR rawasi_private.can_access('accounting', 'view') OR rawasi_private.is_admin()) THEN
    RAISE EXCEPTION 'غير مصرح بتشغيل الفحص التلقائي' USING ERRCODE = '42501';
  END IF;

  RETURN rawasi_private.run_daily_health_and_expiry_scans();
END;
$$;

-- 9. pg_cron Schedule (إذا كان الملحق مفعلاً)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('daily_health_and_expiry_scan')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily_health_and_expiry_scan');

      PERFORM cron.schedule(
        'daily_health_and_expiry_scan',
        '0 6 * * *',
        'SELECT rawasi_private.run_daily_health_and_expiry_scans();'
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'pg_cron schedule notice: %', SQLERRM;
    END;
  END IF;
END;
$$;

-- 10. Permissions & Grants
-- -----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_documents TO authenticated;
GRANT ALL ON public.company_documents TO service_role;
GRANT EXECUTE ON FUNCTION public.get_system_health_radar() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_document_expiry_alerts(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_company_document(uuid, text, text, text, date, date, integer, uuid, uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_company_document_renewed(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_daily_health_and_expiry_scans() TO authenticated;
GRANT EXECUTE ON FUNCTION rawasi_private.run_daily_health_and_expiry_scans() TO authenticated;



-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- FILE: 20261105170012_financial_statements_and_project_profitability.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- =============================================================================
-- Migration: 20261105170012_financial_statements_and_project_profitability.sql
-- Description: Phase 7: القوائم المالية بفترة، وربحية المشاريع، ومؤشرات الأداء المالي
-- =============================================================================

-- 1. RPC: get_income_statement_by_period (قائمة الدخل الدقيقة بفترة مع مقارنة الفترة السابقة)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_income_statement_by_period(
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_compare_prev boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rawasi_private
AS $$
DECLARE
  v_company_id uuid;
  v_start date;
  v_end date;
  v_duration integer;
  v_prev_start date;
  v_prev_end date;

  -- Current Period Numbers
  v_revenues jsonb := '[]'::jsonb;
  v_project_costs jsonb := '[]'::jsonb;
  v_admin_expenses jsonb := '[]'::jsonb;

  v_total_revenue numeric := 0;
  v_total_project_costs numeric := 0;
  v_gross_profit numeric := 0;
  v_gross_margin_pct numeric := 0;
  v_total_admin_expenses numeric := 0;
  v_total_expenses numeric := 0;
  v_net_income numeric := 0;
  v_net_margin_pct numeric := 0;

  -- Previous Period Numbers
  v_prev_revenue numeric := 0;
  v_prev_project_costs numeric := 0;
  v_prev_gross_profit numeric := 0;
  v_prev_admin_expenses numeric := 0;
  v_prev_net_income numeric := 0;
BEGIN
  v_company_id := rawasi_private.current_company_id();
  IF NOT (rawasi_private.can_access('reports', 'view') OR rawasi_private.can_access('accounting', 'view') OR rawasi_private.is_admin()) THEN
    RAISE EXCEPTION 'غير مصرح بعرض القوائم المالية والتقارير' USING ERRCODE = '42501';
  END IF;

  v_start := COALESCE(p_start_date, date_trunc('year', CURRENT_DATE)::date);
  v_end := COALESCE(p_end_date, CURRENT_DATE);

  IF v_start > v_end THEN
    RAISE EXCEPTION 'تاريخ بداية الفترة يجب أن يكون قبل أو يساوي تاريخ النهاية' USING ERRCODE = '22023';
  END IF;

  -- 1. Revenues (4%): Credit - Debit
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'account_id', sub.account_id,
        'code', sub.code,
        'name', sub.name,
        'balance', sub.balance
      ) ORDER BY sub.code
    ), '[]'::jsonb),
    COALESCE(sum(sub.balance), 0)
  INTO v_revenues, v_total_revenue
  FROM (
    SELECT a.id AS account_id, a.code, a.name,
           ROUND(COALESCE(sum(jl.credit - jl.debit), 0), 2) AS balance
    FROM public.accounts a
    JOIN public.journal_lines jl ON jl.account_id = a.id AND jl.company_id = v_company_id
    JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
    WHERE a.company_id = v_company_id
      AND a.code LIKE '4%'
      AND jh.status IN ('posted', 'مرحل', 'معتمد')
      AND jh.entry_date BETWEEN v_start AND v_end
    GROUP BY a.id, a.code, a.name
    HAVING ABS(COALESCE(sum(jl.credit - jl.debit), 0)) > 0.001
  ) sub;

  -- 2. Direct Project Costs (51%): Debit - Credit
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'account_id', sub.account_id,
        'code', sub.code,
        'name', sub.name,
        'cost_category', CASE
          WHEN sub.code LIKE '511%' THEN 'materials'
          WHEN sub.code LIKE '512%' THEN 'labor'
          WHEN sub.code LIKE '513%' THEN 'subcontractors'
          WHEN sub.code LIKE '514%' THEN 'equipment'
          WHEN sub.code LIKE '515%' THEN 'site_expenses'
          WHEN sub.code LIKE '516%' THEN 'depreciation'
          WHEN sub.code LIKE '517%' THEN 'logistics'
          ELSE 'other_operations'
        END,
        'balance', sub.balance
      ) ORDER BY sub.code
    ), '[]'::jsonb),
    COALESCE(sum(sub.balance), 0)
  INTO v_project_costs, v_total_project_costs
  FROM (
    SELECT a.id AS account_id, a.code, a.name,
           ROUND(COALESCE(sum(jl.debit - jl.credit), 0), 2) AS balance
    FROM public.accounts a
    JOIN public.journal_lines jl ON jl.account_id = a.id AND jl.company_id = v_company_id
    JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
    WHERE a.company_id = v_company_id
      AND a.code LIKE '51%'
      AND jh.status IN ('posted', 'مرحل', 'معتمد')
      AND jh.entry_date BETWEEN v_start AND v_end
    GROUP BY a.id, a.code, a.name
    HAVING ABS(COALESCE(sum(jl.debit - jl.credit), 0)) > 0.001
  ) sub;

  -- 3. General & Administrative Expenses (52% and any other 5% not under 51%): Debit - Credit
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'account_id', sub.account_id,
        'code', sub.code,
        'name', sub.name,
        'balance', sub.balance
      ) ORDER BY sub.code
    ), '[]'::jsonb),
    COALESCE(sum(sub.balance), 0)
  INTO v_admin_expenses, v_total_admin_expenses
  FROM (
    SELECT a.id AS account_id, a.code, a.name,
           ROUND(COALESCE(sum(jl.debit - jl.credit), 0), 2) AS balance
    FROM public.accounts a
    JOIN public.journal_lines jl ON jl.account_id = a.id AND jl.company_id = v_company_id
    JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
    WHERE a.company_id = v_company_id
      AND a.code LIKE '5%'
      AND a.code NOT LIKE '51%'
      AND jh.status IN ('posted', 'مرحل', 'معتمد')
      AND jh.entry_date BETWEEN v_start AND v_end
    GROUP BY a.id, a.code, a.name
    HAVING ABS(COALESCE(sum(jl.debit - jl.credit), 0)) > 0.001
  ) sub;

  -- Totals and Margins
  v_gross_profit := v_total_revenue - v_total_project_costs;
  IF v_total_revenue > 0 THEN
    v_gross_margin_pct := ROUND((v_gross_profit / v_total_revenue) * 100, 2);
  ELSE
    v_gross_margin_pct := 0;
  END IF;

  v_total_expenses := v_total_project_costs + v_total_admin_expenses;
  v_net_income := v_total_revenue - v_total_expenses;
  IF v_total_revenue > 0 THEN
    v_net_margin_pct := ROUND((v_net_income / v_total_revenue) * 100, 2);
  ELSE
    v_net_margin_pct := 0;
  END IF;

  -- Previous Period Calculation
  IF p_compare_prev THEN
    v_duration := (v_end - v_start + 1);
    v_prev_start := (v_start - (v_duration || ' days')::interval)::date;
    v_prev_end := (v_start - INTERVAL '1 day')::date;

    SELECT
      COALESCE(sum(CASE WHEN a.code LIKE '4%' THEN (jl.credit - jl.debit) ELSE 0 END), 0),
      COALESCE(sum(CASE WHEN a.code LIKE '51%' THEN (jl.debit - jl.credit) ELSE 0 END), 0),
      COALESCE(sum(CASE WHEN a.code LIKE '5%' AND a.code NOT LIKE '51%' THEN (jl.debit - jl.credit) ELSE 0 END), 0)
    INTO v_prev_revenue, v_prev_project_costs, v_prev_admin_expenses
    FROM public.accounts a
    JOIN public.journal_lines jl ON jl.account_id = a.id AND jl.company_id = v_company_id
    JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
    WHERE a.company_id = v_company_id
      AND (a.code LIKE '4%' OR a.code LIKE '5%')
      AND jh.status IN ('posted', 'مرحل', 'معتمد')
      AND jh.entry_date BETWEEN v_prev_start AND v_prev_end;

    v_prev_gross_profit := v_prev_revenue - v_prev_project_costs;
    v_prev_net_income := v_prev_revenue - (v_prev_project_costs + v_prev_admin_expenses);
  END IF;

  RETURN jsonb_build_object(
    'period', jsonb_build_object(
      'start_date', v_start,
      'end_date', v_end,
      'duration_days', (v_end - v_start + 1)
    ),
    'summary', jsonb_build_object(
      'total_revenue', v_total_revenue,
      'total_project_costs', v_total_project_costs,
      'gross_profit', v_gross_profit,
      'gross_margin_pct', v_gross_margin_pct,
      'total_admin_expenses', v_total_admin_expenses,
      'total_expenses', v_total_expenses,
      'net_income', v_net_income,
      'net_margin_pct', v_net_margin_pct
    ),
    'sections', jsonb_build_object(
      'revenues', v_revenues,
      'project_costs', v_project_costs,
      'admin_expenses', v_admin_expenses
    ),
    'previous_period', CASE WHEN p_compare_prev THEN jsonb_build_object(
      'start_date', v_prev_start,
      'end_date', v_prev_end,
      'total_revenue', v_prev_revenue,
      'total_project_costs', v_prev_project_costs,
      'gross_profit', v_prev_gross_profit,
      'total_admin_expenses', v_prev_admin_expenses,
      'net_income', v_prev_net_income,
      'revenue_change', (v_total_revenue - v_prev_revenue),
      'revenue_change_pct', CASE WHEN v_prev_revenue <> 0 THEN ROUND(((v_total_revenue - v_prev_revenue) / ABS(v_prev_revenue)) * 100, 2) ELSE 0 END,
      'net_income_change', (v_net_income - v_prev_net_income),
      'net_income_change_pct', CASE WHEN v_prev_net_income <> 0 THEN ROUND(((v_net_income - v_prev_net_income) / ABS(v_prev_net_income)) * 100, 2) ELSE 0 END
    ) ELSE NULL END
  );
END;
$$;

-- 2. RPC: get_balance_sheet_as_of (المركز المالي في تاريخ معين مع توازن ذهبي متكامل)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_balance_sheet_as_of(
  p_as_of_date date DEFAULT NULL,
  p_compare_prev boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rawasi_private
AS $$
DECLARE
  v_company_id uuid;
  v_as_of date;
  v_year_start date;
  v_prev_date date;

  -- Assets
  v_current_assets jsonb := '[]'::jsonb;
  v_fixed_assets jsonb := '[]'::jsonb;
  v_other_assets jsonb := '[]'::jsonb;
  v_total_current_assets numeric := 0;
  v_total_fixed_assets numeric := 0;
  v_total_other_assets numeric := 0;
  v_total_assets numeric := 0;

  -- Liabilities
  v_current_liabilities jsonb := '[]'::jsonb;
  v_longterm_liabilities jsonb := '[]'::jsonb;
  v_total_current_liabilities numeric := 0;
  v_total_longterm_liabilities numeric := 0;
  v_total_liabilities numeric := 0;

  -- Equity
  v_equity jsonb := '[]'::jsonb;
  v_total_equity_historical numeric := 0;

  -- P&L / Net Income for Balance Equation
  v_prior_years_pnl numeric := 0;
  v_current_period_revenue numeric := 0;
  v_current_period_expense numeric := 0;
  v_current_period_net_income numeric := 0;
  v_total_equity_with_income numeric := 0;

  -- Balance check
  v_total_liabilities_and_equity numeric := 0;
  v_difference numeric := 0;
  v_is_balanced boolean := false;

  -- Prev Year-end comparison
  v_prev_total_assets numeric := 0;
  v_prev_total_liabilities numeric := 0;
  v_prev_total_equity numeric := 0;
BEGIN
  v_company_id := rawasi_private.current_company_id();
  IF NOT (rawasi_private.can_access('reports', 'view') OR rawasi_private.can_access('accounting', 'view') OR rawasi_private.is_admin()) THEN
    RAISE EXCEPTION 'غير مصرح بعرض القوائم المالية والتقارير' USING ERRCODE = '42501';
  END IF;

  v_as_of := COALESCE(p_as_of_date, CURRENT_DATE);
  v_year_start := date_trunc('year', v_as_of)::date;

  -- A. Assets (1%)
  -- ---------------------------------------------------------------------------
  -- Current Assets (12%): Debit - Credit
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'account_id', sub.account_id,
        'code', sub.code,
        'name', sub.name,
        'subgroup', CASE
          WHEN sub.code LIKE '122%' OR sub.code LIKE '129%' THEN 'cash_and_banks'
          WHEN sub.code LIKE '124%' THEN 'accounts_receivable'
          WHEN sub.code LIKE '125%' THEN 'custodies_and_advances'
          WHEN sub.code LIKE '126%' THEN 'inventory'
          ELSE 'other_current_assets'
        END,
        'balance', sub.balance
      ) ORDER BY sub.code
    ), '[]'::jsonb),
    COALESCE(sum(sub.balance), 0)
  INTO v_current_assets, v_total_current_assets
  FROM (
    SELECT a.id AS account_id, a.code, a.name,
           ROUND(COALESCE(sum(jl.debit - jl.credit), 0), 2) AS balance
    FROM public.accounts a
    JOIN public.journal_lines jl ON jl.account_id = a.id AND jl.company_id = v_company_id
    JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
    WHERE a.company_id = v_company_id
      AND a.code LIKE '12%'
      AND jh.status IN ('posted', 'مرحل', 'معتمد')
      AND jh.entry_date <= v_as_of
    GROUP BY a.id, a.code, a.name
    HAVING ABS(COALESCE(sum(jl.debit - jl.credit), 0)) > 0.001
  ) sub;

  -- Fixed Assets (11%): Cost (111..115) minus Accum. Deprec (119): Debit - Credit
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'account_id', sub.account_id,
        'code', sub.code,
        'name', sub.name,
        'is_contra', (sub.code LIKE '119%'),
        'balance', sub.balance
      ) ORDER BY sub.code
    ), '[]'::jsonb),
    COALESCE(sum(sub.balance), 0)
  INTO v_fixed_assets, v_total_fixed_assets
  FROM (
    SELECT a.id AS account_id, a.code, a.name,
           ROUND(COALESCE(sum(jl.debit - jl.credit), 0), 2) AS balance
    FROM public.accounts a
    JOIN public.journal_lines jl ON jl.account_id = a.id AND jl.company_id = v_company_id
    JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
    WHERE a.company_id = v_company_id
      AND a.code LIKE '11%'
      AND jh.status IN ('posted', 'مرحل', 'معتمد')
      AND jh.entry_date <= v_as_of
    GROUP BY a.id, a.code, a.name
    HAVING ABS(COALESCE(sum(jl.debit - jl.credit), 0)) > 0.001
  ) sub;

  -- Other Assets (any 1% not under 11% or 12%)
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'account_id', sub.account_id,
        'code', sub.code,
        'name', sub.name,
        'balance', sub.balance
      ) ORDER BY sub.code
    ), '[]'::jsonb),
    COALESCE(sum(sub.balance), 0)
  INTO v_other_assets, v_total_other_assets
  FROM (
    SELECT a.id AS account_id, a.code, a.name,
           ROUND(COALESCE(sum(jl.debit - jl.credit), 0), 2) AS balance
    FROM public.accounts a
    JOIN public.journal_lines jl ON jl.account_id = a.id AND jl.company_id = v_company_id
    JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
    WHERE a.company_id = v_company_id
      AND a.code LIKE '1%'
      AND a.code NOT LIKE '11%'
      AND a.code NOT LIKE '12%'
      AND jh.status IN ('posted', 'مرحل', 'معتمد')
      AND jh.entry_date <= v_as_of
    GROUP BY a.id, a.code, a.name
    HAVING ABS(COALESCE(sum(jl.debit - jl.credit), 0)) > 0.001
  ) sub;

  v_total_assets := v_total_current_assets + v_total_fixed_assets + v_total_other_assets;

  -- B. Liabilities (21% and 22%): Credit - Debit
  -- ---------------------------------------------------------------------------
  -- Current Liabilities (21%): Credit - Debit
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'account_id', sub.account_id,
        'code', sub.code,
        'name', sub.name,
        'subgroup', CASE
          WHEN sub.code LIKE '211%' THEN 'suppliers'
          WHEN sub.code LIKE '212%' THEN 'subcontractors_payable'
          WHEN sub.code LIKE '213%' THEN 'retention_guarantees_held'
          WHEN sub.code LIKE '215%' THEN 'vat_payable'
          WHEN sub.code LIKE '216%' THEN 'accrued_payroll'
          WHEN sub.code LIKE '217%' THEN 'customer_material_settlement'
          ELSE 'other_current_liabilities'
        END,
        'balance', sub.balance
      ) ORDER BY sub.code
    ), '[]'::jsonb),
    COALESCE(sum(sub.balance), 0)
  INTO v_current_liabilities, v_total_current_liabilities
  FROM (
    SELECT a.id AS account_id, a.code, a.name,
           ROUND(COALESCE(sum(jl.credit - jl.debit), 0), 2) AS balance
    FROM public.accounts a
    JOIN public.journal_lines jl ON jl.account_id = a.id AND jl.company_id = v_company_id
    JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
    WHERE a.company_id = v_company_id
      AND a.code LIKE '21%'
      AND jh.status IN ('posted', 'مرحل', 'معتمد')
      AND jh.entry_date <= v_as_of
    GROUP BY a.id, a.code, a.name
    HAVING ABS(COALESCE(sum(jl.credit - jl.debit), 0)) > 0.001
  ) sub;

  -- Long Term / Non-Current Liabilities (22%): Credit - Debit
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'account_id', sub.account_id,
        'code', sub.code,
        'name', sub.name,
        'balance', sub.balance
      ) ORDER BY sub.code
    ), '[]'::jsonb),
    COALESCE(sum(sub.balance), 0)
  INTO v_longterm_liabilities, v_total_longterm_liabilities
  FROM (
    SELECT a.id AS account_id, a.code, a.name,
           ROUND(COALESCE(sum(jl.credit - jl.debit), 0), 2) AS balance
    FROM public.accounts a
    JOIN public.journal_lines jl ON jl.account_id = a.id AND jl.company_id = v_company_id
    JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
    WHERE a.company_id = v_company_id
      AND a.code LIKE '22%'
      AND jh.status IN ('posted', 'مرحل', 'معتمد')
      AND jh.entry_date <= v_as_of
    GROUP BY a.id, a.code, a.name
    HAVING ABS(COALESCE(sum(jl.credit - jl.debit), 0)) > 0.001
  ) sub;

  v_total_liabilities := v_total_current_liabilities + v_total_longterm_liabilities;

  -- C. Equity (23%): Credit - Debit
  -- ---------------------------------------------------------------------------
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'account_id', sub.account_id,
        'code', sub.code,
        'name', sub.name,
        'balance', sub.balance
      ) ORDER BY sub.code
    ), '[]'::jsonb),
    COALESCE(sum(sub.balance), 0)
  INTO v_equity, v_total_equity_historical
  FROM (
    SELECT a.id AS account_id, a.code, a.name,
           ROUND(COALESCE(sum(jl.credit - jl.debit), 0), 2) AS balance
    FROM public.accounts a
    JOIN public.journal_lines jl ON jl.account_id = a.id AND jl.company_id = v_company_id
    JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
    WHERE a.company_id = v_company_id
      AND a.code LIKE '23%'
      AND jh.status IN ('posted', 'مرحل', 'معتمد')
      AND jh.entry_date <= v_as_of
    GROUP BY a.id, a.code, a.name
    HAVING ABS(COALESCE(sum(jl.credit - jl.debit), 0)) > 0.001
  ) sub;

  -- D. P&L / Current Period Net Income Calculation for Balance Sheet Equilibrium
  -- ---------------------------------------------------------------------------
  -- Prior years net P&L not closed to retained earnings
  SELECT
    ROUND(COALESCE(sum(CASE WHEN a.code LIKE '4%' THEN (jl.credit - jl.debit) ELSE 0 END), 0) -
          COALESCE(sum(CASE WHEN a.code LIKE '5%' THEN (jl.debit - jl.credit) ELSE 0 END), 0), 2)
  INTO v_prior_years_pnl
  FROM public.accounts a
  JOIN public.journal_lines jl ON jl.account_id = a.id AND jl.company_id = v_company_id
  JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
  WHERE a.company_id = v_company_id
    AND (a.code LIKE '4%' OR a.code LIKE '5%')
    AND jh.status IN ('posted', 'مرحل', 'معتمد')
    AND jh.entry_date < v_year_start;

  -- Current fiscal year net income up to as-of date
  SELECT
    ROUND(COALESCE(sum(jl.credit - jl.debit), 0), 2)
  INTO v_current_period_revenue
  FROM public.accounts a
  JOIN public.journal_lines jl ON jl.account_id = a.id AND jl.company_id = v_company_id
  JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
  WHERE a.company_id = v_company_id
    AND a.code LIKE '4%'
    AND jh.status IN ('posted', 'مرحل', 'معتمد')
    AND jh.entry_date BETWEEN v_year_start AND v_as_of;

  SELECT
    ROUND(COALESCE(sum(jl.debit - jl.credit), 0), 2)
  INTO v_current_period_expense
  FROM public.accounts a
  JOIN public.journal_lines jl ON jl.account_id = a.id AND jl.company_id = v_company_id
  JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
  WHERE a.company_id = v_company_id
    AND a.code LIKE '5%'
    AND jh.status IN ('posted', 'مرحل', 'معتمد')
    AND jh.entry_date BETWEEN v_year_start AND v_as_of;

  v_current_period_net_income := v_current_period_revenue - v_current_period_expense;

  -- Total equity with period income
  v_total_equity_with_income := v_total_equity_historical + v_prior_years_pnl + v_current_period_net_income;
  v_total_liabilities_and_equity := v_total_liabilities + v_total_equity_with_income;

  v_difference := ROUND(v_total_assets - v_total_liabilities_and_equity, 2);
  v_is_balanced := (ABS(v_difference) < 0.01);

  -- E. Previous Year-end comparison (Optional)
  IF p_compare_prev THEN
    v_prev_date := (v_year_start - INTERVAL '1 day')::date;

    SELECT
      ROUND(COALESCE(sum(jl.debit - jl.credit), 0), 2)
    INTO v_prev_total_assets
    FROM public.accounts a
    JOIN public.journal_lines jl ON jl.account_id = a.id AND jl.company_id = v_company_id
    JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
    WHERE a.company_id = v_company_id
      AND a.code LIKE '1%'
      AND jh.status IN ('posted', 'مرحل', 'معتمد')
      AND jh.entry_date <= v_prev_date;

    SELECT
      ROUND(COALESCE(sum(jl.credit - jl.debit), 0), 2)
    INTO v_prev_total_liabilities
    FROM public.accounts a
    JOIN public.journal_lines jl ON jl.account_id = a.id AND jl.company_id = v_company_id
    JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
    WHERE a.company_id = v_company_id
      AND (a.code LIKE '21%' OR a.code LIKE '22%')
      AND jh.status IN ('posted', 'مرحل', 'معتمد')
      AND jh.entry_date <= v_prev_date;

    v_prev_total_equity := v_prev_total_assets - v_prev_total_liabilities;
  END IF;

  RETURN jsonb_build_object(
    'as_of_date', v_as_of,
    'fiscal_year_start', v_year_start,
    'is_balanced', v_is_balanced,
    'difference', v_difference,
    'summary', jsonb_build_object(
      'total_assets', v_total_assets,
      'total_current_assets', v_total_current_assets,
      'total_fixed_assets', v_total_fixed_assets,
      'total_other_assets', v_total_other_assets,
      'total_liabilities', v_total_liabilities,
      'total_current_liabilities', v_total_current_liabilities,
      'total_longterm_liabilities', v_total_longterm_liabilities,
      'total_equity_historical', v_total_equity_historical,
      'prior_years_pnl', v_prior_years_pnl,
      'current_period_revenue', v_current_period_revenue,
      'current_period_expense', v_current_period_expense,
      'current_period_net_income', v_current_period_net_income,
      'total_equity_with_income', v_total_equity_with_income,
      'total_liabilities_and_equity', v_total_liabilities_and_equity
    ),
    'sections', jsonb_build_object(
      'current_assets', v_current_assets,
      'fixed_assets', v_fixed_assets,
      'other_assets', v_other_assets,
      'current_liabilities', v_current_liabilities,
      'longterm_liabilities', v_longterm_liabilities,
      'equity', v_equity
    ),
    'previous_year_end', CASE WHEN p_compare_prev THEN jsonb_build_object(
      'as_of_date', v_prev_date,
      'total_assets', v_prev_total_assets,
      'total_liabilities', v_prev_total_liabilities,
      'total_equity', v_prev_total_equity,
      'assets_growth', (v_total_assets - v_prev_total_assets),
      'assets_growth_pct', CASE WHEN v_prev_total_assets <> 0 THEN ROUND(((v_total_assets - v_prev_total_assets) / ABS(v_prev_total_assets)) * 100, 2) ELSE 0 END
    ) ELSE NULL END
  );
END;
$$;

-- 3. RPC: get_projects_profitability_summary (لوحة ربحية المشاريع مع مطابقة تامة للأستاذ العام)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_projects_profitability_summary(
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_project_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rawasi_private
AS $$
DECLARE
  v_company_id uuid;
  v_start date;
  v_end date;

  v_projects jsonb := '[]'::jsonb;
  v_unallocated jsonb;

  -- Grand Totals across all projects
  v_sum_proj_revenue numeric := 0;
  v_sum_proj_costs numeric := 0;
  v_sum_proj_profit numeric := 0;

  -- Unallocated Totals
  v_unallocated_revenue numeric := 0;
  v_unallocated_costs numeric := 0;
  v_unallocated_profit numeric := 0;

  -- GL Totals for Reconciliation Check
  v_gl_total_revenue numeric := 0;
  v_gl_total_project_costs numeric := 0;
  v_gl_variance numeric := 0;
  v_is_reconciled boolean := false;
BEGIN
  v_company_id := rawasi_private.current_company_id();
  IF NOT (rawasi_private.can_access('reports', 'view') OR rawasi_private.can_access('accounting', 'view') OR rawasi_private.can_access('projects', 'view') OR rawasi_private.is_admin()) THEN
    RAISE EXCEPTION 'غير مصرح بعرض تقارير ربحية المشاريع' USING ERRCODE = '42501';
  END IF;

  v_start := COALESCE(p_start_date, date_trunc('year', CURRENT_DATE)::date);
  v_end := COALESCE(p_end_date, CURRENT_DATE);

  -- Common Table Expression resolving project lines (direct or via source reference fallback)
  WITH raw_lines AS (
    SELECT
      jl.id,
      jl.account_id,
      a.code AS account_code,
      jl.debit,
      jl.credit,
      COALESCE(
        jl.project_id,
        (SELECT inv.project_ids[1] FROM public.invoices inv WHERE inv.id = jh.reference_id AND inv.company_id = v_company_id AND array_length(inv.project_ids, 1) > 0),
        (SELECT sc.project_id FROM public.sub_claims sc WHERE sc.id = jh.reference_id AND sc.company_id = v_company_id),
        (SELECT mi.project_id FROM public.material_issues mi WHERE mi.id = jh.reference_id AND mi.company_id = v_company_id),
        (SELECT e.project_id FROM public.expenses e WHERE e.id = jh.reference_id AND e.company_id = v_company_id),
        (SELECT ll.project_id FROM public.labor_daily_logs ll WHERE ll.id = jh.reference_id AND ll.company_id = v_company_id)
      ) AS resolved_project_id
    FROM public.journal_lines jl
    JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
    JOIN public.accounts a ON a.id = jl.account_id AND a.company_id = v_company_id
    WHERE jl.company_id = v_company_id
      AND (a.code LIKE '4%' OR a.code LIKE '51%')
      AND jh.status IN ('posted', 'مرحل', 'معتمد')
      AND jh.entry_date BETWEEN v_start AND v_end
  ),
  project_breakdowns AS (
    SELECT
      pr.id AS project_id,
      COALESCE(pr.project_name, pr."Property", 'مشروع') AS project_name,
      pr.project_code,
      pr.client_name,
      pr.status AS project_status,
      pr.contract_value,
      pr.estimated_budget,
      -- Revenue from 4%
      ROUND(COALESCE(sum(CASE WHEN rl.account_code LIKE '4%' THEN (rl.credit - rl.debit) ELSE 0 END), 0), 2) AS revenue,
      -- Cost Breakdowns from 51%
      ROUND(COALESCE(sum(CASE WHEN rl.account_code LIKE '511%' THEN (rl.debit - rl.credit) ELSE 0 END), 0), 2) AS materials_cost,
      ROUND(COALESCE(sum(CASE WHEN rl.account_code LIKE '512%' THEN (rl.debit - rl.credit) ELSE 0 END), 0), 2) AS labor_cost,
      ROUND(COALESCE(sum(CASE WHEN rl.account_code LIKE '513%' THEN (rl.debit - rl.credit) ELSE 0 END), 0), 2) AS subcontractors_cost,
      ROUND(COALESCE(sum(CASE WHEN rl.account_code LIKE '514%' THEN (rl.debit - rl.credit) ELSE 0 END), 0), 2) AS equipment_cost,
      ROUND(COALESCE(sum(CASE WHEN rl.account_code LIKE '515%' THEN (rl.debit - rl.credit) ELSE 0 END), 0), 2) AS site_expenses_cost,
      ROUND(COALESCE(sum(CASE WHEN rl.account_code LIKE '516%' THEN (rl.debit - rl.credit) ELSE 0 END), 0), 2) AS depreciation_cost,
      ROUND(COALESCE(sum(CASE WHEN rl.account_code LIKE '517%' OR (rl.account_code LIKE '51%' AND rl.account_code NOT LIKE ALL (ARRAY['511%','512%','513%','514%','515%','516%'])) THEN (rl.debit - rl.credit) ELSE 0 END), 0), 2) AS other_direct_cost,
      -- BOQ Budgets
      COALESCE((
        SELECT sum(bb.contract_quantity * bb.unit_contract_price)
        FROM public.boq_budget bb
        WHERE bb.project_id = pr.id AND bb.company_id = v_company_id
      ), pr.contract_value, 0) AS boq_contract_value,
      COALESCE((
        SELECT sum(COALESCE(bb.estimated_labor_cost, 0) + COALESCE(bb.estimated_material_cost, 0) + COALESCE(bb.estimated_expenses_cost, 0))
        FROM public.boq_budget bb
        WHERE bb.project_id = pr.id AND bb.company_id = v_company_id
      ), pr.estimated_budget, 0) AS boq_estimated_cost
    FROM public.projects pr
    LEFT JOIN raw_lines rl ON rl.resolved_project_id = pr.id
    WHERE pr.company_id = v_company_id
      AND (p_project_id IS NULL OR pr.id = p_project_id)
    GROUP BY pr.id, pr.project_name, pr."Property", pr.project_code, pr.client_name, pr.status, pr.contract_value, pr.estimated_budget
  )
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'project_id', pb.project_id,
        'project_name', pb.project_name,
        'project_code', pb.project_code,
        'client_name', pb.client_name,
        'project_status', pb.project_status,
        'revenue', pb.revenue,
        'costs', jsonb_build_object(
          'materials', pb.materials_cost,
          'labor', pb.labor_cost,
          'subcontractors', pb.subcontractors_cost,
          'equipment', pb.equipment_cost,
          'site_expenses', pb.site_expenses_cost,
          'depreciation', pb.depreciation_cost,
          'other_direct', pb.other_direct_cost,
          'total', (pb.materials_cost + pb.labor_cost + pb.subcontractors_cost + pb.equipment_cost + pb.site_expenses_cost + pb.depreciation_cost + pb.other_direct_cost)
        ),
        'net_profit', (pb.revenue - (pb.materials_cost + pb.labor_cost + pb.subcontractors_cost + pb.equipment_cost + pb.site_expenses_cost + pb.depreciation_cost + pb.other_direct_cost)),
        'margin_pct', CASE
          WHEN pb.revenue > 0 THEN ROUND(((pb.revenue - (pb.materials_cost + pb.labor_cost + pb.subcontractors_cost + pb.equipment_cost + pb.site_expenses_cost + pb.depreciation_cost + pb.other_direct_cost)) / pb.revenue) * 100, 2)
          ELSE 0
        END,
        'boq_comparison', jsonb_build_object(
          'contract_value', pb.boq_contract_value,
          'estimated_cost', pb.boq_estimated_cost,
          'actual_cost', (pb.materials_cost + pb.labor_cost + pb.subcontractors_cost + pb.equipment_cost + pb.site_expenses_cost + pb.depreciation_cost + pb.other_direct_cost),
          'cost_burn_pct', CASE
            WHEN pb.boq_estimated_cost > 0 THEN ROUND(((pb.materials_cost + pb.labor_cost + pb.subcontractors_cost + pb.equipment_cost + pb.site_expenses_cost + pb.depreciation_cost + pb.other_direct_cost) / pb.boq_estimated_cost) * 100, 2)
            ELSE 0
          END,
          'variance', ((pb.materials_cost + pb.labor_cost + pb.subcontractors_cost + pb.equipment_cost + pb.site_expenses_cost + pb.depreciation_cost + pb.other_direct_cost) - pb.boq_estimated_cost)
        )
      ) ORDER BY pb.revenue DESC
    ), '[]'::jsonb),
    COALESCE(sum(pb.revenue), 0),
    COALESCE(sum(pb.materials_cost + pb.labor_cost + pb.subcontractors_cost + pb.equipment_cost + pb.site_expenses_cost + pb.depreciation_cost + pb.other_direct_cost), 0)
  INTO v_projects, v_sum_proj_revenue, v_sum_proj_costs
  FROM project_breakdowns pb
  WHERE (pb.revenue <> 0 OR (pb.materials_cost + pb.labor_cost + pb.subcontractors_cost + pb.equipment_cost + pb.site_expenses_cost + pb.depreciation_cost + pb.other_direct_cost) <> 0);

  v_sum_proj_profit := v_sum_proj_revenue - v_sum_proj_costs;

  -- Unallocated Lines (lines without resolved project id)
  WITH raw_lines AS (
    SELECT
      jl.id,
      a.code AS account_code,
      jl.debit,
      jl.credit,
      COALESCE(
        jl.project_id,
        (SELECT inv.project_ids[1] FROM public.invoices inv WHERE inv.id = jh.reference_id AND inv.company_id = v_company_id AND array_length(inv.project_ids, 1) > 0),
        (SELECT sc.project_id FROM public.sub_claims sc WHERE sc.id = jh.reference_id AND sc.company_id = v_company_id),
        (SELECT mi.project_id FROM public.material_issues mi WHERE mi.id = jh.reference_id AND mi.company_id = v_company_id),
        (SELECT e.project_id FROM public.expenses e WHERE e.id = jh.reference_id AND e.company_id = v_company_id),
        (SELECT ll.project_id FROM public.labor_daily_logs ll WHERE ll.id = jh.reference_id AND ll.company_id = v_company_id)
      ) AS resolved_project_id
    FROM public.journal_lines jl
    JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
    JOIN public.accounts a ON a.id = jl.account_id AND a.company_id = v_company_id
    WHERE jl.company_id = v_company_id
      AND (a.code LIKE '4%' OR a.code LIKE '51%')
      AND jh.status IN ('posted', 'مرحل', 'معتمد')
      AND jh.entry_date BETWEEN v_start AND v_end
  )
  SELECT
    ROUND(COALESCE(sum(CASE WHEN rl.account_code LIKE '4%' THEN (rl.credit - rl.debit) ELSE 0 END), 0), 2),
    ROUND(COALESCE(sum(CASE WHEN rl.account_code LIKE '51%' THEN (rl.debit - rl.credit) ELSE 0 END), 0), 2)
  INTO v_unallocated_revenue, v_unallocated_costs
  FROM raw_lines rl
  WHERE rl.resolved_project_id IS NULL;

  v_unallocated_profit := v_unallocated_revenue - v_unallocated_costs;

  v_unallocated := jsonb_build_object(
    'title_ar', 'غير محدد (إيرادات وتكاليف عمليات عامة غير محملة على مشاريع)',
    'revenue', v_unallocated_revenue,
    'costs', v_unallocated_costs,
    'net_profit', v_unallocated_profit
  );

  -- GL Totals for reconciliation check
  SELECT
    ROUND(COALESCE(sum(CASE WHEN a.code LIKE '4%' THEN (jl.credit - jl.debit) ELSE 0 END), 0), 2),
    ROUND(COALESCE(sum(CASE WHEN a.code LIKE '51%' THEN (jl.debit - jl.credit) ELSE 0 END), 0), 2)
  INTO v_gl_total_revenue, v_gl_total_project_costs
  FROM public.accounts a
  JOIN public.journal_lines jl ON jl.account_id = a.id AND jl.company_id = v_company_id
  JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
  WHERE a.company_id = v_company_id
    AND (a.code LIKE '4%' OR a.code LIKE '51%')
    AND jh.status IN ('posted', 'مرحل', 'معتمد')
    AND jh.entry_date BETWEEN v_start AND v_end;

  v_gl_variance := ROUND((v_sum_proj_costs + v_unallocated_costs) - v_gl_total_project_costs, 2);
  v_is_reconciled := (ABS(v_gl_variance) < 0.01 AND ABS((v_sum_proj_revenue + v_unallocated_revenue) - v_gl_total_revenue) < 0.01);

  RETURN jsonb_build_object(
    'period', jsonb_build_object(
      'start_date', v_start,
      'end_date', v_end
    ),
    'projects_count', jsonb_array_length(v_projects),
    'projects', v_projects,
    'unallocated', v_unallocated,
    'summary', jsonb_build_object(
      'projects_revenue', v_sum_proj_revenue,
      'projects_costs', v_sum_proj_costs,
      'projects_profit', v_sum_proj_profit,
      'unallocated_revenue', v_unallocated_revenue,
      'unallocated_costs', v_unallocated_costs,
      'total_combined_revenue', (v_sum_proj_revenue + v_unallocated_revenue),
      'total_combined_costs', (v_sum_proj_costs + v_unallocated_costs),
      'total_combined_profit', ((v_sum_proj_revenue + v_unallocated_revenue) - (v_sum_proj_costs + v_unallocated_costs)),
      'overall_margin_pct', CASE
        WHEN (v_sum_proj_revenue + v_unallocated_revenue) > 0 THEN
          ROUND((((v_sum_proj_revenue + v_unallocated_revenue) - (v_sum_proj_costs + v_unallocated_costs)) / (v_sum_proj_revenue + v_unallocated_revenue)) * 100, 2)
        ELSE 0
      END
    ),
    'reconciliation', jsonb_build_object(
      'gl_total_revenue', v_gl_total_revenue,
      'gl_total_project_costs', v_gl_total_project_costs,
      'is_reconciled', v_is_reconciled,
      'variance', v_gl_variance
    )
  );
END;
$$;

-- 4. RPC: get_financial_kpis (مؤشرات الأداء المالي والسيولة والتحصيل)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_financial_kpis(
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rawasi_private
AS $$
DECLARE
  v_company_id uuid;
  v_start date;
  v_end date;
  v_days_in_period integer;

  -- Collection Rate & DSO
  v_total_invoiced numeric := 0;
  v_total_collected numeric := 0;
  v_collection_rate_pct numeric := 0;
  v_ar_balance numeric := 0;
  v_dso_days numeric := 0;

  -- Liquidity Ratios
  v_ca numeric := 0;
  v_cl numeric := 0;
  v_cash numeric := 0;
  v_current_ratio numeric := 0;
  v_quick_ratio numeric := 0;

  -- Top / Bottom Projects
  v_top_projects jsonb := '[]'::jsonb;
  v_bottom_projects jsonb := '[]'::jsonb;
BEGIN
  v_company_id := rawasi_private.current_company_id();
  IF NOT (rawasi_private.can_access('reports', 'view') OR rawasi_private.can_access('accounting', 'view') OR rawasi_private.is_admin()) THEN
    RAISE EXCEPTION 'غير مصرح بعرض مؤشرات الأداء المالي' USING ERRCODE = '42501';
  END IF;

  v_start := COALESCE(p_start_date, date_trunc('year', CURRENT_DATE)::date);
  v_end := COALESCE(p_end_date, CURRENT_DATE);
  v_days_in_period := (v_end - v_start + 1);

  -- 1. Invoices & Collection
  SELECT COALESCE(sum(inv.total_amount), 0)
  INTO v_total_invoiced
  FROM public.invoices inv
  WHERE inv.company_id = v_company_id
    AND inv.date BETWEEN v_start AND v_end
    AND inv.status IN ('posted', 'مرحل', 'معتمد', 'مدفوعة');

  SELECT COALESCE(sum(rv.amount), 0)
  INTO v_total_collected
  FROM public.receipt_vouchers rv
  WHERE rv.company_id = v_company_id
    AND rv.date BETWEEN v_start AND v_end
    AND rv.status IN ('posted', 'مرحل', 'معتمد', 'مدفوع');

  IF v_total_invoiced > 0 THEN
    v_collection_rate_pct := ROUND((v_total_collected / v_total_invoiced) * 100, 2);
  ELSE
    v_collection_rate_pct := 100;
  END IF;

  -- 2. AR Balance (Account 124) as of end date
  SELECT ROUND(COALESCE(sum(jl.debit - jl.credit), 0), 2)
  INTO v_ar_balance
  FROM public.accounts a
  JOIN public.journal_lines jl ON jl.account_id = a.id AND jl.company_id = v_company_id
  JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
  WHERE a.company_id = v_company_id
    AND a.code LIKE '124%'
    AND jh.status IN ('posted', 'مرحل', 'معتمد')
    AND jh.entry_date <= v_end;

  IF v_total_invoiced > 0 THEN
    v_dso_days := ROUND((v_ar_balance / v_total_invoiced) * v_days_in_period, 1);
  ELSE
    v_dso_days := 0;
  END IF;

  -- 3. Liquidity Ratios as of end date
  -- Current Assets (12%)
  SELECT ROUND(COALESCE(sum(jl.debit - jl.credit), 0), 2)
  INTO v_ca
  FROM public.accounts a
  JOIN public.journal_lines jl ON jl.account_id = a.id AND jl.company_id = v_company_id
  JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
  WHERE a.company_id = v_company_id
    AND a.code LIKE '12%'
    AND jh.status IN ('posted', 'مرحل', 'معتمد')
    AND jh.entry_date <= v_end;

  -- Cash & Banks (122, 129%)
  SELECT ROUND(COALESCE(sum(jl.debit - jl.credit), 0), 2)
  INTO v_cash
  FROM public.accounts a
  JOIN public.journal_lines jl ON jl.account_id = a.id AND jl.company_id = v_company_id
  JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
  WHERE a.company_id = v_company_id
    AND (a.code LIKE '122%' OR a.code LIKE '129%')
    AND jh.status IN ('posted', 'مرحل', 'معتمد')
    AND jh.entry_date <= v_end;

  -- Current Liabilities (21%)
  SELECT ROUND(COALESCE(sum(jl.credit - jl.debit), 0), 2)
  INTO v_cl
  FROM public.accounts a
  JOIN public.journal_lines jl ON jl.account_id = a.id AND jl.company_id = v_company_id
  JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
  WHERE a.company_id = v_company_id
    AND a.code LIKE '21%'
    AND jh.status IN ('posted', 'مرحل', 'معتمد')
    AND jh.entry_date <= v_end;

  IF v_cl > 0 THEN
    v_current_ratio := ROUND(v_ca / v_cl, 2);
    v_quick_ratio := ROUND((v_cash + v_ar_balance) / v_cl, 2);
  ELSE
    v_current_ratio := ROUND(v_ca, 2);
    v_quick_ratio := ROUND(v_cash + v_ar_balance, 2);
  END IF;

  -- 4. Top 3 Most Profitable & Top 3 Least Profitable Projects
  WITH project_summary AS (
    SELECT
      pr.id AS project_id,
      COALESCE(pr.project_name, pr."Property", 'مشروع') AS project_name,
      ROUND(COALESCE(sum(CASE WHEN a.code LIKE '4%' THEN (jl.credit - jl.debit) ELSE 0 END), 0), 2) AS revenue,
      ROUND(COALESCE(sum(CASE WHEN a.code LIKE '51%' THEN (jl.debit - jl.credit) ELSE 0 END), 0), 2) AS costs
    FROM public.projects pr
    LEFT JOIN public.journal_lines jl ON jl.project_id = pr.id AND jl.company_id = v_company_id
    LEFT JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id AND jh.status IN ('posted', 'مرحل', 'معتمد') AND jh.entry_date BETWEEN v_start AND v_end
    LEFT JOIN public.accounts a ON a.id = jl.account_id AND a.company_id = v_company_id AND (a.code LIKE '4%' OR a.code LIKE '51%')
    WHERE pr.company_id = v_company_id
    GROUP BY pr.id, pr.project_name, pr."Property"
  )
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'project_id', ps.project_id,
        'project_name', ps.project_name,
        'revenue', ps.revenue,
        'costs', ps.costs,
        'net_profit', (ps.revenue - ps.costs),
        'margin_pct', CASE WHEN ps.revenue > 0 THEN ROUND(((ps.revenue - ps.costs) / ps.revenue) * 100, 2) ELSE 0 END
      )
    ), '[]'::jsonb)
  INTO v_top_projects
  FROM (
    SELECT * FROM project_summary
    WHERE (revenue > 0 OR costs > 0)
    ORDER BY (revenue - costs) DESC
    LIMIT 3
  ) ps;

  WITH project_summary AS (
    SELECT
      pr.id AS project_id,
      COALESCE(pr.project_name, pr."Property", 'مشروع') AS project_name,
      ROUND(COALESCE(sum(CASE WHEN a.code LIKE '4%' THEN (jl.credit - jl.debit) ELSE 0 END), 0), 2) AS revenue,
      ROUND(COALESCE(sum(CASE WHEN a.code LIKE '51%' THEN (jl.debit - jl.credit) ELSE 0 END), 0), 2) AS costs
    FROM public.projects pr
    LEFT JOIN public.journal_lines jl ON jl.project_id = pr.id AND jl.company_id = v_company_id
    LEFT JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id AND jh.status IN ('posted', 'مرحل', 'معتمد') AND jh.entry_date BETWEEN v_start AND v_end
    LEFT JOIN public.accounts a ON a.id = jl.account_id AND a.company_id = v_company_id AND (a.code LIKE '4%' OR a.code LIKE '51%')
    WHERE pr.company_id = v_company_id
    GROUP BY pr.id, pr.project_name, pr."Property"
  )
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'project_id', ps.project_id,
        'project_name', ps.project_name,
        'revenue', ps.revenue,
        'costs', ps.costs,
        'net_profit', (ps.revenue - ps.costs),
        'margin_pct', CASE WHEN ps.revenue > 0 THEN ROUND(((ps.revenue - ps.costs) / ps.revenue) * 100, 2) ELSE 0 END
      )
    ), '[]'::jsonb)
  INTO v_bottom_projects
  FROM (
    SELECT * FROM project_summary
    WHERE (revenue > 0 OR costs > 0)
    ORDER BY (revenue - costs) ASC
    LIMIT 3
  ) ps;

  RETURN jsonb_build_object(
    'period', jsonb_build_object(
      'start_date', v_start,
      'end_date', v_end,
      'days_in_period', v_days_in_period
    ),
    'collection_metrics', jsonb_build_object(
      'total_invoiced', v_total_invoiced,
      'total_collected', v_total_collected,
      'collection_rate_pct', v_collection_rate_pct,
      'ar_balance', v_ar_balance,
      'dso_days', v_dso_days
    ),
    'liquidity_metrics', jsonb_build_object(
      'current_assets', v_ca,
      'cash_and_banks', v_cash,
      'current_liabilities', v_cl,
      'current_ratio', v_current_ratio,
      'quick_ratio', v_quick_ratio
    ),
    'project_rankings', jsonb_build_object(
      'top_profitable', v_top_projects,
      'least_profitable', v_bottom_projects
    )
  );
END;
$$;

-- 5. Permissions & Grants
-- -----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.get_income_statement_by_period(date, date, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_balance_sheet_as_of(date, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_projects_profitability_summary(date, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_financial_kpis(date, date) TO authenticated;



-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- FILE: 20261105170013_offline_idempotency_and_realtime.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- Migration: 20261105170013_offline_idempotency_and_realtime.sql
-- Description: Phase 8 - Offline Draft Queue Idempotency (client_request_id per company),
--              Telegram Company Attachments Registry, Draft-Only RPCs, and Realtime Publication

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $preflight$
BEGIN
  IF to_regclass('public.companies') IS NULL OR to_regprocedure('rawasi_private.current_company_id()') IS NULL THEN
    RAISE EXCEPTION 'Multi-company isolation must be applied before Phase 8';
  END IF;
  IF to_regclass('public.company_attachments') IS NOT NULL THEN
    RAISE EXCEPTION 'public.company_attachments already exists';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('labor_daily_logs', 'expenses')
      AND column_name = 'client_request_id'
  ) THEN
    RAISE EXCEPTION 'client_request_id already exists on labor_daily_logs or expenses';
  END IF;
END;
$preflight$;

BEGIN;

-- =============================================================================
-- 1. IDEMPOTENCY KEYS ON TARGET DRAFT TABLES (PER-COMPANY UNIQUE)
-- =============================================================================
ALTER TABLE public.labor_daily_logs
  ADD COLUMN client_request_id uuid;

ALTER TABLE public.labor_daily_logs
  ADD CONSTRAINT labor_daily_logs_company_client_req_uq
  UNIQUE (company_id, client_request_id);

COMMENT ON COLUMN public.labor_daily_logs.client_request_id IS
  'معرّف العملية المولّد على جهاز المستخدم لمنع تكرار مسودات اليوميات عند إعادة إرسال طابور الأوفلاين';

ALTER TABLE public.expenses
  ADD COLUMN client_request_id uuid;

ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_company_client_req_uq
  UNIQUE (company_id, client_request_id);

COMMENT ON COLUMN public.expenses.client_request_id IS
  'معرّف العملية المولّد على جهاز المستخدم لمنع تكرار مسودات المصروفات ومصروفات العهد عند إعادة الإرسال';

-- =============================================================================
-- 2. COMPANY ATTACHMENTS REGISTRY (TELEGRAM BOT API METADATA PER COMPANY)
-- =============================================================================
CREATE TABLE public.company_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT rawasi_private.current_company_id() REFERENCES public.companies(id) ON DELETE RESTRICT,
  client_request_id uuid,
  module text NOT NULL DEFAULT 'general' CHECK (module IN (
    'expenses',
    'custodies',
    'company_documents',
    'receipt_vouchers',
    'payment_vouchers',
    'invoices',
    'general'
  )),
  file_name text NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  file_size integer NOT NULL DEFAULT 0 CHECK (file_size >= 0),
  telegram_file_id text NOT NULL,
  telegram_unique_id text,
  telegram_message_id bigint,
  telegram_chat_id text,
  caption text,
  uploaded_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_attachments_company_id_uq UNIQUE (id, company_id),
  CONSTRAINT company_attachments_company_client_req_uq UNIQUE (company_id, client_request_id)
);

COMMENT ON TABLE public.company_attachments IS
  'سجل مرفقات وصور النظام المرتبطة بـ Telegram Bot API مع عزل كامل لكل شركة ومنع تكرار الرفع';

INSERT INTO rawasi_private.company_scoped_tables(table_name)
VALUES ('company_attachments');

CREATE INDEX company_attachments_company_module_idx
  ON public.company_attachments(company_id, module, created_at DESC);

CREATE TRIGGER aa_stamp_company_id
  BEFORE INSERT OR UPDATE OF company_id ON public.company_attachments
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id();

ALTER TABLE public.company_attachments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.company_attachments FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, DELETE ON public.company_attachments TO authenticated;
GRANT ALL ON public.company_attachments TO service_role;

CREATE POLICY company_attachments_read ON public.company_attachments
  FOR SELECT TO authenticated
  USING (
    (
      rawasi_private.can_access('expenses', 'view')
      OR rawasi_private.can_access('receipts', 'view')
      OR rawasi_private.can_access('payments', 'view')
      OR rawasi_private.can_access('audit_logs', 'view')
      OR rawasi_private.can_access('accounting', 'view')
      OR rawasi_private.can_access('labor_logs', 'view')
      OR rawasi_private.is_admin()
    )
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY company_attachments_insert ON public.company_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      rawasi_private.can_access('expenses', 'create')
      OR rawasi_private.can_access('receipts', 'create')
      OR rawasi_private.can_access('payments', 'create')
      OR rawasi_private.can_access('audit_logs', 'create')
      OR rawasi_private.can_access('labor_logs', 'create')
      OR rawasi_private.is_admin()
    )
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY company_attachments_delete ON public.company_attachments
  FOR DELETE TO authenticated
  USING (
    (uploaded_by = (SELECT auth.uid()) OR rawasi_private.is_admin())
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

-- =============================================================================
-- 3. RPC: IDEMPOTENT COMPANY ATTACHMENT REGISTRATION
-- =============================================================================
CREATE OR REPLACE FUNCTION public.register_company_attachment(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company uuid;
  v_expected_company uuid;
  v_client_req_id uuid;
  v_module text;
  v_file_name text;
  v_mime_type text;
  v_file_size integer;
  v_tg_file_id text;
  v_tg_unique_id text;
  v_tg_msg_id bigint;
  v_tg_chat_id text;
  v_caption text;
  v_existing_id uuid;
  v_inserted_id uuid;
  v_row_json jsonb;
BEGIN
  IF auth.uid() IS NULL AND current_setting('role', true) IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'يلزم تسجيل الدخول لحفظ المرفق' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    rawasi_private.can_access('expenses', 'create')
    OR rawasi_private.can_access('receipts', 'create')
    OR rawasi_private.can_access('payments', 'create')
    OR rawasi_private.can_access('audit_logs', 'create')
    OR rawasi_private.can_access('labor_logs', 'create')
    OR rawasi_private.is_admin()
  ) THEN
    RAISE EXCEPTION 'لا توجد صلاحية رفع مرفقات في الشركة الحالية' USING ERRCODE = '42501';
  END IF;

  v_company := rawasi_private.current_company_id();
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'لم يتم تحديد الشركة الحالية أو لا تملك صلاحية الوصول إليها' USING ERRCODE = '42501';
  END IF;

  IF NULLIF(btrim(coalesce((NULLIF(current_setting('request.headers', true), '')::jsonb ->> 'x-company-id'), '')), '') IS NOT NULL THEN
    IF ((NULLIF(current_setting('request.headers', true), '')::jsonb ->> 'x-company-id')::uuid) IS DISTINCT FROM v_company THEN
      RAISE EXCEPTION 'ليست لديك صلاحية الوصول للشركة المحددة في الطلب' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NULLIF(btrim(coalesce(p_data->>'company_id', '')), '') IS NOT NULL THEN
    v_expected_company := (p_data->>'company_id')::uuid;
    IF v_expected_company IS DISTINCT FROM v_company THEN
      RAISE EXCEPTION 'عدم تطابق معرّف الشركة المرسلة مع الشركة المفتوحة للطلب' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NULLIF(btrim(coalesce(p_data->>'client_request_id', '')), '') IS NOT NULL THEN
    v_client_req_id := (p_data->>'client_request_id')::uuid;
  END IF;

  IF v_client_req_id IS NOT NULL THEN
    SELECT ca.id, to_jsonb(ca) INTO v_existing_id, v_row_json
    FROM public.company_attachments ca
    WHERE ca.company_id = v_company
      AND ca.client_request_id = v_client_req_id;

    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'id', v_existing_id,
        'company_id', v_company,
        'client_request_id', v_client_req_id,
        'url', '/api/attachments/' || v_existing_id::text,
        '_sync_replayed', true,
        'record', v_row_json
      );
    END IF;
  END IF;

  v_module := coalesce(NULLIF(btrim(p_data->>'module'), ''), 'general');
  v_file_name := coalesce(NULLIF(btrim(p_data->>'file_name'), ''), 'attachment');
  v_mime_type := coalesce(NULLIF(btrim(p_data->>'mime_type'), ''), 'application/octet-stream');
  v_file_size := greatest(coalesce((p_data->>'file_size')::integer, 0), 0);
  v_tg_file_id := NULLIF(btrim(coalesce(p_data->>'telegram_file_id', '')), '');
  v_tg_unique_id := NULLIF(btrim(coalesce(p_data->>'telegram_unique_id', '')), '');
  v_tg_msg_id := CASE
    WHEN NULLIF(btrim(coalesce(p_data->>'telegram_message_id', '')), '') IS NOT NULL
    THEN (p_data->>'telegram_message_id')::bigint
    ELSE NULL
  END;
  v_tg_chat_id := NULLIF(btrim(coalesce(p_data->>'telegram_chat_id', '')), '');
  v_caption := NULLIF(btrim(coalesce(p_data->>'caption', '')), '');

  IF v_tg_file_id IS NULL THEN
    RAISE EXCEPTION 'معرّف ملف تيليجرام (telegram_file_id) مطلوب' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.company_attachments (
    company_id, client_request_id, module, file_name, mime_type, file_size,
    telegram_file_id, telegram_unique_id, telegram_message_id, telegram_chat_id,
    caption, uploaded_by
  ) VALUES (
    v_company, v_client_req_id, v_module, v_file_name, v_mime_type, v_file_size,
    v_tg_file_id, v_tg_unique_id, v_tg_msg_id, v_tg_chat_id,
    v_caption, auth.uid()
  )
  ON CONFLICT ON CONSTRAINT company_attachments_company_client_req_uq DO NOTHING
  RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NULL AND v_client_req_id IS NOT NULL THEN
    SELECT ca.id, to_jsonb(ca) INTO v_existing_id, v_row_json
    FROM public.company_attachments ca
    WHERE ca.company_id = v_company
      AND ca.client_request_id = v_client_req_id;

    RETURN jsonb_build_object(
      'success', true,
      'id', v_existing_id,
      'company_id', v_company,
      'client_request_id', v_client_req_id,
      'url', '/api/attachments/' || v_existing_id::text,
      '_sync_replayed', true,
      'record', v_row_json
    );
  END IF;

  SELECT to_jsonb(ca) INTO v_row_json
  FROM public.company_attachments ca
  WHERE ca.id = v_inserted_id AND ca.company_id = v_company;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_inserted_id,
    'company_id', v_company,
    'client_request_id', v_client_req_id,
    'url', '/api/attachments/' || v_inserted_id::text,
    '_sync_replayed', false,
    'record', v_row_json
  );
END;
$$;

REVOKE ALL ON FUNCTION public.register_company_attachment(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_company_attachment(jsonb) TO authenticated, service_role;

-- =============================================================================
-- 4. RPC: IDEMPOTENT DRAFT-ONLY LABOR DAILY LOG (NO POSTING ALLOWED)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.save_labor_log_draft(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company uuid;
  v_expected_company uuid;
  v_client_req_id uuid;
  v_edit_id uuid;
  v_existing_id uuid;
  v_inserted_id uuid;
  v_row_json jsonb;
  v_work_date date;
  v_worker_name text;
  v_project_id uuid;
  v_job_order_id uuid;
  v_worker_partner_id uuid;
  v_sub_contractor_id uuid;
  v_work_item_id uuid;
  v_debit_acc uuid;
  v_credit_acc uuid;
  v_existing_posted boolean;
BEGIN
  IF auth.uid() IS NULL AND current_setting('role', true) IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'يلزم تسجيل الدخول لحفظ مسودة اليومية' USING ERRCODE = '42501';
  END IF;

  IF p_data IS NULL OR jsonb_typeof(p_data) <> 'object' THEN
    RAISE EXCEPTION 'بيانات مسودة اليومية غير صالحة' USING ERRCODE = '22023';
  END IF;

  -- Strict Draft-Only enforcement: reject any attempt to post from draft/offline RPC
  IF coalesce((p_data->>'is_posted')::boolean, false) IS TRUE
     OR lower(btrim(coalesce(p_data->>'action', ''))) IN ('post', 'approve', 'اعتماد', 'ترحيل') THEN
    RAISE EXCEPTION 'حفظ اليوميات من الطابور متاح كمسودات فقط؛ الترحيل والاعتماد يتطلبان اتصالاً مباشراً بالإنترنت'
      USING ERRCODE = '23514';
  END IF;

  v_company := rawasi_private.current_company_id();
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'لم يتم تحديد الشركة الحالية أو لا تملك صلاحية الوصول إليها' USING ERRCODE = '42501';
  END IF;

  IF NULLIF(btrim(coalesce((NULLIF(current_setting('request.headers', true), '')::jsonb ->> 'x-company-id'), '')), '') IS NOT NULL THEN
    IF ((NULLIF(current_setting('request.headers', true), '')::jsonb ->> 'x-company-id')::uuid) IS DISTINCT FROM v_company THEN
      RAISE EXCEPTION 'ليست لديك صلاحية الوصول للشركة المحددة في الطلب' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NULLIF(btrim(coalesce(p_data->>'company_id', '')), '') IS NOT NULL THEN
    v_expected_company := (p_data->>'company_id')::uuid;
    IF v_expected_company IS DISTINCT FROM v_company THEN
      RAISE EXCEPTION 'عدم تطابق معرّف الشركة المرسلة مع الشركة المفتوحة للطلب' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NULLIF(btrim(coalesce(p_data->>'id', '')), '') IS NOT NULL THEN
    v_edit_id := (p_data->>'id')::uuid;
  END IF;

  IF v_edit_id IS NOT NULL THEN
    IF NOT rawasi_private.can_access('labor_logs', 'edit') THEN
      RAISE EXCEPTION 'لا توجد صلاحية تعديل يوميات العمالة' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF NOT rawasi_private.can_access('labor_logs', 'create') THEN
      RAISE EXCEPTION 'لا توجد صلاحية إضافة يوميات عمالة' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NULLIF(btrim(coalesce(p_data->>'client_request_id', '')), '') IS NOT NULL THEN
    v_client_req_id := (p_data->>'client_request_id')::uuid;
  END IF;

  -- Idempotency check before insert
  IF v_edit_id IS NULL AND v_client_req_id IS NOT NULL THEN
    SELECT l.id, to_jsonb(l) INTO v_existing_id, v_row_json
    FROM public.labor_daily_logs l
    WHERE l.company_id = v_company
      AND l.client_request_id = v_client_req_id;

    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'id', v_existing_id,
        'company_id', v_company,
        'client_request_id', v_client_req_id,
        '_sync_replayed', true,
        'record', v_row_json
      );
    END IF;
  END IF;

  v_work_date := coalesce(NULLIF(btrim(p_data->>'work_date'), '')::date, CURRENT_DATE);
  v_worker_name := NULLIF(btrim(coalesce(p_data->>'worker_name', '')), '');
  IF v_worker_name IS NULL THEN
    RAISE EXCEPTION 'اسم العامل مطلوب لحفظ مسودة اليومية' USING ERRCODE = '23514';
  END IF;

  v_project_id := NULLIF(btrim(coalesce(p_data->>'project_id', '')), '')::uuid;
  v_job_order_id := NULLIF(btrim(coalesce(p_data->>'job_order_id', '')), '')::uuid;
  v_worker_partner_id := NULLIF(btrim(coalesce(p_data->>'worker_partner_id', '')), '')::uuid;
  v_sub_contractor_id := NULLIF(btrim(coalesce(p_data->>'sub_contractor_id', '')), '')::uuid;
  v_work_item_id := NULLIF(btrim(coalesce(p_data->>'work_item_id', '')), '')::uuid;

  -- Resolve company-specific labor accounts by code (never fixed UUIDs from another company)
  v_debit_acc := rawasi_private.company_account_id('512');
  v_credit_acc := rawasi_private.company_account_id('216');

  IF NULLIF(btrim(coalesce(p_data->>'debit_account_id', '')), '') IS NOT NULL THEN
    SELECT a.id INTO v_debit_acc
    FROM public.accounts a
    WHERE a.id = (p_data->>'debit_account_id')::uuid AND a.company_id = v_company;
    IF v_debit_acc IS NULL THEN
      v_debit_acc := rawasi_private.company_account_id('512');
    END IF;
  END IF;

  IF NULLIF(btrim(coalesce(p_data->>'credit_account_id', '')), '') IS NOT NULL THEN
    SELECT a.id INTO v_credit_acc
    FROM public.accounts a
    WHERE a.id = (p_data->>'credit_account_id')::uuid AND a.company_id = v_company;
    IF v_credit_acc IS NULL THEN
      v_credit_acc := rawasi_private.company_account_id('216');
    END IF;
  END IF;

  IF v_edit_id IS NOT NULL THEN
    SELECT l.is_posted INTO v_existing_posted
    FROM public.labor_daily_logs l
    WHERE l.id = v_edit_id AND l.company_id = v_company
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'سجل اليومية غير موجود في الشركة الحالية' USING ERRCODE = 'P0002';
    END IF;
    IF v_existing_posted IS TRUE THEN
      RAISE EXCEPTION 'لا يمكن تعديل سجل عمالة مرحّل؛ يرجى فك الترحيل أولاً' USING ERRCODE = '23514';
    END IF;

    UPDATE public.labor_daily_logs
    SET work_date = v_work_date,
        worker_name = v_worker_name,
        site_ref = NULLIF(btrim(coalesce(p_data->>'site_ref', '')), ''),
        job_order_id = v_job_order_id,
        work_item = NULLIF(btrim(coalesce(p_data->>'work_item', '')), ''),
        unit = NULLIF(btrim(coalesce(p_data->>'unit', '')), ''),
        skill_level = NULLIF(btrim(coalesce(p_data->>'skill_level', '')), ''),
        production_desc = NULLIF(btrim(coalesce(p_data->>'production_desc', '')), ''),
        tareeha = rawasi_private.safe_numeric(p_data->>'tareeha'),
        productivity = rawasi_private.safe_numeric(p_data->>'productivity'),
        completion_percentage = rawasi_private.safe_numeric(p_data->>'completion_percentage'),
        daily_wage = coalesce(rawasi_private.safe_numeric(p_data->>'daily_wage'), 0),
        attendance_value = coalesce(rawasi_private.safe_numeric(p_data->>'attendance_value'), 1),
        notes = NULLIF(btrim(coalesce(p_data->>'notes', '')), ''),
        worker_partner_id = v_worker_partner_id,
        project_id = v_project_id,
        work_item_id = v_work_item_id,
        sub_contractor = NULLIF(btrim(coalesce(p_data->>'sub_contractor', '')), ''),
        sub_contractor_id = v_sub_contractor_id,
        debit_account_id = v_debit_acc,
        credit_account_id = v_credit_acc,
        completed_quantity = coalesce(rawasi_private.safe_numeric(p_data->>'completed_quantity'), 0),
        number_of_workers = coalesce((rawasi_private.safe_numeric(p_data->>'number_of_workers'))::integer, 1),
        is_posted = false
    WHERE id = v_edit_id AND company_id = v_company
    RETURNING id INTO v_inserted_id;
  ELSE
    INSERT INTO public.labor_daily_logs (
      company_id, client_request_id, work_date, worker_name, site_ref,
      job_order_id, work_item, unit, skill_level, production_desc,
      tareeha, productivity, completion_percentage, daily_wage, attendance_value,
      notes, worker_partner_id, project_id, work_item_id,
      sub_contractor, sub_contractor_id, debit_account_id, credit_account_id,
      completed_quantity, number_of_workers, is_posted
    ) VALUES (
      v_company, v_client_req_id, v_work_date, v_worker_name,
      NULLIF(btrim(coalesce(p_data->>'site_ref', '')), ''),
      v_job_order_id,
      NULLIF(btrim(coalesce(p_data->>'work_item', '')), ''),
      NULLIF(btrim(coalesce(p_data->>'unit', '')), ''),
      NULLIF(btrim(coalesce(p_data->>'skill_level', '')), ''),
      NULLIF(btrim(coalesce(p_data->>'production_desc', '')), ''),
      rawasi_private.safe_numeric(p_data->>'tareeha'),
      rawasi_private.safe_numeric(p_data->>'productivity'),
      rawasi_private.safe_numeric(p_data->>'completion_percentage'),
      coalesce(rawasi_private.safe_numeric(p_data->>'daily_wage'), 0),
      coalesce(rawasi_private.safe_numeric(p_data->>'attendance_value'), 1),
      NULLIF(btrim(coalesce(p_data->>'notes', '')), ''),
      v_worker_partner_id, v_project_id, v_work_item_id,
      NULLIF(btrim(coalesce(p_data->>'sub_contractor', '')), ''),
      v_sub_contractor_id, v_debit_acc, v_credit_acc,
      coalesce(rawasi_private.safe_numeric(p_data->>'completed_quantity'), 0),
      coalesce((rawasi_private.safe_numeric(p_data->>'number_of_workers'))::integer, 1),
      false
    )
    ON CONFLICT ON CONSTRAINT labor_daily_logs_company_client_req_uq DO NOTHING
    RETURNING id INTO v_inserted_id;

    IF v_inserted_id IS NULL AND v_client_req_id IS NOT NULL THEN
      SELECT l.id, to_jsonb(l) INTO v_existing_id, v_row_json
      FROM public.labor_daily_logs l
      WHERE l.company_id = v_company
        AND l.client_request_id = v_client_req_id;

      RETURN jsonb_build_object(
        'success', true,
        'id', v_existing_id,
        'company_id', v_company,
        'client_request_id', v_client_req_id,
        '_sync_replayed', true,
        'record', v_row_json
      );
    END IF;
  END IF;

  SELECT to_jsonb(l) INTO v_row_json
  FROM public.labor_daily_logs l
  WHERE l.id = v_inserted_id AND l.company_id = v_company;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_inserted_id,
    'company_id', v_company,
    'client_request_id', v_client_req_id,
    '_sync_replayed', false,
    'record', v_row_json
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_labor_log_draft(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_labor_log_draft(jsonb) TO authenticated, service_role;

-- =============================================================================
-- 5. RPC: IDEMPOTENT DRAFT-ONLY EXPENSE & CUSTODY EXPENSE (NO POSTING ALLOWED)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.save_expense_draft(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company uuid;
  v_expected_company uuid;
  v_client_req_id uuid;
  v_edit_id uuid;
  v_existing_id uuid;
  v_inserted_id uuid;
  v_row_json jsonb;
  v_exp_date date;
  v_description text;
  v_quantity numeric(10,2);
  v_unit_price numeric(15,2);
  v_vat_amount numeric(15,2);
  v_discount_amount numeric(15,2);
  v_payment_method text;
  v_payment_account text;
  v_creditor_account text;
  v_paid_amount numeric(15,2);
  v_project_id uuid;
  v_payee_id uuid;
  v_job_order_id uuid;
  v_custody_id uuid;
  v_asset_id uuid;
  v_lines_data jsonb;
  v_custody_status text;
  v_custody_project uuid;
  v_custody_partner_name text;
  v_acc_125_label text;
  v_existing_posted boolean;
BEGIN
  IF auth.uid() IS NULL AND current_setting('role', true) IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'يلزم تسجيل الدخول لحفظ مسودة المصروف' USING ERRCODE = '42501';
  END IF;

  IF p_data IS NULL OR jsonb_typeof(p_data) <> 'object' THEN
    RAISE EXCEPTION 'بيانات مسودة المصروف غير صالحة' USING ERRCODE = '22023';
  END IF;

  -- Strict Draft-Only enforcement: reject any attempt to post from draft/offline RPC
  IF coalesce((p_data->>'is_posted')::boolean, false) IS TRUE
     OR lower(btrim(coalesce(p_data->>'action', ''))) IN ('post', 'approve', 'settle', 'اعتماد', 'ترحيل', 'تسوية') THEN
    RAISE EXCEPTION 'حفظ المصروفات ومصروفات العهدة من الطابور متاح كمسودات فقط؛ الترحيل والاعتماد يتطلبان اتصالاً مباشراً بالإنترنت'
      USING ERRCODE = '23514';
  END IF;

  v_company := rawasi_private.current_company_id();
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'لم يتم تحديد الشركة الحالية أو لا تملك صلاحية الوصول إليها' USING ERRCODE = '42501';
  END IF;

  IF NULLIF(btrim(coalesce((NULLIF(current_setting('request.headers', true), '')::jsonb ->> 'x-company-id'), '')), '') IS NOT NULL THEN
    IF ((NULLIF(current_setting('request.headers', true), '')::jsonb ->> 'x-company-id')::uuid) IS DISTINCT FROM v_company THEN
      RAISE EXCEPTION 'ليست لديك صلاحية الوصول للشركة المحددة في الطلب' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NULLIF(btrim(coalesce(p_data->>'company_id', '')), '') IS NOT NULL THEN
    v_expected_company := (p_data->>'company_id')::uuid;
    IF v_expected_company IS DISTINCT FROM v_company THEN
      RAISE EXCEPTION 'عدم تطابق معرّف الشركة المرسلة مع الشركة المفتوحة للطلب' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NULLIF(btrim(coalesce(p_data->>'id', '')), '') IS NOT NULL THEN
    v_edit_id := (p_data->>'id')::uuid;
  END IF;

  IF v_edit_id IS NOT NULL THEN
    IF NOT rawasi_private.can_access('expenses', 'edit') THEN
      RAISE EXCEPTION 'لا توجد صلاحية تعديل المصروفات' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF NOT rawasi_private.can_access('expenses', 'create') THEN
      RAISE EXCEPTION 'لا توجد صلاحية إضافة مصروفات' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NULLIF(btrim(coalesce(p_data->>'client_request_id', '')), '') IS NOT NULL THEN
    v_client_req_id := (p_data->>'client_request_id')::uuid;
  END IF;

  -- Idempotency check before insert
  IF v_edit_id IS NULL AND v_client_req_id IS NOT NULL THEN
    SELECT e.id, to_jsonb(e) INTO v_existing_id, v_row_json
    FROM public.expenses e
    WHERE e.company_id = v_company
      AND e.client_request_id = v_client_req_id;

    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'id', v_existing_id,
        'company_id', v_company,
        'client_request_id', v_client_req_id,
        '_sync_replayed', true,
        'record', v_row_json
      );
    END IF;
  END IF;

  v_exp_date := coalesce(NULLIF(btrim(p_data->>'exp_date'), '')::date, CURRENT_DATE);
  v_lines_data := CASE
    WHEN jsonb_typeof(p_data->'lines_data') = 'array' THEN p_data->'lines_data'
    ELSE '[]'::jsonb
  END;

  v_description := NULLIF(btrim(coalesce(p_data->>'description', '')), '');
  IF v_description IS NULL AND jsonb_array_length(v_lines_data) > 0 THEN
    SELECT string_agg(coalesce(l->>'description', l->>'item_name', l->>'work_item'), ' + ')
    INTO v_description
    FROM jsonb_array_elements(v_lines_data) l
    WHERE coalesce(l->>'description', l->>'item_name', l->>'work_item') IS NOT NULL;
  END IF;
  v_description := coalesce(NULLIF(btrim(coalesce(v_description, '')), ''), 'مصروف عام');

  v_quantity := round(greatest(coalesce(rawasi_private.safe_numeric(p_data->>'quantity'), 1), 0.01), 2);
  v_unit_price := round(greatest(coalesce(rawasi_private.safe_numeric(p_data->>'unit_price'), 0), 0), 2);
  v_vat_amount := round(greatest(coalesce(rawasi_private.safe_numeric(p_data->>'vat_amount'), 0), 0), 2);
  v_discount_amount := round(greatest(coalesce(rawasi_private.safe_numeric(p_data->>'discount_amount'), 0), 0), 2);

  v_project_id := NULLIF(btrim(coalesce(p_data->>'project_id', '')), '')::uuid;
  v_payee_id := NULLIF(btrim(coalesce(p_data->>'payee_id', '')), '')::uuid;
  v_job_order_id := NULLIF(btrim(coalesce(p_data->>'job_order_id', '')), '')::uuid;
  v_custody_id := NULLIF(btrim(coalesce(p_data->>'custody_id', '')), '')::uuid;
  v_asset_id := NULLIF(btrim(coalesce(p_data->>'asset_id', '')), '')::uuid;

  v_payment_method := coalesce(NULLIF(btrim(p_data->>'payment_method'), ''), CASE WHEN v_custody_id IS NOT NULL THEN 'عهدة' ELSE 'آجل' END);
  v_payment_account := NULLIF(btrim(coalesce(p_data->>'payment_account', '')), '');
  v_creditor_account := NULLIF(btrim(coalesce(p_data->>'creditor_account', '')), '');

  -- Validate custody link if this is a site custody expense draft
  IF v_custody_id IS NOT NULL THEN
    SELECT sc.status, sc.project_id, p.name
    INTO v_custody_status, v_custody_project, v_custody_partner_name
    FROM public.site_custodies sc
    LEFT JOIN public.partners p ON p.id = sc.partner_id AND p.company_id = sc.company_id
    WHERE sc.id = v_custody_id AND sc.company_id = v_company;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'العهدة المحددة غير موجودة في الشركة الحالية' USING ERRCODE = '23503';
    END IF;
    IF v_custody_status <> 'open' THEN
      RAISE EXCEPTION 'لا يمكن تسجيل مصروف جديد على عهدة مغلقة أو مسواة' USING ERRCODE = '23514';
    END IF;

    IF v_project_id IS NULL AND v_custody_project IS NOT NULL THEN
      v_project_id := v_custody_project;
    END IF;

    IF v_payment_account IS NULL THEN
      SELECT a.code || ' - ' || a.name INTO v_acc_125_label
      FROM public.accounts a
      WHERE a.company_id = v_company AND a.code = '125'
      LIMIT 1;
      v_payment_account := coalesce(v_acc_125_label, '125 - عُهد الموظفين والمواقع');
    END IF;

    v_payment_method := 'عهدة';
  END IF;

  IF v_payment_method = 'تسوية داخلية' THEN
    v_paid_amount := round((v_quantity * v_unit_price) + v_vat_amount - v_discount_amount, 2);
  ELSE
    v_paid_amount := 0;
  END IF;

  IF v_edit_id IS NOT NULL THEN
    SELECT e.is_posted INTO v_existing_posted
    FROM public.expenses e
    WHERE e.id = v_edit_id AND e.company_id = v_company
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'سجل المصروف غير موجود في الشركة الحالية' USING ERRCODE = 'P0002';
    END IF;
    IF v_existing_posted IS TRUE THEN
      RAISE EXCEPTION 'لا يمكن تعديل مصروف مرحّل؛ يرجى فك الترحيل أولاً' USING ERRCODE = '23514';
    END IF;

    UPDATE public.expenses
    SET exp_date = v_exp_date,
        main_category = NULLIF(btrim(coalesce(p_data->>'main_category', '')), ''),
        sub_contractor = NULLIF(btrim(coalesce(p_data->>'sub_contractor', '')), ''),
        site_ref = NULLIF(btrim(coalesce(p_data->>'site_ref', '')), ''),
        creditor_account = v_creditor_account,
        description = v_description,
        payee_name = NULLIF(btrim(coalesce(p_data->>'payee_name', '')), ''),
        payment_method = v_payment_method,
        payment_account = v_payment_account,
        employee_name = coalesce(NULLIF(btrim(coalesce(p_data->>'employee_name', '')), ''), v_custody_partner_name),
        quantity = v_quantity,
        unit_price = v_unit_price,
        vat_amount = v_vat_amount,
        discount_amount = v_discount_amount,
        discount_account = NULLIF(btrim(coalesce(p_data->>'discount_account', '')), ''),
        notes = NULLIF(btrim(coalesce(p_data->>'notes', '')), ''),
        invoice_image = NULLIF(btrim(coalesce(p_data->>'invoice_image', '')), ''),
        lines_data = v_lines_data,
        is_auto_distributed = coalesce((p_data->>'is_auto_distributed')::boolean, false),
        paid_amount = v_paid_amount,
        is_posted = false,
        project_id = v_project_id,
        payee_id = v_payee_id,
        job_order_id = v_job_order_id,
        custody_id = v_custody_id,
        asset_id = v_asset_id,
        is_deducted_from_contractor = coalesce((p_data->>'is_deducted_from_contractor')::boolean, false)
    WHERE id = v_edit_id AND company_id = v_company
    RETURNING id INTO v_inserted_id;
  ELSE
    INSERT INTO public.expenses (
      company_id, client_request_id, exp_date, main_category, sub_contractor, site_ref,
      creditor_account, description, payee_name, payment_method, payment_account,
      employee_name, quantity, unit_price, vat_amount, discount_amount, discount_account,
      notes, invoice_image, lines_data, is_auto_distributed, paid_amount, is_posted,
      created_by, project_id, payee_id, job_order_id, custody_id, asset_id, is_deducted_from_contractor
    ) VALUES (
      v_company, v_client_req_id, v_exp_date,
      NULLIF(btrim(coalesce(p_data->>'main_category', '')), ''),
      NULLIF(btrim(coalesce(p_data->>'sub_contractor', '')), ''),
      NULLIF(btrim(coalesce(p_data->>'site_ref', '')), ''),
      v_creditor_account, v_description,
      NULLIF(btrim(coalesce(p_data->>'payee_name', '')), ''),
      v_payment_method, v_payment_account,
      coalesce(NULLIF(btrim(coalesce(p_data->>'employee_name', '')), ''), v_custody_partner_name),
      v_quantity, v_unit_price, v_vat_amount, v_discount_amount,
      NULLIF(btrim(coalesce(p_data->>'discount_account', '')), ''),
      NULLIF(btrim(coalesce(p_data->>'notes', '')), ''),
      NULLIF(btrim(coalesce(p_data->>'invoice_image', '')), ''),
      v_lines_data,
      coalesce((p_data->>'is_auto_distributed')::boolean, false),
      v_paid_amount,
      false,
      auth.uid(),
      v_project_id, v_payee_id, v_job_order_id, v_custody_id, v_asset_id,
      coalesce((p_data->>'is_deducted_from_contractor')::boolean, false)
    )
    ON CONFLICT ON CONSTRAINT expenses_company_client_req_uq DO NOTHING
    RETURNING id INTO v_inserted_id;

    IF v_inserted_id IS NULL AND v_client_req_id IS NOT NULL THEN
      SELECT e.id, to_jsonb(e) INTO v_existing_id, v_row_json
      FROM public.expenses e
      WHERE e.company_id = v_company
        AND e.client_request_id = v_client_req_id;

      RETURN jsonb_build_object(
        'success', true,
        'id', v_existing_id,
        'company_id', v_company,
        'client_request_id', v_client_req_id,
        '_sync_replayed', true,
        'record', v_row_json
      );
    END IF;
  END IF;

  SELECT to_jsonb(e) INTO v_row_json
  FROM public.expenses e
  WHERE e.id = v_inserted_id AND e.company_id = v_company;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_inserted_id,
    'company_id', v_company,
    'client_request_id', v_client_req_id,
    '_sync_replayed', false,
    'record', v_row_json
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_expense_draft(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_expense_draft(jsonb) TO authenticated, service_role;

-- =============================================================================
-- 6. SUPABASE REALTIME PUBLICATION FOR COMPANY-SCOPED LIVE UPDATES
-- =============================================================================
-- Uses REPLICA IDENTITY USING INDEX on (id, company_id) so WAL carries company_id
-- on INSERT/UPDATE/DELETE without putting STORED GENERATED columns (e.g. expenses.total_price,
-- labor_daily_logs.total_pay) into the replica identity.
CREATE TABLE rawasi_private.phase8_realtime_originals (
  table_name text PRIMARY KEY,
  was_in_publication boolean NOT NULL,
  prev_replident "char" NOT NULL,
  prev_replident_index text,
  created_index_name text
);

REVOKE ALL ON rawasi_private.phase8_realtime_originals FROM PUBLIC, anon, authenticated;

DO $realtime$
DECLARE
  v_tbl text;
  v_oid oid;
  v_has_pub boolean;
  v_in_pub boolean;
  v_repl "char";
  v_prev_idx text;
  v_idx_name text;
  v_created_idx text;
  v_tables text[] := ARRAY[
    'labor_daily_logs',
    'expenses',
    'site_custodies',
    'daily_cash_closings',
    'invoices',
    'invoice_adjustment_notes',
    'receipt_vouchers',
    'payment_vouchers',
    'sub_claims',
    'purchase_orders',
    'supplier_invoices',
    'material_receipts',
    'material_issues',
    'stocktaking_sessions',
    'fixed_assets',
    'journal_headers',
    'projects',
    'job_orders',
    'company_documents',
    'company_attachments'
  ];
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime' AND NOT puballtables
  ) INTO v_has_pub;

  FOREACH v_tbl IN ARRAY v_tables LOOP
    SELECT c.oid, c.relreplident INTO v_oid, v_repl
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = v_tbl;

    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'Expected table public.% to exist for Realtime registration', v_tbl;
    END IF;

    v_prev_idx := NULL;
    IF v_repl = 'i' THEN
      SELECT ic.relname INTO v_prev_idx
      FROM pg_index i
      JOIN pg_class ic ON ic.oid = i.indexrelid
      WHERE i.indrelid = v_oid AND i.indisreplident
      LIMIT 1;
    END IF;

    v_in_pub := EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = v_tbl
    );

    -- Find an existing valid unique non-partial index covering strictly (id, company_id)
    v_idx_name := NULL;
    v_created_idx := NULL;

    SELECT ic.relname INTO v_idx_name
    FROM pg_index i
    JOIN pg_class ic ON ic.oid = i.indexrelid
    WHERE i.indrelid = v_oid
      AND i.indisunique
      AND i.indisvalid
      AND i.indpred IS NULL
      AND i.indexprs IS NULL
      AND i.indnatts = 2
      AND (
        SELECT array_agg(a.attname::text ORDER BY a.attname)
        FROM unnest(i.indkey::smallint[]) AS k(attnum)
        JOIN pg_attribute a ON a.attrelid = v_oid AND a.attnum = k.attnum
      ) = ARRAY['company_id', 'id']
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(i.indkey::smallint[]) AS k(attnum)
        JOIN pg_attribute a ON a.attrelid = v_oid AND a.attnum = k.attnum
        WHERE NOT a.attnotnull OR a.attgenerated <> ''
      )
    ORDER BY i.indisprimary DESC, ic.relname
    LIMIT 1;

    IF v_idx_name IS NULL THEN
      v_created_idx := v_tbl || '_realtime_ident_idx';
      EXECUTE format('CREATE UNIQUE INDEX %I ON public.%I (id, company_id)', v_created_idx, v_tbl);
      v_idx_name := v_created_idx;
    END IF;

    INSERT INTO rawasi_private.phase8_realtime_originals(
      table_name, was_in_publication, prev_replident, prev_replident_index, created_index_name
    ) VALUES (
      v_tbl, v_in_pub, v_repl, v_prev_idx, v_created_idx
    );

    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY USING INDEX %I', v_tbl, v_idx_name);

    IF v_has_pub AND NOT v_in_pub THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.%I', v_tbl);
    END IF;
  END LOOP;
END;
$realtime$;

COMMIT;

NOTIFY pgrst, 'reload schema';


