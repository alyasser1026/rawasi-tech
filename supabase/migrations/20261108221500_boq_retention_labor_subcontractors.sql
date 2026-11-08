-- Migration: boq_budget retention default 0, labor breakdown, subcontractor contracts
ALTER TABLE public.boq_budget ALTER COLUMN retention_percentage SET DEFAULT 0;

ALTER TABLE public.boq_budget 
  ADD COLUMN IF NOT EXISTS tech_count numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tech_daily_wage numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS helper_count numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS helper_daily_wage numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS labor_days numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subcontractor_rebar_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subcontractor_concrete_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subcontractor_other_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_subcontractor_cost numeric DEFAULT 0;

ALTER TABLE public.boq_budget DROP COLUMN IF EXISTS item_net_profit;
ALTER TABLE public.boq_budget ADD COLUMN item_net_profit numeric GENERATED ALWAYS AS (
  CASE 
    WHEN (COALESCE(actual_labor_cost, 0) + COALESCE(actual_material_cost, 0) + COALESCE(actual_expenses_cost, 0)) > 0
      THEN (contract_quantity * unit_contract_price) - (COALESCE(actual_labor_cost, 0) + COALESCE(actual_material_cost, 0) + COALESCE(actual_expenses_cost, 0))
    ELSE (contract_quantity * unit_contract_price) - (COALESCE(estimated_labor_cost, 0) + COALESCE(estimated_material_cost, 0) + COALESCE(estimated_expenses_cost, 0) + COALESCE(estimated_subcontractor_cost, 0))
  END
) STORED;

ALTER TABLE public.boq_budget DROP COLUMN IF EXISTS total_budget_variance;
ALTER TABLE public.boq_budget ADD COLUMN total_budget_variance numeric GENERATED ALWAYS AS (
  (COALESCE(estimated_material_cost, 0) + COALESCE(estimated_expenses_cost, 0) + COALESCE(estimated_labor_cost, 0) + COALESCE(estimated_subcontractor_cost, 0))
  - (COALESCE(actual_material_cost, 0) + COALESCE(actual_expenses_cost, 0) + COALESCE(actual_labor_cost, 0))
) STORED;
