-- =============================================================================
-- Migration: 20261105170012_financial_statements_and_project_profitability.sql
-- Description: Phase 7: القوائم المالية بفترة، وربحية المشاريع، ومؤشرات الأداء المالي
-- =============================================================================

-- 1. RPC: get_income_statement_by_period (قائمة الدخل الدقيقة بفترة مع مقارنة الفترة السابقة)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_income_statement_by_period(
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_compare_prev boolean DEFAULT true
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
  v_duration integer;
  v_prev_start date;
  v_prev_end date;

  -- Current Period Numbers
  v_revenues jsonb := '[]'::jsonb;
  v_project_costs jsonb := '[]'::jsonb;
  v_admin_expenses jsonb := '[]'::jsonb;

  v_total_revenue numeric := 0;
  v_total_project_costs numeric := 0;
  v_gross_profit numeric := 0;
  v_gross_margin_pct numeric := 0;
  v_total_admin_expenses numeric := 0;
  v_total_expenses numeric := 0;
  v_net_income numeric := 0;
  v_net_margin_pct numeric := 0;

  -- Previous Period Numbers
  v_prev_revenue numeric := 0;
  v_prev_project_costs numeric := 0;
  v_prev_gross_profit numeric := 0;
  v_prev_admin_expenses numeric := 0;
  v_prev_net_income numeric := 0;
BEGIN
  v_company_id := rawasi_private.current_company_id();
  IF NOT (rawasi_private.can_access('reports', 'view') OR rawasi_private.can_access('accounting', 'view') OR rawasi_private.is_admin()) THEN
    RAISE EXCEPTION 'غير مصرح بعرض القوائم المالية والتقارير' USING ERRCODE = '42501';
  END IF;

  v_start := COALESCE(p_start_date, date_trunc('year', CURRENT_DATE)::date);
  v_end := COALESCE(p_end_date, CURRENT_DATE);

  IF v_start > v_end THEN
    RAISE EXCEPTION 'تاريخ بداية الفترة يجب أن يكون قبل أو يساوي تاريخ النهاية' USING ERRCODE = '22023';
  END IF;

  -- 1. Revenues (4%): Credit - Debit
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'account_id', sub.account_id,
        'code', sub.code,
        'name', sub.name,
        'balance', sub.balance
      ) ORDER BY sub.code
    ), '[]'::jsonb),
    COALESCE(sum(sub.balance), 0)
  INTO v_revenues, v_total_revenue
  FROM (
    SELECT a.id AS account_id, a.code, a.name,
           ROUND(COALESCE(sum(jl.credit - jl.debit), 0), 2) AS balance
    FROM public.accounts a
    JOIN public.journal_lines jl ON jl.account_id = a.id AND jl.company_id = v_company_id
    JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
    WHERE a.company_id = v_company_id
      AND a.code LIKE '4%'
      AND jh.status IN ('posted', 'مرحل', 'معتمد')
      AND jh.entry_date BETWEEN v_start AND v_end
    GROUP BY a.id, a.code, a.name
    HAVING ABS(COALESCE(sum(jl.credit - jl.debit), 0)) > 0.001
  ) sub;

  -- 2. Direct Project Costs (51%): Debit - Credit
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'account_id', sub.account_id,
        'code', sub.code,
        'name', sub.name,
        'cost_category', CASE
          WHEN sub.code LIKE '511%' THEN 'materials'
          WHEN sub.code LIKE '512%' THEN 'labor'
          WHEN sub.code LIKE '513%' THEN 'subcontractors'
          WHEN sub.code LIKE '514%' THEN 'equipment'
          WHEN sub.code LIKE '515%' THEN 'site_expenses'
          WHEN sub.code LIKE '516%' THEN 'depreciation'
          WHEN sub.code LIKE '517%' THEN 'logistics'
          ELSE 'other_operations'
        END,
        'balance', sub.balance
      ) ORDER BY sub.code
    ), '[]'::jsonb),
    COALESCE(sum(sub.balance), 0)
  INTO v_project_costs, v_total_project_costs
  FROM (
    SELECT a.id AS account_id, a.code, a.name,
           ROUND(COALESCE(sum(jl.debit - jl.credit), 0), 2) AS balance
    FROM public.accounts a
    JOIN public.journal_lines jl ON jl.account_id = a.id AND jl.company_id = v_company_id
    JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
    WHERE a.company_id = v_company_id
      AND a.code LIKE '51%'
      AND jh.status IN ('posted', 'مرحل', 'معتمد')
      AND jh.entry_date BETWEEN v_start AND v_end
    GROUP BY a.id, a.code, a.name
    HAVING ABS(COALESCE(sum(jl.debit - jl.credit), 0)) > 0.001
  ) sub;

  -- 3. General & Administrative Expenses (52% and any other 5% not under 51%): Debit - Credit
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'account_id', sub.account_id,
        'code', sub.code,
        'name', sub.name,
        'balance', sub.balance
      ) ORDER BY sub.code
    ), '[]'::jsonb),
    COALESCE(sum(sub.balance), 0)
  INTO v_admin_expenses, v_total_admin_expenses
  FROM (
    SELECT a.id AS account_id, a.code, a.name,
           ROUND(COALESCE(sum(jl.debit - jl.credit), 0), 2) AS balance
    FROM public.accounts a
    JOIN public.journal_lines jl ON jl.account_id = a.id AND jl.company_id = v_company_id
    JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
    WHERE a.company_id = v_company_id
      AND a.code LIKE '5%'
      AND a.code NOT LIKE '51%'
      AND jh.status IN ('posted', 'مرحل', 'معتمد')
      AND jh.entry_date BETWEEN v_start AND v_end
    GROUP BY a.id, a.code, a.name
    HAVING ABS(COALESCE(sum(jl.debit - jl.credit), 0)) > 0.001
  ) sub;

  -- Totals and Margins
  v_gross_profit := v_total_revenue - v_total_project_costs;
  IF v_total_revenue > 0 THEN
    v_gross_margin_pct := ROUND((v_gross_profit / v_total_revenue) * 100, 2);
  ELSE
    v_gross_margin_pct := 0;
  END IF;

  v_total_expenses := v_total_project_costs + v_total_admin_expenses;
  v_net_income := v_total_revenue - v_total_expenses;
  IF v_total_revenue > 0 THEN
    v_net_margin_pct := ROUND((v_net_income / v_total_revenue) * 100, 2);
  ELSE
    v_net_margin_pct := 0;
  END IF;

  -- Previous Period Calculation
  IF p_compare_prev THEN
    v_duration := (v_end - v_start + 1);
    v_prev_start := (v_start - (v_duration || ' days')::interval)::date;
    v_prev_end := (v_start - INTERVAL '1 day')::date;

    SELECT
      COALESCE(sum(CASE WHEN a.code LIKE '4%' THEN (jl.credit - jl.debit) ELSE 0 END), 0),
      COALESCE(sum(CASE WHEN a.code LIKE '51%' THEN (jl.debit - jl.credit) ELSE 0 END), 0),
      COALESCE(sum(CASE WHEN a.code LIKE '5%' AND a.code NOT LIKE '51%' THEN (jl.debit - jl.credit) ELSE 0 END), 0)
    INTO v_prev_revenue, v_prev_project_costs, v_prev_admin_expenses
    FROM public.accounts a
    JOIN public.journal_lines jl ON jl.account_id = a.id AND jl.company_id = v_company_id
    JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
    WHERE a.company_id = v_company_id
      AND (a.code LIKE '4%' OR a.code LIKE '5%')
      AND jh.status IN ('posted', 'مرحل', 'معتمد')
      AND jh.entry_date BETWEEN v_prev_start AND v_prev_end;

    v_prev_gross_profit := v_prev_revenue - v_prev_project_costs;
    v_prev_net_income := v_prev_revenue - (v_prev_project_costs + v_prev_admin_expenses);
  END IF;

  RETURN jsonb_build_object(
    'period', jsonb_build_object(
      'start_date', v_start,
      'end_date', v_end,
      'duration_days', (v_end - v_start + 1)
    ),
    'summary', jsonb_build_object(
      'total_revenue', v_total_revenue,
      'total_project_costs', v_total_project_costs,
      'gross_profit', v_gross_profit,
      'gross_margin_pct', v_gross_margin_pct,
      'total_admin_expenses', v_total_admin_expenses,
      'total_expenses', v_total_expenses,
      'net_income', v_net_income,
      'net_margin_pct', v_net_margin_pct
    ),
    'sections', jsonb_build_object(
      'revenues', v_revenues,
      'project_costs', v_project_costs,
      'admin_expenses', v_admin_expenses
    ),
    'previous_period', CASE WHEN p_compare_prev THEN jsonb_build_object(
      'start_date', v_prev_start,
      'end_date', v_prev_end,
      'total_revenue', v_prev_revenue,
      'total_project_costs', v_prev_project_costs,
      'gross_profit', v_prev_gross_profit,
      'total_admin_expenses', v_prev_admin_expenses,
      'net_income', v_prev_net_income,
      'revenue_change', (v_total_revenue - v_prev_revenue),
      'revenue_change_pct', CASE WHEN v_prev_revenue <> 0 THEN ROUND(((v_total_revenue - v_prev_revenue) / ABS(v_prev_revenue)) * 100, 2) ELSE 0 END,
      'net_income_change', (v_net_income - v_prev_net_income),
      'net_income_change_pct', CASE WHEN v_prev_net_income <> 0 THEN ROUND(((v_net_income - v_prev_net_income) / ABS(v_prev_net_income)) * 100, 2) ELSE 0 END
    ) ELSE NULL END
  );
