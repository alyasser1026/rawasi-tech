-- Isolation tests for multi-company step 2. Run after 10_multi_company_fixture.sql, step 1 and step 2.
-- Every check prints PASS or FAIL; any "ERROR" line outside a check is also a failure.
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
  IF state IS NULL OR SQLSTATE = state THEN RAISE NOTICE 'PASS % (% %)', label, SQLSTATE, left(SQLERRM, 70);
  ELSE RAISE NOTICE 'FAIL % -> got % % (expected %)', label, SQLSTATE, SQLERRM, state; END IF; END $$;
CREATE FUNCTION t.eq(label text, q text, expected text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE got text;
BEGIN EXECUTE q INTO got;
  IF got IS NOT DISTINCT FROM expected THEN RAISE NOTICE 'PASS % = %', label, got;
  ELSE RAISE NOTICE 'FAIL % -> got % (expected %)', label, got, expected; END IF;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'FAIL % -> error % %', label, SQLSTATE, SQLERRM; END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA t TO anon, authenticated;

\set A 'aaaaaaaa-0000-0000-0000-000000000001'
\set S 'aaaaaaaa-0000-0000-0000-000000000002'
\set T 'aaaaaaaa-0000-0000-0000-000000000007'
\set PERMS '{"accounts":["view","create","edit","delete"],"partners":["view","create","edit","delete"],"journal":["view","create","edit","delete"],"projects":["view","create","edit","delete"],"subclaims":["view","create","edit","delete"],"expenses":["view","create","edit","delete"],"invoices":["view","create","edit","delete"],"financial_statements":["view","create","edit"]}'

-- ---------- setup (postgres, no request context) ----------
SELECT set_config('request.jwt.claims', '', false), set_config('request.headers', '', false);
UPDATE public.profiles SET permissions = :'PERMS'::jsonb WHERE id = :'S';
INSERT INTO auth.users (id, email) VALUES (:'T', 't@test.local');
UPDATE public.profiles SET role = 'staff', permissions = :'PERMS'::jsonb WHERE id = :'T';
SELECT id AS phi FROM public.companies WHERE code = 'PHI' \gset
SELECT id AS phi_cash FROM public.accounts WHERE code = '122' \gset
SELECT id AS phi_customers FROM public.accounts WHERE code = '123' \gset

SELECT t.eq('existing rows went to the default company', $q$select count(*)::text from public.accounts where company_id = (select id from public.companies where is_default)$q$, '61');
SELECT t.eq('no row without a company', $q$select count(*)::text from public.accounts where company_id is null$q$, '0');

-- A (system admin) creates a second company with a copy of the chart of accounts and adds T to it
SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', false);
SET ROLE authenticated;
SELECT public.create_company(jsonb_build_object('code', 'RYC', 'name', 'شركة اختبار ثانية', 'copy_accounts_from', :'phi')) AS ryc \gset
SELECT t.ok('A adds T to RYC', format($q$select public.add_company_member(%L, %L, 'member')$q$, :'ryc', :'T'));
SELECT t.err('copy into a company that has accounts', format($q$select public.copy_chart_of_accounts(%L, %L)$q$, :'phi', :'ryc'), '22023');
SELECT t.eq('A members of RYC', format($q$select count(*)::text from public.list_company_members(%L)$q$, :'ryc'), '2');
SELECT t.eq('S is a candidate for RYC', format($q$select count(*)::text from public.list_company_member_candidates(%L) where user_id = %L$q$, :'ryc', :'S'), '1');
RESET ROLE;
SELECT set_config('request.jwt.claims', '', false);

SELECT t.eq('RYC got its own chart', format($q$select count(*)::text from public.accounts where company_id = %L$q$, :'ryc'), '61');
SELECT t.eq('RYC parents stay inside RYC', format($q$select count(*)::text from public.accounts a join public.accounts p on p.id = a.parent_id where a.company_id = %L and p.company_id <> %L$q$, :'ryc', :'ryc'), '0');
SELECT t.eq('same account code exists in both companies', $q$select count(*)::text from public.accounts where code = '215'$q$, '2');
SELECT id AS ryc_cash FROM public.accounts WHERE code = '122' AND company_id = :'ryc' \gset
SELECT id AS ryc_revenue FROM public.accounts WHERE code = '41' AND company_id = :'ryc' \gset

-- ---------- S: member of PHI only, old app (no header) ----------
SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', false);
SET ROLE authenticated;
SELECT t.eq('S works in PHI by default', 'select rawasi_private.current_company_id()::text', :'phi');
SELECT t.eq('S sees PHI accounts only', 'select count(*)::text from public.accounts', '61');
SELECT t.ok('S adds a partner', $q$insert into public.partners (code, name, partner_type) values ('P-1', 'شريك فاي', 'عميل')$q$);
SELECT t.eq('partner stamped with PHI', $q$select company_id::text from public.partners where code = 'P-1'$q$, :'phi');
SELECT t.eq('PHI default VAT account', $q$select rawasi_private.company_account_id('215')::text$q$, '990c949c-5f32-40d7-8d36-5fe45a6c892c');
SELECT t.err('S cannot list RYC members', format($q$select * from public.list_company_members(%L)$q$, :'ryc'), '42501');
-- S asks for a company it does not belong to
SELECT set_config('request.headers', format('{"x-company-id":"%s"}', :'ryc'), false);
SELECT t.eq('foreign company header gives no company', 'select (rawasi_private.current_company_id() is null)::text', 'true');
SELECT t.eq('foreign company header shows nothing', 'select count(*)::text from public.accounts', '0');
SELECT t.err('foreign company header cannot write', $q$insert into public.partners (code, name, partner_type) values ('P-X', 'x', 'عميل')$q$, '42501');
SELECT set_config('request.headers', '{"x-company-id":"not-a-uuid"}', false);
SELECT t.eq('malformed header shows nothing', 'select count(*)::text from public.accounts', '0');
SELECT set_config('request.headers', '', false);
RESET ROLE;

-- ---------- T: member of RYC only ----------
SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000007","role":"authenticated"}', false);
SET ROLE authenticated;
SELECT t.eq('T works in RYC', 'select rawasi_private.current_company_id()::text', :'ryc');
SELECT t.eq('T sees the RYC chart only', format($q$select count(*)::text from public.accounts where company_id = %L$q$, :'ryc'), '61');
SELECT t.eq('T sees no PHI account', format($q$select count(*)::text from public.accounts where company_id = %L$q$, :'phi'), '0');
SELECT t.ok('same partner code allowed in RYC', $q$insert into public.partners (code, name, partner_type) values ('P-1', 'شريك الثانية', 'عميل')$q$);
SELECT t.eq('T sees only its own P-1', $q$select string_agg(name, ',') from public.partners where code = 'P-1'$q$, 'شريك الثانية');
SELECT t.err('duplicate code inside one company still rejected', $q$insert into public.partners (code, name, partner_type) values ('P-1', 'dup', 'عميل')$q$, '23505');
SELECT t.eq('T cannot touch PHI rows', format($q$with u as (update public.partners set name = 'hacked' where company_id = %L returning 1) select count(*)::text from u$q$, :'phi'), '0');
SELECT t.err('T cannot move a record to PHI', format($q$update public.partners set company_id = %L where code = 'P-1'$q$, :'phi'), '42501');
SELECT t.err('T cannot insert into PHI explicitly', format($q$insert into public.partners (code, name, partner_type, company_id) values ('P-2', 'x', 'عميل', %L)$q$, :'phi'), '42501');
SELECT t.err('T cannot point to a PHI account', format($q$insert into public.partners (code, name, partner_type, account_id) values ('P-3', 'x', 'عميل', %L)$q$, :'phi_customers'), '23503');
SELECT t.eq('RYC default VAT account is its own', format($q$select (a.company_id = %L)::text from public.accounts a where a.id = rawasi_private.company_account_id('215')$q$, :'ryc'), 'true');
SELECT t.err('T cannot refresh PHI statements', format($q$select public.generate_financial_reports_json(%L)$q$, :'phi'), '42501');

-- a job order for a subcontractor creates its assignment in the same company (definer trigger)
SELECT t.ok('T adds project, contractor and job order', $q$
  with p as (insert into public."projects" ("Property") values ('مشروع الثانية') returning id),
       c as (insert into public.partners (code, name, partner_type) values ('SUB-1', 'مقاول', 'مقاول باطن') returning id)
  insert into public.job_orders (order_number, project_id, contractor_id, executor_type, assigned_qty, unit_price)
  select 'JO-1', p.id, c.id, 'مقاول باطن', 1, 100 from p, c$q$);
SELECT t.eq('assignment created in RYC', format($q$select count(*)::text from public.contractor_assignments where company_id = %L$q$, :'ryc'), '1');
RESET ROLE;

-- T posts a balanced journal in RYC (one transaction, balance checked at commit)
BEGIN;
SET LOCAL ROLE authenticated;
INSERT INTO public.journal_headers (entry_date, description, status) VALUES (current_date, 'قيد الشركة الثانية', 'معتمد') RETURNING id AS jh \gset
INSERT INTO public.journal_lines (header_id, account_id, debit, credit) VALUES (:'jh', :'ryc_cash', 1000, 0), (:'jh', :'ryc_revenue', 0, 1000);
COMMIT;

SET ROLE authenticated;
SELECT t.eq('RYC journal stamped RYC', format($q$select string_agg(distinct company_id::text, ',') from public.journal_lines where header_id = %L$q$, :'jh'), :'ryc');
SELECT t.eq('RYC statements refreshed for RYC', $q$select report_data ->> 'total_revenue' from public.sys_financial_reports where report_name = 'IncomeStatement'$q$, '1000.00');
SELECT t.eq('T sees its journal in the view', 'select count(*)::text from public.journal_master_view', (SELECT count(*)::text FROM public.journal_lines WHERE header_id = :'jh'));
RESET ROLE;
-- T cannot post against a PHI account
BEGIN;
SET LOCAL ROLE authenticated;
INSERT INTO public.journal_headers (entry_date, description, status) VALUES (current_date, 'قيد مخالف', 'مسودة') RETURNING id AS jh_bad \gset
SELECT t.err('journal line on a PHI account rejected', format($q$insert into public.journal_lines (header_id, account_id, debit, credit) values (%L, %L, 5, 0)$q$, :'jh_bad', :'phi_cash'), '23503');
ROLLBACK;

-- ---------- back to S: PHI untouched ----------
SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', false);
SET ROLE authenticated;
SELECT t.eq('PHI statements not affected', $q$select coalesce(report_data ->> 'total_revenue', 'none') from public.sys_financial_reports where report_name = 'IncomeStatement'$q$, '0');
SELECT t.eq('S sees no RYC journal', 'select count(*)::text from public.journal_lines', '0');
SELECT t.eq('S sees no RYC partner', $q$select string_agg(name, ',') from public.partners where code = 'P-1'$q$, 'شريك فاي');
SELECT t.ok('S refreshes PHI statements', 'select public.generate_financial_reports_json()');
RESET ROLE;

-- ---------- A: member of both, switching ----------
SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', false);
SET ROLE authenticated;
SELECT set_config('request.headers', format('{"x-company-id":"%s"}', :'ryc'), false);
SELECT t.eq('A with RYC header sees RYC journals', 'select count(*)::text from public.journal_headers', '1');
SELECT set_config('request.headers', format('{"x-company-id":"%s"}', :'phi'), false);
SELECT t.eq('A with PHI header sees PHI journals', 'select count(*)::text from public.journal_headers', '0');
SELECT set_config('request.headers', '', false);
SELECT t.eq('A without header uses the default (PHI)', 'select rawasi_private.current_company_id()::text', :'phi');
SELECT t.ok('A makes RYC the default', format('select public.set_my_default_company(%L)', :'ryc'));
SELECT t.eq('A without header now uses RYC', 'select rawasi_private.current_company_id()::text', :'ryc');
-- delete behaviour of the paired keys (SET NULL and CASCADE keep working)
SELECT set_config('request.headers', format('{"x-company-id":"%s"}', :'ryc'), false);
SELECT t.ok('A adds a second job order on the RYC project', $q$insert into public.job_orders (order_number, project_id) select 'JO-2', id from public.projects where "Property" = 'مشروع الثانية'$q$);
SELECT t.ok('A deletes JO-1 (assignment keeps a NULL job order)', $q$delete from public.job_orders where order_number = 'JO-1'$q$);
SELECT t.eq('assignment job order set to NULL', $q$select count(*)::text from public.contractor_assignments where job_order_id is null$q$, '1');
SELECT t.ok('A deletes the assignment and the project', $q$with d as (delete from public.contractor_assignments returning 1) delete from public.projects where "Property" = 'مشروع الثانية'$q$);
SELECT t.eq('JO-2 removed with its project (cascade)', $q$select count(*)::text from public.job_orders where order_number = 'JO-2'$q$, '0');
SELECT set_config('request.headers', '', false);
RESET ROLE;

-- ---------- maintenance context (no signed-in user) ----------
SELECT set_config('request.jwt.claims', '', false), set_config('request.headers', '', false);
SELECT t.err('maintenance insert without a company fails', $q$insert into public.partners (code, name, partner_type) values ('M-1', 'x', 'عميل')$q$, '42501');
SELECT set_config('app.company_id', :'ryc', false);
SELECT t.ok('maintenance insert with app.company_id', $q$insert into public.partners (code, name, partner_type) values ('M-1', 'x', 'عميل')$q$);
SELECT t.eq('maintenance row stamped', $q$select company_id::text from public.partners where code = 'M-1'$q$, :'ryc');
SELECT set_config('app.company_id', '', false);

-- ---------- structure ----------
SELECT t.eq('every scoped table has NOT NULL company_id', $q$select count(*)::text from rawasi_private.company_scoped_tables s join information_schema.columns c on c.table_schema = 'public' and c.table_name = s.table_name and c.column_name = 'company_id' and c.is_nullable = 'NO'$q$, '29');
SELECT t.eq('every policy on scoped tables checks the company', $q$select count(*)::text from pg_policies where schemaname = 'public' and tablename in (select table_name from rawasi_private.company_scoped_tables) and (coalesce(qual, '') || coalesce(with_check, '')) not like '%current_company_id%'$q$, '0');
SELECT t.eq('every FK between scoped tables has a company pair', $q$
  select count(*)::text from pg_constraint con
  join pg_class cc on cc.oid = con.conrelid join pg_class pc on pc.oid = con.confrelid
  where con.contype = 'f' and array_length(con.conkey, 1) = 1
    and cc.relname in (select table_name from rawasi_private.company_scoped_tables)
    and pc.relname in (select table_name from rawasi_private.company_scoped_tables)
    and not exists (select 1 from pg_constraint c2 where c2.conrelid = con.conrelid and c2.confrelid = con.confrelid
                    and c2.contype = 'f' and c2.conkey = array[con.conkey[1], (select attnum from pg_attribute where attrelid = con.conrelid and attname = 'company_id')]::int2[])$q$, '0');
SELECT t.eq('no fixed account UUID defaults left', $q$select count(*)::text from pg_attrdef d join pg_class c on c.oid = d.adrelid where c.relnamespace = 'public'::regnamespace and pg_get_expr(d.adbin, d.adrelid) ~ '^''[0-9a-fA-F-]{36}''::uuid$'$q$, '0');
SELECT t.eq('anon cannot run the new functions', $q$select count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('copy_chart_of_accounts','list_company_members','list_company_member_candidates','generate_financial_reports_json') and has_function_privilege('anon', p.oid, 'EXECUTE')$q$, '0');
