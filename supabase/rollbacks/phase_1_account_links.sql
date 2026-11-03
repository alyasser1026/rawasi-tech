-- Restore the pre-phase-1 schema. Existing business rows are retained.
-- Apply transactionally only when reverting phase_1_account_links.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $old_invoice_defaults$
DECLARE mapping record; account_uuid uuid;
BEGIN
  FOR mapping IN SELECT * FROM (VALUES
    ('tax_acc_id', '41'),
    ('materials_acc_id', '123'),
    ('guarantee_acc_id', '123')
  ) AS defaults(column_name, account_code)
  LOOP
    SELECT id INTO STRICT account_uuid FROM public.accounts WHERE code = mapping.account_code;
    EXECUTE format('ALTER TABLE public.invoices ALTER COLUMN %I SET DEFAULT %L::uuid', mapping.column_name, account_uuid);
  END LOOP;
END;
$old_invoice_defaults$;

ALTER TABLE public.labor_daily_logs
  DROP CONSTRAINT labor_daily_logs_credit_account_id_fkey;
DROP INDEX public.labor_daily_logs_credit_account_id_idx;
NOTIFY pgrst, 'reload schema';
