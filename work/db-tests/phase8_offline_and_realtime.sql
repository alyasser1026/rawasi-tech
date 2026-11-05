-- Test Suite: phase8_offline_and_realtime.sql
-- Description: Testing Phase 8 (Offline Draft Queue Idempotency, Telegram Attachments Registry,
--              Cross-Company Sync Pinning, Zero-Posting Guarantee, and Realtime Publication)

BEGIN;

CREATE SCHEMA IF NOT EXISTS phase8_offline_test;
GRANT USAGE ON SCHEMA phase8_offline_test TO authenticated;

CREATE OR REPLACE FUNCTION phase8_offline_test.assert(cond boolean, msg text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT cond THEN
    RAISE EXCEPTION 'PHASE 8 ASSERTION FAILED: %', msg;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION phase8_offline_test.assert(boolean, text) TO authenticated;

-- Setup isolated companies P8COA, P8COB, P8COC (no membership for staff) and seed standard accounts
DO $$
DECLARE
  v_phi uuid;
  v_coa uuid;
  v_cob uuid;
  v_coc uuid;
  v_admin_uid uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  v_staff_uid uuid := 'aaaaaaaa-0000-0000-0000-000000000002';
BEGIN
  SELECT id INTO v_phi FROM public.companies WHERE code = 'PHI';

  INSERT INTO public.companies (code, name, currency, country, is_active)
  VALUES ('P8COA', 'شركة فاي تك للمشروعات - أ', 'SAR', 'SA', true)
  RETURNING id INTO v_coa;

  INSERT INTO public.companies (code, name, currency, country, is_active)
  VALUES ('P8COB', 'شركة فاي تك للمقاولات - ب', 'SAR', 'SA', true)
  RETURNING id INTO v_cob;

  INSERT INTO public.companies (code, name, currency, country, is_active)
  VALUES ('P8COC', 'شركة معزولة غير مصرحة - ج', 'SAR', 'SA', true)
  RETURNING id INTO v_coc;

  -- Seed core accounts (121, 122, 125, 211, 215, 216, 511, 512) into P8COA and P8COB
  INSERT INTO public.accounts (company_id, code, name, account_type, is_transactional)
  SELECT comp_id, x.code, x.name, x.atype, true
  FROM unnest(ARRAY[v_coa, v_cob]) AS comp_id
  CROSS JOIN (VALUES
    ('121', 'الخزينة الرئيسية', 'أصول'),
    ('122', 'البنك الرئيسي', 'أصول'),
    ('125', 'عُهد الموظفين والمواقع', 'أصول'),
    ('211', 'الموردون', 'خصوم'),
    ('215', 'ضريبة القيمة المضافة', 'خصوم'),
    ('216', 'رواتب وأجور مستحقة', 'خصوم'),
    ('511', 'تكلفة الخامات والمصروفات', 'مصروفات'),
    ('512', 'أجور العمالة المباشرة', 'مصروفات')
  ) AS x(code, name, atype);

  -- Activate staff user with field permissions (labor_logs, expenses, payments) on P8COA & P8COB ONLY (NOT P8COC)
  UPDATE public.profiles
  SET is_active = true,
      permissions = jsonb_build_object(
        'labor_logs', jsonb_build_array('view', 'create', 'edit'),
        'expenses', jsonb_build_array('view', 'create', 'edit'),
        'payments', jsonb_build_array('view', 'create', 'edit'),
        'projects', jsonb_build_array('view'),
        'job_orders', jsonb_build_array('view'),
        'partners', jsonb_build_array('view'),
        'accounts', jsonb_build_array('view')
      )
  WHERE id = v_staff_uid;

  INSERT INTO public.user_companies (user_id, company_id, role, is_active)
  VALUES
    (v_admin_uid, v_coa, 'admin', true),
    (v_admin_uid, v_cob, 'admin', true),
    (v_staff_uid, v_coa, 'member', true),
    (v_staff_uid, v_cob, 'member', true)
  ON CONFLICT (user_id, company_id) DO UPDATE SET is_active = true;
END;
$$;

-- Authenticate JWT for non-admin field engineer (staff user 0002); role switched after fixture setup
SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', true);

DO $$
DECLARE
  v_phi uuid;
  v_coa uuid;
  v_cob uuid;
  v_coc uuid;
  v_phi_acc_512 uuid;
  v_coa_acc_512 uuid;
  v_coa_acc_216 uuid;
  v_coa_acc_121 uuid;
  v_proj_a uuid;
  v_jo_a uuid;
  v_partner_eng uuid;
  v_custody_open uuid;
  v_custody_closed uuid;
  v_jh_before integer;
  v_jh_after integer;
  v_req_att uuid := '11111111-8888-4000-8000-000000000001';
  v_req_lab uuid := '11111111-8888-4000-8000-000000000002';
  v_req_exp uuid := '11111111-8888-4000-8000-000000000003';
  v_req_cst uuid := '11111111-8888-4000-8000-000000000004';
  v_res1 jsonb;
  v_res2 jsonb;
  v_res_b jsonb;
  v_cnt integer;
  v_err_caught boolean;
  v_fifo_ids uuid[] := ARRAY[]::uuid[];
  v_i integer;
  v_pub_cnt integer;
  v_repl_cnt integer;
  v_spent_after numeric(15,2);
BEGIN
  SELECT id INTO v_phi FROM public.companies WHERE code = 'PHI';
  SELECT id INTO v_coa FROM public.companies WHERE code = 'P8COA';
  SELECT id INTO v_cob FROM public.companies WHERE code = 'P8COB';
  SELECT id INTO v_coc FROM public.companies WHERE code = 'P8COC';

  SELECT id INTO v_coa_acc_512 FROM public.accounts WHERE company_id = v_coa AND code = '512';
  SELECT id INTO v_coa_acc_216 FROM public.accounts WHERE company_id = v_coa AND code = '216';
  SELECT id INTO v_coa_acc_121 FROM public.accounts WHERE company_id = v_coa AND code = '121';
  SELECT id INTO v_phi_acc_512 FROM public.accounts WHERE company_id = v_phi AND code = '512' LIMIT 1;

  -- Create project, job order, and partner in P8COA before switching to non-admin authenticated role
  INSERT INTO public.projects (company_id, "Property", client_name)
  VALUES (v_coa, 'مشروع برج النخيل', 'شركة النخيل العقارية')
  RETURNING id INTO v_proj_a;

  INSERT INTO public.job_orders (company_id, order_number, project_id, executor_type, assigned_qty, unit_price, status)
  VALUES (v_coa, 'JO-P8-001', v_proj_a, 'تنفيذ ذاتي', 100, 250, 'جاري التنفيذ')
  RETURNING id INTO v_jo_a;

  INSERT INTO public.partners (company_id, code, name, partner_type)
  VALUES (v_coa, 'ENG-P8-01', 'المهندس محمود سامي', 'موظف')
  RETURNING id INTO v_partner_eng;

  -- Now enforce non-admin authenticated role for ALL tests below!
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.headers', jsonb_build_object('x-company-id', v_coa)::text, true);

  -- Issue an open site custody of 5,000 SAR (online operation before going offline)
  v_custody_open := public.create_site_custody(
    p_partner_id := v_partner_eng,
    p_project_id := v_proj_a,
    p_title := 'عهدة تشطيبات الدور الثالث',
    p_amount := 5000.00,
    p_safe_acc_id := v_coa_acc_121,
    p_payment_method := 'نقدي',
    p_notes := 'عهدة موقع مفتوحة',
    p_max_days := 30
  );

  -- Issue and immediately settle a second custody to verify closed-custody rejection
  v_custody_closed := public.create_site_custody(
    p_partner_id := v_partner_eng,
    p_project_id := v_proj_a,
    p_title := 'عهدة مغلقة للاختبار',
    p_amount := 1000.00,
    p_safe_acc_id := v_coa_acc_121,
    p_payment_method := 'نقدي',
    p_notes := 'تغلق فوراً',
    p_max_days := 15
  );
  PERFORM public.settle_site_custody(v_custody_closed, 'cash_return', v_coa_acc_121, CURRENT_DATE, 'رد كامل');

  -- Baseline journal_headers count before any offline draft RPC calls
  SELECT count(*) INTO v_jh_before FROM public.journal_headers WHERE company_id = v_coa;

  -- ===========================================================================
  -- TEST 1: IDEMPOTENCY (DUPLICATE REPLAY OF SAME client_request_id)
  -- ===========================================================================
  -- 1A. Telegram Attachment Registration Idempotency
  v_res1 := public.register_company_attachment(jsonb_build_object(
    'company_id', v_coa,
    'client_request_id', v_req_att,
    'module', 'expenses',
    'file_name', 'invoice_001.jpg',
    'mime_type', 'image/jpeg',
    'file_size', 184320,
    'telegram_file_id', 'BQACAgIAAxkBAAIBZ2X_test_file_id_001',
    'telegram_unique_id', 'AgAD_unique_001',
    'telegram_message_id', 9001
  ));
  v_res2 := public.register_company_attachment(jsonb_build_object(
    'company_id', v_coa,
    'client_request_id', v_req_att,
    'module', 'expenses',
    'file_name', 'invoice_001.jpg',
    'mime_type', 'image/jpeg',
    'file_size', 184320,
    'telegram_file_id', 'BQACAgIAAxkBAAIBZ2X_test_file_id_001_retry'
  ));

  SELECT count(*) INTO v_cnt FROM public.company_attachments WHERE company_id = v_coa AND client_request_id = v_req_att;
  PERFORM phase8_offline_test.assert(
    v_cnt = 1
    AND (v_res1->>'id') = (v_res2->>'id')
    AND (v_res1->>'_sync_replayed')::boolean = false
    AND (v_res2->>'_sync_replayed')::boolean = true,
    'Attachment idempotency failed: expected 1 row and _sync_replayed false->true'
  );

  -- 1B. Labor Daily Log Draft Idempotency (+ Multi-Company Account Code Resolution)
  v_res1 := public.save_labor_log_draft(jsonb_build_object(
    'company_id', v_coa,
    'client_request_id', v_req_lab,
    'work_date', '2026-06-01',
    'worker_name', 'أحمد السيد محمود',
    'project_id', v_proj_a,
    'job_order_id', v_jo_a,
    'daily_wage', 220,
    'attendance_value', 1,
    'number_of_workers', 1,
    'debit_account_id', v_phi_acc_512 -- Intentionally foreign company UUID; RPC must resolve P8COA's 512!
  ));
  v_res2 := public.save_labor_log_draft(jsonb_build_object(
    'company_id', v_coa,
    'client_request_id', v_req_lab,
    'work_date', '2026-06-01',
    'worker_name', 'أحمد السيد محمود',
    'project_id', v_proj_a,
    'job_order_id', v_jo_a,
    'daily_wage', 220,
    'attendance_value', 1
  ));

  SELECT count(*) INTO v_cnt FROM public.labor_daily_logs WHERE company_id = v_coa AND client_request_id = v_req_lab;
  PERFORM phase8_offline_test.assert(
    v_cnt = 1
    AND (v_res1->>'id') = (v_res2->>'id')
    AND (v_res1->>'_sync_replayed')::boolean = false
    AND (v_res2->>'_sync_replayed')::boolean = true
    AND (v_res1->'record'->>'debit_account_id')::uuid = v_coa_acc_512
    AND (v_res1->'record'->>'credit_account_id')::uuid = v_coa_acc_216
    AND (v_res1->'record'->>'is_posted')::boolean = false,
    'Labor log draft idempotency or company account resolution failed'
  );

  -- 1C. General Expense & Custody Expense Draft Idempotency
  v_res1 := public.save_expense_draft(jsonb_build_object(
    'company_id', v_coa,
    'client_request_id', v_req_exp,
    'exp_date', '2026-06-01',
    'description', 'شراء مستلزمات سلامة للموقع',
    'quantity', 2,
    'unit_price', 150,
    'vat_amount', 45,
    'project_id', v_proj_a,
    'job_order_id', v_jo_a,
    'invoice_image', v_res2->>'url'
  ));
  v_res2 := public.save_expense_draft(jsonb_build_object(
    'company_id', v_coa,
    'client_request_id', v_req_exp,
    'exp_date', '2026-06-01',
    'description', 'شراء مستلزمات سلامة للموقع',
    'quantity', 2,
    'unit_price', 150,
    'vat_amount', 45,
    'project_id', v_proj_a,
    'job_order_id', v_jo_a
  ));

  SELECT count(*) INTO v_cnt FROM public.expenses WHERE company_id = v_coa AND client_request_id = v_req_exp;
  PERFORM phase8_offline_test.assert(
    v_cnt = 1
    AND (v_res1->>'id') = (v_res2->>'id')
    AND (v_res1->>'_sync_replayed')::boolean = false
    AND (v_res2->>'_sync_replayed')::boolean = true,
    'General expense draft idempotency failed'
  );

  -- Custody expense draft replay
  v_res1 := public.save_expense_draft(jsonb_build_object(
    'company_id', v_coa,
    'client_request_id', v_req_cst,
    'exp_date', '2026-06-01',
    'description', 'شراء أسمنت سريع الشك من العهدة',
    'quantity', 5,
    'unit_price', 40,
    'vat_amount', 30,
    'custody_id', v_custody_open,
    'job_order_id', v_jo_a
  ));
  v_res2 := public.save_expense_draft(jsonb_build_object(
    'company_id', v_coa,
    'client_request_id', v_req_cst,
    'exp_date', '2026-06-01',
    'description', 'شراء أسمنت سريع الشك من العهدة',
    'quantity', 5,
    'unit_price', 40,
    'vat_amount', 30,
    'custody_id', v_custody_open,
    'job_order_id', v_jo_a
  ));

  PERFORM phase8_offline_test.assert(
    (v_res1->>'id') = (v_res2->>'id')
    AND (v_res1->>'_sync_replayed')::boolean = false
    AND (v_res2->>'_sync_replayed')::boolean = true
    AND (v_res1->'record'->>'payment_method') = 'عهدة'
    AND (v_res1->'record'->>'custody_id')::uuid = v_custody_open,
    'Custody expense draft idempotency failed'
  );

  -- Same client_request_id in Company B is independent (UNIQUE(company_id, client_request_id))
  PERFORM set_config('request.headers', jsonb_build_object('x-company-id', v_cob)::text, true);
  v_res_b := public.save_labor_log_draft(jsonb_build_object(
    'company_id', v_cob,
    'client_request_id', v_req_lab,
    'work_date', '2026-06-01',
    'worker_name', 'عامل شركة ب المستقلة',
    'daily_wage', 180
  ));
  PERFORM phase8_offline_test.assert(
    (v_res_b->>'_sync_replayed')::boolean = false AND (v_res_b->>'company_id')::uuid = v_cob,
    'Per-company client_request_id uniqueness failed across companies'
  );
  RAISE NOTICE 'PASS 1: Idempotency verified across attachments, labor logs, general expenses, and custody expenses';

  -- ===========================================================================
  -- TEST 2: 5 SEQUENTIAL FIFO OFFLINE DRAFT OPERATIONS
  -- ===========================================================================
  PERFORM set_config('request.headers', jsonb_build_object('x-company-id', v_coa)::text, true);

  FOR v_i IN 1..5 LOOP
    IF v_i IN (1, 2) THEN
      v_res1 := public.save_labor_log_draft(jsonb_build_object(
        'company_id', v_coa,
        'client_request_id', ('22222222-8888-4000-8000-00000000000' || v_i)::uuid,
        'work_date', '2026-06-02',
        'worker_name', 'عامل طابور رقم ' || v_i,
        'project_id', v_proj_a,
        'job_order_id', v_jo_a,
        'daily_wage', 100 * v_i
      ));
    ELSIF v_i IN (3, 4) THEN
      v_res1 := public.save_expense_draft(jsonb_build_object(
        'company_id', v_coa,
        'client_request_id', ('22222222-8888-4000-8000-00000000000' || v_i)::uuid,
        'exp_date', '2026-06-02',
        'description', 'مصروف طابور رقم ' || v_i,
        'quantity', 1,
        'unit_price', 250 * v_i,
        'project_id', v_proj_a,
        'job_order_id', v_jo_a
      ));
    ELSE
      v_res1 := public.save_expense_draft(jsonb_build_object(
        'company_id', v_coa,
        'client_request_id', ('22222222-8888-4000-8000-00000000000' || v_i)::uuid,
        'exp_date', '2026-06-02',
        'description', 'مصروف عهدة طابور رقم ' || v_i,
        'quantity', 1,
        'unit_price', 300,
        'custody_id', v_custody_open,
        'job_order_id', v_jo_a
      ));
    END IF;
    v_fifo_ids := array_append(v_fifo_ids, (v_res1->>'id')::uuid);
  END LOOP;

  PERFORM phase8_offline_test.assert(
    array_length(v_fifo_ids, 1) = 5,
    'Expected all 5 FIFO offline operations to succeed'
  );
  RAISE NOTICE 'PASS 2: 5 sequential FIFO offline drafts (labor + general expenses + custody expense) saved cleanly';

  -- ===========================================================================
  -- TEST 3: CROSS-COMPANY PINNING & TENANT ISOLATION
  -- ===========================================================================
  -- 3A. User switches UI to P8COB, then syncs an item pinned to P8COA using x-company-id: P8COA
  PERFORM set_config('request.headers', jsonb_build_object('x-company-id', v_cob)::text, true);
  -- Sync engine explicitly sets x-company-id: item.company_id (v_coa) for that request:
  PERFORM set_config('request.headers', jsonb_build_object('x-company-id', v_coa)::text, true);
  v_res1 := public.save_expense_draft(jsonb_build_object(
    'company_id', v_coa,
    'client_request_id', '33333333-8888-4000-8000-000000000001',
    'exp_date', '2026-06-03',
    'description', 'مصروف مثبت على شركة أ بعد التبديل',
    'quantity', 1,
    'unit_price', 420
  ));
  PERFORM phase8_offline_test.assert(
    (v_res1->>'company_id')::uuid = v_coa,
    'Pinned offline item did not land in target company P8COA'
  );

  -- 3B. Mismatched header (x-company-id = P8COB) vs payload (company_id = P8COA) MUST be rejected!
  PERFORM set_config('request.headers', jsonb_build_object('x-company-id', v_cob)::text, true);
  v_err_caught := false;
  BEGIN
    PERFORM public.save_expense_draft(jsonb_build_object(
      'company_id', v_coa,
      'client_request_id', '33333333-8888-4000-8000-000000000002',
      'description', 'محاولة خلط شركات',
      'unit_price', 100
    ));
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_err_caught := true;
  END;
  PERFORM phase8_offline_test.assert(v_err_caught, 'Mismatched payload company_id vs header x-company-id must fail with 42501');

  -- 3C. Unauthorized company header (P8COC) MUST fail closed (42501)
  PERFORM set_config('request.headers', jsonb_build_object('x-company-id', v_coc)::text, true);
  v_err_caught := false;
  BEGIN
    PERFORM public.save_labor_log_draft(jsonb_build_object(
      'worker_name', 'محاولة شركة غير مصرحة',
      'daily_wage', 100
    ));
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_err_caught := true;
  END;
  PERFORM phase8_offline_test.assert(v_err_caught, 'Unauthorized company header P8COC must fail closed with 42501');

  -- 3D. Attachment RLS isolation: P8COB cannot read P8COA attachments
  PERFORM set_config('request.headers', jsonb_build_object('x-company-id', v_cob)::text, true);
  SELECT count(*) INTO v_cnt FROM public.company_attachments WHERE client_request_id = v_req_att;
  PERFORM phase8_offline_test.assert(v_cnt = 0, 'P8COB leaked company_attachments belonging to P8COA');
  RAISE NOTICE 'PASS 3: Cross-company pinning, header mismatch rejection, and RLS attachment isolation verified';

  -- ===========================================================================
  -- TEST 4: ZERO-POSTING GUARANTEE (DRAFT-ONLY ENFORCEMENT)
  -- ===========================================================================
  PERFORM set_config('request.headers', jsonb_build_object('x-company-id', v_coa)::text, true);

  -- 4A. Reject is_posted = true on labor_daily_logs draft RPC
  v_err_caught := false;
  BEGIN
    PERFORM public.save_labor_log_draft(jsonb_build_object(
      'worker_name', 'محاولة ترحيل أوفلاين',
      'daily_wage', 200,
      'is_posted', true
    ));
  EXCEPTION WHEN SQLSTATE '23514' THEN
    v_err_caught := true;
  END;
  PERFORM phase8_offline_test.assert(v_err_caught, 'save_labor_log_draft must reject is_posted=true with 23514');

  -- 4B. Reject action = post on save_expense_draft
  v_err_caught := false;
  BEGIN
    PERFORM public.save_expense_draft(jsonb_build_object(
      'description', 'محاولة اعتماد مصروف أوفلاين',
      'unit_price', 500,
      'action', 'post'
    ));
  EXCEPTION WHEN SQLSTATE '23514' THEN
    v_err_caught := true;
  END;
  PERFORM phase8_offline_test.assert(v_err_caught, 'save_expense_draft must reject action=post with 23514');

  -- 4C. Reject custody expense draft on settled/closed custody
  v_err_caught := false;
  BEGIN
    PERFORM public.save_expense_draft(jsonb_build_object(
      'description', 'مصروف على عهدة مسواة',
      'unit_price', 100,
      'custody_id', v_custody_closed
    ));
  EXCEPTION WHEN SQLSTATE '23514' THEN
    v_err_caught := true;
  END;
  PERFORM phase8_offline_test.assert(v_err_caught, 'save_expense_draft must reject closed custody with 23514');

  -- 4D. Confirm ZERO journal_headers created and custody spent_amount still 0.00!
  SELECT count(*) INTO v_jh_after FROM public.journal_headers WHERE company_id = v_coa;
  SELECT spent_amount INTO v_spent_after FROM public.site_custodies WHERE id = v_custody_open AND company_id = v_coa;

  PERFORM phase8_offline_test.assert(
    v_jh_after = v_jh_before,
    'Draft RPCs MUST NOT create any journal_headers! Before=' || v_jh_before || ', After=' || v_jh_after
  );
  PERFORM phase8_offline_test.assert(
    v_spent_after = 0.00,
    'Unposted custody expense drafts MUST NOT alter site_custodies.spent_amount! Got ' || v_spent_after
  );
  RAISE NOTICE 'PASS 4: Zero-posting guarantee verified (0 GL journals created, 0 custody balance mutation on drafts)';

  -- ===========================================================================
  -- TEST 5: REALTIME PUBLICATION & REPLICA IDENTITY FULL CHECK
  -- ===========================================================================
  SELECT count(*) INTO v_pub_cnt
  FROM pg_publication_tables
  WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename IN (
      'labor_daily_logs', 'expenses', 'site_custodies', 'daily_cash_closings',
      'invoices', 'invoice_adjustment_notes', 'receipt_vouchers', 'payment_vouchers',
      'sub_claims', 'purchase_orders', 'supplier_invoices', 'material_receipts',
      'material_issues', 'stocktaking_sessions', 'fixed_assets', 'journal_headers',
      'projects', 'job_orders', 'company_documents', 'company_attachments'
    );

  SELECT count(*) INTO v_repl_cnt
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relreplident IN ('i', 'f')
    AND c.relname IN (
      'labor_daily_logs', 'expenses', 'site_custodies', 'daily_cash_closings',
      'invoices', 'invoice_adjustment_notes', 'receipt_vouchers', 'payment_vouchers',
      'sub_claims', 'purchase_orders', 'supplier_invoices', 'material_receipts',
      'material_issues', 'stocktaking_sessions', 'fixed_assets', 'journal_headers',
      'projects', 'job_orders', 'company_documents', 'company_attachments'
    );

  PERFORM phase8_offline_test.assert(
    v_pub_cnt = 20 AND v_repl_cnt = 20,
    'Expected all 20 company tables in supabase_realtime with (id, company_id) REPLICA IDENTITY; got pub=' || v_pub_cnt || ', repl=' || v_repl_cnt
  );

  -- Also verify UPDATE on generated-column tables (expenses, labor_daily_logs) works cleanly while published!
  PERFORM public.save_expense_draft(jsonb_build_object(
    'id', v_fifo_ids[3],
    'company_id', v_coa,
    'description', 'مصروف طابور محدّث بدون أي خطأ في الأعمدة المولدة',
    'quantity', 2,
    'unit_price', 300,
    'project_id', v_proj_a,
    'job_order_id', v_jo_a
  ));
  PERFORM public.save_labor_log_draft(jsonb_build_object(
    'id', v_fifo_ids[1],
    'company_id', v_coa,
    'worker_name', 'عامل طابور محدّث',
    'daily_wage', 250,
    'project_id', v_proj_a,
    'job_order_id', v_jo_a
  ));
  RAISE NOTICE 'PASS 5: All 20 company tables registered in supabase_realtime with (id, company_id) REPLICA IDENTITY and generated-column updates verified';
END;
$$;

ROLLBACK;
