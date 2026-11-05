-- Migration: 20261105170006_ar_aging_reports.sql
-- Description: Phase 2 aging reports for customers, subcontractors, and suppliers with point-in-time cutoffs and GL reconciliation.

BEGIN;

CREATE FUNCTION rawasi_private.require_aging_report_access(p_party_type text)
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
    v_company uuid := rawasi_private.current_company_id();
BEGIN
    IF auth.uid() IS NULL OR v_company IS NULL THEN
        RAISE EXCEPTION 'يتطلب الوصول تحديد الشركة والمستخدم المسجل' USING ERRCODE = '42501';
    END IF;

    IF NOT (
        rawasi_private.can_access('reports', 'view')
        OR rawasi_private.can_access('partners', 'view')
        OR rawasi_private.can_access('invoices', 'view')
        OR rawasi_private.can_access('subclaims', 'view')
        OR rawasi_private.can_access('materials', 'view')
        OR rawasi_private.can_access('journal', 'view')
    ) THEN
        RAISE EXCEPTION 'لا تملك صلاحية عرض تقارير أعمار الذمم' USING ERRCODE = '42501';
    END IF;

    IF p_party_type = 'customers' AND NOT (
        rawasi_private.can_access('invoices', 'view')
        OR rawasi_private.can_access('reports', 'view')
        OR rawasi_private.can_access('partners', 'view')
    ) THEN
        RAISE EXCEPTION 'لا تملك صلاحية عرض أعمار ذمم العملاء' USING ERRCODE = '42501';
    END IF;

    IF p_party_type = 'subcontractors' AND NOT (
        rawasi_private.can_access('subclaims', 'view')
        OR rawasi_private.can_access('reports', 'view')
        OR rawasi_private.can_access('partners', 'view')
    ) THEN
        RAISE EXCEPTION 'لا تملك صلاحية عرض أعمار ذمم مقاولي الباطن' USING ERRCODE = '42501';
    END IF;

    IF p_party_type = 'suppliers' AND NOT (
        rawasi_private.can_access('materials', 'view')
        OR rawasi_private.can_access('expenses', 'view')
        OR rawasi_private.can_access('reports', 'view')
        OR rawasi_private.can_access('partners', 'view')
    ) THEN
        RAISE EXCEPTION 'لا تملك صلاحية عرض أعمار ذمم الموردين' USING ERRCODE = '42501';
    END IF;

    RETURN v_company;
END;
$$;

