-- Tests for multi-company step 3 (posting functions and report statuses).
-- Run after 10_multi_company_fixture.sql and steps 1, 2 and 3 on a fresh database.
\set ON_ERROR_STOP 0
SET client_min_messages = notice;

DROP SCHEMA IF EXISTS t CASCADE;
CREATE SCHEMA t;
GRANT USAGE ON SCHEMA t TO anon, authenticated;
CREATE FUNCTION t.ok(label text, q text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN EXECUTE q; RAISE NOTICE 'PASS %', label;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'FAIL % -> unexpected error % %', label, SQLSTATE, SQLERRM; END $$;
CREATE FUNCTION t.err(label text, q text, state text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN EXECUTE q; RAISE NOTICE 'FAIL % -> no error (expected %)', label, state;
EXCEPTION WHEN OTHERS THEN
  IF state IS NULL OR SQLSTATE = state THEN RAISE NOTICE 'PASS % (% %)', label, SQLSTATE, left(SQLERRM, 90);
  ELSE RAISE NOTICE 'FAIL % -> got % % (expected %)', label, SQLSTATE, SQLERRM, state; END IF; END $$;
CREATE FUNCTION t.eq(label text, q text, expected text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE got text;
BEGIN EXECUTE q INTO got;
  IF got IS NOT DISTINCT FROM expected THEN RAISE NOTICE 'PASS % = %', label, got;
  ELSE RAISE NOTICE 'FAIL % -> got % (expected %)', label, got, expected; END IF;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'FAIL % -> error % %', label, SQLSTATE, SQLERRM; END $$;
-- account codes used by the journal lines of one source document, in line order
CREATE FUNCTION t.codes(p_reference uuid) RETURNS text LANGUAGE sql AS $$
  SELECT string_agg(a.code || CASE WHEN a.company_id = l.company_id AND h.company_id = l.company_id THEN '' ELSE '!' END, ',' ORDER BY l.debit DESC, a.code)
  FROM public.journal_headers h
  JOIN public.journal_lines l ON l.header_id = h.id
  JOIN public.accounts a ON a.id = l.account_id
  WHERE h.reference_id = p_reference $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA t TO anon, authenticated;

-- A (system admin) creates RYC with a copy of the chart, and EMPTY without any accounts
SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', false);
SET ROLE authenticated;
SELECT id AS phi FROM public.companies WHERE code = 'PHI' \gset
SELECT public.create_company(jsonb_build_object('code', 'RYC', 'name', 'شركة اختبار ثانية', 'copy_accounts_from', :'phi')) AS ryc \gset
SELECT public.create_company(jsonb_build_object('code', 'EMPTY', 'name', 'شركة بدون حسابات')) AS empty_co \gset
SELECT t.err('missing account code gives a clear error', $q$select rawasi_private.require_company_account('9999')$q$, 'P0002');

-- the same documents posted in each company
\set CO :phi
\ir 50_step3_company.sql
\set CO :ryc
\ir 50_step3_company.sql

-- RYC statements now include 'posted' journals (violation income 20, labor 100 + claim 1000 costs)
SELECT set_config('request.headers', format('{"x-company-id":"%s"}', :'ryc'), false);
SELECT t.eq('RYC statements: revenue from posted journals', $q$select report_data ->> 'total_revenue' from public.sys_financial_reports where report_name = 'IncomeStatement'$q$, '20.00');
SELECT t.eq('RYC statements: expenses from posted journals', $q$select report_data ->> 'total_expense' from public.sys_financial_reports where report_name = 'IncomeStatement'$q$, '1100.00');
SELECT t.eq('RYC trial balance counts every posted journal', $q$select (sum(period_debit) = (select sum(debit) from public.journal_lines))::text from public.get_trial_balance(current_date - 1, current_date + 1)$q$, 'true');
SELECT t.eq('RYC trial balance balances', $q$select (sum(period_debit) = sum(period_credit))::text from public.get_trial_balance(current_date - 1, current_date + 1)$q$, 'true');
SELECT t.eq('PHI journals invisible from RYC', format($q$select count(*)::text from public.journal_lines where company_id = %L$q$, :'phi'), '0');

-- Draft lines must not contribute, and an empty date range must preserve zero-balance accounts.
INSERT INTO public.journal_headers (entry_date, description, status)
VALUES (current_date, 'draft excluded from reports', 'draft') RETURNING id AS draft_header \gset
SELECT public.save_journal_draft(:'draft_header', current_date, 'draft excluded from reports',
  jsonb_build_array(
    jsonb_build_object('account_id', rawasi_private.require_company_account('122'), 'debit', 987, 'credit', 0),
    jsonb_build_object('account_id', rawasi_private.require_company_account('216'), 'debit', 0, 'credit', 987)));
SELECT t.eq('detailed report excludes draft amounts', $q$
  select (sum(r.total_debit) = (select sum(l.debit) from public.journal_lines l join public.journal_headers h on h.id = l.header_id where h.status in ('posted','مرحل','معتمد')))::text
  from public.get_accounts_report_with_lines(current_date - 1, current_date + 1) r where r.is_transactional$q$, 'true');
SELECT t.eq('detailed report excludes draft transactions', $q$
  select (sum(jsonb_array_length(r.transactions)) = (select count(*) from public.journal_lines l join public.journal_headers h on h.id = l.header_id where h.status in ('posted','مرحل','معتمد')))::text
  from public.get_accounts_report_with_lines(current_date - 1, current_date + 1) r where r.is_transactional$q$, 'true');
SELECT t.eq('detailed report excludes out-of-period amounts and transactions', $q$
  select (count(*) > 0 and bool_and(total_debit = 0 and total_credit = 0 and transactions = '[]'::jsonb))::text
  from public.get_accounts_report_with_lines(current_date + 10, current_date + 11)$q$, 'true');

-- a company without a chart cannot post, and nothing is half-posted
SELECT set_config('request.headers', format('{"x-company-id":"%s"}', :'empty_co'), false);
SELECT t.ok('EMPTY: labor log saved (no default accounts)', $q$insert into public.labor_daily_logs (work_date, worker_name, daily_wage) values (current_date, 'عامل', 100)$q$);
SELECT t.err('EMPTY: posting stops with the missing account', $q$select public.post_labor_logs_bulk(array(select id from public.labor_daily_logs))$q$, 'P0002');
SELECT t.eq('EMPTY: labor log still unposted', $q$select coalesce(bool_or(is_posted), false)::text from public.labor_daily_logs$q$, 'false');
SELECT t.eq('EMPTY: no journal created', 'select count(*)::text from public.journal_headers', '0');
SELECT set_config('request.headers', '', false);
RESET ROLE;

SELECT t.eq('no posting function keeps a fixed account id', $q$
  select count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('bulk_disburse_expenses','bulk_disburse_optimized','bulk_disburse_v2','post_labor_logs_bulk','post_sub_claim_to_journal','post_violations_bulk','rpc_post_claim','rpc_post_material','rpc_post_material_claim')
    and p.prosrc ~ '''[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'''$q$, '0');
