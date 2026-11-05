-- Roll back the note and VAT migrations first if they have been applied.
BEGIN;
SET LOCAL lock_timeout = '10s';

LOCK TABLE public.invoices, public.material_receipts, public.invoice_posted_lines,
  public.invoice_customer_material_applications IN ACCESS EXCLUSIVE MODE;

DO $restore$
DECLARE definition text := pg_get_functiondef('rawasi_private.post_legacy_invoices(uuid[])'::regprocedure);
BEGIN
  IF EXISTS (SELECT FROM public.invoices WHERE line_accounting)
    OR EXISTS (SELECT FROM public.material_receipts WHERE job_order_id IS NOT NULL)
    OR EXISTS (SELECT FROM public.invoice_posted_lines)
    OR EXISTS (SELECT FROM public.invoice_customer_material_applications) THEN
    RAISE EXCEPTION 'Invoice or customer material data uses the new accounting. Preserve it before planning a rollback.';
  END IF;
  EXECUTE replace(definition, 'CREATE OR REPLACE FUNCTION rawasi_private.post_legacy_invoices(',
    'CREATE OR REPLACE FUNCTION public.post_invoices_bulk(');
END;
$restore$;

DROP FUNCTION rawasi_private.post_invoice_lines_scoped(uuid[]);
DROP FUNCTION rawasi_private.post_legacy_invoices(uuid[]);
DROP FUNCTION public.preview_invoice_work_order_lines(jsonb,boolean);
DROP FUNCTION public.get_invoice_customer_materials(uuid[],uuid,date);
DROP FUNCTION rawasi_private.customer_material_net_applied(uuid,uuid);
DROP FUNCTION rawasi_private.invoice_line_calculation(uuid,jsonb,boolean);

DROP TRIGGER trg_protect_applied_customer_material ON public.material_receipts;
DROP TRIGGER trg_protect_applied_material_journal ON public.journal_headers;
DROP TRIGGER zz_protect_applied_material_lines ON public.journal_lines;
DROP FUNCTION rawasi_private.protect_applied_customer_material();

DROP TABLE public.invoice_customer_material_applications;
DROP TABLE public.invoice_posted_lines;
DELETE FROM rawasi_private.company_scoped_tables
WHERE table_name IN ('invoice_posted_lines','invoice_customer_material_applications');

ALTER TABLE public.invoices DROP COLUMN customer_materials, DROP COLUMN line_accounting;
DROP TRIGGER trg_job_order_link ON public.material_receipts;
DROP INDEX public.material_receipts_customer_credit_idx;
ALTER TABLE public.material_receipts
  DROP CONSTRAINT customer_material_receipt_has_source,
  DROP COLUMN job_order_id;

NOTIFY pgrst, 'reload schema';
COMMIT;
