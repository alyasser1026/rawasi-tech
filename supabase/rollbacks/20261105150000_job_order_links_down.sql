-- Rollback of 20261105150000_job_order_links.sql: restores the original functions and views exactly as
-- they were, then removes the triggers, helpers, indexes and the new job_order_id columns.
-- Work order links stored in the new columns (penalties, receipts, material issues, journal lines) are lost;
-- links that already existed before the migration are kept.

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $restore$
DECLARE
  r record;
BEGIN
  IF to_regclass('rawasi_private.job_order_link_originals') IS NULL THEN
    RAISE EXCEPTION 'job_order_links is not applied';
  END IF;
  FOR r IN SELECT name, definition FROM rawasi_private.job_order_link_originals WHERE name LIKE '%(%' LOOP
    EXECUTE r.definition;
  END LOOP;
  SELECT definition INTO r FROM rawasi_private.job_order_link_originals WHERE name = 'public.job_order_ledger_view';
  EXECUTE 'CREATE OR REPLACE VIEW public.job_order_ledger_view WITH (security_invoker = true) AS ' || r.definition;
  SELECT definition INTO r FROM rawasi_private.job_order_link_originals WHERE name = 'public.job_order_performance';
  EXECUTE 'CREATE OR REPLACE VIEW public.job_order_performance WITH (security_invoker = true) AS ' || r.definition;
END;
$restore$;

DROP TRIGGER trg_job_order_link ON public.labor_daily_logs;
DROP TRIGGER trg_job_order_link ON public.expenses;
DROP TRIGGER trg_job_order_link ON public.contractor_assignments;
DROP TRIGGER trg_job_order_link ON public.violations;
DROP TRIGGER trg_job_order_link ON public.material_issues;
DROP TRIGGER trg_job_order_link ON public.manual_journals;
DROP TRIGGER trg_job_order_link ON public.payment_vouchers;
DROP TRIGGER trg_job_order_link ON public.receipt_vouchers;
DROP TRIGGER trg_job_order_link ON public.sub_claims;
DROP TRIGGER trg_job_order_link ON public.invoices;
DROP TRIGGER trg_aa_job_order_link ON public.material_issue_lines;
DROP TRIGGER trg_job_order_lines ON public.material_issues;
DROP TRIGGER trg_job_order_guard ON public.job_orders;
DROP TRIGGER trg_job_order_tag ON public.journal_headers;
DROP TRIGGER trg_job_order_tag ON public.journal_lines;

DROP FUNCTION rawasi_private.check_job_order_link();
DROP FUNCTION rawasi_private.sync_material_issue_line_job_order();
DROP FUNCTION rawasi_private.sync_material_issue_job_order();
DROP FUNCTION rawasi_private.check_invoice_job_orders();
DROP FUNCTION rawasi_private.guard_job_order_links();
DROP FUNCTION rawasi_private.tag_journal_header_job_order();
DROP FUNCTION rawasi_private.tag_journal_line_job_order();
DROP FUNCTION rawasi_private.entry_job_order(text, uuid);
DROP FUNCTION rawasi_private.single_job_order(uuid[]);

DROP INDEX public.idx_jo_link_labor_daily_logs;
DROP INDEX public.idx_jo_link_expenses;
DROP INDEX public.idx_jo_link_contractor_assignments;
DROP INDEX public.idx_jo_link_material_issue_lines;
DROP INDEX public.idx_jo_link_material_issues;
DROP INDEX public.idx_jo_link_payment_vouchers;
DROP INDEX public.idx_jo_link_receipt_vouchers;
DROP INDEX public.idx_jo_link_violations;
DROP INDEX public.idx_jo_link_sub_claims;
DROP INDEX public.idx_jo_link_manual_journals;
DROP INDEX public.idx_jo_link_journal_headers;
DROP INDEX public.idx_jo_link_journal_lines;
DROP INDEX public.idx_jo_link_invoices_lines;

ALTER TABLE public.violations DROP COLUMN job_order_id;
ALTER TABLE public.receipt_vouchers DROP COLUMN job_order_id;
ALTER TABLE public.material_issues DROP COLUMN job_order_id;
ALTER TABLE public.journal_lines DROP COLUMN job_order_id;

DROP FUNCTION rawasi_private.invoice_line_total(jsonb);
DROP FUNCTION rawasi_private.safe_numeric(text);
DROP FUNCTION rawasi_private.json_array_or_empty(jsonb);
DROP TABLE rawasi_private.job_order_link_originals;
