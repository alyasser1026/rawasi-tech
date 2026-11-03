-- Run using a privileged connection. All financial/audit fixtures roll back.
BEGIN;
SELECT set_config('request.jwt.claim.sub',
  (SELECT id::text FROM public.profiles WHERE is_admin AND is_active ORDER BY created_at LIMIT 1),true);
SET LOCAL ROLE authenticated;
DO $tests$
DECLARE
  employee uuid; slip uuid; inventory_item uuid; h uuid; debit_account uuid; credit_account uuid;
  actual numeric; column_name text; bad_value numeric; rejected boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.check_is_admin() THEN RAISE EXCEPTION 'An active administrator is required'; END IF;
  INSERT INTO public.partners(code,name,partner_type)
    VALUES('PH5-'||gen_random_uuid()::text,'Phase 5 precision fixture','موظف') RETURNING id INTO employee;
  INSERT INTO public.payroll_slips(emp_id,month,basic_salary,total_advances,total_deductions,net_salary,allowances,amount_to_pay)
    VALUES(employee,'1900-01',0.1,0.2,0.01,0.1,0.01,0.1) RETURNING id INTO slip;
  INSERT INTO public.payroll_slips(emp_id,month,basic_salary,net_salary)
    VALUES(employee,'1900-02',0.2,0.2);
  SELECT previous_unpaid_balance INTO STRICT actual
    FROM public.get_payroll_balances_with_cutoff(3,1900,'1900-03-01') WHERE partner_id=employee;
  IF actual<>0.3 THEN RAISE EXCEPTION 'Payroll balance lost decimal precision: %',actual; END IF;
  UPDATE public.payroll_slips SET net_salary=basic_salary+allowances-total_deductions-total_advances WHERE id=slip;
  IF (SELECT net_salary FROM public.payroll_slips WHERE id=slip)<>-0.1 THEN
    RAISE EXCEPTION 'Payroll decimal subtraction is not exact'; END IF;
  UPDATE public.payroll_slips SET basic_salary=1234567890123456.78,net_salary=1234567890123456.78 WHERE id=slip;
  IF (SELECT net_salary FROM public.payroll_slips WHERE id=slip)<>1234567890123456.78 THEN
    RAISE EXCEPTION 'High precision salary was rounded'; END IF;
  UPDATE public.payroll_slips SET basic_salary=NULL,total_advances=NULL,total_deductions=NULL,allowances=NULL,amount_to_pay=NULL,net_salary=0 WHERE id=slip;
  IF (SELECT basic_salary IS NOT NULL FROM public.payroll_slips WHERE id=slip) THEN
    RAISE EXCEPTION 'Nullable salary behavior changed'; END IF;

  FOREACH column_name IN ARRAY ARRAY['basic_salary','total_advances','total_deductions','net_salary','allowances','amount_to_pay'] LOOP
    FOREACH bad_value IN ARRAY ARRAY['NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric] LOOP
      rejected:=false;
      BEGIN
        EXECUTE format('UPDATE public.payroll_slips SET %I=$1 WHERE id=$2',column_name) USING bad_value,slip;
      EXCEPTION WHEN check_violation THEN rejected:=true; END;
      IF NOT rejected THEN RAISE EXCEPTION 'Nonfinite salary accepted in %',column_name; END IF;
    END LOOP;
  END LOOP;

  INSERT INTO public.inventory(item_name,current_stock,avg_price)
    VALUES('PH5 precision fixture',0.1,0.1) RETURNING id INTO inventory_item;
  UPDATE public.inventory SET avg_price=(current_stock*avg_price+0.2*0.4)/(current_stock+0.2),current_stock=current_stock+0.2 WHERE id=inventory_item;
  IF NOT EXISTS(SELECT 1 FROM public.inventory WHERE id=inventory_item AND current_stock=0.3 AND avg_price=0.3 AND current_stock*avg_price=0.09) THEN
    RAISE EXCEPTION 'Decimal stock valuation is not exact'; END IF;
  UPDATE public.inventory SET avg_price=123.456789012345678901,current_stock=3.25 WHERE id=inventory_item;
  IF (SELECT avg_price FROM public.inventory WHERE id=inventory_item)<>123.456789012345678901 THEN
    RAISE EXCEPTION 'Average price precision was truncated'; END IF;
  FOREACH column_name IN ARRAY ARRAY['current_stock','avg_price'] LOOP
    FOREACH bad_value IN ARRAY ARRAY['NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric] LOOP
      rejected:=false;
      BEGIN
        EXECUTE format('UPDATE public.inventory SET %I=$1 WHERE id=$2',column_name) USING bad_value,inventory_item;
      EXCEPTION WHEN check_violation THEN rejected:=true; END;
      IF NOT rejected THEN RAISE EXCEPTION 'Nonfinite inventory accepted in %',column_name; END IF;
    END LOOP;
  END LOOP;
  UPDATE public.inventory SET current_stock=-0.125,avg_price=NULL WHERE id=inventory_item;
  IF (SELECT current_stock FROM public.inventory WHERE id=inventory_item)<>-0.125 THEN
    RAISE EXCEPTION 'Existing negative-stock behavior changed'; END IF;
  INSERT INTO public.inventory(item_name) VALUES('PH5 default precision fixture') RETURNING id INTO inventory_item;
  IF NOT EXISTS(SELECT 1 FROM public.inventory WHERE id=inventory_item AND current_stock=0 AND avg_price=0) THEN
    RAISE EXCEPTION 'Inventory defaults changed'; END IF;

  -- Decimal payroll totals remain compatible with the phase 3 journal guards.
  SELECT id INTO STRICT debit_account FROM public.accounts WHERE code='512';
  SELECT id INTO STRICT credit_account FROM public.accounts WHERE code='216';
  INSERT INTO public.journal_headers(entry_date,description,status,v_type)
    VALUES(current_date,'Phase 5 decimal journal fixture','posted','phase_5_test') RETURNING id INTO h;
  INSERT INTO public.journal_lines(header_id,account_id,debit,credit)
    VALUES(h,debit_account,0.1+0.2,0),(h,credit_account,0,0.3);
  SET CONSTRAINTS ALL IMMEDIATE;
  IF jsonb_typeof(to_jsonb((SELECT net_salary FROM public.payroll_slips WHERE id=slip)))<>'number' THEN
    RAISE EXCEPTION 'Salary JSON type changed'; END IF;
  IF has_table_privilege('anon','public.payroll_slips','SELECT') OR has_table_privilege('anon','public.inventory','SELECT') THEN
    RAISE EXCEPTION 'Anonymous financial access enabled'; END IF;
  PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  IF EXISTS(SELECT 1 FROM public.payroll_slips WHERE emp_id=employee)
    OR EXISTS(SELECT 1 FROM public.inventory WHERE id=inventory_item) THEN
    RAISE EXCEPTION 'Precision change bypassed RLS'; END IF;
END;
$tests$;
SELECT 'phase_5_exact_values_tests_passed' AS result;
ROLLBACK;
