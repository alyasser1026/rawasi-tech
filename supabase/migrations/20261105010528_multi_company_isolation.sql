-- Multi-company, step 2: every business record belongs to one company, and every request only
-- sees and writes the data of the company the user is working in.
--
-- How the working company is chosen (rawasi_private.current_company_id()):
--   1. the x-company-id header the app sends with each request, if the user is a member of it;
--      a company the user does not belong to gives NO company (nothing visible, nothing writable);
--   2. without the header (older app versions, realtime, background jobs): the user's default company
--      (set every time they switch), then the system default company if they belong to it;
--   3. with no signed-in user (SQL editor, maintenance): the app.company_id setting, if set.
--
-- What changes:
--   * company_id (NOT NULL) on 29 business tables. Existing rows go to the current default company
--     without rewriting them or firing their triggers. New rows get the working company automatically.
--   * A record can never be moved to another company, and a record can only point to records of its
--     own company (an extra company-aware foreign key next to every existing one).
--   * Codes and document numbers are unique per company instead of system-wide.
--   * Every existing policy on those tables keeps its module permission check and also requires the
--     row to belong to the working company. Views already run with the caller's rights, so they follow.
--   * Default accounts on invoices, journal lines and labor logs are looked up by account code inside
--     the working company instead of being fixed UUIDs of the first company.
--   * Financial statements are cached per company.
--   * copy_chart_of_accounts() and create_company(... copy_accounts_from ...) so a new company starts
--     with the same chart of accounts; list_company_members() / list_company_member_candidates().
--
-- Still to do in step 3: ten posting functions use fixed account UUIDs of the first company. In any
-- other company they now FAIL with a foreign-key error instead of posting into the wrong books.

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $preflight$
BEGIN
  IF to_regclass('public.companies') IS NULL THEN
    RAISE EXCEPTION 'Apply 20261104234711_multi_company_system.sql first';
  END IF;
  IF (SELECT count(*) FROM public.companies WHERE is_default AND is_active) <> 1 THEN
    RAISE EXCEPTION 'Exactly one active default company is required before isolating data';
  END IF;
END;
$preflight$;

-- ---------------------------------------------------------------------------
-- Which tables hold company data
-- ---------------------------------------------------------------------------
CREATE TABLE rawasi_private.company_scoped_tables (
  table_name text PRIMARY KEY
);
COMMENT ON TABLE rawasi_private.company_scoped_tables IS 'Business tables isolated per company (company_id + policies). Shared tables are not listed.';
REVOKE ALL ON rawasi_private.company_scoped_tables FROM PUBLIC, anon, authenticated;

INSERT INTO rawasi_private.company_scoped_tables (table_name) VALUES
  ('accounts'), ('boq_budget'), ('boq_items'), ('cash_flows'), ('contractor_assignments'),
  ('expenses'), ('financial_plans'), ('inventory'), ('invoices'), ('job_orders'),
  ('journal_errors'), ('journal_headers'), ('journal_lines'), ('labor_daily_logs'), ('manual_journals'),
  ('material_issue_lines'), ('material_issues'), ('material_items'), ('material_receipt_lines'), ('material_receipts'),
  ('partners'), ('payment_vouchers'), ('payroll_slips'), ('projects'), ('receipt_vouchers'),
  ('sub_claims'), ('sys_financial_reports'), ('temp_labor_daily_logs'), ('violations');
-- Shared on purpose: profiles, system_settings (per user), messages, notifications, user_requests,
-- user_tasks, audit_logs, companies, user_companies.

DO $check_tables$
DECLARE missing text;
BEGIN
  SELECT string_agg(t.table_name, ', ') INTO missing
  FROM rawasi_private.company_scoped_tables t
  WHERE to_regclass('public.' || quote_ident(t.table_name)) IS NULL;
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'Tables not found: %', missing; END IF;
END;
$check_tables$;

-- ---------------------------------------------------------------------------
-- The working company of the current request
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rawasi_private.current_company_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_requested text;
  v_company uuid;
