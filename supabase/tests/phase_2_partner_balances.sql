-- Run using a privileged test connection. Every fixture is rolled back.
BEGIN;
SELECT set_config('request.jwt.claim.sub',
  (SELECT id::text FROM public.profiles WHERE is_admin AND is_active ORDER BY created_at LIMIT 1), true);
SET LOCAL ROLE authenticated;
DO $tests$
DECLARE
  owner_id uuid := auth.uid(); supplier uuid; customer uuid; worker uuid; empty_partner uuid;
  supplier_account uuid; customer_account uuid; wage_account uuid; cash_account uuid; expense_account uuid;
  log_id uuid; h_id uuid; payment_header uuid; item jsonb; fixtures jsonb;
  excluded_status text; test_number integer; before_tie numeric; after_tie numeric;
  opening numeric; closing numeric; mismatches integer;
BEGIN
  IF owner_id IS NULL OR NOT public.check_is_admin() THEN RAISE EXCEPTION 'An active administrator is required for this test'; END IF;
  SELECT id INTO STRICT supplier_account FROM public.accounts WHERE code='211';
  SELECT id INTO STRICT customer_account FROM public.accounts WHERE code='123';
  SELECT id INTO STRICT wage_account FROM public.accounts WHERE code='216';
  SELECT id INTO STRICT cash_account FROM public.accounts WHERE code='1291';
  SELECT id INTO STRICT expense_account FROM public.accounts WHERE code='512';
  INSERT INTO public.partners(code,name,partner_type) VALUES ('PH2-'||gen_random_uuid()::text,'Phase 2 supplier fixture','مورد') RETURNING id INTO supplier;
  INSERT INTO public.partners(code,name,partner_type) VALUES ('PH2-'||gen_random_uuid()::text,'Phase 2 customer fixture','عميل') RETURNING id INTO customer;
  INSERT INTO public.partners(code,name,partner_type) VALUES ('PH2-'||gen_random_uuid()::text,'Phase 2 worker fixture','عامل') RETURNING id INTO worker;
  INSERT INTO public.partners(code,name,partner_type,is_active) VALUES ('PH2-'||gen_random_uuid()::text,'Phase 2 empty inactive fixture','مورد',false) RETURNING id INTO empty_partner;
  INSERT INTO public.labor_daily_logs(work_date,worker_name,worker_partner_id,daily_wage,attendance_value,is_posted)
    VALUES ('2026-01-01','Phase 2 worker fixture',worker,200,3,true) RETURNING id INTO log_id;
  fixtures := jsonb_build_array(
    jsonb_build_object('party',supplier,'account',supplier_account,'credit',1000,'debit',0,'status','posted','date','2026-01-01'),
    jsonb_build_object('party',supplier,'account',supplier_account,'credit',0,'debit',250,'status','posted','date','2026-01-02','payment',true),
    jsonb_build_object('party',customer,'account',customer_account,'credit',0,'debit',2000,'status','معتمد','date','2026-01-01'),
    jsonb_build_object('party',customer,'account',customer_account,'credit',500,'debit',0,'status','مرحل','date','2026-01-02'),
    jsonb_build_object('party',worker,'account',wage_account,'credit',600,'debit',0,'status','posted','date','2026-01-01','reference',log_id),
    jsonb_build_object('party',worker,'account',wage_account,'credit',0,'debit',250,'status','posted','date','2026-01-02')
  );
  FOR item IN SELECT value FROM jsonb_array_elements(fixtures) LOOP
    INSERT INTO public.journal_headers(entry_date,description,status,v_type,reference_id)
      VALUES ((item->>'date')::date,'Phase 2 fixture','draft',
        CASE WHEN item ? 'reference' THEN 'labor_daily_logs' ELSE 'manual_journals' END,(item->>'reference')::uuid)
      RETURNING id INTO h_id;
    INSERT INTO public.journal_lines(header_id,account_id,partner_id,debit,credit,quantity,created_at)
      VALUES (h_id,(item->>'account')::uuid,(item->>'party')::uuid,(item->>'debit')::numeric,(item->>'credit')::numeric,
        CASE WHEN item ? 'reference' THEN 3 ELSE 1 END,'2026-01-01T10:00:00Z');
    INSERT INTO public.journal_lines(header_id,account_id,debit,credit)
      VALUES (h_id,cash_account,(item->>'credit')::numeric,(item->>'debit')::numeric);
    UPDATE public.journal_headers SET status=item->>'status' WHERE id=h_id;
    IF item ? 'payment' THEN payment_header := h_id; END IF;
  END LOOP;
  FOREACH excluded_status IN ARRAY ARRAY['draft','مسودة','معلق','cancelled','ملغي',NULL] LOOP
    INSERT INTO public.journal_headers(entry_date,description,status) VALUES ('2026-01-01','Excluded phase 2 fixture','draft') RETURNING id INTO h_id;
    INSERT INTO public.journal_lines(header_id,account_id,partner_id,debit,credit) VALUES (h_id,supplier_account,supplier,0,9999);
    INSERT INTO public.journal_lines(header_id,account_id,debit,credit) VALUES (h_id,expense_account,9999,0);
    UPDATE public.journal_headers SET status=excluded_status WHERE id=h_id;
  END LOOP;
  IF public.get_partner_balance(supplier)<>750 OR public.get_partner_balance(customer)<>-1500
    OR public.get_partner_balance(worker)<>350 OR public.get_partner_balance(empty_partner)<>0
    OR public.get_partner_balance(NULL)<>0 OR public.get_partner_balance(gen_random_uuid())<>0
  THEN RAISE EXCEPTION 'Partner balance sign or posted-only filtering failed'; END IF;
  IF (SELECT total_work_days FROM public.all_partners_account_summary WHERE partner_id=worker)<>3
    THEN RAISE EXCEPTION 'Posted attendance summary failed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.partner_balances_summary WHERE partner_id=supplier AND total_earned=1000 AND total_paid=250 AND current_balance=750)
    THEN RAISE EXCEPTION 'Compatibility view contract failed'; END IF;
  FOR test_number IN 1..2 LOOP
    INSERT INTO public.journal_headers(entry_date,description,status) VALUES ('2026-01-03','Tied phase 2 fixture','draft') RETURNING id INTO h_id;
    INSERT INTO public.journal_lines(header_id,account_id,partner_id,debit,credit,created_at)
      VALUES (h_id,supplier_account,supplier,0,25.25,'2026-01-03T10:00:00Z');
    INSERT INTO public.journal_lines(header_id,account_id,debit,credit) VALUES (h_id,expense_account,25.25,0);
    UPDATE public.journal_headers SET status='posted' WHERE id=h_id;
  END LOOP;
  SELECT running_balance INTO before_tie FROM public.partner_statement_ledger WHERE partner_id=supplier AND transaction_date='2026-01-03' ORDER BY created_at,line_id LIMIT 1;
  SELECT running_balance INTO after_tie FROM public.partner_statement_ledger WHERE partner_id=supplier AND transaction_date='2026-01-03' ORDER BY created_at DESC,line_id DESC LIMIT 1;
  IF before_tie<>775.25 OR after_tie<>800.50 THEN RAISE EXCEPTION 'Tied running balances are not deterministic'; END IF;
  SELECT COALESCE(SUM(credit-debit) FILTER(WHERE transaction_date<'2026-01-02'),0),
    COALESCE(SUM(credit-debit) FILTER(WHERE transaction_date<='2026-01-02'),0)
    INTO opening,closing FROM public.partner_statement_ledger WHERE partner_id=supplier;
  IF opening<>1000 OR closing<>750 THEN RAISE EXCEPTION 'Date cutoffs disagree with the statement'; END IF;
  UPDATE public.journal_headers SET status='draft' WHERE id=payment_header;
  IF public.get_partner_balance(supplier)<>1050.50 THEN RAISE EXCEPTION 'Unposting did not update balance'; END IF;
  UPDATE public.journal_headers SET status='posted' WHERE id=payment_header;
  IF public.get_partner_balance(supplier)<>800.50 THEN RAISE EXCEPTION 'Reposting did not restore balance'; END IF;
  SELECT count(*) INTO mismatches FROM public.all_partners_account_summary s JOIN public.partner_balances_summary c USING(partner_id)
    WHERE s.net_balance<>c.current_balance OR s.net_balance<>public.get_partner_balance(s.partner_id)
      OR s.net_balance<>(SELECT COALESCE(SUM(l.credit-l.debit),0) FROM public.partner_statement_ledger l WHERE l.partner_id=s.partner_id);
  IF mismatches<>0 THEN RAISE EXCEPTION 'Ledger, summaries and RPC disagree'; END IF;
  IF has_table_privilege('anon','public.partner_balances_summary','SELECT') OR has_function_privilege('anon','public.get_partner_balance(uuid)','EXECUTE')
    THEN RAISE EXCEPTION 'Anonymous financial access is enabled'; END IF;
  PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  IF EXISTS(SELECT 1 FROM public.partner_balances_summary) OR EXISTS(SELECT 1 FROM public.partner_statement_ledger)
    OR public.get_partner_balance(supplier)<>0 THEN RAISE EXCEPTION 'Rows leaked to an unauthorized account'; END IF;
  PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
END;
$tests$;
ROLLBACK;
SELECT 'PASS: posted-only balances, signs, partial payments, attendance, ties, date cutoffs, unposting/reposting, view/RPC equality and RLS; all fixtures rolled back' AS result;
