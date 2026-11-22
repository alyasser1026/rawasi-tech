BEGIN;

-- ============================================================================
-- Prioritize projects.estimated_budget over BOQ item sums in project RPCs
-- Fallback to leaf boq_budget sums only when projects.estimated_budget = 0
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_project_dashboard()
 RETURNS TABLE(
   id uuid,
   "Property" text,
   client_name text,
   status text,
   contract_value numeric,
   estimated_budget numeric,
   total_material_cost numeric,
   total_direct_expenses numeric,
   direct_labor_cost numeric,
   allocated_labor_cost numeric,
   total_cost numeric,
   subcontractors jsonb,
   overall_completion_percentage numeric
 )
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
    v_total_general_labor_cost numeric;
    v_total_labor_logs numeric;
BEGIN
    SELECT COALESCE(SUM(COALESCE(NULLIF(ex.paid_amount, 0), ex.total_price, 0)), 0)
    INTO v_total_general_labor_cost
    FROM public.expenses ex
    WHERE ex.project_id IS NULL
      AND NOT COALESCE(ex.is_deleted, false)
      AND (ex.main_category LIKE '%عمال%' OR ex.main_category LIKE '%رواتب%' OR ex.main_category LIKE '%أجور%');

    SELECT COALESCE(SUM(attendance_value), 1) INTO v_total_labor_logs FROM public.labor_daily_logs;
    IF v_total_labor_logs <= 0 THEN v_total_labor_logs := 1; END IF;

    RETURN QUERY
    WITH MaterialCosts AS (
        SELECT mi.project_id, SUM(mil.total_price) AS material_cost
        FROM public.material_issues mi
        JOIN public.material_issue_lines mil ON mi.id = mil.issue_id
        GROUP BY mi.project_id
    ),
    DirectExpenses AS (
        SELECT ex_dir.project_id, SUM(COALESCE(NULLIF(ex_dir.paid_amount, 0), ex_dir.total_price, 0)) AS exp_cost
        FROM public.expenses ex_dir
        WHERE ex_dir.project_id IS NOT NULL AND NOT COALESCE(ex_dir.is_deleted, false)
        GROUP BY ex_dir.project_id
    ),
    SubClaimCosts AS (
        SELECT sc.project_id, SUM(COALESCE(sc.net_amount, 0)) AS sub_cost
        FROM public.sub_claims sc
        WHERE sc.project_id IS NOT NULL AND COALESCE(sc.is_posted, false) = true
        GROUP BY sc.project_id
    ),
    LaborLogs AS (
        SELECT ldl.project_id,
               SUM(COALESCE(ldl.attendance_value, 1)) AS project_workers,
               SUM(COALESCE(ldl.attendance_value, 1) * COALESCE(ldl.daily_wage, 0)) AS direct_labor
        FROM public.labor_daily_logs ldl
        GROUP BY ldl.project_id
    ),
    Subcontractors AS (
        SELECT sub_union.project_id, jsonb_agg(DISTINCT sub_union.sub_name) AS subs
        FROM (
            SELECT e.project_id, p.name AS sub_name FROM public.expenses e JOIN public.partners p ON e.payee_id = p.id WHERE e.project_id IS NOT NULL
            UNION SELECT m.project_id, p.name AS sub_name FROM public.material_issues m JOIN public.partners p ON m.subcontractor_id = p.id WHERE m.project_id IS NOT NULL
            UNION SELECT ca.project_id, p.name AS sub_name FROM public.contractor_assignments ca JOIN public.partners p ON ca.contractor_id = p.id WHERE ca.project_id IS NOT NULL
            UNION SELECT sc.project_id, p.name AS sub_name FROM public.sub_claims sc JOIN public.partners p ON sc.contractor_id = p.id WHERE sc.project_id IS NOT NULL
        ) sub_union
        WHERE sub_name IS NOT NULL
        GROUP BY sub_union.project_id
    ),
    BOQStats AS (
        SELECT
            b.project_id,
            COALESCE(AVG(b.completed_percentage), 0) AS avg_completion,
            SUM(COALESCE(NULLIF(b.total_contract_amount, 0), COALESCE(b.contract_quantity, 0) * COALESCE(b.unit_contract_price, 0))) AS boq_contract_value,
            SUM(
              COALESCE(b.estimated_labor_cost, 0) +
              COALESCE(b.estimated_material_cost, 0) +
              COALESCE(b.estimated_expenses_cost, 0) +
              COALESCE(b.estimated_subcontractor_cost, 0)
            ) AS boq_estimated_budget
        FROM public.boq_budget b
        WHERE NOT EXISTS (SELECT 1 FROM public.boq_budget child WHERE child.parent_id = b.id)
          AND COALESCE(b.item_type, 'فرعي') <> 'رئيسي'
        GROUP BY b.project_id
    )
    SELECT
        p.id,
        p."Property"::text,
        p.client_name::text,
        p.status::text,
        COALESCE(NULLIF(bs.boq_contract_value, 0), p.contract_value, 0) AS contract_value,
        COALESCE(NULLIF(p.estimated_budget, 0), bs.boq_estimated_budget, 0) AS estimated_budget,
        COALESCE(mc.material_cost, 0) AS total_material_cost,
        (COALESCE(de.exp_cost, 0) + COALESCE(scc.sub_cost, 0)) AS total_direct_expenses,
        COALESCE(ll.direct_labor, 0) AS direct_labor_cost,
        ROUND((COALESCE(ll.project_workers, 0)::numeric / v_total_labor_logs) * v_total_general_labor_cost, 2) AS allocated_labor_cost,
        (
          COALESCE(mc.material_cost, 0) +
          COALESCE(de.exp_cost, 0) +
          COALESCE(scc.sub_cost, 0) +
          COALESCE(ll.direct_labor, 0) +
          ROUND((COALESCE(ll.project_workers, 0)::numeric / v_total_labor_logs) * v_total_general_labor_cost, 2)
        ) AS total_cost,
        COALESCE(s.subs, '[]'::jsonb) AS subcontractors,
        COALESCE(bs.avg_completion, 0) AS overall_completion_percentage
    FROM public.projects p
    LEFT JOIN MaterialCosts mc ON p.id = mc.project_id
    LEFT JOIN DirectExpenses de ON p.id = de.project_id
    LEFT JOIN SubClaimCosts scc ON p.id = scc.project_id
    LEFT JOIN LaborLogs ll ON p.id = ll.project_id
    LEFT JOIN Subcontractors s ON p.id = s.project_id
    LEFT JOIN BOQStats bs ON p.id = bs.project_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_projects_profitability_summary(
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_project_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rawasi_private
AS $$
DECLARE
  v_company_id uuid;
  v_start date;
  v_end date;

  v_projects jsonb := '[]'::jsonb;
  v_unallocated jsonb;

  -- Grand Totals across all projects
  v_sum_proj_revenue numeric := 0;
  v_sum_proj_costs numeric := 0;
  v_sum_proj_profit numeric := 0;

  -- Unallocated Totals
  v_unallocated_revenue numeric := 0;
  v_unallocated_costs numeric := 0;
  v_unallocated_profit numeric := 0;

  -- GL Totals for Reconciliation Check
  v_gl_total_revenue numeric := 0;
  v_gl_total_project_costs numeric := 0;
  v_gl_variance numeric := 0;
  v_is_reconciled boolean := false;
BEGIN
  v_company_id := rawasi_private.current_company_id();
  IF NOT (rawasi_private.can_access('reports', 'view') OR rawasi_private.can_access('accounting', 'view') OR rawasi_private.can_access('projects', 'view') OR rawasi_private.is_admin()) THEN
    RAISE EXCEPTION 'غير مصرح بعرض تقارير ربحية المشاريع' USING ERRCODE = '42501';
  END IF;

  v_start := COALESCE(p_start_date, date_trunc('year', CURRENT_DATE)::date);
  v_end := COALESCE(p_end_date, CURRENT_DATE);

  -- Common Table Expression resolving project lines (direct or via source reference fallback)
  WITH raw_lines AS (
    SELECT
      jl.id,
      jl.account_id,
      a.code AS account_code,
      jl.debit,
      jl.credit,
      COALESCE(
        jl.project_id,
        (SELECT inv.project_ids[1] FROM public.invoices inv WHERE inv.id = jh.reference_id AND inv.company_id = v_company_id AND array_length(inv.project_ids, 1) > 0),
        (SELECT sc.project_id FROM public.sub_claims sc WHERE sc.id = jh.reference_id AND sc.company_id = v_company_id),
        (SELECT mi.project_id FROM public.material_issues mi WHERE mi.id = jh.reference_id AND mi.company_id = v_company_id),
        (SELECT e.project_id FROM public.expenses e WHERE e.id = jh.reference_id AND e.company_id = v_company_id),
        (SELECT ll.project_id FROM public.labor_daily_logs ll WHERE ll.id = jh.reference_id AND ll.company_id = v_company_id)
      ) AS resolved_project_id
    FROM public.journal_lines jl
    JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
    JOIN public.accounts a ON a.id = jl.account_id AND a.company_id = v_company_id
    WHERE jl.company_id = v_company_id
      AND (a.code LIKE '4%' OR a.code LIKE '51%')
      AND jh.status IN ('posted', 'مرحل', 'معتمد')
      AND jh.entry_date BETWEEN v_start AND v_end
  ),
  project_breakdowns AS (
    SELECT
      pr.id AS project_id,
      COALESCE(pr.project_name, pr."Property", 'مشروع') AS project_name,
      pr.project_code,
      pr.client_name,
      pr.status AS project_status,
      pr.contract_value,
      COALESCE(pr.estimated_budget, 0) AS project_estimated_budget,
      -- Revenue from 4%
      ROUND(COALESCE(sum(CASE WHEN rl.account_code LIKE '4%' THEN (rl.credit - rl.debit) ELSE 0 END), 0), 2) AS revenue,
      -- Cost Breakdowns from 51%
      ROUND(COALESCE(sum(CASE WHEN rl.account_code LIKE '511%' THEN (rl.debit - rl.credit) ELSE 0 END), 0), 2) AS materials_cost,
      ROUND(COALESCE(sum(CASE WHEN rl.account_code LIKE '512%' THEN (rl.debit - rl.credit) ELSE 0 END), 0), 2) AS labor_cost,
      ROUND(COALESCE(sum(CASE WHEN rl.account_code LIKE '513%' THEN (rl.debit - rl.credit) ELSE 0 END), 0), 2) AS subcontractors_cost,
      ROUND(COALESCE(sum(CASE WHEN rl.account_code LIKE '514%' THEN (rl.debit - rl.credit) ELSE 0 END), 0), 2) AS equipment_cost,
      ROUND(COALESCE(sum(CASE WHEN rl.account_code LIKE '515%' THEN (rl.debit - rl.credit) ELSE 0 END), 0), 2) AS site_expenses_cost,
      ROUND(COALESCE(sum(CASE WHEN rl.account_code LIKE '516%' THEN (rl.debit - rl.credit) ELSE 0 END), 0), 2) AS depreciation_cost,
      ROUND(COALESCE(sum(CASE WHEN rl.account_code LIKE '517%' OR (rl.account_code LIKE '51%' AND rl.account_code NOT LIKE ALL (ARRAY['511%','512%','513%','514%','515%','516%'])) THEN (rl.debit - rl.credit) ELSE 0 END), 0), 2) AS other_direct_cost,
      -- Leaf BOQ aggregates + Approved Budget prioritizing projects.estimated_budget
      COALESCE(NULLIF(boq_agg.boq_contract_value, 0), pr.contract_value, 0) AS boq_contract_value,
      COALESCE(boq_agg.boq_only_estimated_cost, 0) AS boq_only_estimated_cost,
      COALESCE(NULLIF(pr.estimated_budget, 0), NULLIF(boq_agg.boq_only_estimated_cost, 0), 0) AS boq_estimated_cost
    FROM public.projects pr
    LEFT JOIN raw_lines rl ON rl.resolved_project_id = pr.id
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(sum(COALESCE(NULLIF(bb.total_contract_amount, 0), COALESCE(bb.contract_quantity, 0) * COALESCE(bb.unit_contract_price, 0))), 0) AS boq_contract_value,
        COALESCE(sum(
          COALESCE(bb.estimated_labor_cost, 0) +
          COALESCE(bb.estimated_material_cost, 0) +
          COALESCE(bb.estimated_expenses_cost, 0) +
          COALESCE(bb.estimated_subcontractor_cost, 0)
        ), 0) AS boq_only_estimated_cost
      FROM public.boq_budget bb
      WHERE bb.project_id = pr.id
        AND bb.company_id = v_company_id
        AND NOT EXISTS (SELECT 1 FROM public.boq_budget ch WHERE ch.parent_id = bb.id)
        AND COALESCE(bb.item_type, 'فرعي') <> 'رئيسي'
    ) boq_agg ON true
    WHERE pr.company_id = v_company_id
      AND (p_project_id IS NULL OR pr.id = p_project_id)
    GROUP BY pr.id, pr.project_name, pr."Property", pr.project_code, pr.client_name, pr.status, pr.contract_value, pr.estimated_budget, boq_agg.boq_contract_value, boq_agg.boq_only_estimated_cost
  )
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'project_id', pb.project_id,
        'project_name', pb.project_name,
        'project_code', pb.project_code,
        'client_name', pb.client_name,
        'project_status', pb.project_status,
        'revenue', pb.revenue,
        'costs', jsonb_build_object(
          'materials', pb.materials_cost,
          'labor', pb.labor_cost,
          'subcontractors', pb.subcontractors_cost,
          'equipment', pb.equipment_cost,
          'site_expenses', pb.site_expenses_cost,
          'depreciation', pb.depreciation_cost,
          'other_direct', pb.other_direct_cost,
          'total', (pb.materials_cost + pb.labor_cost + pb.subcontractors_cost + pb.equipment_cost + pb.site_expenses_cost + pb.depreciation_cost + pb.other_direct_cost)
        ),
        'net_profit', (pb.revenue - (pb.materials_cost + pb.labor_cost + pb.subcontractors_cost + pb.equipment_cost + pb.site_expenses_cost + pb.depreciation_cost + pb.other_direct_cost)),
        'margin_pct', CASE
          WHEN pb.revenue > 0 THEN ROUND(((pb.revenue - (pb.materials_cost + pb.labor_cost + pb.subcontractors_cost + pb.equipment_cost + pb.site_expenses_cost + pb.depreciation_cost + pb.other_direct_cost)) / pb.revenue) * 100, 2)
          ELSE 0
        END,
        'boq_comparison', jsonb_build_object(
          'contract_value', pb.boq_contract_value,
          'estimated_cost', pb.boq_estimated_cost,
          'boq_estimated_cost', pb.boq_only_estimated_cost,
          'project_estimated_budget', pb.project_estimated_budget,
          'actual_cost', (pb.materials_cost + pb.labor_cost + pb.subcontractors_cost + pb.equipment_cost + pb.site_expenses_cost + pb.depreciation_cost + pb.other_direct_cost),
          'cost_burn_pct', CASE
            WHEN pb.boq_estimated_cost > 0 THEN ROUND(((pb.materials_cost + pb.labor_cost + pb.subcontractors_cost + pb.equipment_cost + pb.site_expenses_cost + pb.depreciation_cost + pb.other_direct_cost) / pb.boq_estimated_cost) * 100, 2)
            ELSE 0
          END,
          'variance', ((pb.materials_cost + pb.labor_cost + pb.subcontractors_cost + pb.equipment_cost + pb.site_expenses_cost + pb.depreciation_cost + pb.other_direct_cost) - pb.boq_estimated_cost)
        )
      ) ORDER BY pb.revenue DESC
    ), '[]'::jsonb),
    COALESCE(sum(pb.revenue), 0),
    COALESCE(sum(pb.materials_cost + pb.labor_cost + pb.subcontractors_cost + pb.equipment_cost + pb.site_expenses_cost + pb.depreciation_cost + pb.other_direct_cost), 0)
  INTO v_projects, v_sum_proj_revenue, v_sum_proj_costs
  FROM project_breakdowns pb
  WHERE (pb.revenue <> 0 OR (pb.materials_cost + pb.labor_cost + pb.subcontractors_cost + pb.equipment_cost + pb.site_expenses_cost + pb.depreciation_cost + pb.other_direct_cost) <> 0);

  v_sum_proj_profit := v_sum_proj_revenue - v_sum_proj_costs;

  -- Unallocated Lines (lines without resolved project id)
  WITH raw_lines AS (
    SELECT
      jl.id,
      a.code AS account_code,
      jl.debit,
      jl.credit,
      COALESCE(
        jl.project_id,
        (SELECT inv.project_ids[1] FROM public.invoices inv WHERE inv.id = jh.reference_id AND inv.company_id = v_company_id AND array_length(inv.project_ids, 1) > 0),
        (SELECT sc.project_id FROM public.sub_claims sc WHERE sc.id = jh.reference_id AND sc.company_id = v_company_id),
        (SELECT mi.project_id FROM public.material_issues mi WHERE mi.id = jh.reference_id AND mi.company_id = v_company_id),
        (SELECT e.project_id FROM public.expenses e WHERE e.id = jh.reference_id AND e.company_id = v_company_id),
        (SELECT ll.project_id FROM public.labor_daily_logs ll WHERE ll.id = jh.reference_id AND ll.company_id = v_company_id)
      ) AS resolved_project_id
    FROM public.journal_lines jl
    JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
    JOIN public.accounts a ON a.id = jl.account_id AND a.company_id = v_company_id
    WHERE jl.company_id = v_company_id
      AND (a.code LIKE '4%' OR a.code LIKE '51%')
      AND jh.status IN ('posted', 'مرحل', 'معتمد')
      AND jh.entry_date BETWEEN v_start AND v_end
  )
  SELECT
    ROUND(COALESCE(sum(CASE WHEN rl.account_code LIKE '4%' THEN (rl.credit - rl.debit) ELSE 0 END), 0), 2),
    ROUND(COALESCE(sum(CASE WHEN rl.account_code LIKE '51%' THEN (rl.debit - rl.credit) ELSE 0 END), 0), 2)
  INTO v_unallocated_revenue, v_unallocated_costs
  FROM raw_lines rl
  WHERE rl.resolved_project_id IS NULL;

  v_unallocated_profit := v_unallocated_revenue - v_unallocated_costs;

  v_unallocated := jsonb_build_object(
    'title_ar', 'غير محدد (إيرادات وتكاليف عمليات عامة غير محملة على مشاريع)',
    'revenue', v_unallocated_revenue,
    'costs', v_unallocated_costs,
    'net_profit', v_unallocated_profit
  );

  -- GL Totals for reconciliation check
  SELECT
    ROUND(COALESCE(sum(CASE WHEN a.code LIKE '4%' THEN (jl.credit - jl.debit) ELSE 0 END), 0), 2),
    ROUND(COALESCE(sum(CASE WHEN a.code LIKE '51%' THEN (jl.debit - jl.credit) ELSE 0 END), 0), 2)
  INTO v_gl_total_revenue, v_gl_total_project_costs
  FROM public.accounts a
  JOIN public.journal_lines jl ON jl.account_id = a.id AND jl.company_id = v_company_id
  JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
  WHERE a.company_id = v_company_id
    AND (a.code LIKE '4%' OR a.code LIKE '51%')
    AND jh.status IN ('posted', 'مرحل', 'معتمد')
    AND jh.entry_date BETWEEN v_start AND v_end;

  v_gl_variance := ROUND((v_sum_proj_costs + v_unallocated_costs) - v_gl_total_project_costs, 2);
  v_is_reconciled := (ABS(v_gl_variance) < 0.01 AND ABS((v_sum_proj_revenue + v_unallocated_revenue) - v_gl_total_revenue) < 0.01);

  RETURN jsonb_build_object(
    'period', jsonb_build_object(
      'start_date', v_start,
      'end_date', v_end
    ),
    'projects_count', jsonb_array_length(v_projects),
    'projects', v_projects,
    'unallocated', v_unallocated,
    'summary', jsonb_build_object(
      'projects_revenue', v_sum_proj_revenue,
      'projects_costs', v_sum_proj_costs,
      'projects_profit', v_sum_proj_profit,
      'unallocated_revenue', v_unallocated_revenue,
      'unallocated_costs', v_unallocated_costs,
      'total_combined_revenue', (v_sum_proj_revenue + v_unallocated_revenue),
      'total_combined_costs', (v_sum_proj_costs + v_unallocated_costs),
      'total_combined_profit', ((v_sum_proj_revenue + v_unallocated_revenue) - (v_sum_proj_costs + v_unallocated_costs)),
      'overall_margin_pct', CASE
        WHEN (v_sum_proj_revenue + v_unallocated_revenue) > 0 THEN
          ROUND((((v_sum_proj_revenue + v_unallocated_revenue) - (v_sum_proj_costs + v_unallocated_costs)) / (v_sum_proj_revenue + v_unallocated_revenue)) * 100, 2)
        ELSE 0
      END
    ),
    'reconciliation', jsonb_build_object(
      'gl_total_revenue', v_gl_total_revenue,
      'gl_total_project_costs', v_gl_total_project_costs,
      'is_reconciled', v_is_reconciled,
      'variance', v_gl_variance
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_project_dashboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_projects_profitability_summary(date, date, uuid) TO authenticated;

COMMIT;
