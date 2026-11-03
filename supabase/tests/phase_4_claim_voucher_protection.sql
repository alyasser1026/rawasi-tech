-- Authenticated-admin integration tests; no fixture persists.
BEGIN;
SELECT set_config('request.jwt.claim.sub',
  (SELECT id::text FROM public.profiles WHERE is_admin AND is_active ORDER BY created_at LIMIT 1),true);
SET LOCAL ROLE authenticated;
DO $tests$
DECLARE
  party uuid; expense uuid; cash uuid; payable uuid; claim uuid; voucher uuid; other_voucher uuid;
  assignment uuid; issue uuid; material uuid; deduction uuid; h uuid; alt_h uuid;
  blocked boolean; action integer; document_status text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.check_is_admin() THEN RAISE EXCEPTION 'An active administrator is required'; END IF;
  SELECT id INTO STRICT expense FROM public.accounts WHERE code='512';
  SELECT id INTO STRICT cash FROM public.accounts WHERE code='1291';
  SELECT id INTO STRICT payable FROM public.accounts WHERE code='212';
  INSERT INTO public.partners(code,name,partner_type,account_id)
    VALUES('PH4-'||gen_random_uuid()::text,'Phase 4 contractor fixture','مقاول',payable) RETURNING id INTO party;
  INSERT INTO public.sub_claims(claim_number,contractor_id,total_amount,retention_amount,net_amount)
    VALUES('PH4-'||gen_random_uuid()::text,party,1000,50,950) RETURNING id INTO claim;
  INSERT INTO public.contractor_assignments(contractor_id,claim_id,status)
    VALUES(party,claim,'مفوتر') RETURNING id INTO assignment;
  INSERT INTO public.material_issues(issue_number,claim_id)
    VALUES('PH4-'||gen_random_uuid()::text,claim) RETURNING id INTO issue;
  INSERT INTO public.material_issue_lines(issue_id,item_name,claim_id)
    VALUES(issue,'Phase 4 material fixture',claim) RETURNING id INTO material;
  INSERT INTO public.expenses(description,unit_price,payee_id,claim_id,is_deducted_in_claim)
    VALUES('Phase 4 deduction fixture',10,party,claim,true) RETURNING id INTO deduction;
  PERFORM public.post_sub_claim(claim);
  SELECT jv_header_id INTO STRICT h FROM public.sub_claims WHERE id=claim;
  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;

  FOR action IN 1..4 LOOP
    blocked:=false;
    BEGIN
      IF action=1 THEN DELETE FROM public.sub_claims WHERE id=claim;
      ELSIF action=2 THEN PERFORM public.rpc_delete_claim(claim);
      ELSIF action=3 THEN PERFORM public.delete_sub_claim(claim);
      ELSE UPDATE public.sub_claims SET is_posted=false,status='مسودة' WHERE id=claim; END IF;
    EXCEPTION WHEN check_violation THEN blocked:=true;
    END;
    IF NOT blocked THEN RAISE EXCEPTION 'Posted claim action % was accepted',action; END IF;
  END LOOP;

  INSERT INTO public.payment_vouchers(voucher_number,amount,partner_id,debit_account_id,credit_account_id,sub_claim_id)
    VALUES('PH4-'||gen_random_uuid()::text,200,party,payable,cash,claim) RETURNING id INTO voucher;
  PERFORM public.post_payment_vouchers_bulk(ARRAY[voucher]);
  UPDATE public.sub_claims SET paid_amount=200,status='مسدد جزئي' WHERE id=claim;
  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;
  FOR action IN 1..4 LOOP
    blocked:=false;
    BEGIN
      IF action=1 THEN DELETE FROM public.payment_vouchers WHERE id=voucher;
      ELSIF action=2 THEN PERFORM public.delete_payment_vouchers_bulk(ARRAY[voucher]);
      ELSIF action=3 THEN UPDATE public.payment_vouchers SET amount=300 WHERE id=voucher;
      ELSE PERFORM public.rpc_unpost_claim(claim); END IF;
    EXCEPTION WHEN check_violation THEN blocked:=true;
    END;
    IF NOT blocked THEN RAISE EXCEPTION 'Posted voucher/claim action % was accepted',action; END IF;
  END LOOP;
  IF NOT EXISTS(SELECT 1 FROM public.journal_headers WHERE id=h)
    OR NOT EXISTS(SELECT 1 FROM public.journal_headers WHERE reference_id=voucher)
    THEN RAISE EXCEPTION 'Failed deletion lost journal records'; END IF;

  -- Similar descriptions never create a deletion association.
  INSERT INTO public.payment_vouchers(voucher_number,amount,partner_id,debit_account_id,credit_account_id,description)
    VALUES('PH4-'||gen_random_uuid()::text,25,party,payable,cash,'Text includes '||(SELECT claim_number FROM public.sub_claims WHERE id=claim))
    RETURNING id INTO other_voucher;
  PERFORM public.unpost_universal_bulk('payment_vouchers',ARRAY[voucher]);
  IF NOT EXISTS(SELECT 1 FROM public.payment_vouchers WHERE id=voucher AND NOT is_posted AND sub_claim_id=claim)
    OR (SELECT paid_amount FROM public.sub_claims WHERE id=claim)<>0
    OR EXISTS(SELECT 1 FROM public.journal_headers WHERE reference_id=voucher)
    THEN RAISE EXCEPTION 'Voucher unposting did not preserve source/link or correct claim paid amount'; END IF;
  PERFORM public.rpc_unpost_claim(claim);
  IF NOT EXISTS(SELECT 1 FROM public.sub_claims WHERE id=claim AND NOT is_posted AND jv_id IS NULL AND jv_header_id IS NULL)
    OR EXISTS(SELECT 1 FROM public.journal_headers WHERE reference_id=claim OR id=h)
    OR NOT EXISTS(SELECT 1 FROM public.contractor_assignments WHERE id=assignment AND claim_id=claim AND status='مفوتر')
    OR NOT EXISTS(SELECT 1 FROM public.material_issue_lines WHERE id=material AND claim_id=claim)
    OR NOT EXISTS(SELECT 1 FROM public.expenses WHERE id=deduction AND claim_id=claim AND is_deducted_in_claim)
    OR (SELECT count(*) FROM public.payment_vouchers WHERE id IN(voucher,other_voucher))<>2
    THEN RAISE EXCEPTION 'Claim unposting deleted vouchers or released its assignments/deductions'; END IF;
  FOR action IN 1..3 LOOP
    blocked:=false;
    BEGIN
      IF action=1 THEN DELETE FROM public.sub_claims WHERE id=claim;
      ELSIF action=2 THEN PERFORM public.rpc_delete_claim(claim);
      ELSE PERFORM public.delete_sub_claim(claim); END IF;
    EXCEPTION WHEN foreign_key_violation THEN blocked:=true;
    END;
    IF NOT blocked THEN RAISE EXCEPTION 'Claim with voucher was deleted'; END IF;
  END LOOP;
  blocked:=false;
  BEGIN DELETE FROM public.payment_vouchers WHERE id=voucher;
  EXCEPTION WHEN check_violation THEN blocked:=true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'Direct linked-voucher delete was accepted'; END IF;

  -- Claim can be reposted without regenerating its assignments.
  PERFORM public.post_sub_claim(claim);
  PERFORM public.post_payment_vouchers_bulk(ARRAY[voucher]);
  blocked:=false;
  BEGIN PERFORM public.delete_payment_vouchers_bulk(ARRAY[other_voucher,voucher]);
  EXCEPTION WHEN check_violation THEN blocked:=true; END;
  IF NOT blocked OR (SELECT count(*) FROM public.payment_vouchers WHERE id IN(voucher,other_voucher))<>2
    THEN RAISE EXCEPTION 'Mixed bulk delete was not atomic'; END IF;
  PERFORM public.unpost_payment_vouchers_bulk(ARRAY[voucher]);
  PERFORM public.rpc_unpost_claim(claim);
  -- Explicit selected draft-voucher deletion is permitted and releases its link.
  PERFORM public.delete_payment_vouchers_bulk(ARRAY[voucher]);
  PERFORM public.rpc_delete_claim(claim);
  IF EXISTS(SELECT 1 FROM public.sub_claims WHERE id=claim)
    OR EXISTS(SELECT 1 FROM public.journal_headers WHERE reference_id=claim)
    OR NOT EXISTS(SELECT 1 FROM public.contractor_assignments WHERE id=assignment AND claim_id IS NULL AND status='جاري التنفيذ')
    OR NOT EXISTS(SELECT 1 FROM public.material_issue_lines WHERE id=material AND claim_id IS NULL)
    OR NOT EXISTS(SELECT 1 FROM public.material_issues WHERE id=issue AND claim_id IS NULL)
    OR NOT EXISTS(SELECT 1 FROM public.expenses WHERE id=deduction AND claim_id IS NULL AND NOT is_deducted_in_claim)
    OR NOT EXISTS(SELECT 1 FROM public.payment_vouchers WHERE id=other_voucher)
    THEN RAISE EXCEPTION 'Draft cleanup or unrelated voucher preservation failed'; END IF;
  SET CONSTRAINTS ALL IMMEDIATE;
END;
$tests$;
SELECT 'phase_4_claim_voucher_tests_passed' AS result;
ROLLBACK;