BEGIN
  IF v_uid IS NULL THEN
    -- Trusted server-side context only (anon has no access to company tables).
    v_requested := NULLIF(current_setting('app.company_id', true), '');
    IF v_requested ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RETURN v_requested::uuid;
    END IF;
    RETURN NULL;
  END IF;

  BEGIN
    v_requested := NULLIF(current_setting('request.headers', true), '')::json ->> 'x-company-id';
  EXCEPTION WHEN others THEN
    v_requested := NULL;
  END;

  IF v_requested IS NOT NULL THEN
    IF v_requested ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       AND rawasi_private.user_in_company(v_requested::uuid) THEN
      RETURN v_requested::uuid;
    END IF;
    RETURN NULL; -- asked for a company the user cannot use: fail closed
  END IF;

  SELECT uc.company_id INTO v_company
  FROM public.user_companies AS uc
  JOIN public.companies AS c ON c.id = uc.company_id
  JOIN public.profiles AS p ON p.id = uc.user_id
  WHERE uc.user_id = v_uid AND uc.is_active AND c.is_active AND COALESCE(p.is_active, true)
  ORDER BY uc.is_default DESC, c.is_default DESC, c.created_at
  LIMIT 1;
  RETURN v_company;
END;
$$;
REVOKE ALL ON FUNCTION rawasi_private.current_company_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION rawasi_private.current_company_id() TO authenticated, service_role;

-- Stamps new rows with the working company and refuses to move rows between companies.
CREATE OR REPLACE FUNCTION rawasi_private.stamp_company_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.company_id IS NULL THEN
      NEW.company_id := rawasi_private.current_company_id();
    END IF;
    IF NEW.company_id IS NULL THEN
      RAISE EXCEPTION 'لم يتم تحديد الشركة: اختر الشركة التي تعمل عليها ثم حاول مرة أخرى' USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
    RAISE EXCEPTION 'لا يمكن نقل السجل إلى شركة أخرى' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION rawasi_private.stamp_company_id() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- company_id on every business table
-- ---------------------------------------------------------------------------
DO $add_company$
DECLARE
  v_default uuid := (SELECT id FROM public.companies WHERE is_default);
  t text;
BEGIN
  FOR t IN SELECT table_name FROM rawasi_private.company_scoped_tables ORDER BY table_name LOOP
    -- A constant default fills existing rows instantly (no rewrite, no row triggers).
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN company_id uuid NOT NULL DEFAULT %L REFERENCES public.companies(id) ON DELETE RESTRICT', t, v_default);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN company_id SET DEFAULT rawasi_private.current_company_id()', t);
    EXECUTE format('CREATE INDEX %I ON public.%I (company_id)', t || '_company_id_idx', t);
    EXECUTE format('CREATE TRIGGER aa_stamp_company_id BEFORE INSERT OR UPDATE OF company_id ON public.%I FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id()', t);
    EXECUTE format('COMMENT ON COLUMN public.%I.company_id IS %L', t, 'Owning company; set automatically from the working company.');
  END LOOP;
END;
$add_company$;

-- ---------------------------------------------------------------------------
-- A record may only reference records of its own company
-- ---------------------------------------------------------------------------
DO $company_fks$
DECLARE
  r record;
  v_parent text;
BEGIN
  -- (id, company_id) keys on every table that other company tables point to
  FOR v_parent IN
    SELECT DISTINCT pc.relname
    FROM pg_constraint con
    JOIN pg_class cc ON cc.oid = con.conrelid
    JOIN pg_class pc ON pc.oid = con.confrelid
    WHERE con.contype = 'f' AND con.connamespace = 'public'::regnamespace
      AND cc.relname IN (SELECT table_name FROM rawasi_private.company_scoped_tables)
      AND pc.relname IN (SELECT table_name FROM rawasi_private.company_scoped_tables)
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I UNIQUE (id, company_id)', v_parent, v_parent || '_id_company_key');
  END LOOP;

  -- one company-aware foreign key next to each single-column foreign key between company tables
  FOR r IN
    SELECT cc.relname AS child, pc.relname AS parent, a.attname AS col, con.confdeltype AS on_delete
    FROM pg_constraint con
    JOIN pg_class cc ON cc.oid = con.conrelid
    JOIN pg_class pc ON pc.oid = con.confrelid
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
    WHERE con.contype = 'f' AND con.connamespace = 'public'::regnamespace
      AND array_length(con.conkey, 1) = 1
      AND cc.relname IN (SELECT table_name FROM rawasi_private.company_scoped_tables)
      AND pc.relname IN (SELECT table_name FROM rawasi_private.company_scoped_tables)
    ORDER BY 1, 3
  LOOP
    -- Same delete behaviour as the original key, so the two never disagree about the order they run in.
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I, company_id) REFERENCES public.%I (id, company_id) %s',
                   r.child, left(r.child || '_' || r.col, 48) || '_company_fkey', r.col, r.parent,
                   CASE r.on_delete
                     WHEN 'c' THEN 'ON DELETE CASCADE'
                     WHEN 'n' THEN format('ON DELETE SET NULL (%I)', r.col)
                     WHEN 'r' THEN 'ON DELETE RESTRICT'
                     ELSE 'ON DELETE NO ACTION'
                   END);
  END LOOP;
