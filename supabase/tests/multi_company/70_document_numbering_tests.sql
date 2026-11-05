-- Tests for 20261105170000_document_numbering.sql (after steps 1-3, job_order_links and the migration).
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
  IF state IS NULL OR SQLSTATE = state THEN RAISE NOTICE 'PASS % (% %)', label, SQLSTATE, left(SQLERRM, 80);
  ELSE RAISE NOTICE 'FAIL % -> got % % (expected %)', label, SQLSTATE, SQLERRM, state; END IF; END $$;
CREATE FUNCTION t.eq(label text, q text, expected text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE got text;
BEGIN EXECUTE q INTO got;
  IF got IS NOT DISTINCT FROM expected THEN RAISE NOTICE 'PASS % = %', label, got;
  ELSE RAISE NOTICE 'FAIL % -> got % (expected %)', label, got, expected; END IF;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'FAIL % -> error % %', label, SQLSTATE, SQLERRM; END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA t TO anon, authenticated;

SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', false);
SET ROLE authenticated;
SELECT id AS phi FROM public.companies WHERE code = 'PHI' \gset
SELECT public.create_company(jsonb_build_object('code', 'RYC', 'name', 'شركة اختبار ثانية')) AS ryc \gset

SELECT set_config('request.headers', format('{"x-company-id":"%s"}', :'phi'), false);
INSERT INTO public.invoices (invoice_number, date, taxable_amount, tax_amount, total_amount, status) VALUES ('INV-2026-48213', '2026-03-01', 1, 0, 1, 'مسودة') RETURNING invoice_number AS n1 \gset
INSERT INTO public.invoices (invoice_number, date, taxable_amount, tax_amount, total_amount, status) VALUES (NULL, '2026-04-01', 1, 0, 1, 'مسودة') RETURNING invoice_number AS n2 \gset
SELECT t.eq('a made-up number is replaced by the first number', format('select %L', :'n1'), 'INV-2026-0001');
SELECT t.eq('next invoice takes the next number', format('select %L', :'n2'), 'INV-2026-0002');
SELECT t.err('a save that fails', $q$insert into public.invoices (invoice_number, date, taxable_amount, tax_amount, total_amount, status, partner_id) values (null, '2026-04-02', 1, 0, 1, 'مسودة', gen_random_uuid())$q$, NULL);
INSERT INTO public.invoices (date, taxable_amount, tax_amount, total_amount, status) VALUES ('2026-04-03', 1, 0, 1, 'مسودة') RETURNING invoice_number AS n3 \gset
SELECT t.eq('... gives no number away', format('select %L', :'n3'), 'INV-2026-0003');
INSERT INTO public.invoices (date, taxable_amount, tax_amount, total_amount, status) VALUES ('2027-01-05', 1, 0, 1, 'مسودة') RETURNING invoice_number AS n4 \gset
SELECT t.eq('a new year starts again at 0001', format('select %L', :'n4'), 'INV-2027-0001');
SELECT t.ok('changing a saved number', format($q$update public.invoices set invoice_number = 'X-1' where invoice_number = %L$q$, :'n2'));
SELECT t.eq('... keeps the saved number', format($q$select count(*)::text from public.invoices where invoice_number = %L$q$, :'n2'), '1');

INSERT INTO public.payment_vouchers (voucher_number, date, amount) VALUES ('PV-123456', '2026-05-01', 10) RETURNING voucher_number AS pv \gset
INSERT INTO public.receipt_vouchers (receipt_number, date, amount, payment_method, status) VALUES (NULL, '2026-05-01', 10, 'تحويل بنكي', 'مسودة') RETURNING receipt_number AS rv \gset
INSERT INTO public.projects ("Property") VALUES ('فيلا') RETURNING id AS v \gset
INSERT INTO public.boq_budget (project_id, work_item, contract_quantity, unit, unit_contract_price) VALUES (:'v', 'بند', 1, 'م2', 1) RETURNING id AS b \gset
INSERT INTO public.job_orders (order_number, project_id, boq_budget_id, executor_type, assigned_qty, unit_price, status, start_date)
VALUES ('JO-2026-5512', :'v', :'b', 'تنفيذ ذاتي', 1, 1, 'مسودة', '2026-06-01') RETURNING order_number AS jo \gset
INSERT INTO public.material_issues (issue_number, project_id, issue_date, issue_type, total_amount) VALUES ('ISS-998877', :'v', '2026-06-02', 'صرف للمشروع', 0) RETURNING issue_number AS iss \gset
INSERT INTO public.material_receipts (receipt_number, project_id, receipt_date, total_amount) VALUES ('MAT-1', :'v', '2026-06-02', 0) RETURNING receipt_number AS mr \gset
SELECT t.eq('each type has its own sequence', format('select %L', :'pv' || ' ' || :'rv' || ' ' || :'jo' || ' ' || :'iss' || ' ' || :'mr'),
  'PV-2026-0001 RV-2026-0001 JO-2026-0001 ISS-2026-0001 MR-2026-0001');

SELECT set_config('request.headers', format('{"x-company-id":"%s"}', :'ryc'), false);
INSERT INTO public.invoices (date, taxable_amount, tax_amount, total_amount, status) VALUES ('2026-04-01', 1, 0, 1, 'مسودة') RETURNING invoice_number AS r1 \gset
SELECT t.eq('the second company has its own sequence', format('select %L', :'r1'), 'INV-2026-0001');
RESET ROLE;

-- without a signed-in user (server restore / SQL editor) a given number is kept, and an existing one is skipped
SELECT set_config('request.jwt.claims', '', false);
SELECT set_config('app.company_id', :'phi', false);
INSERT INTO public.invoices (invoice_number, date, taxable_amount, tax_amount, total_amount, status, company_id) VALUES ('INV-2026-0004', '2026-04-05', 1, 0, 1, 'مسودة', :'phi');
SELECT t.eq('restore keeps its number', $q$select count(*)::text from public.invoices where invoice_number = 'INV-2026-0004'$q$, '1');
SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', false);
SET ROLE authenticated;
SELECT set_config('request.headers', format('{"x-company-id":"%s"}', :'phi'), false);
INSERT INTO public.invoices (date, taxable_amount, tax_amount, total_amount, status) VALUES ('2026-04-06', 1, 0, 1, 'مسودة') RETURNING invoice_number AS n5 \gset
SELECT t.eq('a number already used is skipped', format('select %L', :'n5'), 'INV-2026-0005');
RESET ROLE;

-- legacy sequential documents with gaps (0001, 0003) advance chronologically to 0004 instead of back-filling 0002
SELECT set_config('request.jwt.claims', '', false);
SELECT set_config('app.company_id', :'phi', false);
INSERT INTO public.invoices (invoice_number, date, taxable_amount, tax_amount, total_amount, status, company_id)
VALUES ('INV-2028-0001', '2028-01-10', 1, 0, 1, 'مسودة', :'phi'),
       ('INV-2028-0003', '2028-01-12', 1, 0, 1, 'مسودة', :'phi');
-- 9999 -> 10000 transition expands cleanly to 5 digits without truncation or infinite loop
INSERT INTO rawasi_private.document_counters (company_id, doc_type, year, last_number)
VALUES (:'phi', 'INV', 2029, 9998);

SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', false);
SET ROLE authenticated;
SELECT set_config('request.headers', format('{"x-company-id":"%s"}', :'phi'), false);
INSERT INTO public.invoices (date, taxable_amount, tax_amount, total_amount, status) VALUES ('2028-02-01', 1, 0, 1, 'مسودة') RETURNING invoice_number AS gap_next \gset
SELECT t.eq('legacy sequential documents with gaps advance past max', format('select %L', :'gap_next'), 'INV-2028-0004');
INSERT INTO public.invoices (date, taxable_amount, tax_amount, total_amount, status) VALUES ('2029-05-01', 1, 0, 1, 'مسودة') RETURNING invoice_number AS n9999 \gset
INSERT INTO public.invoices (date, taxable_amount, tax_amount, total_amount, status) VALUES ('2029-05-02', 1, 0, 1, 'مسودة') RETURNING invoice_number AS n10000 \gset
SELECT t.eq('counter reaches 9999 cleanly', format('select %L', :'n9999'), 'INV-2029-9999');
SELECT t.eq('9999 -> 10000 expands to 5 digits without truncation', format('select %L', :'n10000'), 'INV-2029-10000');
RESET ROLE;
