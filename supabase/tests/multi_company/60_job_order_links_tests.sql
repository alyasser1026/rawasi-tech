-- Tests for 20261105150000_job_order_links.sql. Run after steps 1-3 and the migration on a fresh database.
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
-- journal lines of one document: account code, work order number (or -), partner yes/no, debit-credit; in a stable order
CREATE FUNCTION t.lines(p_reference uuid) RETURNS text LANGUAGE sql AS $$
  SELECT string_agg(a.code || ':' || COALESCE(regexp_replace(j.order_number, '^JO-[0-9]{4}-0*', 'JO-'), '-') || ':' || CASE WHEN l.partner_id IS NULL THEN 'co' ELSE 'partner' END
                    || ':' || (l.debit - l.credit)::numeric(14,2), ' ' ORDER BY a.code, l.debit DESC, l.credit DESC, j.order_number)
  FROM public.journal_headers h
  JOIN public.journal_lines l ON l.header_id = h.id
  JOIN public.accounts a ON a.id = l.account_id
  LEFT JOIN public.job_orders j ON j.id = l.job_order_id
  WHERE h.reference_id = p_reference $$;
CREATE FUNCTION t.acc(p_code text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM public.accounts WHERE code = p_code $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA t TO anon, authenticated;

SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', false);
SET ROLE authenticated;
SELECT id AS phi FROM public.companies WHERE code = 'PHI' \gset
SELECT public.create_company(jsonb_build_object('code', 'RYC', 'name', 'شركة اختبار ثانية', 'copy_accounts_from', :'phi')) AS ryc \gset

-- a work order in the second company
SELECT set_config('request.headers', format('{"x-company-id":"%s"}', :'ryc'), false);
INSERT INTO public.projects ("Property") VALUES ('فيلا الشركة التانية') RETURNING id AS rv \gset
INSERT INTO public.boq_budget (project_id, work_item, contract_quantity, unit, unit_contract_price) VALUES (:'rv', 'بند', 10, 'م2', 10) RETURNING id AS rb \gset
INSERT INTO public.job_orders (order_number, project_id, boq_budget_id, executor_type, assigned_qty, unit_price, status)
VALUES ('R-1', :'rv', :'rb', 'تنفيذ ذاتي', 10, 10, 'جاري التنفيذ') RETURNING id AS rj \gset

-- PHI: two villas, three work orders (two self-executed on villa 1, one subcontracted on villa 2), one unused
SELECT set_config('request.headers', format('{"x-company-id":"%s"}', :'phi'), false);
INSERT INTO public.projects ("Property") VALUES ('فيلا 1') RETURNING id AS v1 \gset
INSERT INTO public.projects ("Property") VALUES ('فيلا 2') RETURNING id AS v2 \gset
INSERT INTO public.partners (code, name, partner_type) VALUES ('SUB-J', 'مقاول أ', 'مقاول باطن') RETURNING id AS sub \gset
INSERT INTO public.partners (code, name, partner_type) VALUES ('CLI-J', 'عميل أ', 'عميل') RETURNING id AS cli \gset
INSERT INTO public.partners (code, name, partner_type) VALUES ('WRK-J', 'عامل أ', 'عامل') RETURNING id AS wrk \gset
INSERT INTO public.boq_budget (project_id, work_item, contract_quantity, unit, unit_contract_price) VALUES (:'v1', 'لياسة', 100, 'م2', 100) RETURNING id AS b1 \gset
INSERT INTO public.boq_budget (project_id, work_item, contract_quantity, unit, unit_contract_price) VALUES (:'v1', 'دهانات', 50, 'م2', 200) RETURNING id AS b2 \gset
INSERT INTO public.boq_budget (project_id, work_item, contract_quantity, unit, unit_contract_price) VALUES (:'v2', 'بلاط', 80, 'م2', 150) RETURNING id AS b3 \gset
INSERT INTO public.job_orders (order_number, project_id, boq_budget_id, executor_type, assigned_qty, unit_price, status)
VALUES ('JO-1', :'v1', :'b1', 'تنفيذ ذاتي', 100, 100, 'جاري التنفيذ') RETURNING id AS j1 \gset
INSERT INTO public.job_orders (order_number, project_id, boq_budget_id, executor_type, assigned_qty, unit_price, status)
VALUES ('JO-2', :'v1', :'b2', 'تنفيذ ذاتي', 50, 200, 'جاري التنفيذ') RETURNING id AS j2 \gset
INSERT INTO public.job_orders (order_number, project_id, boq_budget_id, executor_type, contractor_id, assigned_qty, unit_price, status)
VALUES ('JO-3', :'v2', :'b3', 'مقاول باطن', :'sub', 80, 90, 'جاري التنفيذ') RETURNING id AS j3 \gset
INSERT INTO public.job_orders (order_number, project_id, boq_budget_id, executor_type, assigned_qty, unit_price, status)
VALUES ('JO-9', :'v1', :'b1', 'تنفيذ ذاتي', 1, 1, 'مسودة') RETURNING id AS j9 \gset

-- 1. Same company and same villa
SELECT t.err('labor log: work order of another villa is refused',
  format($q$insert into public.labor_daily_logs (work_date, worker_name, daily_wage, project_id, job_order_id) values (current_date, 'x', 1, %L, %L)$q$, :'v2', :'j1'), '23514');
SELECT t.err('labor log: work order of another company is refused',
  format($q$insert into public.labor_daily_logs (work_date, worker_name, daily_wage, job_order_id) values (current_date, 'x', 1, %L)$q$, :'rj'), '23503');
INSERT INTO public.labor_daily_logs (work_date, worker_name, daily_wage, worker_partner_id, job_order_id)
VALUES (current_date, 'عامل أ', 300, :'wrk', :'j1') RETURNING id AS lab \gset
SELECT t.eq('labor log without villa gets the work order villa', format('select (project_id = %L)::text from public.labor_daily_logs where id = %L', :'v1', :'lab'), 'true');
SELECT t.err('changing the villa of a linked log is refused',
  format('update public.labor_daily_logs set project_id = %L where id = %L', :'v2', :'lab'), '23514');

INSERT INTO public.payment_vouchers (voucher_number, date, amount, debit_account_id, credit_account_id, job_order_id, description)
VALUES ('PV-J1', current_date, 150, t.acc('513'), t.acc('122'), :'j1', 'صرف مباشر') RETURNING id AS pv \gset
SELECT t.eq('payment voucher without villas gets the work order villa', format('select (project_ids = array[%L::uuid])::text from public.payment_vouchers where id = %L', :'v1', :'pv'), 'true');
SELECT t.err('payment voucher: work order outside the chosen villas is refused',
  format($q$insert into public.payment_vouchers (voucher_number, date, amount, job_order_id, project_ids) values ('PV-X', current_date, 1, %L, array[%L::uuid])$q$, :'j1', :'v2'), '23514');

INSERT INTO public.violations (date, amount, emp_name, reason, partner_id, debit_account_id, credit_account_id, job_order_id)
VALUES (current_date, 40, 'عامل أ', 'تأخير', :'wrk', t.acc('216'), t.acc('46'), :'j1') RETURNING id AS vio \gset
SELECT t.eq('penalty gets the work order villa', format('select (project_id = %L)::text from public.violations where id = %L', :'v1', :'vio'), 'true');

INSERT INTO public.receipt_vouchers (receipt_number, date, amount, payment_method, partner_id, safe_bank_acc_id, partner_acc_id, job_order_id, status)
VALUES ('RV-J1', current_date, 500, 'تحويل بنكي', :'cli', t.acc('122'), t.acc('124'), :'j1', 'مسودة') RETURNING id AS rcp \gset
SELECT t.eq('receipt gets the work order villa', format('select (project_ids = array[%L::uuid])::text from public.receipt_vouchers where id = %L', :'v1', :'rcp'), 'true');

-- material issues follow one work order
INSERT INTO public.material_issues (issue_number, project_id, issue_date, issue_type, total_amount, job_order_id)
VALUES ('ISS-J1', :'v1', current_date, 'صرف للمشروع', 70, :'j1') RETURNING id AS iss \gset
INSERT INTO public.material_issue_lines (issue_id, item_name, quantity, unit_price, total_price) VALUES (:'iss', 'أسمنت', 7, 10, 70) RETURNING id AS issl \gset
SELECT t.eq('issue line takes the issue work order', format('select (job_order_id = %L)::text from public.material_issue_lines where id = %L', :'j1', :'issl'), 'true');
SELECT t.err('issue line with another work order is refused',
  format($q$insert into public.material_issue_lines (issue_id, item_name, quantity, unit_price, total_price, job_order_id) values (%L, 'رمل', 1, 1, 1, %L)$q$, :'iss', :'j2'), '23514');
INSERT INTO public.material_issues (issue_number, project_id, issue_date, issue_type, total_amount) VALUES ('ISS-J2', :'v1', current_date, 'صرف للمشروع', 20) RETURNING id AS iss2 \gset
INSERT INTO public.material_issue_lines (issue_id, item_name, quantity, unit_price, total_price, job_order_id) VALUES (:'iss2', 'رمل', 2, 10, 20, :'j2');
SELECT t.eq('a line with a work order sets it on its issue', format('select (job_order_id = %L)::text from public.material_issues where id = %L', :'j2', :'iss2'), 'true');
SELECT t.err('issue in villa 2 with a villa 1 work order is refused',
  format($q$insert into public.material_issues (issue_number, project_id, issue_date, issue_type, total_amount, job_order_id) values ('ISS-X', %L, current_date, 'صرف للمشروع', 1, %L)$q$, :'v2', :'j1'), '23514');

-- invoice lines: two work orders, the second villa is added to the invoice
INSERT INTO public.invoices (invoice_number, date, partner_id, project_ids, taxable_amount, tax_amount, total_amount,
  debit_account_id, credit_account_id, tax_acc_id, status, lines_data)
VALUES ('INV-J1', current_date, :'cli', array[:'v1'::uuid], 2000, 300, 2300, t.acc('124'), t.acc('41'), t.acc('215'), 'مسودة',
  jsonb_build_array(
    jsonb_build_object('description', 'لياسة', 'quantity', 10, 'unit_price', 100, 'job_order_id', :'j1'),
    jsonb_build_object('description', 'بلاط', 'quantity', '5', 'unit_price', '200', 'job_order_id', :'j3')))
RETURNING id AS inv \gset
SELECT t.eq('invoice villas include the villa of every line', format('select (project_ids @> array[%L::uuid, %L::uuid])::text from public.invoices where id = %L', :'v1', :'v2', :'inv'), 'true');
SELECT t.eq('invoice line gets its villa and BOQ line', format($q$select (lines_data->1->>'project_id' = %L and lines_data->1->>'boq_budget_id' = %L)::text from public.invoices where id = %L$q$, :'v2', :'b3', :'inv'), 'true');
SELECT t.err('invoice line with a work order of another company is refused',
  format($q$update public.invoices set lines_data = jsonb_build_array(jsonb_build_object('quantity', 1, 'unit_price', 1, 'job_order_id', %L)) where id = %L$q$, :'rj', :'inv'), '23503');
INSERT INTO public.invoices (invoice_number, date, partner_id, taxable_amount, tax_amount, total_amount,
  debit_account_id, credit_account_id, tax_acc_id, status, lines_data)
VALUES ('INV-J2', current_date, :'cli', 500, 75, 575, t.acc('124'), t.acc('41'), t.acc('215'), 'مسودة',
  jsonb_build_array(jsonb_build_object('description', 'دهانات', 'quantity', 2.5, 'unit_price', 200, 'job_order_id', :'j2')))
RETURNING id AS inv2 \gset

-- 2. Work orders with documents cannot be deleted or moved
SELECT t.err('deleting a work order with a daily log is refused', format('delete from public.job_orders where id = %L', :'j1'), '23503');
SELECT t.err('moving a used work order to another villa is refused', format('update public.job_orders set project_id = %L where id = %L', :'v2', :'j2'), '23503');
SELECT t.ok('an unused work order can still be deleted', format('delete from public.job_orders where id = %L', :'j9'));
SELECT t.ok('a used work order can still be edited', format($q$update public.job_orders set notes = 'تعديل' where id = %L$q$, :'j1'));

-- 3. Posting: every line takes the document work order; partner_id stays on the partner line only
SELECT t.ok('post daily log', format('select public.post_labor_logs_bulk(array[%L::uuid])', :'lab'));
SELECT t.eq('daily log entry', format('select t.lines(%L)', :'lab'), '216:JO-1:partner:-300.00 512:JO-1:co:300.00');

INSERT INTO public.expenses (description, unit_price, quantity, exp_date, creditor_account, payment_account, job_order_id)
VALUES ('مصروف لأمر الشغل', 60, 1, current_date, '518', '122', :'j1') RETURNING id AS exp \gset
INSERT INTO public.expenses (description, unit_price, quantity, exp_date, creditor_account, payment_account, job_order_id, is_deleted)
VALUES ('مصروف محذوف', 999, 1, current_date, '518', '122', :'j1', true);
SELECT t.ok('post expense', format('select public.post_expenses_bulk(array[%L::uuid])', :'exp'));
SELECT t.eq('expense entry', format('select t.lines(%L)', :'exp'), '122:JO-1:co:-60.00 518:JO-1:co:60.00');

SELECT t.ok('post penalty', format('select public.post_violations_bulk_journal(array[%L::uuid])', :'vio'));
SELECT t.eq('penalty entry', format('select t.lines(%L)', :'vio'), '216:JO-1:partner:40.00 46:JO-1:co:-40.00');

SELECT t.ok('post receipt', format('select public.post_receipts_bulk(array[%L::uuid])', :'rcp'));
SELECT t.eq('receipt entry', format('select t.lines(%L)', :'rcp'), '122:JO-1:co:500.00 124:JO-1:partner:-500.00');

SELECT t.ok('post payment voucher', format('select public.post_payment_vouchers_bulk(array[%L::uuid])', :'pv'));
SELECT t.eq('payment voucher entry', format('select t.lines(%L)', :'pv'), '122:JO-1:co:-150.00 513:JO-1:co:150.00');

SELECT t.ok('post material issue', format('select public.rpc_post_material_issue(%L)', :'iss'));
SELECT t.eq('material issue entry', format('select t.lines(%L)', :'iss'), '126:JO-1:co:-70.00 511:JO-1:co:70.00');

SELECT t.ok('post invoice with two work orders', format('select public.post_invoices_bulk(array[%L::uuid])', :'inv'));
SELECT t.eq('revenue split per work order, totals untagged', format('select t.lines(%L)', :'inv'),
  '124:-:partner:2300.00 215:-:co:-300.00 41:JO-1:co:-1000.00 41:JO-3:co:-1000.00');
SELECT t.eq('split revenue lines carry the villa', format($q$select count(*)::text from public.journal_lines l join public.journal_headers h on h.id = l.header_id
  join public.job_orders j on j.id = l.job_order_id where h.reference_id = %L and l.project_id = j.project_id$q$, :'inv'), '2');
SELECT t.ok('post invoice with one work order', format('select public.post_invoices_bulk(array[%L::uuid])', :'inv2'));
SELECT t.eq('single work order invoice: every line tagged', format('select t.lines(%L)', :'inv2'),
  '124:JO-2:partner:575.00 215:JO-2:co:-75.00 41:JO-2:co:-500.00');

-- contractor claim on the subcontracted work order (its assignment was created with the work order)
SELECT id AS asg FROM public.contractor_assignments WHERE job_order_id = :'j3' \gset
SELECT t.ok('post contractor claim', format($q$select public.create_and_post_sub_claim(gen_random_uuid(),
  jsonb_build_object('contractor_id', %L, 'project_ids', array[%L::uuid], 'date', current_date, 'total_amount', 7200,
    'retention_amount', 360, 'advance_payment', 0, 'materials_deduction', 0, 'other_deductions', 0, 'net_amount', 6840), array[%L::uuid])$q$,
  :'sub', :'v2', :'asg'));
SELECT id AS clm FROM public.sub_claims WHERE contractor_id = :'sub' \gset
SELECT t.eq('claim entry: cost and contractor lines on the work order', format('select t.lines(%L)', :'clm'),
  '212:JO-3:partner:-6840.00 213:JO-3:co:-360.00 513:JO-3:co:7200.00');

INSERT INTO public.manual_journals (voucher_number, entry_date, description, amount, debit_account_id, credit_account_id, job_order_id)
VALUES ('MJ-J1', current_date, 'قيد يدوي', 25, t.acc('518'), t.acc('122'), :'j2') RETURNING id AS mj \gset
SELECT t.ok('post manual journal', format('select public.post_manual_journals_bulk(array[%L::uuid])', :'mj'));
SELECT t.eq('manual journal entry', format('select t.lines(%L)', :'mj'), '122:JO-2:co:-25.00 518:JO-2:co:25.00');

SELECT t.eq('every posted entry still balances', $q$select count(*)::text from (select header_id from public.journal_lines group by header_id having sum(debit) <> sum(credit)) x$q$, '0');
SELECT t.err('deleting a work order with journal lines is refused', format('delete from public.job_orders where id = %L', :'j2'), '23503');

-- 4. Ledger and performance views
SELECT t.eq('JO-1 ledger rows by type', format($q$select string_agg(trans_type || '=' || amount::numeric(14,2), ' ' order by trans_type) from public.job_order_ledger_view where job_order_id = %L$q$, :'j1'),
  'جزاءات=40.00 خامات مصروفة=70.00 سندات قبض=500.00 فواتير=1000.00 مصروفات نثرية=60.00 يوميات عمالة=300.00');
SELECT t.eq('JO-1 cost = labor + materials + expenses - penalties', format('select effective_cost::numeric(14,2)::text from public.job_order_performance where job_order_id = %L', :'j1'), '390.00');
SELECT t.eq('JO-3 ledger has the invoice line', format($q$select string_agg(trans_type || '=' || amount::numeric(14,2), ' ') from public.job_order_ledger_view where job_order_id = %L$q$, :'j3'), 'فواتير=1000.00');

-- 5. The second company sees none of it
SELECT set_config('request.headers', format('{"x-company-id":"%s"}', :'ryc'), false);
SELECT t.eq('second company: no PHI ledger rows', 'select count(*)::text from public.job_order_ledger_view', '0');
SELECT t.eq('second company: no PHI journal lines', 'select count(*)::text from public.journal_lines', '0');
SELECT set_config('request.headers', '', false);
RESET ROLE;