END;
$$;

-- 2. RPC: get_balance_sheet_as_of (المركز المالي في تاريخ معين مع توازن ذهبي متكامل)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_balance_sheet_as_of(
  p_as_of_date date DEFAULT NULL,
  p_compare_prev boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rawasi_private
AS $$
DECLARE
  v_company_id uuid;
  v_as_of date;
  v_year_start date;
  v_prev_date date;

  -- Assets
  v_current_assets jsonb := '[]'::jsonb;
  v_fixed_assets jsonb := '[]'::jsonb;
  v_other_assets jsonb := '[]'::jsonb;
  v_total_current_assets numeric := 0;
  v_total_fixed_assets numeric := 0;
  v_total_other_assets numeric := 0;
  v_total_assets numeric := 0;

  -- Liabilities
  v_current_liabilities jsonb := '[]'::jsonb;
  v_longterm_liabilities jsonb := '[]'::jsonb;
  v_total_current_liabilities numeric := 0;
  v_total_longterm_liabilities numeric := 0;
  v_total_liabilities numeric := 0;

  -- Equity
  v_equity jsonb := '[]'::jsonb;
  v_total_equity_historical numeric := 0;

  -- P&L / Net Income for Balance Equation
  v_prior_years_pnl numeric := 0;
  v_current_period_revenue numeric := 0;
  v_current_period_expense numeric := 0;
  v_current_period_net_income numeric := 0;
  v_total_equity_with_income numeric := 0;

  -- Balance check
  v_total_liabilities_and_equity numeric := 0;
  v_difference numeric := 0;
  v_is_balanced boolean := false;

  -- Prev Year-end comparison
  v_prev_total_assets numeric := 0;
  v_prev_total_liabilities numeric := 0;
  v_prev_total_equity numeric := 0;
BEGIN
  v_company_id := rawasi_private.current_company_id();
  IF NOT (rawasi_private.can_access('reports', 'view') OR rawasi_private.can_access('accounting', 'view') OR rawasi_private.is_admin()) THEN
    RAISE EXCEPTION 'غير مصرح بعرض القوائم المالية والتقارير' USING ERRCODE = '42501';
  END IF;

  v_as_of := COALESCE(p_as_of_date, CURRENT_DATE);
  v_year_start := date_trunc('year', v_as_of)::date;

  -- A. Assets (1%)
  -- ---------------------------------------------------------------------------
  -- Current Assets (12%): Debit - Credit
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'account_id', sub.account_id,
        'code', sub.code,
        'name', sub.name,
        'subgroup', CASE
          WHEN sub.code LIKE '122%' OR sub.code LIKE '129%' THEN 'cash_and_banks'
          WHEN sub.code LIKE '124%' THEN 'accounts_receivable'
          WHEN sub.code LIKE '125%' THEN 'custodies_and_advances'
          WHEN sub.code LIKE '126%' THEN 'inventory'
          ELSE 'other_current_assets'
        END,
        'balance', sub.balance
      ) ORDER BY sub.code
    ), '[]'::jsonb),
    COALESCE(sum(sub.balance), 0)
  INTO v_current_assets, v_total_current_assets
  FROM (
    SELECT a.id AS account_id, a.code, a.name,
           ROUND(COALESCE(sum(jl.debit - jl.credit), 0), 2) AS balance
    FROM public.accounts a
    JOIN public.journal_lines jl ON jl.account_id = a.id AND jl.company_id = v_company_id
    JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
    WHERE a.company_id = v_company_id
      AND a.code LIKE '12%'
      AND jh.status IN ('posted', 'مرحل', 'معتمد')
      AND jh.entry_date <= v_as_of
    GROUP BY a.id, a.code, a.name
    HAVING ABS(COALESCE(sum(jl.debit - jl.credit), 0)) > 0.001
  ) sub;

  -- Fixed Assets (11%): Cost (111..115) minus Accum. Deprec (119): Debit - Credit
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'account_id', sub.account_id,
        'code', sub.code,
        'name', sub.name,
        'is_contra', (sub.code LIKE '119%'),
        'balance', sub.balance
      ) ORDER BY sub.code
    ), '[]'::jsonb),
    COALESCE(sum(sub.balance), 0)
  INTO v_fixed_assets, v_total_fixed_assets
  FROM (
    SELECT a.id AS account_id, a.code, a.name,
           ROUND(COALESCE(sum(jl.debit - jl.credit), 0), 2) AS balance
    FROM public.accounts a
    JOIN public.journal_lines jl ON jl.account_id = a.id AND jl.company_id = v_company_id
    JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
    WHERE a.company_id = v_company_id
      AND a.code LIKE '11%'
      AND jh.status IN ('posted', 'مرحل', 'معتمد')
      AND jh.entry_date <= v_as_of
    GROUP BY a.id, a.code, a.name
    HAVING ABS(COALESCE(sum(jl.debit - jl.credit), 0)) > 0.001
  ) sub;

  -- Other Assets (any 1% not under 11% or 12%)
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'account_id', sub.account_id,
        'code', sub.code,
        'name', sub.name,
        'balance', sub.balance
      ) ORDER BY sub.code
    ), '[]'::jsonb),
    COALESCE(sum(sub.balance), 0)
  INTO v_other_assets, v_total_other_assets
  FROM (
    SELECT a.id AS account_id, a.code, a.name,
           ROUND(COALESCE(sum(jl.debit - jl.credit), 0), 2) AS balance
    FROM public.accounts a
    JOIN public.journal_lines jl ON jl.account_id = a.id AND jl.company_id = v_company_id
    JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
    WHERE a.company_id = v_company_id
      AND a.code LIKE '1%'
      AND a.code NOT LIKE '11%'
      AND a.code NOT LIKE '12%'
      AND jh.status IN ('posted', 'مرحل', 'معتمد')
      AND jh.entry_date <= v_as_of
    GROUP BY a.id, a.code, a.name
    HAVING ABS(COALESCE(sum(jl.debit - jl.credit), 0)) > 0.001
  ) sub;

  v_total_assets := v_total_current_assets + v_total_fixed_assets + v_total_other_assets;

  -- B. Liabilities (21% and 22%): Credit - Debit
  -- ---------------------------------------------------------------------------
  -- Current Liabilities (21%): Credit - Debit
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'account_id', sub.account_id,
        'code', sub.code,
        'name', sub.name,
        'subgroup', CASE
          WHEN sub.code LIKE '211%' THEN 'suppliers'
          WHEN sub.code LIKE '212%' THEN 'subcontractors_payable'
          WHEN sub.code LIKE '213%' THEN 'retention_guarantees_held'
          WHEN sub.code LIKE '215%' THEN 'vat_payable'
          WHEN sub.code LIKE '216%' THEN 'accrued_payroll'
          WHEN sub.code LIKE '217%' THEN 'customer_material_settlement'
          ELSE 'other_current_liabilities'
        END,
        'balance', sub.balance
      ) ORDER BY sub.code
    ), '[]'::jsonb),
    COALESCE(sum(sub.balance), 0)
  INTO v_current_liabilities, v_total_current_liabilities
  FROM (
    SELECT a.id AS account_id, a.code, a.name,
           ROUND(COALESCE(sum(jl.credit - jl.debit), 0), 2) AS balance
    FROM public.accounts a
    JOIN public.journal_lines jl ON jl.account_id = a.id AND jl.company_id = v_company_id
    JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
    WHERE a.company_id = v_company_id
      AND a.code LIKE '21%'
      AND jh.status IN ('posted', 'مرحل', 'معتمد')
      AND jh.entry_date <= v_as_of
    GROUP BY a.id, a.code, a.name
    HAVING ABS(COALESCE(sum(jl.credit - jl.debit), 0)) > 0.001
  ) sub;

  -- Long Term / Non-Current Liabilities (22%): Credit - Debit
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'account_id', sub.account_id,
        'code', sub.code,
        'name', sub.name,
        'balance', sub.balance
      ) ORDER BY sub.code
    ), '[]'::jsonb),
    COALESCE(sum(sub.balance), 0)
  INTO v_longterm_liabilities, v_total_longterm_liabilities
  FROM (
    SELECT a.id AS account_id, a.code, a.name,
           ROUND(COALESCE(sum(jl.credit - jl.debit), 0), 2) AS balance
    FROM public.accounts a
    JOIN public.journal_lines jl ON jl.account_id = a.id AND jl.company_id = v_company_id
    JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
    WHERE a.company_id = v_company_id
      AND a.code LIKE '22%'
      AND jh.status IN ('posted', 'مرحل', 'معتمد')
      AND jh.entry_date <= v_as_of
    GROUP BY a.id, a.code, a.name
    HAVING ABS(COALESCE(sum(jl.credit - jl.debit), 0)) > 0.001
  ) sub;

  v_total_liabilities := v_total_current_liabilities + v_total_longterm_liabilities;

  -- C. Equity (23%): Credit - Debit
  -- ---------------------------------------------------------------------------
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'account_id', sub.account_id,
        'code', sub.code,
        'name', sub.name,
        'balance', sub.balance
      ) ORDER BY sub.code
    ), '[]'::jsonb),
    COALESCE(sum(sub.balance), 0)
  INTO v_equity, v_total_equity_historical
  FROM (
    SELECT a.id AS account_id, a.code, a.name,
           ROUND(COALESCE(sum(jl.credit - jl.debit), 0), 2) AS balance
    FROM public.accounts a
    JOIN public.journal_lines jl ON jl.account_id = a.id AND jl.company_id = v_company_id
    JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
    WHERE a.company_id = v_company_id
      AND a.code LIKE '23%'
      AND jh.status IN ('posted', 'مرحل', 'معتمد')
      AND jh.entry_date <= v_as_of
    GROUP BY a.id, a.code, a.name
    HAVING ABS(COALESCE(sum(jl.credit - jl.debit), 0)) > 0.001
  ) sub;

  -- D. P&L / Current Period Net Income Calculation for Balance Sheet Equilibrium
  -- ---------------------------------------------------------------------------
  -- Prior years net P&L not closed to retained earnings
  SELECT
    ROUND(COALESCE(sum(CASE WHEN a.code LIKE '4%' THEN (jl.credit - jl.debit) ELSE 0 END), 0) -
          COALESCE(sum(CASE WHEN a.code LIKE '5%' THEN (jl.debit - jl.credit) ELSE 0 END), 0), 2)
  INTO v_prior_years_pnl
  FROM public.accounts a
  JOIN public.journal_lines jl ON jl.account_id = a.id AND jl.company_id = v_company_id
  JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
  WHERE a.company_id = v_company_id
    AND (a.code LIKE '4%' OR a.code LIKE '5%')
    AND jh.status IN ('posted', 'مرحل', 'معتمد')
    AND jh.entry_date < v_year_start;

  -- Current fiscal year net income up to as-of date
  SELECT
    ROUND(COALESCE(sum(jl.credit - jl.debit), 0), 2)
  INTO v_current_period_revenue
  FROM public.accounts a
  JOIN public.journal_lines jl ON jl.account_id = a.id AND jl.company_id = v_company_id
  JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
  WHERE a.company_id = v_company_id
    AND a.code LIKE '4%'
    AND jh.status IN ('posted', 'مرحل', 'معتمد')
    AND jh.entry_date BETWEEN v_year_start AND v_as_of;

  SELECT
    ROUND(COALESCE(sum(jl.debit - jl.credit), 0), 2)
  INTO v_current_period_expense
  FROM public.accounts a
  JOIN public.journal_lines jl ON jl.account_id = a.id AND jl.company_id = v_company_id
  JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
  WHERE a.company_id = v_company_id
    AND a.code LIKE '5%'
    AND jh.status IN ('posted', 'مرحل', 'معتمد')
    AND jh.entry_date BETWEEN v_year_start AND v_as_of;

  v_current_period_net_income := v_current_period_revenue - v_current_period_expense;

  -- Total equity with period income
  v_total_equity_with_income := v_total_equity_historical + v_prior_years_pnl + v_current_period_net_income;
  v_total_liabilities_and_equity := v_total_liabilities + v_total_equity_with_income;

  v_difference := ROUND(v_total_assets - v_total_liabilities_and_equity, 2);
  v_is_balanced := (ABS(v_difference) < 0.01);

  -- E. Previous Year-end comparison (Optional)
  IF p_compare_prev THEN
    v_prev_date := (v_year_start - INTERVAL '1 day')::date;

    SELECT
      ROUND(COALESCE(sum(jl.debit - jl.credit), 0), 2)
    INTO v_prev_total_assets
    FROM public.accounts a
    JOIN public.journal_lines jl ON jl.account_id = a.id AND jl.company_id = v_company_id
    JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
    WHERE a.company_id = v_company_id
      AND a.code LIKE '1%'
      AND jh.status IN ('posted', 'مرحل', 'معتمد')
      AND jh.entry_date <= v_prev_date;

    SELECT
      ROUND(COALESCE(sum(jl.credit - jl.debit), 0), 2)
    INTO v_prev_total_liabilities
    FROM public.accounts a
    JOIN public.journal_lines jl ON jl.account_id = a.id AND jl.company_id = v_company_id
    JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
    WHERE a.company_id = v_company_id
      AND (a.code LIKE '21%' OR a.code LIKE '22%')
      AND jh.status IN ('posted', 'مرحل', 'معتمد')
      AND jh.entry_date <= v_prev_date;

    v_prev_total_equity := v_prev_total_assets - v_prev_total_liabilities;
  END IF;

  RETURN jsonb_build_object(
    'as_of_date', v_as_of,
    'fiscal_year_start', v_year_start,
    'is_balanced', v_is_balanced,
    'difference', v_difference,
    'summary', jsonb_build_object(
      'total_assets', v_total_assets,
      'total_current_assets', v_total_current_assets,
      'total_fixed_assets', v_total_fixed_assets,
      'total_other_assets', v_total_other_assets,
      'total_liabilities', v_total_liabilities,
      'total_current_liabilities', v_total_current_liabilities,
      'total_longterm_liabilities', v_total_longterm_liabilities,
      'total_equity_historical', v_total_equity_historical,
      'prior_years_pnl', v_prior_years_pnl,
      'current_period_revenue', v_current_period_revenue,
      'current_period_expense', v_current_period_expense,
      'current_period_net_income', v_current_period_net_income,
      'total_equity_with_income', v_total_equity_with_income,
      'total_liabilities_and_equity', v_total_liabilities_and_equity
    ),
    'sections', jsonb_build_object(
      'current_assets', v_current_assets,
      'fixed_assets', v_fixed_assets,
      'other_assets', v_other_assets,
      'current_liabilities', v_current_liabilities,
      'longterm_liabilities', v_longterm_liabilities,
      'equity', v_equity
    ),
    'previous_year_end', CASE WHEN p_compare_prev THEN jsonb_build_object(
      'as_of_date', v_prev_date,
      'total_assets', v_prev_total_assets,
      'total_liabilities', v_prev_total_liabilities,
      'total_equity', v_prev_total_equity,
      'assets_growth', (v_total_assets - v_prev_total_assets),
      'assets_growth_pct', CASE WHEN v_prev_total_assets <> 0 THEN ROUND(((v_total_assets - v_prev_total_assets) / ABS(v_prev_total_assets)) * 100, 2) ELSE 0 END
    ) ELSE NULL END
  );