END;
$company_fks$;

-- ---------------------------------------------------------------------------
-- Codes and document numbers: unique per company
-- ---------------------------------------------------------------------------
DO $per_company_unique$
DECLARE
  wanted text[] := ARRAY[
    'accounts_code_key', 'boq_budget_code_unique', 'boq_items_item_code_key', 'invoices_invoice_number_key',
    'job_orders_order_number_key', 'manual_journals_voucher_number_key', 'material_items_item_code_key',
    'unique_material_name_key', 'material_receipts_receipt_number_key', 'partners_code_key',
    'payment_vouchers_voucher_number_key', 'projects_project_code_key', 'unique_project_name_idx',
    'receipt_vouchers_receipt_number_key', 'sub_claims_claim_number_key'];
  r record;
  n integer := 0;
BEGIN
  FOR r IN
    SELECT con.conname, cl.relname AS tbl,
           (SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY array_position(con.conkey, a.attnum))
            FROM pg_attribute a WHERE a.attrelid = con.conrelid AND a.attnum = ANY (con.conkey)) AS cols
    FROM pg_constraint con
    JOIN pg_class cl ON cl.oid = con.conrelid
    WHERE con.contype = 'u' AND con.connamespace = 'public'::regnamespace AND con.conname = ANY (wanted)
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.tbl, r.conname);
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I UNIQUE (company_id, %s)', r.tbl, r.conname, r.cols);
    n := n + 1;
  END LOOP;
  IF n <> array_length(wanted, 1) THEN
    RAISE EXCEPTION 'Expected % unique constraints to scope per company, found %', array_length(wanted, 1), n;
  END IF;
END;
$per_company_unique$;

-- ---------------------------------------------------------------------------
-- Policies: same module permission + the row belongs to the working company
-- ---------------------------------------------------------------------------
-- The original expressions are kept so the rollback script can restore them exactly.
CREATE TABLE rawasi_private.company_policy_originals (
  tablename text NOT NULL,
  policyname text NOT NULL,
  qual text,
  with_check text,
  PRIMARY KEY (tablename, policyname)
);
REVOKE ALL ON rawasi_private.company_policy_originals FROM PUBLIC, anon, authenticated;
INSERT INTO rawasi_private.company_policy_originals (tablename, policyname, qual, with_check)
SELECT tablename, policyname, qual, with_check FROM pg_policies
WHERE schemaname = 'public' AND tablename IN (SELECT table_name FROM rawasi_private.company_scoped_tables);

DO $policies$
DECLARE
  r record;
  cond constant text := 'company_id = (SELECT rawasi_private.current_company_id())';
  missing text;
BEGIN
  SELECT string_agg(t.table_name, ', ') INTO missing
  FROM rawasi_private.company_scoped_tables t
  JOIN pg_class c ON c.relname = t.table_name AND c.relnamespace = 'public'::regnamespace
  WHERE NOT c.relrowsecurity
     OR NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = t.table_name);
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'RLS or policies missing on: %', missing; END IF;

  FOR r IN
    SELECT p.policyname, p.tablename, p.qual, p.with_check
    FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename IN (SELECT table_name FROM rawasi_private.company_scoped_tables)
  LOOP
    IF r.qual IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON public.%I USING ((%s) AND %s)', r.policyname, r.tablename, r.qual, cond);
    END IF;
    IF r.with_check IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON public.%I WITH CHECK ((%s) AND %s)', r.policyname, r.tablename, r.with_check, cond);
    END IF;
  END LOOP;
