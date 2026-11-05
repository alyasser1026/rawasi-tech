\set ON_ERROR_STOP 0
-- A works in PHI (no header, default switched to RYC by the isolation tests -> use header)
SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', false);
SELECT id AS phi FROM public.companies WHERE code='PHI' \gset
SELECT id AS ryc FROM public.companies WHERE code='RYC' \gset
SELECT set_config('request.headers', format('{"x-company-id":"%s"}', :'phi'), false);
SET ROLE authenticated;
INSERT INTO public.partners (code, name, partner_type) VALUES ('C-PHI', 'عميل فاي', 'عميل') RETURNING id AS cust \gset
INSERT INTO public.invoices (invoice_number, partner_id, total_amount, taxable_amount, tax_amount) VALUES ('INV-1', :'cust', 1150, 1000, 150) RETURNING id AS inv, tax_acc_id, debit_account_id, company_id \gset
SELECT (SELECT code FROM public.accounts WHERE id = :'tax_acc_id') AS tax_code, (SELECT code FROM public.accounts WHERE id = :'debit_account_id') AS debit_code, :'company_id' = :'phi' AS in_phi;
SELECT public.post_invoices_bulk(ARRAY[:'inv'::uuid]);
SELECT count(*) AS phi_journal_lines, string_agg(DISTINCT company_id::text, ',') = :'phi' AS all_phi FROM public.journal_lines;
SELECT report_data->>'total_revenue' AS phi_revenue FROM public.sys_financial_reports WHERE report_name='IncomeStatement';
-- same in RYC
SELECT set_config('request.headers', format('{"x-company-id":"%s"}', :'ryc'), false);
INSERT INTO public.partners (code, name, partner_type) VALUES ('C-PHI', 'عميل الثانية', 'عميل') RETURNING id AS cust2 \gset
INSERT INTO public.invoices (invoice_number, partner_id, total_amount, taxable_amount, tax_amount) VALUES ('INV-1', :'cust2', 2300, 2000, 300) RETURNING id AS inv2, tax_acc_id AS tax2 \gset
SELECT (SELECT company_id = :'ryc' FROM public.accounts WHERE id = :'tax2') AS ryc_tax_account_is_ryc;
SELECT public.post_invoices_bulk(ARRAY[:'inv2'::uuid]);
SELECT count(*) AS ryc_journal_lines FROM public.journal_lines;
SELECT report_data->>'total_revenue' AS ryc_revenue FROM public.sys_financial_reports WHERE report_name='IncomeStatement';
RESET ROLE;
