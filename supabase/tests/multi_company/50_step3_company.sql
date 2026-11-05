-- Posts one of each document in company :CO (included twice by 50_step3_tests.sql). Runs as A.
SELECT set_config('request.headers', format('{"x-company-id":"%s"}', :'CO'), false);
SELECT code AS co_code FROM public.companies WHERE id = :'CO' \gset

-- labor log without its own accounts -> 512 (site wages) / 216 (accrued wages)
INSERT INTO public.labor_daily_logs (work_date, worker_name, daily_wage, debit_account_id, credit_account_id)
VALUES (current_date, 'عامل اختبار', 100, NULL, NULL) RETURNING id AS labor \gset
SELECT t.ok(:'co_code' || ': post labor log', format('select public.post_labor_logs_bulk(array[%L::uuid])', :'labor'));
SELECT t.eq(:'co_code' || ': labor accounts', format('select t.codes(%L)', :'labor'), '512,216');

-- subcontractor claim with retention (post_sub_claim, used by the claims screen) -> 513 / 212 / 213
INSERT INTO public.partners (code, name, partner_type) VALUES ('SUB-T', 'مقاول اختبار', 'مقاول باطن') RETURNING id AS sub \gset
INSERT INTO public.projects ("Property") VALUES ('مشروع اختبار') RETURNING id AS prj \gset
INSERT INTO public.sub_claims (claim_number, contractor_id, project_id, date, total_amount, retention_amount, net_amount)
VALUES ('CL-1', :'sub', :'prj', current_date, 1000, 50, 900) RETURNING id AS claim \gset
SELECT t.ok(:'co_code' || ': post claim with retention', format('select public.post_sub_claim(%L)', :'claim'));
SELECT t.eq(:'co_code' || ': claim accounts', format('select t.codes(%L)', :'claim'), '513,212,213');

-- violation -> 216 / 46
INSERT INTO public.violations (date, amount, emp_name, reason) VALUES (current_date, 20, 'موظف', 'تأخير') RETURNING id AS vio \gset
SELECT t.ok(:'co_code' || ': post violation', format('select public.post_violations_bulk(array[%L::uuid])', :'vio'));
SELECT t.eq(:'co_code' || ': violation accounts', format('select t.codes(%L)', :'vio'), '216,46');

-- material receipt -> 126 / 217
INSERT INTO public.material_receipts (receipt_number, receipt_date, total_amount, project_id, supplier_id)
VALUES ('MR-1', current_date, 500, :'prj', :'sub') RETURNING id AS mr \gset
SELECT t.ok(:'co_code' || ': post material receipt', format('select public.rpc_post_material(%L)', :'mr'));
SELECT t.eq(:'co_code' || ': material accounts', format('select t.codes(%L)', :'mr'), '126,217');

-- bulk disbursement -> voucher credited to the main cash box (122) of the same company
INSERT INTO public.expenses (description, unit_price, quantity, exp_date) VALUES ('مصروف اختبار', 50, 1, current_date) RETURNING id AS exp \gset
SELECT t.ok(:'co_code' || ': bulk disburse', format('select public.bulk_disburse_v2(array[%L::uuid], %L)', :'exp', 'aaaaaaaa-0000-0000-0000-000000000001'));
SELECT t.eq(:'co_code' || ': voucher paid from own cash box', format($q$select a.code || case when a.company_id = v.company_id then '' else '!' end from public.payment_vouchers v join public.accounts a on a.id = v.credit_account_id where v.related_expense_id = %L$q$, :'exp'), '122');
