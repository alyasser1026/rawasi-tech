-- Retention for new job orders. Existing orders keep an unspecified rate until reviewed.
BEGIN;
SET LOCAL lock_timeout = '10s';

ALTER TABLE public.job_orders
  ADD COLUMN retention_percent numeric(5,2)
  CONSTRAINT job_orders_retention_percent_range CHECK (retention_percent BETWEEN 0 AND 100);

ALTER TABLE public.job_orders
  ALTER COLUMN retention_percent SET DEFAULT 10;

COMMENT ON COLUMN public.job_orders.retention_percent IS
  'Customer invoice retention percentage configured on the job order; NULL means a legacy order has not been configured.';

NOTIFY pgrst, 'reload schema';

COMMIT;