END;
$policies$;

-- ---------------------------------------------------------------------------
-- Default accounts by code inside the working company
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rawasi_private.company_account_id(p_code text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT a.id FROM public.accounts AS a
  WHERE a.company_id = rawasi_private.current_company_id() AND a.code = p_code
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION rawasi_private.company_account_id(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION rawasi_private.company_account_id(text) TO authenticated, service_role;

DO $account_defaults$
DECLARE
  r record;
  v_code text;
BEGIN
  FOR r IN
    SELECT c.relname AS tbl, a.attname AS col,
           (regexp_match(pg_get_expr(d.adbin, d.adrelid), '''([0-9a-fA-F-]{36})''::uuid'))[1]::uuid AS account_id
    FROM pg_attrdef d
    JOIN pg_class c ON c.oid = d.adrelid
    JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
    WHERE c.relnamespace = 'public'::regnamespace
      AND c.relname IN (SELECT table_name FROM rawasi_private.company_scoped_tables)
      AND pg_get_expr(d.adbin, d.adrelid) ~ '^''[0-9a-fA-F-]{36}''::uuid$'
  LOOP
    SELECT code INTO v_code FROM public.accounts WHERE id = r.account_id;
    IF v_code IS NULL THEN
      RAISE EXCEPTION 'Default of %.% points to an unknown account %', r.tbl, r.col, r.account_id;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I SET DEFAULT rawasi_private.company_account_id(%L)', r.tbl, r.col, v_code);
  END LOOP;
END;
$account_defaults$;

-- ---------------------------------------------------------------------------
-- Financial statements cached per company
-- ---------------------------------------------------------------------------
ALTER TABLE public.sys_financial_reports DROP CONSTRAINT sys_financial_reports_pkey;
ALTER TABLE public.sys_financial_reports ADD CONSTRAINT sys_financial_reports_pkey PRIMARY KEY (company_id, report_name);

DROP FUNCTION public.generate_financial_reports_json();

CREATE FUNCTION public.generate_financial_reports_json(p_company_id uuid DEFAULT NULL)
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
$$;
REVOKE ALL ON FUNCTION public.generate_financial_reports_json(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_financial_reports_json(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION rawasi_private.trg_refresh_financial_reports()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_company uuid := rawasi_private.current_company_id();
  r record;
BEGIN
  IF v_company IS NOT NULL THEN
    PERFORM public.generate_financial_reports_json(v_company);
  ELSIF auth.uid() IS NULL THEN
    -- maintenance without a selected company: refresh every company
    FOR r IN SELECT id FROM public.companies WHERE is_active LOOP
      PERFORM public.generate_financial_reports_json(r.id);
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- Starting a new company from an existing chart of accounts
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.copy_chart_of_accounts(p_source_company uuid, p_target_company uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT rawasi_private.is_company_admin(p_target_company) THEN
    RAISE EXCEPTION 'You are not allowed to set up this company' USING ERRCODE = '42501';
  END IF;
  IF NOT (rawasi_private.is_admin() OR rawasi_private.user_in_company(p_source_company)) THEN
    RAISE EXCEPTION 'You cannot copy from a company you do not belong to' USING ERRCODE = '42501';
  END IF;
  IF p_source_company = p_target_company THEN
    RAISE EXCEPTION 'Choose a different company to copy from' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.accounts WHERE company_id = p_target_company) THEN
    RAISE EXCEPTION 'This company already has a chart of accounts' USING ERRCODE = '22023';
  END IF;

  WITH src AS (
    SELECT a.id, a.code, a.name, a.account_type, a.parent_id, a.is_transactional, gen_random_uuid() AS new_id
    FROM public.accounts AS a
    WHERE a.company_id = p_source_company
  ), inserted AS (
    INSERT INTO public.accounts (id, code, name, account_type, parent_id, is_transactional, company_id)
    SELECT s.new_id, s.code, s.name, s.account_type, parent.new_id, s.is_transactional, p_target_company
    FROM src AS s
    LEFT JOIN src AS parent ON parent.id = s.parent_id
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM inserted;
  RETURN v_count;
END;
$$;

-- create_company now accepts "copy_accounts_from": <company id>.
CREATE OR REPLACE FUNCTION public.create_company(p_company jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_id uuid;
  v_copy_from text;
BEGIN
  IF v_uid IS NULL OR NOT rawasi_private.is_admin() THEN
    RAISE EXCEPTION 'Only an administrator can create companies' USING ERRCODE = '42501';
  END IF;
  IF p_company IS NULL OR jsonb_typeof(p_company) <> 'object' THEN
    RAISE EXCEPTION 'Company data is required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.companies (code, name, legal_name, tax_number, cr_number, currency, country,
                                email, phone, address, logo_url, brand_color, fiscal_year_start, created_by)
  VALUES (
    upper(rawasi_private.clean_company_text(p_company ->> 'code')),
    rawasi_private.clean_company_text(p_company ->> 'name'),
    rawasi_private.clean_company_text(p_company ->> 'legal_name'),
    rawasi_private.clean_company_text(p_company ->> 'tax_number'),
    rawasi_private.clean_company_text(p_company ->> 'cr_number'),
    COALESCE(upper(rawasi_private.clean_company_text(p_company ->> 'currency')), 'SAR'),
    COALESCE(upper(rawasi_private.clean_company_text(p_company ->> 'country')), 'SA'),
    rawasi_private.clean_company_text(p_company ->> 'email'),
    rawasi_private.clean_company_text(p_company ->> 'phone'),
    rawasi_private.clean_company_text(p_company ->> 'address'),
    rawasi_private.clean_company_text(p_company ->> 'logo_url'),
    COALESCE(rawasi_private.clean_company_text(p_company ->> 'brand_color'), '#F97316'),
    NULLIF(p_company ->> 'fiscal_year_start', '')::date,
    v_uid
  )
  RETURNING id INTO v_id;

  INSERT INTO public.user_companies (user_id, company_id, role, created_by)
  VALUES (v_uid, v_id, 'admin', v_uid);

  v_copy_from := rawasi_private.clean_company_text(p_company ->> 'copy_accounts_from');
  IF v_copy_from IS NOT NULL THEN
    PERFORM public.copy_chart_of_accounts(v_copy_from::uuid, v_id);
  END IF;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Members screen
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_company_members(p_company_id uuid)
RETURNS TABLE (user_id uuid, full_name text, email text, role text, is_active boolean, is_default boolean, system_role text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT rawasi_private.is_company_admin(p_company_id) THEN
    RAISE EXCEPTION 'You are not allowed to see the members of this company' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT uc.user_id, p.full_name, p.email, uc.role, uc.is_active, uc.is_default,
         CASE WHEN COALESCE(p.is_admin, false) THEN 'super_admin' ELSE COALESCE(p.role, 'client') END
  FROM public.user_companies AS uc
  JOIN public.profiles AS p ON p.id = uc.user_id
  WHERE uc.company_id = p_company_id
  ORDER BY uc.is_active DESC, uc.role, p.full_name NULLS LAST;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_company_member_candidates(p_company_id uuid)
RETURNS TABLE (user_id uuid, full_name text, email text, system_role text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT rawasi_private.is_company_admin(p_company_id) THEN
    RAISE EXCEPTION 'You are not allowed to manage members of this company' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT p.id, p.full_name, p.email,
         CASE WHEN COALESCE(p.is_admin, false) THEN 'super_admin' ELSE COALESCE(p.role, 'client') END
  FROM public.profiles AS p
  WHERE COALESCE(p.is_active, true)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_companies AS uc
      WHERE uc.user_id = p.id AND uc.company_id = p_company_id AND uc.is_active)
  ORDER BY p.full_name NULLS LAST;
END;
$$;

DO $grants$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.copy_chart_of_accounts(uuid, uuid)',
    'public.create_company(jsonb)',
    'public.list_company_members(uuid)',
    'public.list_company_member_candidates(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn);
  END LOOP;
END;
$grants$;

-- Rebuild the cached statements of the default company under the new key.
SELECT public.generate_financial_reports_json((SELECT id FROM public.companies WHERE is_default));
