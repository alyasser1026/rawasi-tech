-- Payroll integration fixtures; every test row is rolled back.
-- Admin integration fixtures, all rolled back; explicitly force deferred checks.
BEGIN;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM public.profiles WHERE is_admin AND is_active ORDER BY created_at LIMIT 1),true);
SET LOCAL ROLE authenticated;
DO $tests$
DECLARE employee uuid; other_employee uuid; worker uuid; cash uuid; expense uuid; liability uuid; revenue uuid;
  opening uuid; voucher uuid; penalty uuid; labor uuid; slip uuid; header uuid; payload jsonb; blocked boolean; amount numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT public.check_is_admin() THEN RAISE EXCEPTION 'An active administrator is required'; END IF;
  SELECT id INTO STRICT cash FROM public.accounts WHERE code='1291';
  SELECT id INTO STRICT expense FROM public.accounts WHERE code='512';
  SELECT id INTO STRICT liability FROM public.accounts WHERE code='216';
  SELECT id INTO STRICT revenue FROM public.accounts WHERE code='41';
  INSERT INTO public.partners(code,name,partner_type) VALUES('PH6-'||gen_random_uuid(),'Monthly workflow fixture','موظف') RETURNING id INTO employee;
  INSERT INTO public.partners(code,name,partner_type) VALUES('PH6-'||gen_random_uuid(),'Other monthly fixture','موظف') RETURNING id INTO other_employee;
  INSERT INTO public.partners(code,name,partner_type) VALUES('PH6-'||gen_random_uuid(),'Daily workflow fixture','عامل يومية') RETURNING id INTO worker;
  INSERT INTO public.journal_headers(entry_date,description,status) VALUES('1901-02-01','Opening fixture','posted') RETURNING id INTO opening;
  INSERT INTO public.journal_lines(header_id,account_id,partner_id,debit,credit)
    VALUES(opening,expense,NULL,50,0),(opening,liability,employee,0,50);
  INSERT INTO public.payment_vouchers(voucher_number,date,partner_id,amount,debit_account_id,credit_account_id)
    VALUES('PH6-'||gen_random_uuid(),'1901-03-04',employee,20,liability,cash) RETURNING id INTO voucher;
  PERFORM public.post_payment_vouchers_bulk(ARRAY[voucher]);
  INSERT INTO public.violations(date,partner_id,emp_name,amount,reason)
    VALUES('1901-03-04',employee,'Monthly workflow fixture',5,'Phase 6 deduction') RETURNING id INTO penalty;
  PERFORM public.post_violations_bulk(ARRAY[penalty]);
  INSERT INTO public.labor_daily_logs(work_date,worker_name,worker_partner_id,daily_wage,attendance_value)
    VALUES('1901-03-04','Daily workflow fixture',worker,75,1) RETURNING id INTO labor;
  PERFORM public.post_labor_logs_bulk(ARRAY[labor]);
  -- Draft payments/penalties do not reduce the sheet's posted balance.
  INSERT INTO public.payment_vouchers(voucher_number,date,partner_id,amount,debit_account_id,credit_account_id)
    VALUES('PH6-'||gen_random_uuid(),'1901-03-05',employee,999,liability,cash);
  INSERT INTO public.violations(date,partner_id,amount,reason)
    VALUES('1901-03-05',employee,999,'Unposted penalty fixture');
  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;
  payload:=jsonb_build_array(jsonb_build_object('emp_id',employee,'basic_salary','100','allowances','10','amount_to_pay','0','status','غير مدفوع'));
  PERFORM public.save_payroll_drafts('1901-03','1901-03-31',payload);
  SELECT id INTO STRICT slip FROM public.payroll_slips WHERE emp_id=employee AND month='1901-03';
  IF NOT EXISTS(SELECT 1 FROM public.payroll_slips WHERE id=slip AND previous_balance=50 AND total_advances=20 AND total_deductions=5 AND net_salary=135 AND NOT is_posted) THEN
    RAISE EXCEPTION 'Payroll draft does not match posted source balances'; END IF;
  -- A bad second selection rolls back changes to the first selected salary.
  blocked:=false;
  BEGIN
    PERFORM public.save_payroll_drafts('1901-03','1901-03-31',payload||jsonb_build_array(jsonb_build_object('emp_id',worker,'basic_salary','999','allowances','0','amount_to_pay','0','status','غير مدفوع')));
  EXCEPTION WHEN check_violation THEN blocked:=true; END;
  IF NOT blocked OR EXISTS(SELECT 1 FROM public.payroll_slips WHERE emp_id=worker) THEN RAISE EXCEPTION 'Worker payroll was saved'; END IF;
  PERFORM public.save_and_post_payroll('1901-03','1901-03-31',payload);
  SELECT journal_header_id INTO STRICT header FROM public.payroll_slips WHERE id=slip;
  IF header IS NULL OR (SELECT count(*) FROM public.journal_lines WHERE header_id=header)<>2
    OR NOT EXISTS(SELECT 1 FROM public.journal_lines WHERE header_id=header AND account_id=expense AND partner_id IS NULL AND debit=110)
    OR NOT EXISTS(SELECT 1 FROM public.journal_lines WHERE header_id=header AND account_id=liability AND partner_id=employee AND credit=110)
    OR public.get_partner_balance(employee)<>135
    OR EXISTS(SELECT 1 FROM public.payroll_slips WHERE emp_id IN(worker,other_employee)) THEN
    RAISE EXCEPTION 'Selected salary posting duplicated sources or used incorrect accounts'; END IF;
  blocked:=false;
  BEGIN PERFORM public.save_and_post_payroll('1901-03','1901-03-31',payload);
  EXCEPTION WHEN check_violation THEN blocked:=true; END;
  IF NOT blocked OR (SELECT count(*) FROM public.journal_headers WHERE reference_id=slip)<>1 THEN RAISE EXCEPTION 'Duplicate salary posting accepted'; END IF;
  blocked:=false;
  BEGIN DELETE FROM public.payroll_slips WHERE id=slip;
  EXCEPTION WHEN check_violation THEN blocked:=true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'Posted salary deleted'; END IF;
  PERFORM public.unpost_payroll_slips('1901-03',ARRAY[employee]);
  IF EXISTS(SELECT 1 FROM public.journal_headers WHERE id=header) OR public.get_partner_balance(employee)<>25
    OR NOT EXISTS(SELECT 1 FROM public.payment_vouchers WHERE id=voucher AND is_posted)
    OR NOT EXISTS(SELECT 1 FROM public.violations WHERE id=penalty AND is_posted)
    OR NOT EXISTS(SELECT 1 FROM public.labor_daily_logs WHERE id=labor AND is_posted) THEN
    RAISE EXCEPTION 'Unposting salary modified independent sources'; END IF;
  PERFORM public.save_and_post_payroll('1901-03','1901-03-31',payload);
  IF public.get_partner_balance(employee)<>135 THEN RAISE EXCEPTION 'Reposting changed employee balance'; END IF;
  IF has_function_privilege('anon','public.save_and_post_payroll(text,date,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous payroll access enabled'; END IF;
  SET CONSTRAINTS ALL IMMEDIATE;
END;
$tests$;
SELECT 'phase_6_payroll_workflow_tests_passed' AS result;
ROLLBACK;
