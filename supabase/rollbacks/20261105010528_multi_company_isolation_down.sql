-- Undo 20261105010528_multi_company_isolation.sql (multi-company step 2).
-- Kept outside supabase/migrations so the CLI never runs it by itself.
-- Refuses to run while any company other than the default one owns business records,
-- because removing company_id would mix their books together.
-- Run in the SQL editor, then delete version 20261105010528 from supabase_migrations.schema_migrations.
BEGIN;
SET LOCAL lock_timeout = '10s';

DO $guard$
DECLARE
  v_default uuid := (SELECT id FROM public.companies WHERE is_default);
  t text;
  n bigint;
BEGIN
  FOR t IN SELECT table_name FROM rawasi_private.company_scoped_tables LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE company_id <> %L', t, v_default) INTO n;
    IF n > 0 AND t <> 'sys_financial_reports' THEN
      RAISE EXCEPTION 'Table % has % rows in other companies; move or delete them first', t, n;
    END IF;
  END LOOP;
END;
$guard$;

-- functions added or changed by step 2
DROP FUNCTION IF EXISTS public.list_company_member_candidates(uuid);
DROP FUNCTION IF EXISTS public.list_company_members(uuid);
DROP FUNCTION IF EXISTS public.copy_chart_of_accounts(uuid, uuid);

-- step-1 version (verbatim)
CREATE OR REPLACE FUNCTION public.create_company(p_company jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_id uuid;
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

  RETURN v_id;
END;
$function$;

-- original trigger function (verbatim)
CREATE OR REPLACE FUNCTION rawasi_private.trg_refresh_financial_reports()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
BEGIN
    -- We simply call the generator asynchronously or synchronously
    -- It takes a fraction of a second so running it synchronously is fine.
    PERFORM public.generate_financial_reports_json();
    RETURN NULL;
END;
$function$;

DROP FUNCTION IF EXISTS public.generate_financial_reports_json(uuid);
-- original statements generator (verbatim)
CREATE FUNCTION public.generate_financial_reports_json()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
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
$function$;
REVOKE ALL ON FUNCTION public.generate_financial_reports_json() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_financial_reports_json() TO authenticated, service_role;

-- default accounts back to the default company's account ids
DO $defaults$
DECLARE
  v_default uuid := (SELECT id FROM public.companies WHERE is_default);
  r record;
  v_id uuid;
BEGIN
  FOR r IN
    SELECT c.relname AS tbl, a.attname AS col, (regexp_match(pg_get_expr(d.adbin, d.adrelid), 'company_account_id\(''([^'']+)''')) [1] AS code
    FROM pg_attrdef d
    JOIN pg_class c ON c.oid = d.adrelid
    JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
    WHERE c.relnamespace = 'public'::regnamespace AND pg_get_expr(d.adbin, d.adrelid) LIKE 'rawasi_private.company_account_id(%'
  LOOP
    SELECT id INTO v_id FROM public.accounts WHERE company_id = v_default AND code = r.code;
    IF v_id IS NULL THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP DEFAULT', r.tbl, r.col);
    ELSE
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I SET DEFAULT %L::uuid', r.tbl, r.col, v_id);
    END IF;
  END LOOP;
END;
$defaults$;
DROP FUNCTION IF EXISTS rawasi_private.company_account_id(text);

-- policies exactly as they were before step 2
DO $policies$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM rawasi_private.company_policy_originals LOOP
    IF r.qual IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON public.%I USING (%s)', r.policyname, r.tablename, r.qual);
    END IF;
    IF r.with_check IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON public.%I WITH CHECK (%s)', r.policyname, r.tablename, r.with_check);
    END IF;
  END LOOP;
END;
$policies$;

-- statements cache keyed by report name again
DELETE FROM public.sys_financial_reports WHERE company_id <> (SELECT id FROM public.companies WHERE is_default);
ALTER TABLE public.sys_financial_reports DROP CONSTRAINT sys_financial_reports_pkey;
ALTER TABLE public.sys_financial_reports ADD CONSTRAINT sys_financial_reports_pkey PRIMARY KEY (report_name);

-- unique constraints without company_id, then drop the column (and its keys, index and trigger)
DO $columns$
DECLARE
  r record;
  t text;
BEGIN
  FOR r IN
    SELECT con.conname, cl.relname AS tbl,
           (SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY array_position(con.conkey, a.attnum))
            FROM pg_attribute a WHERE a.attrelid = con.conrelid AND a.attnum = ANY (con.conkey) AND a.attname <> 'company_id') AS cols
    FROM pg_constraint con
    JOIN pg_class cl ON cl.oid = con.conrelid
    WHERE con.contype = 'u' AND con.connamespace = 'public'::regnamespace
      AND cl.relname IN (SELECT table_name FROM rawasi_private.company_scoped_tables)
      AND pg_get_constraintdef(con.oid) LIKE 'UNIQUE (company_id, %'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.tbl, r.conname);
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I UNIQUE (%s)', r.tbl, r.conname, r.cols);
  END LOOP;

  FOR r IN
    SELECT con.conname, cl.relname AS tbl FROM pg_constraint con JOIN pg_class cl ON cl.oid = con.conrelid
    WHERE con.connamespace = 'public'::regnamespace AND con.contype = 'f' AND con.conname LIKE '%\_company\_fkey'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
  FOR r IN
    SELECT con.conname, cl.relname AS tbl FROM pg_constraint con JOIN pg_class cl ON cl.oid = con.conrelid
    WHERE con.connamespace = 'public'::regnamespace AND con.contype = 'u' AND con.conname LIKE '%\_id\_company\_key'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;

  FOR t IN SELECT table_name FROM rawasi_private.company_scoped_tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS aa_stamp_company_id ON public.%I', t);
    EXECUTE format('ALTER TABLE public.%I DROP COLUMN company_id', t);
  END LOOP;
END;
$columns$;

DROP FUNCTION IF EXISTS rawasi_private.stamp_company_id();
DROP FUNCTION IF EXISTS rawasi_private.current_company_id();
DROP TABLE IF EXISTS rawasi_private.company_policy_originals;
DROP TABLE IF EXISTS rawasi_private.company_scoped_tables;

COMMIT;
