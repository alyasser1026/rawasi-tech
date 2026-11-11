-- Rollback: 20261111194500_fix_subclaims_safe_and_project_accounting.rollback.sql

BEGIN;

DROP TRIGGER IF EXISTS trg_boq_update_from_subclaims ON public.sub_claims;
DROP TRIGGER IF EXISTS trg_boq_update_from_receipts ON public.receipt_vouchers;
DROP FUNCTION IF EXISTS rawasi_private.trigger_boq_update_from_subclaims();
DROP FUNCTION IF EXISTS rawasi_private.trigger_boq_update_from_receipts();

ALTER TABLE public.boq_budget
  DROP COLUMN IF EXISTS tech_days,
  DROP COLUMN IF EXISTS helper_days,
  DROP COLUMN IF EXISTS actual_subcontractor_cost;

COMMIT;