REVOKE ALL ON FUNCTION rawasi_private.require_aging_report_access(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION rawasi_private.require_aging_report_access(text) TO authenticated;

-- Main comprehensive aging report function
CREATE FUNCTION public.get_aging_report(
    p_party_type text DEFAULT 'customers',
    p_as_of_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
    v_company uuid;
    v_as_of date := coalesce(p_as_of_date, CURRENT_DATE);
    v_gl_account_code text;
    v_gl_account_id uuid;
    v_gl_balance numeric := 0;
    v_gl_account_name text;
    v_company_name text;
    v_party_type text := lower(btrim(coalesce(p_party_type, 'customers')));
BEGIN
    IF v_party_type NOT IN ('customers', 'subcontractors', 'suppliers') THEN
        RAISE EXCEPTION 'نوع التقرير غير مدعوم: % (الأنواع المدعومة: customers, subcontractors, suppliers)', p_party_type USING ERRCODE = '22023';
    END IF;

    IF NOT isfinite(v_as_of) THEN
        RAISE EXCEPTION 'تاريخ التقرير غير صالح' USING ERRCODE = '22023';
    END IF;

    v_company := rawasi_private.require_aging_report_access(v_party_type);

    SELECT name INTO v_company_name FROM public.companies WHERE id = v_company;

    -- Pick the expected controlling GL account:
    -- Customers -> 123
    -- Subcontractors -> 212
    -- Suppliers -> 211
    IF v_party_type = 'customers' THEN
        v_gl_account_code := '123';
    ELSIF v_party_type = 'subcontractors' THEN
        v_gl_account_code := '212';
    ELSE
        v_gl_account_code := '211';
    END IF;

    SELECT id, name INTO v_gl_account_id, v_gl_account_name
    FROM public.accounts
    WHERE company_id = v_company AND code = v_gl_account_code
    LIMIT 1;

    -- Compute cumulative posted GL balance up to v_as_of
    IF v_gl_account_id IS NOT NULL THEN
        SELECT coalesce(
            CASE 
                -- 123 is Asset (normal debit balance): balance = debit - credit
                WHEN v_gl_account_code = '123' THEN sum(jl.debit - jl.credit)
                -- 211, 212 are Liabilities (normal credit balance): balance = credit - debit
                ELSE sum(jl.credit - jl.debit)
            END,
            0
        ) INTO v_gl_balance
        FROM public.journal_lines jl
        JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = jl.company_id
        WHERE jl.company_id = v_company
          AND jl.account_id = v_gl_account_id
          AND jh.status IN ('posted', 'مرحل', 'معتمد')
          AND jh.entry_date <= v_as_of;
    END IF;

    -- =========================================================================
    -- BRANCH 1: CUSTOMERS (العملاء - حساب 123)
    -- =========================================================================
    IF v_party_type = 'customers' THEN
        RETURN (
            WITH inv_receipts AS (
                SELECT r.invoice_id, sum(r.amount) AS paid_amount
                FROM public.receipt_vouchers r
                WHERE r.company_id = v_company
                  AND r.invoice_id IS NOT NULL
                  AND r.status IN ('posted', 'مرحل', 'معتمد')
                  AND r.date <= v_as_of
                  AND EXISTS (
                      SELECT 1 FROM public.journal_headers jh
                      WHERE jh.company_id = r.company_id AND jh.reference_id = r.id
                        AND jh.v_type IN ('receipt_vouchers', 'سند قبض')
                        AND jh.status IN ('posted', 'مرحل', 'معتمد')
                        AND jh.entry_date <= v_as_of
                  )
                GROUP BY r.invoice_id
            ),
            inv_adjustments AS (
                SELECT n.invoice_id,
                       sum(CASE n.note_type WHEN 'debit' THEN n.receivable_amount ELSE -n.receivable_amount END) AS net_adj
                FROM public.invoice_adjustment_notes n
                WHERE n.company_id = v_company
                  AND n.note_date <= v_as_of
                GROUP BY n.invoice_id
            ),
            inv_docs AS (
                SELECT 
                    i.id AS doc_id,
                    i.invoice_number AS doc_number,
                    'فاتورة مبيعات' AS doc_type,
                    i.date AS doc_date,
                    i.due_date AS due_date,
                    i.partner_id,
                    p.code AS partner_code,
                    coalesce(p.name, i.client_name, 'عميل غير محدد') AS partner_name,
                    p.phone AS partner_phone,
                    -- Primary project
                    CASE 
                        WHEN coalesce(cardinality(i.project_ids), 0) = 1 THEN i.project_ids[1]
                        ELSE NULL::uuid
                    END AS project_id,
                    CASE 
                        WHEN coalesce(cardinality(i.project_ids), 0) = 1 THEN pr."Property"
                        WHEN coalesce(cardinality(i.project_ids), 0) > 1 THEN 'مشاريع متعددة'
                        ELSE 'غير محدد'
                    END AS project_name,
                    i.total_amount AS original_amount,
                    coalesce(adj.net_adj, 0) AS adjustment_amount,
                    (coalesce(i.total_amount, 0) + coalesce(adj.net_adj, 0)) AS adjusted_total,
                    coalesce(rec.paid_amount, 0) AS paid_amount,
                    round(coalesce(i.total_amount, 0) + coalesce(adj.net_adj, 0) - coalesce(rec.paid_amount, 0), 2) AS remaining_balance
                FROM public.invoices i
                LEFT JOIN public.partners p ON p.id = i.partner_id AND p.company_id = i.company_id
                LEFT JOIN inv_receipts rec ON rec.invoice_id = i.id
                LEFT JOIN inv_adjustments adj ON adj.invoice_id = i.id
                LEFT JOIN public.projects pr ON pr.id = i.project_ids[1] AND pr.company_id = i.company_id
                WHERE i.company_id = v_company
                  AND i.status IN ('posted', 'مرحل', 'معتمد')
                  AND i.date <= v_as_of
                  AND EXISTS (
                      SELECT 1 FROM public.journal_headers jh
                      WHERE jh.company_id = i.company_id AND jh.reference_id = i.id
                        AND jh.v_type IN ('invoices', 'فاتورة مبيعات')
                        AND jh.status IN ('posted', 'مرحل', 'معتمد')
                        AND jh.entry_date <= v_as_of
                  )
            ),
            aged_docs AS (
                SELECT 
                    d.*,
                    CASE 
                        WHEN d.due_date IS NULL THEN NULL::integer
                        ELSE (v_as_of - d.due_date)
                    END AS overdue_days,
                    CASE 
                        WHEN d.due_date IS NULL THEN 'unspecified'
                        WHEN (v_as_of - d.due_date) <= 0 THEN 'current'
                        WHEN (v_as_of - d.due_date) <= 30 THEN 'days_1_30'
                        WHEN (v_as_of - d.due_date) <= 60 THEN 'days_31_60'
                        WHEN (v_as_of - d.due_date) <= 90 THEN 'days_61_90'
                        ELSE 'over_90'
                    END AS bucket
                FROM inv_docs d
                WHERE d.remaining_balance <> 0
            ),
            partner_agg AS (
                SELECT 
                    a.partner_id,
                    a.partner_code,
                    a.partner_name,
                    a.partner_phone,
                    count(*) AS open_docs_count,
                    round(sum(a.remaining_balance), 2) AS total_due,
                    round(sum(CASE WHEN a.bucket = 'current' THEN a.remaining_balance ELSE 0 END), 2) AS current_balance,
                    round(sum(CASE WHEN a.bucket = 'days_1_30' THEN a.remaining_balance ELSE 0 END), 2) AS days_1_30,
                    round(sum(CASE WHEN a.bucket = 'days_31_60' THEN a.remaining_balance ELSE 0 END), 2) AS days_31_60,
                    round(sum(CASE WHEN a.bucket = 'days_61_90' THEN a.remaining_balance ELSE 0 END), 2) AS days_61_90,
                    round(sum(CASE WHEN a.bucket = 'over_90' THEN a.remaining_balance ELSE 0 END), 2) AS over_90,
                    round(sum(CASE WHEN a.bucket = 'unspecified' THEN a.remaining_balance ELSE 0 END), 2) AS unspecified,
                    round(sum(CASE WHEN a.bucket <> 'current' AND a.bucket <> 'unspecified' THEN a.remaining_balance ELSE 0 END), 2) AS overdue_balance,
                    jsonb_agg(
                        jsonb_build_object(
                            'doc_id', a.doc_id,
                            'doc_number', a.doc_number,
                            'doc_type', a.doc_type,
                            'doc_date', a.doc_date,
                            'due_date', a.due_date,
                            'project_id', a.project_id,
                            'project_name', a.project_name,
                            'original_amount', a.original_amount,
                            'adjustment_amount', a.adjustment_amount,
                            'adjusted_total', a.adjusted_total,
                            'paid_amount', a.paid_amount,
                            'remaining_balance', a.remaining_balance,
                            'overdue_days', a.overdue_days,
                            'bucket', a.bucket
                        ) ORDER BY a.due_date NULLS LAST, a.doc_date
                    ) AS documents
                FROM aged_docs a
                GROUP BY a.partner_id, a.partner_code, a.partner_name, a.partner_phone
            ),
            project_agg AS (
                SELECT 
                    coalesce(a.project_id::text, 'unspecified') AS project_id,
                    coalesce(a.project_name, 'غير محدد') AS project_name,
                    count(*) AS open_docs_count,
                    round(sum(a.remaining_balance), 2) AS total_due,
                    round(sum(CASE WHEN a.bucket = 'current' THEN a.remaining_balance ELSE 0 END), 2) AS current_balance,
                    round(sum(CASE WHEN a.bucket = 'days_1_30' THEN a.remaining_balance ELSE 0 END), 2) AS days_1_30,
                    round(sum(CASE WHEN a.bucket = 'days_31_60' THEN a.remaining_balance ELSE 0 END), 2) AS days_31_60,
                    round(sum(CASE WHEN a.bucket = 'days_61_90' THEN a.remaining_balance ELSE 0 END), 2) AS days_61_90,
                    round(sum(CASE WHEN a.bucket = 'over_90' THEN a.remaining_balance ELSE 0 END), 2) AS over_90,
                    round(sum(CASE WHEN a.bucket = 'unspecified' THEN a.remaining_balance ELSE 0 END), 2) AS unspecified,
                    round(sum(CASE WHEN a.bucket <> 'current' AND a.bucket <> 'unspecified' THEN a.remaining_balance ELSE 0 END), 2) AS overdue_balance
                FROM aged_docs a
                GROUP BY a.project_id, a.project_name
            ),
            totals_agg AS (
                SELECT 
                    round(coalesce(sum(d.original_amount), 0), 2) AS total_invoiced,
                    round(coalesce(sum(d.adjusted_total), 0), 2) AS total_effective_invoiced,
                    round(coalesce(sum(d.paid_amount), 0), 2) AS total_collected,
                    round(coalesce(sum(d.remaining_balance), 0), 2) AS total_due,
                    round(coalesce(sum(CASE WHEN d.bucket = 'current' THEN d.remaining_balance ELSE 0 END), 0), 2) AS current_balance,
                    round(coalesce(sum(CASE WHEN d.bucket = 'days_1_30' THEN d.remaining_balance ELSE 0 END), 0), 2) AS days_1_30,
                    round(coalesce(sum(CASE WHEN d.bucket = 'days_31_60' THEN d.remaining_balance ELSE 0 END), 0), 2) AS days_31_60,
                    round(coalesce(sum(CASE WHEN d.bucket = 'days_61_90' THEN d.remaining_balance ELSE 0 END), 0), 2) AS days_61_90,
                    round(coalesce(sum(CASE WHEN d.bucket = 'over_90' THEN d.remaining_balance ELSE 0 END), 0), 2) AS over_90,
                    round(coalesce(sum(CASE WHEN d.bucket = 'unspecified' THEN d.remaining_balance ELSE 0 END), 0), 2) AS unspecified,
                    round(coalesce(sum(CASE WHEN d.bucket <> 'current' AND d.bucket <> 'unspecified' THEN d.remaining_balance ELSE 0 END), 0), 2) AS overdue_balance,
                    CASE 
                        WHEN coalesce(sum(d.adjusted_total), 0) > 0 
                        THEN round((coalesce(sum(d.paid_amount), 0) / sum(d.adjusted_total)) * 100, 2)
                        ELSE 0
                    END AS collection_rate_percent
                FROM aged_docs d
                FULL JOIN inv_docs id_all ON true
            ),
            sales_totals AS (
                SELECT 
                    coalesce(sum(i.adjusted_total), 0) AS total_sales,
                    coalesce(sum(i.paid_amount), 0) AS total_paid
                FROM inv_docs i
            )
            SELECT jsonb_build_object(
                'party_type', v_party_type,
                'as_of_date', v_as_of,
                'company', jsonb_build_object('id', v_company, 'name', v_company_name),
                'gl_reconciliation', jsonb_build_object(
                    'account_code', v_gl_account_code,
                    'account_name', v_gl_account_name,
                    'gl_balance', v_gl_balance,
                    'subledger_balance', coalesce((SELECT sum(total_due) FROM partner_agg), 0),
                    'variance', round(v_gl_balance - coalesce((SELECT sum(total_due) FROM partner_agg), 0), 2),
                    'is_reconciled', (round(v_gl_balance - coalesce((SELECT sum(total_due) FROM partner_agg), 0), 2) = 0)
                ),
                'kpis', jsonb_build_object(
                    'total_due', coalesce((SELECT sum(total_due) FROM partner_agg), 0),
                    'overdue_balance', coalesce((SELECT sum(overdue_balance) FROM partner_agg), 0),
                    'current_balance', coalesce((SELECT sum(current_balance) FROM partner_agg), 0),
                    'days_1_30', coalesce((SELECT sum(days_1_30) FROM partner_agg), 0),
                    'days_31_60', coalesce((SELECT sum(days_31_60) FROM partner_agg), 0),
                    'days_61_90', coalesce((SELECT sum(days_61_90) FROM partner_agg), 0),
                    'over_90', coalesce((SELECT sum(over_90) FROM partner_agg), 0),
                    'unspecified', coalesce((SELECT sum(unspecified) FROM partner_agg), 0),
                    'collection_rate_percent', (
                        SELECT CASE WHEN total_sales > 0 THEN round((total_paid / total_sales) * 100, 2) ELSE 0 END
                        FROM sales_totals
                    ),
                    'total_sales', (SELECT total_sales FROM sales_totals),
                    'total_collected', (SELECT total_paid FROM sales_totals)
                ),
                'top_debtors', coalesce((
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'partner_id', p.partner_id,
                            'partner_code', p.partner_code,
                            'partner_name', p.partner_name,
                            'total_due', p.total_due,
                            'overdue_balance', p.overdue_balance
                        ) ORDER BY p.total_due DESC
                    )
                    FROM (SELECT * FROM partner_agg ORDER BY total_due DESC LIMIT 5) p
                ), '[]'::jsonb),
                'partners', coalesce((
                    SELECT jsonb_agg(to_jsonb(p) ORDER BY p.total_due DESC)
                    FROM partner_agg p
                ), '[]'::jsonb),
                'projects', coalesce((
                    SELECT jsonb_agg(to_jsonb(pr) ORDER BY pr.total_due DESC)
                    FROM project_agg pr
                ), '[]'::jsonb)
            )
        );
    END IF;

    -- =========================================================================
    -- BRANCH 2: SUBCONTRACTORS (مقاولو الباطن - حساب 212)
    -- =========================================================================
    IF v_party_type = 'subcontractors' THEN
        RETURN (
            WITH claim_payments AS (
                SELECT pv.sub_claim_id, sum(pv.amount) AS paid_amount
                FROM public.payment_vouchers pv
                WHERE pv.company_id = v_company
                  AND pv.sub_claim_id IS NOT NULL
                  AND pv.status IN ('posted', 'مرحل', 'معتمد')
                  AND pv.date <= v_as_of
                  AND EXISTS (
                      SELECT 1 FROM public.journal_headers jh
                      WHERE jh.company_id = pv.company_id AND jh.reference_id = pv.id
                        AND jh.v_type IN ('payment_vouchers', 'سند صرف')
                        AND jh.status IN ('posted', 'مرحل', 'معتمد')
                        AND jh.entry_date <= v_as_of
                  )
                GROUP BY pv.sub_claim_id
            ),
            claim_docs AS (
                SELECT 
                    sc.id AS doc_id,
                    sc.claim_number AS doc_number,
                    'مستخلص مقاول باطن' AS doc_type,
                    sc.date AS doc_date,
                    CASE 
                        WHEN sc.date IS NOT NULL AND coalesce(sc.payment_period_days, 14) >= 0 
                        THEN (sc.date + coalesce(sc.payment_period_days, 14))
                        ELSE NULL::date
                    END AS due_date,
                    sc.payment_period_days,
                    sc.contractor_id AS partner_id,
                    p.code AS partner_code,
                    coalesce(p.name, 'مقاول غير محدد') AS partner_name,
                    p.phone AS partner_phone,
                    -- Project identification
                    CASE 
                        WHEN sc.project_id IS NOT NULL THEN sc.project_id
                        WHEN coalesce(cardinality(sc.project_ids), 0) = 1 THEN sc.project_ids[1]
                        ELSE NULL::uuid
                    END AS project_id,
                    CASE 
                        WHEN pr."Property" IS NOT NULL THEN pr."Property"
                        WHEN sc.project_names_text IS NOT NULL THEN sc.project_names_text
                        ELSE 'غير محدد'
                    END AS project_name,
                    sc.net_amount AS original_amount,
                    0::numeric AS adjustment_amount,
                    sc.net_amount AS adjusted_total,
                    coalesce(cp.paid_amount, 0) AS paid_amount,
                    round(coalesce(sc.net_amount, 0) - coalesce(cp.paid_amount, 0), 2) AS remaining_balance
                FROM public.sub_claims sc
                LEFT JOIN public.partners p ON p.id = sc.contractor_id AND p.company_id = sc.company_id
                LEFT JOIN claim_payments cp ON cp.sub_claim_id = sc.id
                LEFT JOIN public.projects pr ON pr.id = coalesce(sc.project_id, sc.project_ids[1]) AND pr.company_id = sc.company_id
                WHERE sc.company_id = v_company
                  AND sc.is_posted IS TRUE
                  AND sc.date <= v_as_of
                  AND EXISTS (
                      SELECT 1 FROM public.journal_headers jh
                      WHERE jh.company_id = sc.company_id AND jh.reference_id = sc.id
                        AND jh.v_type IN ('sub_claims', 'مستخلص مقاول باطن', 'مستخلص', 'invoices')
                        AND jh.status IN ('posted', 'مرحل', 'معتمد')
                        AND jh.entry_date <= v_as_of
                  )
            ),
            aged_docs AS (
                SELECT 
                    d.*,
                    CASE 
                        WHEN d.due_date IS NULL THEN NULL::integer
                        ELSE (v_as_of - d.due_date)
                    END AS overdue_days,
                    CASE 
                        WHEN d.due_date IS NULL THEN 'unspecified'
                        WHEN (v_as_of - d.due_date) <= 0 THEN 'current'
                        WHEN (v_as_of - d.due_date) <= 30 THEN 'days_1_30'
                        WHEN (v_as_of - d.due_date) <= 60 THEN 'days_31_60'
                        WHEN (v_as_of - d.due_date) <= 90 THEN 'days_61_90'
                        ELSE 'over_90'
                    END AS bucket
                FROM claim_docs d
                WHERE d.remaining_balance <> 0
            ),
            partner_agg AS (
                SELECT 
                    a.partner_id,
                    a.partner_code,
                    a.partner_name,
                    a.partner_phone,
                    count(*) AS open_docs_count,
                    round(sum(a.remaining_balance), 2) AS total_due,
                    round(sum(CASE WHEN a.bucket = 'current' THEN a.remaining_balance ELSE 0 END), 2) AS current_balance,
                    round(sum(CASE WHEN a.bucket = 'days_1_30' THEN a.remaining_balance ELSE 0 END), 2) AS days_1_30,
                    round(sum(CASE WHEN a.bucket = 'days_31_60' THEN a.remaining_balance ELSE 0 END), 2) AS days_31_60,
                    round(sum(CASE WHEN a.bucket = 'days_61_90' THEN a.remaining_balance ELSE 0 END), 2) AS days_61_90,
                    round(sum(CASE WHEN a.bucket = 'over_90' THEN a.remaining_balance ELSE 0 END), 2) AS over_90,
                    round(sum(CASE WHEN a.bucket = 'unspecified' THEN a.remaining_balance ELSE 0 END), 2) AS unspecified,
                    round(sum(CASE WHEN a.bucket <> 'current' AND a.bucket <> 'unspecified' THEN a.remaining_balance ELSE 0 END), 2) AS overdue_balance,
                    jsonb_agg(
                        jsonb_build_object(
                            'doc_id', a.doc_id,
                            'doc_number', a.doc_number,
                            'doc_type', a.doc_type,
                            'doc_date', a.doc_date,
                            'due_date', a.due_date,
                            'payment_period_days', a.payment_period_days,
                            'project_id', a.project_id,
                            'project_name', a.project_name,
                            'original_amount', a.original_amount,
                            'adjusted_total', a.adjusted_total,
                            'paid_amount', a.paid_amount,
                            'remaining_balance', a.remaining_balance,
                            'overdue_days', a.overdue_days,
                            'bucket', a.bucket
                        ) ORDER BY a.due_date NULLS LAST, a.doc_date
                    ) AS documents
                FROM aged_docs a
                GROUP BY a.partner_id, a.partner_code, a.partner_name, a.partner_phone
            ),
            project_agg AS (
                SELECT 
                    coalesce(a.project_id::text, 'unspecified') AS project_id,
                    coalesce(a.project_name, 'غير محدد') AS project_name,
                    count(*) AS open_docs_count,
                    round(sum(a.remaining_balance), 2) AS total_due,
                    round(sum(CASE WHEN a.bucket = 'current' THEN a.remaining_balance ELSE 0 END), 2) AS current_balance,
                    round(sum(CASE WHEN a.bucket = 'days_1_30' THEN a.remaining_balance ELSE 0 END), 2) AS days_1_30,
                    round(sum(CASE WHEN a.bucket = 'days_31_60' THEN a.remaining_balance ELSE 0 END), 2) AS days_31_60,
                    round(sum(CASE WHEN a.bucket = 'days_61_90' THEN a.remaining_balance ELSE 0 END), 2) AS days_61_90,
                    round(sum(CASE WHEN a.bucket = 'over_90' THEN a.remaining_balance ELSE 0 END), 2) AS over_90,
                    round(sum(CASE WHEN a.bucket = 'unspecified' THEN a.remaining_balance ELSE 0 END), 2) AS unspecified,
                    round(sum(CASE WHEN a.bucket <> 'current' AND a.bucket <> 'unspecified' THEN a.remaining_balance ELSE 0 END), 2) AS overdue_balance
                FROM aged_docs a
                GROUP BY a.project_id, a.project_name
            ),
            claim_totals AS (
                SELECT 
                    coalesce(sum(c.adjusted_total), 0) AS total_claims,
                    coalesce(sum(c.paid_amount), 0) AS total_paid
                FROM claim_docs c
            )
            SELECT jsonb_build_object(
                'party_type', v_party_type,
                'as_of_date', v_as_of,
                'company', jsonb_build_object('id', v_company, 'name', v_company_name),
                'gl_reconciliation', jsonb_build_object(
                    'account_code', v_gl_account_code,
                    'account_name', v_gl_account_name,
                    'gl_balance', v_gl_balance,
                    'subledger_balance', coalesce((SELECT sum(total_due) FROM partner_agg), 0),
                    'variance', round(v_gl_balance - coalesce((SELECT sum(total_due) FROM partner_agg), 0), 2),
                    'is_reconciled', (round(v_gl_balance - coalesce((SELECT sum(total_due) FROM partner_agg), 0), 2) = 0)
                ),
                'kpis', jsonb_build_object(
                    'total_due', coalesce((SELECT sum(total_due) FROM partner_agg), 0),
                    'overdue_balance', coalesce((SELECT sum(overdue_balance) FROM partner_agg), 0),
                    'current_balance', coalesce((SELECT sum(current_balance) FROM partner_agg), 0),
                    'days_1_30', coalesce((SELECT sum(days_1_30) FROM partner_agg), 0),
                    'days_31_60', coalesce((SELECT sum(days_31_60) FROM partner_agg), 0),
                    'days_61_90', coalesce((SELECT sum(days_61_90) FROM partner_agg), 0),
                    'over_90', coalesce((SELECT sum(over_90) FROM partner_agg), 0),
                    'unspecified', coalesce((SELECT sum(unspecified) FROM partner_agg), 0),
                    'payment_rate_percent', (
                        SELECT CASE WHEN total_claims > 0 THEN round((total_paid / total_claims) * 100, 2) ELSE 0 END
                        FROM claim_totals
                    ),
                    'total_claims', (SELECT total_claims FROM claim_totals),
                    'total_paid', (SELECT total_paid FROM claim_totals)
                ),
                'top_debtors', coalesce((
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'partner_id', p.partner_id,
                            'partner_code', p.partner_code,
                            'partner_name', p.partner_name,
                            'total_due', p.total_due,
                            'overdue_balance', p.overdue_balance
                        ) ORDER BY p.total_due DESC
                    )
                    FROM (SELECT * FROM partner_agg ORDER BY total_due DESC LIMIT 5) p
                ), '[]'::jsonb),
                'partners', coalesce((
                    SELECT jsonb_agg(to_jsonb(p) ORDER BY p.total_due DESC)
                    FROM partner_agg p
                ), '[]'::jsonb),
                'projects', coalesce((
                    SELECT jsonb_agg(to_jsonb(pr) ORDER BY pr.total_due DESC)
                    FROM project_agg pr
                ), '[]'::jsonb)
            )
        );
    END IF;

    -- =========================================================================
    -- BRANCH 3: SUPPLIERS (الموردون - حساب 211)
    -- =========================================================================
    -- Supplier dues come from posted material receipts to 211 (rpc_post_material_receipt),
    -- on-credit expenses where creditor_account is 211, and posted payment_vouchers to partner_id on 211.
    RETURN (
        WITH supplier_payments AS (
            -- All payments debited to 211 (or linked to partner_id) up to as_of
            SELECT jl.partner_id, sum(jl.debit) AS total_paid
            FROM public.journal_lines jl
            JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = jl.company_id
            WHERE jl.company_id = v_company
              AND jl.account_id = v_gl_account_id
              AND jl.partner_id IS NOT NULL
              AND jh.status IN ('posted', 'مرحل', 'معتمد')
              AND jh.entry_date <= v_as_of
            GROUP BY jl.partner_id
        ),
        receipt_supp_docs AS (
            SELECT 
                mr.id AS doc_id,
                mr.receipt_number AS doc_number,
                'سند استلام مواد' AS doc_type,
                mr.receipt_date AS doc_date,
                mr.receipt_date + 30 AS due_date, -- default 30-day term for supplier material receipts
                mr.supplier_id AS partner_id,
                p.code AS partner_code,
                coalesce(p.name, 'مورد غير محدد') AS partner_name,
                p.phone AS partner_phone,
                mr.project_id,
                coalesce(pr."Property", 'غير محدد') AS project_name,
                mr.total_amount AS original_amount,
                0::numeric AS adjustment_amount,
                mr.total_amount AS adjusted_total
            FROM public.material_receipts mr
            LEFT JOIN public.partners p ON p.id = mr.supplier_id AND p.company_id = mr.company_id
            LEFT JOIN public.projects pr ON pr.id = mr.project_id AND pr.company_id = mr.company_id
            WHERE mr.company_id = v_company
              AND mr.is_posted IS TRUE
              AND mr.receipt_type <> 'توريد عميل' -- client materials belong to 217, not 211!
              AND mr.receipt_date <= v_as_of
              AND EXISTS (
                  SELECT 1 FROM public.journal_headers jh
                  JOIN public.journal_lines jl ON jl.header_id = jh.id AND jl.company_id = jh.company_id
                  WHERE jh.company_id = mr.company_id AND jh.reference_id = mr.id
                    AND jh.v_type = 'inventory'
                    AND jl.account_id = v_gl_account_id
                    AND jh.status IN ('posted', 'مرحل', 'معتمد')
                    AND jh.entry_date <= v_as_of
              )
        ),
        expense_supp_docs AS (
            SELECT 
                e.id AS doc_id,
                coalesce(e.site_ref, 'EXP-' || substring(e.id::text, 1, 8)) AS doc_number,
                'فاتورة مشتريات/مصروف آجل' AS doc_type,
                e.exp_date AS doc_date,
                e.exp_date + 30 AS due_date,
                e.payee_id AS partner_id,
                p.code AS partner_code,
                coalesce(p.name, e.payee_name, 'مورد غير محدد') AS partner_name,
                p.phone AS partner_phone,
                e.project_id,
                coalesce(pr."Property", 'غير محدد') AS project_name,
                (e.total_price + coalesce(e.vat_amount, 0) - coalesce(e.discount_amount, 0)) AS original_amount,
                0::numeric AS adjustment_amount,
                (e.total_price + coalesce(e.vat_amount, 0) - coalesce(e.discount_amount, 0)) AS adjusted_total
            FROM public.expenses e
            LEFT JOIN public.partners p ON p.id = e.payee_id AND p.company_id = e.company_id
            LEFT JOIN public.projects pr ON pr.id = e.project_id AND pr.company_id = e.company_id
            WHERE e.company_id = v_company
              AND e.is_posted IS TRUE
              AND e.exp_date <= v_as_of
              AND EXISTS (
                  SELECT 1 FROM public.journal_headers jh
                  JOIN public.journal_lines jl ON jl.header_id = jh.id AND jl.company_id = jh.company_id
                  WHERE jh.company_id = e.company_id AND jh.reference_id = e.id
                    AND jl.account_id = v_gl_account_id AND jl.credit > 0
                    AND jh.status IN ('posted', 'مرحل', 'معتمد')
                    AND jh.entry_date <= v_as_of
              )
        ),
        all_supp_docs AS (
            SELECT * FROM receipt_supp_docs
            UNION ALL
            SELECT * FROM expense_supp_docs
        ),
        -- FIFO settlement of supplier payments against supplier documents (oldest first)
        supp_cumulative AS (
            SELECT 
                d.*,
                coalesce(sp.total_paid, 0) AS partner_total_paid,
                coalesce(sum(d.adjusted_total) OVER (
                    PARTITION BY d.partner_id 
                    ORDER BY d.doc_date, d.doc_id 
                    ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
                ), 0) AS prior_docs_total,
                sum(d.adjusted_total) OVER (
                    PARTITION BY d.partner_id 
                    ORDER BY d.doc_date, d.doc_id 
                    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                ) AS cumulative_docs_total
            FROM all_supp_docs d
            LEFT JOIN supplier_payments sp ON sp.partner_id = d.partner_id
        ),
        supp_allocated AS (
            SELECT 
                c.doc_id,
                c.doc_number,
                c.doc_type,
                c.doc_date,
                c.due_date,
                c.partner_id,
                c.partner_code,
                c.partner_name,
                c.partner_phone,
                c.project_id,
                c.project_name,
                c.original_amount,
                c.adjustment_amount,
                c.adjusted_total,
                round(
                    CASE 
                        -- Fully paid
                        WHEN c.partner_total_paid >= c.cumulative_docs_total THEN c.adjusted_total
                        -- Partially paid
                        WHEN c.partner_total_paid > c.prior_docs_total THEN (c.partner_total_paid - c.prior_docs_total)
                        -- Unpaid
                        ELSE 0
                    END,
                    2
                ) AS paid_amount,
                round(
                    CASE 
                        -- Fully paid
                        WHEN c.partner_total_paid >= c.cumulative_docs_total THEN 0
                        -- Partially paid
                        WHEN c.partner_total_paid > c.prior_docs_total THEN (c.cumulative_docs_total - c.partner_total_paid)
                        -- Unpaid
                        ELSE c.adjusted_total
                    END,
                    2
                ) AS remaining_balance
            FROM supp_cumulative c
        ),
        aged_docs AS (
            SELECT 
                a.*,
                CASE 
                    WHEN a.due_date IS NULL THEN NULL::integer
                    ELSE (v_as_of - a.due_date)
                END AS overdue_days,
                CASE 
                    WHEN a.due_date IS NULL THEN 'unspecified'
                    WHEN (v_as_of - a.due_date) <= 0 THEN 'current'
                    WHEN (v_as_of - a.due_date) <= 30 THEN 'days_1_30'
                    WHEN (v_as_of - a.due_date) <= 60 THEN 'days_31_60'
                    WHEN (v_as_of - a.due_date) <= 90 THEN 'days_61_90'
                    ELSE 'over_90'
                END AS bucket
            FROM supp_allocated a
            WHERE a.remaining_balance <> 0
        ),
        partner_agg AS (
            SELECT 
                a.partner_id,
                a.partner_code,
                a.partner_name,
                a.partner_phone,
                count(*) AS open_docs_count,
                round(sum(a.remaining_balance), 2) AS total_due,
                round(sum(CASE WHEN a.bucket = 'current' THEN a.remaining_balance ELSE 0 END), 2) AS current_balance,
                round(sum(CASE WHEN a.bucket = 'days_1_30' THEN a.remaining_balance ELSE 0 END), 2) AS days_1_30,
                round(sum(CASE WHEN a.bucket = 'days_31_60' THEN a.remaining_balance ELSE 0 END), 2) AS days_31_60,
                round(sum(CASE WHEN a.bucket = 'days_61_90' THEN a.remaining_balance ELSE 0 END), 2) AS days_61_90,
                round(sum(CASE WHEN a.bucket = 'over_90' THEN a.remaining_balance ELSE 0 END), 2) AS over_90,
                round(sum(CASE WHEN a.bucket = 'unspecified' THEN a.remaining_balance ELSE 0 END), 2) AS unspecified,
                round(sum(CASE WHEN a.bucket <> 'current' AND a.bucket <> 'unspecified' THEN a.remaining_balance ELSE 0 END), 2) AS overdue_balance,
                jsonb_agg(
                    jsonb_build_object(
                        'doc_id', a.doc_id,
                        'doc_number', a.doc_number,
                        'doc_type', a.doc_type,
                        'doc_date', a.doc_date,
                        'due_date', a.due_date,
                        'project_id', a.project_id,
                        'project_name', a.project_name,
                        'original_amount', a.original_amount,
                        'adjusted_total', a.adjusted_total,
                        'paid_amount', a.paid_amount,
                        'remaining_balance', a.remaining_balance,
                        'overdue_days', a.overdue_days,
                        'bucket', a.bucket
                    ) ORDER BY a.due_date NULLS LAST, a.doc_date
                ) AS documents
            FROM aged_docs a
            GROUP BY a.partner_id, a.partner_code, a.partner_name, a.partner_phone
        ),
        project_agg AS (
            SELECT 
                coalesce(a.project_id::text, 'unspecified') AS project_id,
                coalesce(a.project_name, 'غير محدد') AS project_name,
                count(*) AS open_docs_count,
                round(sum(a.remaining_balance), 2) AS total_due,
                round(sum(CASE WHEN a.bucket = 'current' THEN a.remaining_balance ELSE 0 END), 2) AS current_balance,
                round(sum(CASE WHEN a.bucket = 'days_1_30' THEN a.remaining_balance ELSE 0 END), 2) AS days_1_30,
                round(sum(CASE WHEN a.bucket = 'days_31_60' THEN a.remaining_balance ELSE 0 END), 2) AS days_31_60,
                round(sum(CASE WHEN a.bucket = 'days_61_90' THEN a.remaining_balance ELSE 0 END), 2) AS days_61_90,
                round(sum(CASE WHEN a.bucket = 'over_90' THEN a.remaining_balance ELSE 0 END), 2) AS over_90,
                round(sum(CASE WHEN a.bucket = 'unspecified' THEN a.remaining_balance ELSE 0 END), 2) AS unspecified,
                round(sum(CASE WHEN a.bucket <> 'current' AND a.bucket <> 'unspecified' THEN a.remaining_balance ELSE 0 END), 2) AS overdue_balance
            FROM aged_docs a
            GROUP BY a.project_id, a.project_name
        ),
        supp_totals AS (
            SELECT 
                coalesce(sum(s.adjusted_total), 0) AS total_invoiced,
                coalesce(sum(s.paid_amount), 0) AS total_paid
            FROM supp_allocated s
        )
        SELECT jsonb_build_object(
            'party_type', v_party_type,
            'as_of_date', v_as_of,
            'company', jsonb_build_object('id', v_company, 'name', v_company_name),
            'gl_reconciliation', jsonb_build_object(
                'account_code', v_gl_account_code,
                'account_name', v_gl_account_name,
                'gl_balance', v_gl_balance,
                'subledger_balance', coalesce((SELECT sum(total_due) FROM partner_agg), 0),
                'variance', round(v_gl_balance - coalesce((SELECT sum(total_due) FROM partner_agg), 0), 2),
                'is_reconciled', (round(v_gl_balance - coalesce((SELECT sum(total_due) FROM partner_agg), 0), 2) = 0)
            ),
            'kpis', jsonb_build_object(
                'total_due', coalesce((SELECT sum(total_due) FROM partner_agg), 0),
                'overdue_balance', coalesce((SELECT sum(overdue_balance) FROM partner_agg), 0),
                'current_balance', coalesce((SELECT sum(current_balance) FROM partner_agg), 0),
                'days_1_30', coalesce((SELECT sum(days_1_30) FROM partner_agg), 0),
                'days_31_60', coalesce((SELECT sum(days_31_60) FROM partner_agg), 0),
                'days_61_90', coalesce((SELECT sum(days_61_90) FROM partner_agg), 0),
                'over_90', coalesce((SELECT sum(over_90) FROM partner_agg), 0),
                'unspecified', coalesce((SELECT sum(unspecified) FROM partner_agg), 0),
                'payment_rate_percent', (
                    SELECT CASE WHEN total_invoiced > 0 THEN round((total_paid / total_invoiced) * 100, 2) ELSE 0 END
                    FROM supp_totals
                ),
                'total_invoiced', (SELECT total_invoiced FROM supp_totals),
                'total_paid', (SELECT total_paid FROM supp_totals)
            ),
            'top_debtors', coalesce((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'partner_id', p.partner_id,
                        'partner_code', p.partner_code,
                        'partner_name', p.partner_name,
                        'total_due', p.total_due,
                        'overdue_balance', p.overdue_balance
                    ) ORDER BY p.total_due DESC
                )
                FROM (SELECT * FROM partner_agg ORDER BY total_due DESC LIMIT 5) p
            ), '[]'::jsonb),
            'partners', coalesce((
                SELECT jsonb_agg(to_jsonb(p) ORDER BY p.total_due DESC)
                FROM partner_agg p
            ), '[]'::jsonb),
            'projects', coalesce((
                SELECT jsonb_agg(to_jsonb(pr) ORDER BY pr.total_due DESC)
                FROM project_agg pr
            ), '[]'::jsonb)
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_aging_report(text, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_aging_report(text, date) TO authenticated;

COMMIT;
