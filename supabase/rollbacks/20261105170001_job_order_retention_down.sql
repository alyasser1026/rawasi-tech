-- Safe before use. Export and review configured rates before planning a rollback after use.
BEGIN;
SET LOCAL lock_timeout = '10s';

LOCK TABLE public.job_orders IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.job_orders WHERE retention_percent IS NOT NULL) THEN
    RAISE EXCEPTION 'Job orders have configured retention rates. Preserve those rates before rolling back.';
  END IF;
END;
$$;

ALTER TABLE public.job_orders DROP COLUMN retention_percent;

NOTIFY pgrst, 'reload schema';

COMMIT;
