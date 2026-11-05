-- Rollback: 20261105170012_financial_statements_and_project_profitability_down.sql
-- Description: Rollback Phase 7 financial statements, project profitability, and KPIs RPCs

BEGIN;

DROP FUNCTION IF EXISTS public.get_financial_kpis(date, date);
DROP FUNCTION IF EXISTS public.get_projects_profitability_summary(date, date, uuid);
DROP FUNCTION IF EXISTS public.get_balance_sheet_as_of(date, boolean);
DROP FUNCTION IF EXISTS public.get_income_statement_by_period(date, date, boolean);

COMMIT;