END;
$$;

-- 3. RPC: get_projects_profitability_summary (لوحة ربحية المشاريع مع مطابقة تامة للأستاذ العام)
-- -----------------------------------------------------------------------------
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
      pr.estimated_budget,
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
      -- BOQ Budgets
      COALESCE((
        SELECT sum(bb.contract_quantity * bb.unit_contract_price)
        FROM public.boq_budget bb
        WHERE bb.project_id = pr.id AND bb.company_id = v_company_id
      ), pr.contract_value, 0) AS boq_contract_value,
      COALESCE((
        SELECT sum(COALESCE(bb.estimated_labor_cost, 0) + COALESCE(bb.estimated_material_cost, 0) + COALESCE(bb.estimated_expenses_cost, 0))
        FROM public.boq_budget bb
        WHERE bb.project_id = pr.id AND bb.company_id = v_company_id
      ), pr.estimated_budget, 0) AS boq_estimated_cost
    FROM public.projects pr
    LEFT JOIN raw_lines rl ON rl.resolved_project_id = pr.id
    WHERE pr.company_id = v_company_id
      AND (p_project_id IS NULL OR pr.id = p_project_id)
    GROUP BY pr.id, pr.project_name, pr."Property", pr.project_code, pr.client_name, pr.status, pr.contract_value, pr.estimated_budget
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

