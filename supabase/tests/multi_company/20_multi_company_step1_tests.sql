-- Security tests for the multi-company migration. Every check prints PASS or FAIL.
\set ON_ERROR_STOP 0
SET client_min_messages = notice;

CREATE SCHEMA t;
GRANT USAGE ON SCHEMA t TO anon, authenticated;

CREATE FUNCTION t.ok(label text, q text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE q;
  RAISE NOTICE 'PASS %', label;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL % -> unexpected error % %', label, SQLSTATE, SQLERRM;
END $$;

CREATE FUNCTION t.err(label text, q text, state text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE q;
  RAISE NOTICE 'FAIL % -> no error (expected %)', label, state;
EXCEPTION WHEN OTHERS THEN
  IF state IS NULL OR SQLSTATE = state THEN RAISE NOTICE 'PASS % (% %)', label, SQLSTATE, left(SQLERRM, 70);
  ELSE RAISE NOTICE 'FAIL % -> got % % (expected %)', label, SQLSTATE, SQLERRM, state; END IF;
END $$;

CREATE FUNCTION t.eq(label text, q text, expected text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE got text;
BEGIN
  EXECUTE q INTO got;
  IF got IS NOT DISTINCT FROM expected THEN RAISE NOTICE 'PASS % = %', label, got;
  ELSE RAISE NOTICE 'FAIL % -> got % (expected %)', label, got, expected; END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL % -> error % %', label, SQLSTATE, SQLERRM;
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA t TO anon, authenticated;

-- ---------- seed results (as postgres) ----------
SELECT t.eq('seed: one company', 'select count(*)::text from public.companies', '1');
SELECT t.eq('seed: PHI is default', $q$select is_default::text from public.companies where code='PHI'$q$, 'true');
SELECT t.eq('seed: no fake tax number', $q$select coalesce(tax_number,'none') from public.companies where code='PHI'$q$, 'none');
SELECT t.eq('seed: admin -> admin', $q$select role from public.user_companies where user_id='aaaaaaaa-0000-0000-0000-000000000001'$q$, 'admin');
SELECT t.eq('seed: staff -> member', $q$select role from public.user_companies where user_id='aaaaaaaa-0000-0000-0000-000000000002'$q$, 'member');
SELECT t.eq('seed: pending client skipped', $q$select count(*)::text from public.user_companies where user_id='aaaaaaaa-0000-0000-0000-000000000003'$q$, '0');
SELECT t.eq('seed: inactive skipped', $q$select count(*)::text from public.user_companies where user_id='aaaaaaaa-0000-0000-0000-000000000004'$q$, '0');
SELECT t.eq('seed: client with permissions -> member', $q$select role from public.user_companies where user_id='aaaaaaaa-0000-0000-0000-000000000006'$q$, 'member');
SELECT t.eq('rls enabled on both tables', $q$select count(*)::text from pg_class where relname in ('companies','user_companies') and relrowsecurity$q$, '2');
SELECT t.eq('anon has no table grants', $q$select count(*)::text from information_schema.role_table_grants where grantee='anon' and table_name in ('companies','user_companies')$q$, '0');
SELECT t.eq('authenticated only SELECT', $q$select string_agg(distinct privilege_type, ',') from information_schema.role_table_grants where grantee='authenticated' and table_name in ('companies','user_companies')$q$, 'SELECT');
SELECT t.eq('anon cannot run company functions', $q$select count(*)::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('get_user_accessible_companies','create_company','update_company','set_my_default_company','add_company_member','set_company_member_role','remove_company_member') and has_function_privilege('anon', p.oid, 'EXECUTE')$q$, '0');

-- a user created after the migration (not a member of anything)
SELECT set_config('request.jwt.claims', '', false);
INSERT INTO auth.users (id, email) VALUES ('aaaaaaaa-0000-0000-0000-000000000005', 'new@test.local');
UPDATE public.profiles SET role = 'staff' WHERE id = 'aaaaaaaa-0000-0000-0000-000000000005';

-- ---------- anon ----------
SELECT set_config('request.jwt.claims', '{"role":"anon"}', false);
SET ROLE anon;
SELECT t.err('anon: read companies', 'select * from public.companies', '42501');
SELECT t.err('anon: read memberships', 'select * from public.user_companies', '42501');
SELECT t.err('anon: rpc list', 'select * from public.get_user_accessible_companies()', '42501');
SELECT t.err('anon: rpc create', $q$select public.create_company('{"code":"HACK","name":"x y"}')$q$, '42501');
RESET ROLE;

-- ---------- pending client (no membership) ----------
SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}', false);
SET ROLE authenticated;
SELECT t.eq('client: sees no companies', 'select count(*)::text from public.companies', '0');
SELECT t.eq('client: rpc returns none', 'select count(*)::text from public.get_user_accessible_companies()', '0');
SELECT t.eq('client: sees no memberships', 'select count(*)::text from public.user_companies', '0');
SELECT t.err('client: direct insert company', $q$insert into public.companies(code,name) values ('HACK','hack co')$q$, '42501');
SELECT t.err('client: self-assign admin', $q$insert into public.user_companies(user_id,company_id,role) select 'aaaaaaaa-0000-0000-0000-000000000003', id, 'admin' from public.companies$q$, '42501');
SELECT t.err('client: direct update', $q$update public.companies set name='hacked'$q$, '42501');
SELECT t.err('client: direct delete', $q$delete from public.user_companies$q$, '42501');
SELECT t.err('client: rpc create', $q$select public.create_company('{"code":"HACK","name":"hack co"}')$q$, '42501');
SELECT t.err('client: rpc add self', $q$select public.add_company_member((select id from public.companies limit 1), 'aaaaaaaa-0000-0000-0000-000000000003')$q$, NULL);
SELECT t.err('client: set default on foreign company', $q$select public.set_my_default_company('00000000-0000-0000-0000-000000000000')$q$, '42501');
RESET ROLE;

-- ---------- staff member ----------
SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', false);
SET ROLE authenticated;
SELECT t.eq('staff: sees PHI', 'select string_agg(code, $$,$$) from public.companies', 'PHI');
SELECT t.eq('staff: rpc role', 'select role from public.get_user_accessible_companies()', 'member');
SELECT t.eq('staff: sees only own membership', 'select count(*)::text from public.user_companies', '1');
SELECT t.err('staff: cannot edit company', $q$select public.update_company((select id from public.companies where code='PHI'), '{"name":"edited by staff"}')$q$, '42501');
SELECT t.err('staff: cannot add members', $q$select public.add_company_member((select id from public.companies where code='PHI'), 'aaaaaaaa-0000-0000-0000-000000000005')$q$, '42501');
SELECT t.err('staff: cannot create company', $q$select public.create_company('{"code":"STF","name":"staff co"}')$q$, '42501');
SELECT t.ok('staff: set own default', $q$select public.set_my_default_company((select id from public.companies where code='PHI'))$q$);
RESET ROLE;

-- ---------- platform admin ----------
SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', false);
SET ROLE authenticated;
SELECT t.err('admin: invalid VAT rejected', $q$select public.create_company('{"code":"BAD","name":"bad vat","tax_number":"123"}')$q$, '23514');
SELECT t.err('admin: bad code rejected', $q$select public.create_company('{"code":"a b","name":"bad code"}')$q$, '23514');
SELECT t.err('admin: duplicate code rejected', $q$select public.create_company('{"code":"phi","name":"dup"}')$q$, '23505');
SELECT t.ok('admin: create RYC', $q$select public.create_company('{"code":"ryc","name":"شركة تجريبية ثانية","tax_number":"300000000000003","cr_number":"1010000000","brand_color":"#0284C7"}')$q$);
SELECT t.eq('admin: code upper-cased', $q$select count(*)::text from public.companies where code='RYC'$q$, '1');
SELECT t.eq('admin: became RYC admin', $q$select role from public.get_user_accessible_companies() where code='RYC'$q$, 'admin');
SELECT t.eq('admin: sees 2 companies', 'select count(*)::text from public.companies', '2');
SELECT t.err('admin: duplicate VAT rejected', $q$select public.create_company('{"code":"DUP","name":"dup vat","tax_number":"300000000000003"}')$q$, '23505');
SELECT t.ok('admin: edit PHI VAT', $q$select public.update_company((select id from public.companies where code='PHI'), '{"tax_number":"311111111111113","legal_name":"  "}')$q$);
SELECT t.eq('admin: blank text stored as null', $q$select coalesce(legal_name,'null') from public.companies where code='PHI'$q$, 'null');
SELECT t.eq('admin: untouched keys kept', $q$select name from public.companies where code='PHI'$q$, 'فاي تك للمقاولات العامة والتشطيبات الفاخرة');
SELECT t.err('admin: cannot deactivate default', $q$select public.update_company((select id from public.companies where code='PHI'), '{"is_active":false}')$q$, '22023');
SELECT t.ok('admin: move default to RYC', $q$select public.update_company((select id from public.companies where code='RYC'), '{"is_default":true}')$q$);
SELECT t.eq('admin: single default', $q$select string_agg(code, ',') from public.companies where is_default$q$, 'RYC');
SELECT t.ok('admin: move default back', $q$select public.update_company((select id from public.companies where code='PHI'), '{"is_default":true}')$q$);
SELECT t.ok('admin: add staff as RYC admin', $q$select public.add_company_member((select id from public.companies where code='RYC'), 'aaaaaaaa-0000-0000-0000-000000000002', 'admin')$q$);
SELECT t.err('admin: bad role rejected', $q$select public.add_company_member((select id from public.companies where code='RYC'), 'aaaaaaaa-0000-0000-0000-000000000005', 'owner')$q$, '22023');
SELECT t.err('admin: inactive user rejected', $q$select public.add_company_member((select id from public.companies where code='RYC'), 'aaaaaaaa-0000-0000-0000-000000000004')$q$, 'P0002');
SELECT t.eq('admin: sees all memberships', 'select count(*)::text from public.user_companies', '5');
RESET ROLE;

-- ---------- staff as company admin of RYC only ----------
SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', false);
SET ROLE authenticated;
SELECT t.eq('staff: now sees 2 companies', 'select count(*)::text from public.companies', '2');
SELECT t.ok('staff: edits RYC', $q$select public.update_company((select id from public.companies where code='RYC'), '{"phone":"0500000000"}')$q$);
SELECT t.err('staff: still cannot edit PHI', $q$select public.update_company((select id from public.companies where code='PHI'), '{"phone":"1"}')$q$, '42501');
SELECT t.err('staff: cannot deactivate RYC', $q$select public.update_company((select id from public.companies where code='RYC'), '{"is_active":false}')$q$, '42501');
SELECT t.err('staff: cannot make RYC default', $q$select public.update_company((select id from public.companies where code='RYC'), '{"is_default":true}')$q$, '42501');
SELECT t.ok('staff: adds new user to RYC', $q$select public.add_company_member((select id from public.companies where code='RYC'), 'aaaaaaaa-0000-0000-0000-000000000005')$q$);
SELECT t.eq('staff: sees RYC members + own PHI', 'select count(*)::text from public.user_companies', '4');
SELECT t.ok('staff: removes platform admin from RYC', $q$select public.remove_company_member((select id from public.companies where code='RYC'), 'aaaaaaaa-0000-0000-0000-000000000001')$q$);
SELECT t.err('staff: cannot remove last RYC admin (self)', $q$select public.remove_company_member((select id from public.companies where code='RYC'), 'aaaaaaaa-0000-0000-0000-000000000002')$q$, '22023');
SELECT t.err('staff: cannot demote last RYC admin', $q$select public.set_company_member_role((select id from public.companies where code='RYC'), 'aaaaaaaa-0000-0000-0000-000000000002', 'member')$q$, '22023');
SELECT t.ok('staff: set RYC as own default', $q$select public.set_my_default_company((select id from public.companies where code='RYC'))$q$);
SELECT t.eq('staff: rpc lists default first', 'select code from public.get_user_accessible_companies() limit 1', 'RYC');
RESET ROLE;

-- ---------- platform admin still manages RYC without membership ----------
SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', false);
SET ROLE authenticated;
SELECT t.eq('admin: still sees RYC (management)', $q$select count(*)::text from public.companies where code='RYC'$q$, '1');
SELECT t.eq('admin: RYC not in switcher (no membership)', $q$select count(*)::text from public.get_user_accessible_companies() where code='RYC'$q$, '0');
SELECT t.eq('admin: user_in_company(RYC) false', $q$select rawasi_private.user_in_company((select id from public.companies where code='RYC'))::text$q$, 'false');
SELECT t.ok('admin: deactivates RYC', $q$select public.update_company((select id from public.companies where code='RYC'), '{"is_active":false}')$q$);
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', false);
SET ROLE authenticated;
SELECT t.eq('staff: inactive company hidden from switcher', $q$select string_agg(code, ',') from public.get_user_accessible_companies()$q$, 'PHI');
SELECT t.eq('staff: user_in_company(inactive) false', $q$select rawasi_private.user_in_company((select id from public.companies where code='RYC'))::text$q$, 'false');
RESET ROLE;

-- deactivated profile loses access everywhere
SELECT set_config('request.jwt.claims', '', false);
UPDATE public.profiles SET is_active = false WHERE id = 'aaaaaaaa-0000-0000-0000-000000000002';
SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', false);
SET ROLE authenticated;
SELECT t.eq('inactive profile: no companies', 'select count(*)::text from public.get_user_accessible_companies()', '0');
SELECT t.eq('inactive profile: cannot see PHI', $q$select count(*)::text from public.companies where code='PHI'$q$, '0');
RESET ROLE;

SELECT t.eq('audit trail written', $q$select (count(*) > 0)::text from public.audit_logs where table_name in ('companies','user_companies')$q$, 'true');
SELECT t.eq('updated_at touched', $q$select (updated_at > created_at)::text from public.companies where code='PHI'$q$, 'true');
