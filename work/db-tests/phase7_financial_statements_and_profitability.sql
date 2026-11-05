-- Test Suite: phase7_financial_statements_and_profitability.sql
-- Description: Testing Phase 7 (Dynamic Financial Statements, Project Profitability Reconciliation & Financial KPIs)

BEGIN;

CREATE SCHEMA IF NOT EXISTS phase7_compliance_test;
GRANT USAGE ON SCHEMA phase7_compliance_test TO authenticated;

CREATE OR REPLACE FUNCTION phase7_compliance_test.assert(cond boolean, msg text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT cond THEN
    RAISE EXCEPTION 'PHASE 7 ASSERTION FAILED: %', msg;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION phase7_compliance_test.assert(boolean, text) TO authenticated;

-- Setup P7CO and RYC companies and admin membership as superuser
DO $$
DECLARE
  v_p7co uuid;
  v_ry uuid;
  v_admin_uid uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
BEGIN
  SELECT id INTO v_p7co FROM public.companies WHERE code = 'P7CO';
  IF v_p7co IS NULL THEN
    INSERT INTO public.companies (code, name, currency, country, is_active)
    VALUES ('P7CO', 'شركة الرواد للمقاولات المتطورة', 'SAR', 'SA', true)
    RETURNING id INTO v_p7co;
  END IF;

  SELECT id INTO v_ry FROM public.companies WHERE code = 'RYC';
  IF v_ry IS NULL THEN
    INSERT INTO public.companies (code, name, currency, country, is_active)
    VALUES ('RYC', 'شركة الرياض للإنشاءات', 'SAR', 'SA', true)
    RETURNING id INTO v_ry;
  END IF;

  INSERT INTO public.user_companies (user_id, company_id, role, is_active)
  VALUES (v_admin_uid, v_p7co, 'admin', true)
  ON CONFLICT (user_id, company_id) DO UPDATE SET is_active = true, role = 'admin';

  INSERT INTO public.user_companies (user_id, company_id, role, is_active)
  VALUES (v_admin_uid, v_ry, 'admin', true)
  ON CONFLICT (user_id, company_id) DO UPDATE SET is_active = true, role = 'admin';
END;
$$;

-- Authenticate as admin user
SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

-- Set session context to P7CO
SELECT set_config('request.headers', jsonb_build_object('x-company-id', (SELECT id FROM public.companies WHERE code = 'P7CO'))::text, true);

DO $$
DECLARE
  v_p7co uuid;
  v_ry uuid;

  -- Master Data IDs
  v_proj1 uuid;
  v_proj2 uuid;
  v_proj3 uuid;

  v_client_id uuid;
  v_supplier_id uuid;
  v_contractor_id uuid;

  -- Account IDs
  v_acc_111 uuid; -- المباني
  v_acc_119 uuid; -- مجمع الإهلاك
  v_acc_122 uuid; -- البنك
  v_acc_124 uuid; -- العملاء
  v_acc_211 uuid; -- الموردون
  v_acc_212 uuid; -- مقاولو الباطن
  v_acc_231 uuid; -- رأس المال
  v_acc_41  uuid; -- إيرادات
  v_acc_511 uuid; -- خامات
  v_acc_512 uuid; -- عمالة
  v_acc_513 uuid; -- مقاولو باطن
  v_acc_514 uuid; -- معدات
  v_acc_515 uuid; -- مصاريف موقع
  v_acc_516 uuid; -- إهلاك عمليات
  v_acc_521 uuid; -- مصاريف عمومية

  -- Journal Header IDs
  v_jh_opening uuid;
  v_jh_rev1 uuid;
  v_jh_rev2 uuid;
  v_jh_rev_unalloc uuid;
  v_jh_costs uuid;
  v_jh_admin uuid;

  -- RPC Result Holders
  v_is_res jsonb;
  v_bs_res jsonb;
  v_prof_res jsonb;
  v_kpis_res jsonb;

  -- Cross Company Result Holders
  v_ry_is jsonb;
  v_ry_bs jsonb;
  v_ry_prof jsonb;
  v_ry_kpis jsonb;

  v_gl_net numeric;
BEGIN
  SELECT id INTO v_p7co FROM public.companies WHERE code = 'P7CO';
  SELECT id INTO v_ry FROM public.companies WHERE code = 'RYC';

  -- 1. Ensure required accounts exist in P7CO
  INSERT INTO public.accounts (company_id, code, name, account_type, is_transactional)
  SELECT v_p7co, x.code, x.name, x.atype, true
  FROM (VALUES
    ('111', 'المباني والإنشاءات', 'أصول'),
    ('119', 'مجمع إهلاك الأصول', 'أصول'),
    ('122', 'البنك الرئيسي', 'أصول'),
    ('124', 'العملاء والذمم المدينة', 'أصول'),
    ('211', 'الموردون والتجارة', 'خصوم'),
    ('212', 'أرصدة مقاولي الباطن', 'خصوم'),
    ('231', 'رأس المال المدفوع', 'حقوق ملكية'),
    ('41',  'إيرادات عقود المقاولات', 'إيرادات'),
    ('511', 'تكاليف المواد والخامات المباشرة', 'مصروفات'),
    ('512', 'أجور ورواتب العمالة المباشرة', 'مصروفات'),
    ('513', 'تكاليف مقاولي الباطن المباشرة', 'مصروفات'),
    ('514', 'إيجار وتشغيل المعدات المباشرة', 'مصروفات'),
    ('515', 'مصروفات تشغيل الموقع الميداني', 'مصروفات'),
    ('516', 'إهلاك آلات ومعدات التشغيل', 'مصروفات'),
    ('521', 'مصروفات عمومية وإدارية', 'مصروفات')
  ) AS x(code, name, atype);

  SELECT id INTO v_acc_111 FROM public.accounts WHERE company_id = v_p7co AND code = '111';
  SELECT id INTO v_acc_119 FROM public.accounts WHERE company_id = v_p7co AND code = '119';
  SELECT id INTO v_acc_122 FROM public.accounts WHERE company_id = v_p7co AND code = '122';
  SELECT id INTO v_acc_124 FROM public.accounts WHERE company_id = v_p7co AND code = '124';
  SELECT id INTO v_acc_211 FROM public.accounts WHERE company_id = v_p7co AND code = '211';
  SELECT id INTO v_acc_212 FROM public.accounts WHERE company_id = v_p7co AND code = '212';
  SELECT id INTO v_acc_231 FROM public.accounts WHERE company_id = v_p7co AND code = '231';
  SELECT id INTO v_acc_41  FROM public.accounts WHERE company_id = v_p7co AND code = '41';
  SELECT id INTO v_acc_511 FROM public.accounts WHERE company_id = v_p7co AND code = '511';
  SELECT id INTO v_acc_512 FROM public.accounts WHERE company_id = v_p7co AND code = '512';
  SELECT id INTO v_acc_513 FROM public.accounts WHERE company_id = v_p7co AND code = '513';
  SELECT id INTO v_acc_514 FROM public.accounts WHERE company_id = v_p7co AND code = '514';
  SELECT id INTO v_acc_515 FROM public.accounts WHERE company_id = v_p7co AND code = '515';
  SELECT id INTO v_acc_516 FROM public.accounts WHERE company_id = v_p7co AND code = '516';
  SELECT id INTO v_acc_521 FROM public.accounts WHERE company_id = v_p7co AND code = '521';

  -- 2. Create Master Data: Partners & Projects
  INSERT INTO public.partners (company_id, code, name, partner_type)
  VALUES (v_p7co, 'CL-P7-01', 'شركة التطوير العقاري الكبرى', 'عميل')
  RETURNING id INTO v_client_id;

  INSERT INTO public.partners (company_id, code, name, partner_type)
  VALUES (v_p7co, 'SUP-P7-01', 'شركة توريد الأسمنت والحديد', 'مورد')
  RETURNING id INTO v_supplier_id;

  INSERT INTO public.partners (company_id, code, name, partner_type)
  VALUES (v_p7co, 'SUB-P7-01', 'مؤسسة إنجاز لأعمال الباطن', 'مقاول')
  RETURNING id INTO v_contractor_id;

  INSERT INTO public.projects (company_id, project_name, project_code, "Property", client_name, contract_value, estimated_budget, status)
  VALUES (v_p7co, 'مشروع برج العاصمة', 'PRJ-CAP-01', 'برج العاصمة', 'شركة التطوير العقاري الكبرى', 1000000, 700000, 'قيد التنفيذ')
  RETURNING id INTO v_proj1;

  INSERT INTO public.projects (company_id, project_name, project_code, "Property", client_name, contract_value, estimated_budget, status)
  VALUES (v_p7co, 'مشروع مجمع الفلل السكني', 'PRJ-VIL-02', 'مجمع الفلل', 'شركة التطوير العقاري الكبرى', 600000, 400000, 'قيد التنفيذ')
  RETURNING id INTO v_proj2;

  INSERT INTO public.projects (company_id, project_name, project_code, "Property", client_name, contract_value, estimated_budget, status)
  VALUES (v_p7co, 'مشروع صيانة المرافق', 'PRJ-MNT-03', 'صيانة المرافق', 'شركة التطوير العقاري الكبرى', 100000, 80000, 'قيد التنفيذ')
  RETURNING id INTO v_proj3;

  -- 3. Create BOQ Budget Entries
  INSERT INTO public.boq_budget (
    company_id, project_id, work_item, contract_quantity, unit_contract_price,
    estimated_material_cost, estimated_labor_cost, estimated_expenses_cost
  ) VALUES
  (v_p7co, v_proj1, 'أعمال الهيكل الخرساني والإنشاء', 100, 10000, 400000, 200000, 100000),
  (v_p7co, v_proj2, 'أعمال التشطيبات المعمارية', 60, 10000, 250000, 100000, 50000);

  -- 4. Create Opening Balance Journal Entry (as of 2025-12-31)
  -- Assets: Fixed 111 (300k) - Accum Deprec 119 (50k) + Bank 122 (500k) = 750k
  -- Equity: Capital 231 (750k)
  INSERT INTO public.journal_headers (company_id, entry_date, description, status)
  VALUES (v_p7co, '2025-12-31', 'قيد افتتاحي للسنة السابقة', 'posted')
  RETURNING id INTO v_jh_opening;

  INSERT INTO public.journal_lines (company_id, header_id, account_id, debit, credit, notes)
  VALUES
    (v_p7co, v_jh_opening, v_acc_111, 300000, 0, 'تكلفة المباني والأصول'),
    (v_p7co, v_jh_opening, v_acc_119, 0, 50000, 'مجمع إهلاك الأصول'),
    (v_p7co, v_jh_opening, v_acc_122, 500000, 0, 'رصيد البنك الافتتاحي'),
    (v_p7co, v_jh_opening, v_acc_231, 0, 750000, 'رأس مال المساهمين');

  -- 5. Current Period Journal Entries (Between 2026-05-01 and 2026-05-31)
  -- Entry A: Project 1 Revenue (Credit 41: 500k, Debit 124 AR: 500k)
  INSERT INTO public.journal_headers (company_id, entry_date, description, status)
  VALUES (v_p7co, '2026-05-10', 'إيراد مستخلص مشروع برج العاصمة', 'posted')
  RETURNING id INTO v_jh_rev1;

  INSERT INTO public.journal_lines (company_id, header_id, account_id, project_id, debit, credit, notes)
  VALUES
    (v_p7co, v_jh_rev1, v_acc_124, v_proj1, 500000, 0, 'ذمة العميل - برج العاصمة'),
    (v_p7co, v_jh_rev1, v_acc_41,  v_proj1, 0, 500000, 'إيراد المقاولات - برج العاصمة');

  -- Entry B: Project 2 Revenue (Credit 41: 300k, Debit 124 AR: 300k)
  INSERT INTO public.journal_headers (company_id, entry_date, description, status)
  VALUES (v_p7co, '2026-05-12', 'إيراد مستخلص مشروع مجمع الفلل', 'posted')
  RETURNING id INTO v_jh_rev2;

  INSERT INTO public.journal_lines (company_id, header_id, account_id, project_id, debit, credit, notes)
  VALUES
    (v_p7co, v_jh_rev2, v_acc_124, v_proj2, 300000, 0, 'ذمة العميل - مجمع الفلل'),
    (v_p7co, v_jh_rev2, v_acc_41,  v_proj2, 0, 300000, 'إيراد المقاولات - مجمع الفلل');

  -- Entry C: Unallocated Revenue (Credit 41: 50k, Debit 122 Bank: 50k)
  INSERT INTO public.journal_headers (company_id, entry_date, description, status)
  VALUES (v_p7co, '2026-05-14', 'إيرادات استشارات هندسية عامة غير مخصصة لمشروع', 'posted')
  RETURNING id INTO v_jh_rev_unalloc;

  INSERT INTO public.journal_lines (company_id, header_id, account_id, debit, credit, notes)
  VALUES
    (v_p7co, v_jh_rev_unalloc, v_acc_122, 50000, 0, 'تحصيل بنكي مباشر'),
    (v_p7co, v_jh_rev_unalloc, v_acc_41,  0, 50000, 'إيرادات عامة');

  -- Entry D: Direct Project Costs
  -- Project 1 Costs: 511 (150k), 512 (100k), 513 (80k), 514 (20k), 515 (10k) = 360k
  -- Project 2 Costs: 511 (90k), 512 (60k), 513 (50k) = 200k
  -- Project 3 Costs: 512 (120k) = 120k
  -- Unallocated Direct Costs: 511 (15k), 516 (15k) = 30k
  -- Total Costs = 360k + 200k + 120k + 30k = 710k
  -- Offsetting Credits: 122 Bank (400k), 211 Suppliers (255k), 119 Deprec (15k), 212 Subcontractors (40k) = 710k
  INSERT INTO public.journal_headers (company_id, entry_date, description, status)
  VALUES (v_p7co, '2026-05-18', 'قيد تكاليف المشاريع المباشرة عن شهر مايو', 'posted')
  RETURNING id INTO v_jh_costs;

  INSERT INTO public.journal_lines (company_id, header_id, account_id, project_id, debit, credit, notes)
  VALUES
    -- Project 1
    (v_p7co, v_jh_costs, v_acc_511, v_proj1, 150000, 0, 'خامات برج العاصمة'),
    (v_p7co, v_jh_costs, v_acc_512, v_proj1, 100000, 0, 'أجور عمالة برج العاصمة'),
    (v_p7co, v_jh_costs, v_acc_513, v_proj1,  80000, 0, 'مقاولو باطن برج العاصمة'),
    (v_p7co, v_jh_costs, v_acc_514, v_proj1,  20000, 0, 'معدات برج العاصمة'),
    (v_p7co, v_jh_costs, v_acc_515, v_proj1,  10000, 0, 'مصاريف موقع برج العاصمة'),
    -- Project 2
    (v_p7co, v_jh_costs, v_acc_511, v_proj2,  90000, 0, 'خامات مجمع الفلل'),
    (v_p7co, v_jh_costs, v_acc_512, v_proj2,  60000, 0, 'أجور عمالة مجمع الفلل'),
    (v_p7co, v_jh_costs, v_acc_513, v_proj2,  50000, 0, 'مقاولو باطن مجمع الفلل'),
    -- Project 3
    (v_p7co, v_jh_costs, v_acc_512, v_proj3, 120000, 0, 'أجور عمالة صيانة المرافق'),
    -- Unallocated
    (v_p7co, v_jh_costs, v_acc_511, NULL,     15000, 0, 'مواد مستودع مركزية عامة'),
    (v_p7co, v_jh_costs, v_acc_516, NULL,     15000, 0, 'إهلاك معدات تشغيلية مركزية'),
    -- Offsetting Credits
    (v_p7co, v_jh_costs, v_acc_122, NULL,          0, 400000, 'صرف نقدي من البنك'),
    (v_p7co, v_jh_costs, v_acc_211, NULL,          0, 255000, 'مستحقات موردين'),
    (v_p7co, v_jh_costs, v_acc_119, NULL,          0,  15000, 'إهلاك متراكم'),
    (v_p7co, v_jh_costs, v_acc_212, NULL,          0,  40000, 'مستحقات مقاولي باطن');

  -- Entry E: General & Administrative Expenses (Debit 521: 40k, Credit 122 Bank: 40k)
  INSERT INTO public.journal_headers (company_id, entry_date, description, status)
  VALUES (v_p7co, '2026-05-25', 'رواتب ومصاريف إدارية عمومية', 'posted')
  RETURNING id INTO v_jh_admin;

  INSERT INTO public.journal_lines (company_id, header_id, account_id, debit, credit, notes)
  VALUES
    (v_p7co, v_jh_admin, v_acc_521, 40000, 0, 'رواتب الإدارة العامة'),
    (v_p7co, v_jh_admin, v_acc_122, 0, 40000, 'سداد بنكي');

  -- Entry F: Invoices & Collections for KPI verification
  INSERT INTO public.invoices (company_id, invoice_number, date, total_amount, status)
  VALUES (v_p7co, 'INV-P7-001', '2026-05-15', 800000, 'posted');

  INSERT INTO public.receipt_vouchers (company_id, receipt_number, date, amount, payment_method, status)
  VALUES (v_p7co, 'RV-P7-001', '2026-05-20', 400000, 'تحويل بنكي', 'posted');

  -- ===========================================================================
  -- VERIFICATION 1: Income Statement (قائمة الدخل الدقيقة)
  -- ===========================================================================
  v_is_res := public.get_income_statement_by_period('2026-05-01'::date, '2026-05-31'::date, false);

  PERFORM phase7_compliance_test.assert(
    (v_is_res->'summary'->>'total_revenue')::numeric = 850000.00,
    'Income statement total_revenue should be 850,000, got ' || (v_is_res->'summary'->>'total_revenue')
  );

  PERFORM phase7_compliance_test.assert(
    (v_is_res->'summary'->>'total_project_costs')::numeric = 710000.00,
    'Income statement total_project_costs should be 710,000, got ' || (v_is_res->'summary'->>'total_project_costs')
  );

  PERFORM phase7_compliance_test.assert(
    (v_is_res->'summary'->>'gross_profit')::numeric = 140000.00,
    'Income statement gross_profit should be 140,000, got ' || (v_is_res->'summary'->>'gross_profit')
  );

  PERFORM phase7_compliance_test.assert(
    (v_is_res->'summary'->>'total_admin_expenses')::numeric = 40000.00,
    'Income statement total_admin_expenses should be 40,000, got ' || (v_is_res->'summary'->>'total_admin_expenses')
  );

  PERFORM phase7_compliance_test.assert(
    (v_is_res->'summary'->>'net_income')::numeric = 100000.00,
    'Income statement net_income should be 100,000, got ' || (v_is_res->'summary'->>'net_income')
  );

  -- Check exact match with Trial Balance Net Formula
  SELECT
    ROUND(
      COALESCE(sum(CASE WHEN a.code LIKE '4%' THEN (jl.credit - jl.debit) ELSE 0 END), 0) -
      COALESCE(sum(CASE WHEN a.code LIKE '5%' THEN (jl.debit - jl.credit) ELSE 0 END), 0)
    , 2)
  INTO v_gl_net
  FROM public.accounts a
  JOIN public.journal_lines jl ON jl.account_id = a.id AND jl.company_id = v_p7co
  JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_p7co
  WHERE a.company_id = v_p7co
    AND (a.code LIKE '4%' OR a.code LIKE '5%')
    AND jh.status IN ('posted', 'مرحل', 'معتمد')
    AND jh.entry_date BETWEEN '2026-05-01'::date AND '2026-05-31'::date;

  PERFORM phase7_compliance_test.assert(
    v_gl_net = (v_is_res->'summary'->>'net_income')::numeric,
    'Trial balance net profit invariant violated: Trial Balance = ' || v_gl_net || ', Income Statement = ' || (v_is_res->'summary'->>'net_income')
  );

  -- ===========================================================================
  -- VERIFICATION 2: Balance Sheet (المركز المالي وتوازن المعادلة المحاسبية)
  -- ===========================================================================
  v_bs_res := public.get_balance_sheet_as_of('2026-05-31'::date, false);

  PERFORM phase7_compliance_test.assert(
    (v_bs_res->>'is_balanced')::boolean = true,
    'Balance sheet MUST be balanced, but is_balanced was false. Diff: ' || (v_bs_res->>'difference')
  );

  PERFORM phase7_compliance_test.assert(
    (v_bs_res->>'difference')::numeric = 0.00,
    'Balance sheet difference MUST be exactly 0.00, got ' || (v_bs_res->>'difference')
  );

  PERFORM phase7_compliance_test.assert(
    (v_bs_res->'summary'->>'total_assets')::numeric = (v_bs_res->'summary'->>'total_liabilities_and_equity')::numeric,
    'Total Assets must equal Total Liabilities and Equity'
  );

  PERFORM phase7_compliance_test.assert(
    (v_bs_res->'summary'->>'total_assets')::numeric = 1145000.00,
    'Total Assets expected 1,145,000, got ' || (v_bs_res->'summary'->>'total_assets')
  );

  PERFORM phase7_compliance_test.assert(
    (v_bs_res->'summary'->>'current_period_net_income')::numeric = 100000.00,
    'Current period net income in balance sheet expected 100,000, got ' || (v_bs_res->'summary'->>'current_period_net_income')
  );

  -- ===========================================================================
  -- VERIFICATION 3: Project Profitability & GL Reconciliation
  -- ===========================================================================
  v_prof_res := public.get_projects_profitability_summary('2026-05-01'::date, '2026-05-31'::date, NULL);

  PERFORM phase7_compliance_test.assert(
    (v_prof_res->'reconciliation'->>'is_reconciled')::boolean = true,
    'Project profitability MUST reconcile 100% with General Ledger'
  );

  PERFORM phase7_compliance_test.assert(
    (v_prof_res->'reconciliation'->>'variance')::numeric = 0.00,
    'Reconciliation variance MUST be 0.00, got ' || (v_prof_res->'reconciliation'->>'variance')
  );

  PERFORM phase7_compliance_test.assert(
    (v_prof_res->'summary'->>'total_combined_revenue')::numeric = 850000.00,
    'Combined projects + unallocated revenue should be 850,000, got ' || (v_prof_res->'summary'->>'total_combined_revenue')
  );

  PERFORM phase7_compliance_test.assert(
    (v_prof_res->'summary'->>'total_combined_costs')::numeric = 710000.00,
    'Combined projects + unallocated costs should be 710,000, got ' || (v_prof_res->'summary'->>'total_combined_costs')
  );

  PERFORM phase7_compliance_test.assert(
    (v_prof_res->'unallocated'->>'revenue')::numeric = 50000.00,
    'Unallocated revenue expected 50,000, got ' || (v_prof_res->'unallocated'->>'revenue')
  );

  PERFORM phase7_compliance_test.assert(
    (v_prof_res->'unallocated'->>'costs')::numeric = 30000.00,
    'Unallocated costs expected 30,000, got ' || (v_prof_res->'unallocated'->>'costs')
  );

  -- Check Project 1 Breakdown
  PERFORM phase7_compliance_test.assert(
    EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_prof_res->'projects') p
      WHERE (p->>'project_id')::uuid = v_proj1
        AND (p->>'revenue')::numeric = 500000.00
        AND (p->'costs'->>'materials')::numeric = 150000.00
        AND (p->'costs'->>'labor')::numeric = 100000.00
        AND (p->'costs'->>'subcontractors')::numeric = 80000.00
        AND (p->'costs'->>'equipment')::numeric = 20000.00
        AND (p->'costs'->>'site_expenses')::numeric = 10000.00
        AND (p->'costs'->>'total')::numeric = 360000.00
        AND (p->>'net_profit')::numeric = 140000.00
        AND (p->'boq_comparison'->>'contract_value')::numeric = 1000000.00
        AND (p->'boq_comparison'->>'estimated_cost')::numeric = 700000.00
        AND (p->'boq_comparison'->>'cost_burn_pct')::numeric = 51.43
    ),
    'Project 1 (Capital Tower) metrics or BOQ comparison failed verification'
  );

  -- ===========================================================================
  -- VERIFICATION 4: Financial KPIs (مؤشرات الأداء المالي والسيولة)
  -- ===========================================================================
  v_kpis_res := public.get_financial_kpis('2026-05-01'::date, '2026-05-31'::date);

  PERFORM phase7_compliance_test.assert(
    (v_kpis_res->'collection_metrics'->>'total_invoiced')::numeric = 800000.00,
    'KPI total_invoiced expected 800,000, got ' || (v_kpis_res->'collection_metrics'->>'total_invoiced')
  );

  PERFORM phase7_compliance_test.assert(
    (v_kpis_res->'collection_metrics'->>'total_collected')::numeric = 400000.00,
    'KPI total_collected expected 400,000, got ' || (v_kpis_res->'collection_metrics'->>'total_collected')
  );

  PERFORM phase7_compliance_test.assert(
    (v_kpis_res->'collection_metrics'->>'collection_rate_pct')::numeric = 50.00,
    'KPI collection_rate_pct expected 50%, got ' || (v_kpis_res->'collection_metrics'->>'collection_rate_pct')
  );

  PERFORM phase7_compliance_test.assert(
    (v_kpis_res->'liquidity_metrics'->>'current_ratio')::numeric > 0,
    'Current ratio should be positive'
  );

  -- Project Rankings: Top Profitable should include Project 1 (140k profit)
  PERFORM phase7_compliance_test.assert(
    (v_kpis_res->'project_rankings'->'top_profitable'->0->>'project_id')::uuid = v_proj1,
    'Top profitable project MUST be Project 1'
  );

  -- Least Profitable should be Project 3 (-120k profit)
  PERFORM phase7_compliance_test.assert(
    (v_kpis_res->'project_rankings'->'least_profitable'->0->>'project_id')::uuid = v_proj3,
    'Least profitable project MUST be Project 3'
  );

  -- ===========================================================================
  -- VERIFICATION 5: Multi-Company Tenant Isolation
  -- ===========================================================================
  -- Switch context to Company RYC
  PERFORM set_config('request.headers', jsonb_build_object('x-company-id', v_ry)::text, true);

  v_ry_is := public.get_income_statement_by_period('2026-05-01'::date, '2026-05-31'::date, false);
  v_ry_bs := public.get_balance_sheet_as_of('2026-05-31'::date, false);
  v_ry_prof := public.get_projects_profitability_summary('2026-05-01'::date, '2026-05-31'::date, NULL);
  v_ry_kpis := public.get_financial_kpis('2026-05-01'::date, '2026-05-31'::date);

  PERFORM phase7_compliance_test.assert(
    (v_ry_is->'summary'->>'total_revenue')::numeric = 0.00 AND (v_ry_is->'summary'->>'net_income')::numeric = 0.00,
    'Company RYC leaked Income Statement data from Company P7CO!'
  );

  PERFORM phase7_compliance_test.assert(
    (v_ry_bs->'summary'->>'total_assets')::numeric = 0.00,
    'Company RYC leaked Balance Sheet assets from Company P7CO!'
  );

  PERFORM phase7_compliance_test.assert(
    (v_ry_prof->>'projects_count')::integer = 0,
    'Company RYC leaked Projects Profitability from Company P7CO!'
  );

  PERFORM phase7_compliance_test.assert(
    (v_ry_kpis->'collection_metrics'->>'total_invoiced')::numeric = 0.00,
    'Company RYC leaked Financial KPIs from Company P7CO!'
  );

END;
$$;

ROLLBACK;