-- 4. RPC: get_financial_kpis (مؤشرات الأداء المالي والسيولة والتحصيل)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_financial_kpis(
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
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
  v_days_in_period integer;

  -- Collection Rate & DSO
  v_total_invoiced numeric := 0;
  v_total_collected numeric := 0;
  v_collection_rate_pct numeric := 0;
  v_ar_balance numeric := 0;
  v_dso_days numeric := 0;

  -- Liquidity Ratios
  v_ca numeric := 0;
  v_cl numeric := 0;
  v_cash numeric := 0;
  v_current_ratio numeric := 0;
  v_quick_ratio numeric := 0;

  -- Top / Bottom Projects
  v_top_projects jsonb := '[]'::jsonb;
  v_bottom_projects jsonb := '[]'::jsonb;
BEGIN
  v_company_id := rawasi_private.current_company_id();
  IF NOT (rawasi_private.can_access('reports', 'view') OR rawasi_private.can_access('accounting', 'view') OR rawasi_private.is_admin()) THEN
    RAISE EXCEPTION 'غير مصرح بعرض مؤشرات الأداء المالي' USING ERRCODE = '42501';
  END IF;

  v_start := COALESCE(p_start_date, date_trunc('year', CURRENT_DATE)::date);
  v_end := COALESCE(p_end_date, CURRENT_DATE);
  v_days_in_period := (v_end - v_start + 1);

  -- 1. Invoices & Collection
  SELECT COALESCE(sum(inv.total_amount), 0)
  INTO v_total_invoiced
  FROM public.invoices inv
  WHERE inv.company_id = v_company_id
    AND inv.date BETWEEN v_start AND v_end
    AND inv.status IN ('posted', 'مرحل', 'معتمد', 'مدفوعة');

  SELECT COALESCE(sum(rv.amount), 0)
  INTO v_total_collected
  FROM public.receipt_vouchers rv
  WHERE rv.company_id = v_company_id
    AND rv.date BETWEEN v_start AND v_end
    AND rv.status IN ('posted', 'مرحل', 'معتمد', 'مدفوع');

  IF v_total_invoiced > 0 THEN
    v_collection_rate_pct := ROUND((v_total_collected / v_total_invoiced) * 100, 2);
  ELSE
    v_collection_rate_pct := 100;
  END IF;

  -- 2. AR Balance (Account 124) as of end date
  SELECT ROUND(COALESCE(sum(jl.debit - jl.credit), 0), 2)
  INTO v_ar_balance
  FROM public.accounts a
  JOIN public.journal_lines jl ON jl.account_id = a.id AND jl.company_id = v_company_id
  JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
  WHERE a.company_id = v_company_id
    AND a.code LIKE '124%'
    AND jh.status IN ('posted', 'مرحل', 'معتمد')
    AND jh.entry_date <= v_end;

  IF v_total_invoiced > 0 THEN
    v_dso_days := ROUND((v_ar_balance / v_total_invoiced) * v_days_in_period, 1);
  ELSE
    v_dso_days := 0;
  END IF;

  -- 3. Liquidity Ratios as of end date
  -- Current Assets (12%)
  SELECT ROUND(COALESCE(sum(jl.debit - jl.credit), 0), 2)
  INTO v_ca
  FROM public.accounts a
  JOIN public.journal_lines jl ON jl.account_id = a.id AND jl.company_id = v_company_id
  JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
  WHERE a.company_id = v_company_id
    AND a.code LIKE '12%'
    AND jh.status IN ('posted', 'مرحل', 'معتمد')
    AND jh.entry_date <= v_end;

  -- Cash & Banks (122, 129%)
  SELECT ROUND(COALESCE(sum(jl.debit - jl.credit), 0), 2)
  INTO v_cash
  FROM public.accounts a
  JOIN public.journal_lines jl ON jl.account_id = a.id AND jl.company_id = v_company_id
  JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
  WHERE a.company_id = v_company_id
    AND (a.code LIKE '122%' OR a.code LIKE '129%')
    AND jh.status IN ('posted', 'مرحل', 'معتمد')
    AND jh.entry_date <= v_end;

  -- Current Liabilities (21%)
  SELECT ROUND(COALESCE(sum(jl.credit - jl.debit), 0), 2)
  INTO v_cl
  FROM public.accounts a
  JOIN public.journal_lines jl ON jl.account_id = a.id AND jl.company_id = v_company_id
  JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
  WHERE a.company_id = v_company_id
    AND a.code LIKE '21%'
    AND jh.status IN ('posted', 'مرحل', 'معتمد')
    AND jh.entry_date <= v_end;

  IF v_cl > 0 THEN
    v_current_ratio := ROUND(v_ca / v_cl, 2);
    v_quick_ratio := ROUND((v_cash + v_ar_balance) / v_cl, 2);
  ELSE
    v_current_ratio := ROUND(v_ca, 2);
    v_quick_ratio := ROUND(v_cash + v_ar_balance, 2);
  END IF;

  -- 4. Top 3 Most Profitable & Top 3 Least Profitable Projects
  WITH project_summary AS (
    SELECT
      pr.id AS project_id,
      COALESCE(pr.project_name, pr."Property", 'مشروع') AS project_name,
      ROUND(COALESCE(sum(CASE WHEN a.code LIKE '4%' THEN (jl.credit - jl.debit) ELSE 0 END), 0), 2) AS revenue,
      ROUND(COALESCE(sum(CASE WHEN a.code LIKE '51%' THEN (jl.debit - jl.credit) ELSE 0 END), 0), 2) AS costs
    FROM public.projects pr
    LEFT JOIN public.journal_lines jl ON jl.project_id = pr.id AND jl.company_id = v_company_id
    LEFT JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id AND jh.status IN ('posted', 'مرحل', 'معتمد') AND jh.entry_date BETWEEN v_start AND v_end
    LEFT JOIN public.accounts a ON a.id = jl.account_id AND a.company_id = v_company_id AND (a.code LIKE '4%' OR a.code LIKE '51%')
    WHERE pr.company_id = v_company_id
    GROUP BY pr.id, pr.project_name, pr."Property"
  )
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'project_id', ps.project_id,
        'project_name', ps.project_name,
        'revenue', ps.revenue,
        'costs', ps.costs,
        'net_profit', (ps.revenue - ps.costs),
        'margin_pct', CASE WHEN ps.revenue > 0 THEN ROUND(((ps.revenue - ps.costs) / ps.revenue) * 100, 2) ELSE 0 END
      )
    ), '[]'::jsonb)
  INTO v_top_projects
  FROM (
    SELECT * FROM project_summary
    WHERE (revenue > 0 OR costs > 0)
    ORDER BY (revenue - costs) DESC
    LIMIT 3
  ) ps;

  WITH project_summary AS (
    SELECT
      pr.id AS project_id,
      COALESCE(pr.project_name, pr."Property", 'مشروع') AS project_name,
      ROUND(COALESCE(sum(CASE WHEN a.code LIKE '4%' THEN (jl.credit - jl.debit) ELSE 0 END), 0), 2) AS revenue,
      ROUND(COALESCE(sum(CASE WHEN a.code LIKE '51%' THEN (jl.debit - jl.credit) ELSE 0 END), 0), 2) AS costs
    FROM public.projects pr
    LEFT JOIN public.journal_lines jl ON jl.project_id = pr.id AND jl.company_id = v_company_id
    LEFT JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id AND jh.status IN ('posted', 'مرحل', 'معتمد') AND jh.entry_date BETWEEN v_start AND v_end
    LEFT JOIN public.accounts a ON a.id = jl.account_id AND a.company_id = v_company_id AND (a.code LIKE '4%' OR a.code LIKE '51%')
    WHERE pr.company_id = v_company_id
    GROUP BY pr.id, pr.project_name, pr."Property"
  )
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'project_id', ps.project_id,
        'project_name', ps.project_name,
        'revenue', ps.revenue,
        'costs', ps.costs,
        'net_profit', (ps.revenue - ps.costs),
        'margin_pct', CASE WHEN ps.revenue > 0 THEN ROUND(((ps.revenue - ps.costs) / ps.revenue) * 100, 2) ELSE 0 END
      )
    ), '[]'::jsonb)
  INTO v_bottom_projects
  FROM (
    SELECT * FROM project_summary
    WHERE (revenue > 0 OR costs > 0)
    ORDER BY (revenue - costs) ASC
    LIMIT 3
  ) ps;

  RETURN jsonb_build_object(
    'period', jsonb_build_object(
      'start_date', v_start,
      'end_date', v_end,
      'days_in_period', v_days_in_period
    ),
    'collection_metrics', jsonb_build_object(
      'total_invoiced', v_total_invoiced,
      'total_collected', v_total_collected,
      'collection_rate_pct', v_collection_rate_pct,
      'ar_balance', v_ar_balance,
      'dso_days', v_dso_days
    ),
    'liquidity_metrics', jsonb_build_object(
      'current_assets', v_ca,
      'cash_and_banks', v_cash,
      'current_liabilities', v_cl,
      'current_ratio', v_current_ratio,
      'quick_ratio', v_quick_ratio
    ),
    'project_rankings', jsonb_build_object(
      'top_profitable', v_top_projects,
      'least_profitable', v_bottom_projects
    )
  );
END;
$$;

-- 5. Permissions & Grants
-- -----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.get_income_statement_by_period(date, date, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_balance_sheet_as_of(date, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_projects_profitability_summary(date, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_financial_kpis(date, date) TO authenticated;
