-- Migration: 20261105170008_fixed_assets_and_depreciation.sql
-- Description: Phase 4 - Fixed Assets, Monthly Depreciation Runs, Asset Transfers between Projects, and Operational Cost Tracking

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $preflight$
BEGIN
  IF to_regclass('public.companies') IS NULL THEN
    RAISE EXCEPTION 'Multi-company system is required before Phase 4';
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
CREATE TABLE IF NOT EXISTS public.fixed_assets (
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
CREATE TABLE IF NOT EXISTS public.asset_transfers (
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
CREATE TABLE IF NOT EXISTS public.asset_depreciation_runs (
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
CREATE TABLE IF NOT EXISTS public.asset_depreciation_lines (
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
  ADD COLUMN IF NOT EXISTS asset_id uuid;

ALTER TABLE public.expenses
  DROP CONSTRAINT IF EXISTS expenses_asset_fkey;
ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_asset_fkey
  FOREIGN KEY (asset_id, company_id) REFERENCES public.fixed_assets(id, company_id) ON DELETE SET NULL;

-- Register new tables in rawasi_private.company_scoped_tables
INSERT INTO rawasi_private.company_scoped_tables(table_name)
VALUES ('fixed_assets'), ('asset_transfers'), ('asset_depreciation_runs'), ('asset_depreciation_lines')
ON CONFLICT (table_name) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS fixed_assets_company_type_idx ON public.fixed_assets(company_id, asset_type);
CREATE INDEX IF NOT EXISTS fixed_assets_company_status_idx ON public.fixed_assets(company_id, status);
CREATE INDEX IF NOT EXISTS fixed_assets_company_project_idx ON public.fixed_assets(company_id, current_project_id);
CREATE INDEX IF NOT EXISTS asset_transfers_asset_idx ON public.asset_transfers(company_id, asset_id);
CREATE INDEX IF NOT EXISTS asset_dep_runs_period_idx ON public.asset_depreciation_runs(company_id, period_year, period_month);
CREATE INDEX IF NOT EXISTS asset_dep_lines_run_idx ON public.asset_depreciation_lines(company_id, run_id);
CREATE INDEX IF NOT EXISTS expenses_asset_idx ON public.expenses(company_id, asset_id);

-- Triggers for company stamping and document numbering
DROP TRIGGER IF EXISTS aa_stamp_company_id ON public.fixed_assets;
CREATE TRIGGER aa_stamp_company_id BEFORE INSERT OR UPDATE OF company_id ON public.fixed_assets
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id();

DROP TRIGGER IF EXISTS aa_stamp_company_id ON public.asset_transfers;
CREATE TRIGGER aa_stamp_company_id BEFORE INSERT OR UPDATE OF company_id ON public.asset_transfers
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id();

DROP TRIGGER IF EXISTS aa_stamp_company_id ON public.asset_depreciation_runs;
CREATE TRIGGER aa_stamp_company_id BEFORE INSERT OR UPDATE OF company_id ON public.asset_depreciation_runs
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id();

DROP TRIGGER IF EXISTS aa_stamp_company_id ON public.asset_depreciation_lines;
CREATE TRIGGER aa_stamp_company_id BEFORE INSERT OR UPDATE OF company_id ON public.asset_depreciation_lines
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id();

DROP TRIGGER IF EXISTS trg_doc_number ON public.fixed_assets;
CREATE TRIGGER trg_doc_number BEFORE INSERT ON public.fixed_assets
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.assign_document_number('AST', 'asset_number', 'purchase_date');

DROP TRIGGER IF EXISTS trg_doc_number ON public.asset_transfers;
CREATE TRIGGER trg_doc_number BEFORE INSERT ON public.asset_transfers
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.assign_document_number('TRF', 'transfer_number', 'transfer_date');

DROP TRIGGER IF EXISTS trg_doc_number ON public.asset_depreciation_runs;
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
