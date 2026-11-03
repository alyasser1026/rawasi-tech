-- Run using a privileged test connection; financial and audit fixtures roll back.
BEGIN;
SELECT set_config('request.jwt.claim.sub',
  (SELECT id::text FROM public.profiles WHERE is_admin AND is_active ORDER BY created_at LIMIT 1),true);
SET LOCAL ROLE authenticated;
DO $tests$
DECLARE
  expense uuid; cash uuid; payable uuid; party uuid; h uuid; draft uuid; source_id uuid;
  line_id uuid; replacement jsonb; alias text; bad_case integer; rejected boolean;
  status_before text; result_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.check_is_admin() THEN RAISE EXCEPTION 'An active administrator is required'; END IF;
  SELECT id INTO STRICT expense FROM public.accounts WHERE code='512';
  SELECT id INTO STRICT cash FROM public.accounts WHERE code='1291';
  SELECT id INTO STRICT payable FROM public.accounts WHERE code='212';
  INSERT INTO public.partners(code,name,partner_type,account_id)
    VALUES('PH3-'||gen_random_uuid()::text,'Phase 3 rollback fixture','مقاول',payable) RETURNING id INTO party;

  FOREACH alias IN ARRAY ARRAY['posted','مرحل','معتمد'] LOOP
    INSERT INTO public.journal_headers(entry_date,description,status)
      VALUES(current_date,'Phase 3 balanced fixture',alias) RETURNING id INTO h;
    INSERT INTO public.journal_lines(header_id,account_id,debit,credit)
      VALUES(h,expense,0.30,0),(h,cash,0,0.30),(h,expense,0,0);
  END LOOP;
  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;

  FOR bad_case IN 1..7 LOOP
    rejected:=false;
    BEGIN
      INSERT INTO public.journal_headers(entry_date,description,status)
        VALUES(current_date,'Phase 3 rejected fixture','posted') RETURNING id INTO h;
      IF bad_case=1 THEN
        INSERT INTO public.journal_lines(header_id,account_id,debit,credit) VALUES(h,expense,-1,0);
      ELSIF bad_case=2 THEN
        INSERT INTO public.journal_lines(header_id,account_id,debit,credit) VALUES(h,cash,0,-1);
      ELSIF bad_case=3 THEN
        INSERT INTO public.journal_lines(header_id,account_id,debit,credit) VALUES(h,expense,1,1);
      ELSIF bad_case=4 THEN
        INSERT INTO public.journal_lines(header_id,account_id,debit,credit) VALUES(h,expense,'NaN'::numeric,0);
      ELSIF bad_case=5 THEN
        INSERT INTO public.journal_lines(header_id,account_id,debit,credit) VALUES(h,expense,100.01,0),(h,cash,0,100);
      ELSIF bad_case=6 THEN
        INSERT INTO public.journal_lines(header_id,account_id,debit,credit) VALUES(h,expense,0,0),(h,cash,0,0);
      END IF;
      SET CONSTRAINTS ALL IMMEDIATE;
    EXCEPTION WHEN check_violation THEN rejected:=true;
    END;
    IF NOT rejected THEN RAISE EXCEPTION 'Invalid case % was accepted',bad_case; END IF;
    SET CONSTRAINTS ALL DEFERRED;
  END LOOP;

  INSERT INTO public.journal_headers(entry_date,description,status)
    VALUES(current_date,'Original draft','draft') RETURNING id INTO draft;
  INSERT INTO public.journal_lines(header_id,account_id,debit,credit) VALUES(draft,expense,100,0) RETURNING id INTO line_id;
  SET CONSTRAINTS ALL IMMEDIATE; -- An unfinished draft is valid.
  SET CONSTRAINTS ALL DEFERRED;
  rejected:=false;
  BEGIN
    UPDATE public.journal_headers SET status='posted' WHERE id=draft;
    SET CONSTRAINTS ALL IMMEDIATE;
  EXCEPTION WHEN check_violation THEN rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Unbalanced draft was posted'; END IF;
  SET CONSTRAINTS ALL DEFERRED;
  replacement:=jsonb_build_array(
    jsonb_build_object('id',line_id,'account_id',expense,'partner_id',party,'debit',125,'credit',0,'notes','Preserve line metadata'),
    jsonb_build_object('account_id',cash,'debit',0,'credit',125));
  PERFORM public.save_journal_draft(draft,current_date,'Atomic saved draft',replacement);
  IF NOT EXISTS(SELECT 1 FROM public.journal_lines WHERE id=line_id AND partner_id=party AND notes='Preserve line metadata')
    THEN RAISE EXCEPTION 'Draft save lost line metadata'; END IF;
  rejected:=false;
  BEGIN
    PERFORM public.save_journal_draft(draft,current_date,'Must roll back',
      jsonb_build_array(jsonb_build_object('account_id',gen_random_uuid(),'debit',125,'credit',0)));
  EXCEPTION WHEN foreign_key_violation THEN rejected:=true;
  END;
  IF NOT rejected OR (SELECT description FROM public.journal_headers WHERE id=draft)<>'Atomic saved draft'
    OR (SELECT count(*) FROM public.journal_lines WHERE header_id=draft)<>2
    THEN RAISE EXCEPTION 'Failed draft save was not atomic'; END IF;

  INSERT INTO public.manual_journals(voucher_number,description,debit_account_id,credit_account_id,amount,partner_id)
    VALUES('PH3-'||gen_random_uuid()::text,'Manual posting fixture',expense,cash,100,party) RETURNING id INTO source_id;
  PERFORM public.post_manual_journals_bulk(ARRAY[source_id]);
  INSERT INTO public.payment_vouchers(voucher_number,amount,partner_id,debit_account_id,credit_account_id)
    VALUES('PH3-'||gen_random_uuid()::text,150,party,payable,cash) RETURNING id INTO source_id;
  PERFORM public.post_payment_vouchers_bulk(ARRAY[source_id]);
  INSERT INTO public.receipt_vouchers(receipt_number,amount,payment_method,partner_id,safe_bank_acc_id,partner_acc_id)
    VALUES('PH3-'||gen_random_uuid()::text,200,'نقدي (كاش)',party,cash,payable) RETURNING id INTO source_id;
  PERFORM public.post_receipts_bulk(ARRAY[source_id]);
  INSERT INTO public.invoices(invoice_number,partner_id,taxable_amount,tax_amount,guarantee_amount,total_amount)
    VALUES('PH3-'||gen_random_uuid()::text,party,100,15,5,110) RETURNING id INTO source_id;
  PERFORM public.post_invoices_bulk(ARRAY[source_id]);
  INSERT INTO public.labor_daily_logs(work_date,worker_name,worker_partner_id,daily_wage,attendance_value)
    VALUES(current_date,'Phase 3 labor fixture',party,300,1) RETURNING id INTO source_id;
  PERFORM public.post_labor_logs_bulk(ARRAY[source_id]);
  INSERT INTO public.expenses(description,quantity,unit_price,creditor_account,payment_account,payee_id)
    VALUES('Phase 3 expense fixture',1,75,'512 - expense','1291 - bank',party) RETURNING id INTO source_id;
  PERFORM public.post_expenses_bulk(ARRAY[source_id]);
  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;

  INSERT INTO public.invoices(invoice_number,partner_id,taxable_amount,total_amount)
    VALUES('PH3-'||gen_random_uuid()::text,party,100,200) RETURNING id,status INTO source_id,status_before;
  rejected:=false;
  BEGIN
    PERFORM public.post_invoices_bulk(ARRAY[source_id]);
    SET CONSTRAINTS ALL IMMEDIATE;
  EXCEPTION WHEN check_violation THEN rejected:=true;
  END;
  IF NOT rejected OR EXISTS(SELECT 1 FROM public.journal_headers WHERE reference_id=source_id)
    OR (SELECT status FROM public.invoices WHERE id=source_id) IS DISTINCT FROM status_before
    THEN RAISE EXCEPTION 'Invalid invoice posting was not atomic'; END IF;
  SET CONSTRAINTS ALL IMMEDIATE;
END;
$tests$;
SELECT 'phase_3_integrity_tests_passed' AS result;
ROLLBACK;
