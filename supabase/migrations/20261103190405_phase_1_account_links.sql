-- Phase 1: align invoice account defaults with the existing form and protect
-- labor credit-account references. Existing records are not rewritten.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $preflight$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.labor_daily_logs l
    LEFT JOIN public.accounts a ON a.id = l.credit_account_id
    WHERE l.credit_account_id IS NOT NULL AND a.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Labor logs contain unknown credit accounts; reconcile them before applying phase 1';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_attrdef d
    JOIN pg_attribute col ON col.attrelid = d.adrelid AND col.attnum = d.adnum
    JOIN pg_class tbl ON tbl.oid = d.adrelid
    JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
    CROSS JOIN LATERAL regexp_match(pg_get_expr(d.adbin, d.adrelid), '''([0-9a-fA-F-]{36})''::uuid') fixed(id)
    LEFT JOIN public.accounts a ON a.id = fixed.id[1]::uuid
    WHERE ns.nspname = 'public'
      AND tbl.relname IN ('invoices', 'journal_lines', 'labor_daily_logs')
      AND fixed.id IS NOT NULL
      AND (a.id IS NULL OR a.is_transactional IS NOT TRUE)
  ) THEN
    RAISE EXCEPTION 'A default account is missing or is not transactional';
  END IF;
END;
$preflight$;

-- Resolve stable chart codes instead of embedding generated account UUIDs.
DO $invoice_defaults$
DECLARE mapping record; account_uuid uuid;
BEGIN
  FOR mapping IN SELECT * FROM (VALUES
    ('tax_acc_id', '215'),
    ('materials_acc_id', '217'),
    ('guarantee_acc_id', '124')
  ) AS defaults(column_name, account_code)
  LOOP
    SELECT id INTO STRICT account_uuid
    FROM public.accounts
    WHERE code = mapping.account_code AND is_transactional IS TRUE;
    EXECUTE format('ALTER TABLE public.invoices ALTER COLUMN %I SET DEFAULT %L::uuid', mapping.column_name, account_uuid);
  END LOOP;
END;
$invoice_defaults$;

CREATE INDEX labor_daily_logs_credit_account_id_idx
  ON public.labor_daily_logs (credit_account_id);

ALTER TABLE public.labor_daily_logs
  ADD CONSTRAINT labor_daily_logs_credit_account_id_fkey
  FOREIGN KEY (credit_account_id) REFERENCES public.accounts (id)
  ON UPDATE NO ACTION ON DELETE RESTRICT NOT VALID;

ALTER TABLE public.labor_daily_logs
  VALIDATE CONSTRAINT labor_daily_logs_credit_account_id_fkey;

NOTIFY pgrst, 'reload schema';
