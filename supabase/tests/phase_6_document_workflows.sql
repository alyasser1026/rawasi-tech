BEGIN;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM public.profiles WHERE is_admin AND is_active ORDER BY created_at LIMIT 1),true);
SET LOCAL ROLE authenticated;
DO $tests$
DECLARE party uuid; customer uuid; project uuid; task uuid; extra_task uuid; job uuid; claim uuid:=gen_random_uuid();
  voucher uuid:=gen_random_uuid(); invalid_claim uuid:=gen_random_uuid(); bad_payment uuid:=gen_random_uuid();
  invoice uuid; receipt uuid; expense_id uuid; expense_payment uuid; labor uuid; cash uuid; payable uuid; receivable uuid;
  expense_account uuid; payload jsonb; blocked boolean;
BEGIN
  SELECT id INTO STRICT cash FROM public.accounts WHERE code='1291';
  SELECT id INTO STRICT payable FROM public.accounts WHERE code='212';
  SELECT id INTO STRICT receivable FROM public.accounts WHERE code='123';
  SELECT id INTO STRICT expense_account FROM public.accounts WHERE code='512';
  INSERT INTO public.partners(code,name,partner_type,account_id) VALUES('PH6-'||gen_random_uuid(),'Document contractor fixture','مقاول',payable) RETURNING id INTO party;
  INSERT INTO public.partners(code,name,partner_type,account_id) VALUES('PH6-'||gen_random_uuid(),'Document customer fixture','عميل',receivable) RETURNING id INTO customer;
  INSERT INTO public.projects("Property") VALUES('Phase 6 workflow project') RETURNING id INTO project;
  INSERT INTO public.job_orders(order_number,project_id,executor_type,contractor_id) VALUES('PH6-'||gen_random_uuid(),project,'مقاول باطن',party) RETURNING id INTO job;
  INSERT INTO public.contractor_assignments(contractor_id,project_id,job_order_id,assigned_qty,unit_price) VALUES(party,project,job,1,100) RETURNING id INTO task;
  INSERT INTO public.contractor_assignments(contractor_id,project_id,job_order_id,assigned_qty,unit_price) VALUES(party,project,job,1,100) RETURNING id INTO extra_task;
  payload:=jsonb_build_object('contractor_id',party,'project_ids',ARRAY[project],'date','1903-01-01','total_amount',100,
    'retention_amount',5,'advance_payment',0,'materials_deduction',0,'other_deductions',0,'net_amount',95);
  PERFORM public.create_and_post_sub_claim(claim,payload,ARRAY[task]);
  PERFORM public.create_and_post_sub_claim(claim,payload,ARRAY[task]);
  IF (SELECT count(*) FROM public.journal_headers WHERE reference_id=claim)<>1 OR public.get_partner_balance(party)<>95 THEN RAISE EXCEPTION 'Claim retry duplicated its journal'; END IF;
  blocked:=false;
  BEGIN PERFORM public.create_and_post_sub_claim(invalid_claim,payload,ARRAY[extra_task],'{}',ARRAY[gen_random_uuid()]);
  EXCEPTION WHEN check_violation THEN blocked:=true; END;
  IF NOT blocked OR EXISTS(SELECT 1 FROM public.sub_claims WHERE id=invalid_claim)
    OR (SELECT claim_id FROM public.contractor_assignments WHERE id=extra_task) IS NOT NULL THEN RAISE EXCEPTION 'Failed claim creation left partial work'; END IF;
  payload:=jsonb_build_object('date','1903-01-02','amount',40,'payment_method','نقدي','partner_id',party);
  PERFORM public.pay_sub_claim(voucher,claim,payload);
  PERFORM public.pay_sub_claim(voucher,claim,payload);
  IF public.get_partner_balance(party)<>55 OR (SELECT paid_amount FROM public.sub_claims WHERE id=claim)<>40
    OR (SELECT count(*) FROM public.payment_vouchers WHERE sub_claim_id=claim)<>1
    OR NOT EXISTS(SELECT 1 FROM public.cash_flows WHERE source_id=voucher AND source_type='payment_voucher' AND amount=40) THEN
    RAISE EXCEPTION 'Claim payment/retry/posted cash flow disagrees with ledger'; END IF;
  blocked:=false;
  BEGIN PERFORM public.pay_sub_claim(bad_payment,claim,jsonb_set(payload,'{amount}','60'));
  EXCEPTION WHEN check_violation THEN blocked:=true; END;
  IF NOT blocked OR EXISTS(SELECT 1 FROM public.payment_vouchers WHERE id=bad_payment) THEN RAISE EXCEPTION 'Claim overpayment accepted'; END IF;
  PERFORM public.unpost_payment_vouchers_bulk(ARRAY[voucher]);
  PERFORM public.rpc_unpost_claim(claim);
  IF public.get_partner_balance(party)<>0 OR NOT EXISTS(SELECT 1 FROM public.contractor_assignments WHERE id=task AND claim_id=claim)
    OR EXISTS(SELECT 1 FROM public.cash_flows WHERE source_id=voucher) THEN RAISE EXCEPTION 'Unposting lost source links or retained draft cash flow'; END IF;
  PERFORM public.delete_payment_vouchers_bulk(ARRAY[voucher]);
  PERFORM public.rpc_delete_claim(claim);

  INSERT INTO public.invoices(invoice_number,partner_id,taxable_amount,total_amount)
    VALUES('PH6-'||gen_random_uuid(),customer,100,100) RETURNING id INTO invoice;
  PERFORM public.post_invoices_bulk(ARRAY[invoice]);
  INSERT INTO public.receipt_vouchers(receipt_number,date,partner_id,invoice_id,amount,payment_method,safe_bank_acc_id,partner_acc_id)
    VALUES('PH6-'||gen_random_uuid(),'1903-02-01',customer,invoice,25,'نقدي (كاش)',cash,receivable) RETURNING id INTO receipt;
  IF EXISTS(SELECT 1 FROM public.cash_flows WHERE source_id=receipt) THEN RAISE EXCEPTION 'Draft receipt entered cash flow'; END IF;
  PERFORM public.post_receipts_bulk(ARRAY[receipt]);
  IF public.get_partner_balance(customer)<>-75 OR (SELECT paid_amount FROM public.invoices WHERE id=invoice)<>25 THEN RAISE EXCEPTION 'Invoice payment and customer ledger disagree'; END IF;
  blocked:=false;
  BEGIN PERFORM public.unpost_invoices_bulk(ARRAY[invoice]);
  EXCEPTION WHEN check_violation THEN blocked:=true; END;
  IF NOT blocked OR NOT EXISTS(SELECT 1 FROM public.receipt_vouchers WHERE id=receipt) THEN RAISE EXCEPTION 'Invoice unpost deleted its receipt'; END IF;
  PERFORM public.unpost_receipts_bulk(ARRAY[receipt]);
  IF (SELECT paid_amount FROM public.invoices WHERE id=invoice)<>0 OR EXISTS(SELECT 1 FROM public.cash_flows WHERE source_id=receipt) THEN RAISE EXCEPTION 'Receipt unpost left stale collection'; END IF;
  PERFORM public.unpost_invoices_bulk(ARRAY[invoice]);
  IF public.get_partner_balance(customer)<>0 OR NOT EXISTS(SELECT 1 FROM public.receipt_vouchers WHERE id=receipt AND invoice_id=invoice) THEN RAISE EXCEPTION 'Invoice unpost lost its draft receipt or balance'; END IF;
  blocked:=false;
  BEGIN PERFORM public.delete_invoices_bulk(ARRAY[invoice]);
  EXCEPTION WHEN foreign_key_violation THEN blocked:=true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'Invoice with receipt deleted'; END IF;
  PERFORM public.post_invoices_bulk(ARRAY[invoice]);
  PERFORM public.post_receipts_bulk(ARRAY[receipt]);
  IF public.get_partner_balance(customer)<>-75 OR (SELECT paid_amount FROM public.invoices WHERE id=invoice)<>25 THEN RAISE EXCEPTION 'Reposting changed customer totals'; END IF;
  PERFORM public.unpost_receipts_bulk(ARRAY[receipt]);
  PERFORM public.unpost_invoices_bulk(ARRAY[invoice]);
  PERFORM public.delete_receipts_bulk(ARRAY[receipt]);
  PERFORM public.delete_invoices_bulk(ARRAY[invoice]);

  INSERT INTO public.expenses(description,quantity,unit_price,creditor_account,payment_account,payee_id)
    VALUES('Phase 6 expense fixture',1,30,'512 - expense','1291 - bank',party) RETURNING id INTO expense_id;
  PERFORM public.post_expenses_bulk(ARRAY[expense_id]);
  INSERT INTO public.payment_vouchers(voucher_number,partner_id,amount,related_expense_id,debit_account_id,credit_account_id)
    VALUES('PH6-'||gen_random_uuid(),party,10,expense_id,payable,cash) RETURNING id INTO expense_payment;
  PERFORM public.post_payment_vouchers_bulk(ARRAY[expense_payment]);
  blocked:=false;
  BEGIN PERFORM public.unpost_expenses_bulk(ARRAY[expense_id]);
  EXCEPTION WHEN check_violation THEN blocked:=true; END;
  IF NOT blocked OR NOT EXISTS(SELECT 1 FROM public.payment_vouchers WHERE id=expense_payment) THEN RAISE EXCEPTION 'Expense unposting erased a payment'; END IF;
  PERFORM public.unpost_payment_vouchers_bulk(ARRAY[expense_payment]);
  PERFORM public.unpost_expenses_bulk(ARRAY[expense_id]);
  IF EXISTS(SELECT 1 FROM public.journal_headers WHERE reference_id=expense_id)
    OR NOT EXISTS(SELECT 1 FROM public.payment_vouchers WHERE id=expense_payment AND related_expense_id=expense_id) THEN
    RAISE EXCEPTION 'Expense unposting left its journal or lost its voucher'; END IF;
  SET CONSTRAINTS ALL IMMEDIATE;
END;
$tests$;
SELECT 'phase_6_document_workflow_tests_passed' AS result;
ROLLBACK;
