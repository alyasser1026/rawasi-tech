-- Run transactionally. Refuse rollback if new decimal data would lose precision.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL extra_float_digits=3;
DO $preflight$
BEGIN
  IF EXISTS(
    SELECT 1 FROM public.payroll_slips p CROSS JOIN LATERAL (
      VALUES(p.basic_salary),(p.total_advances),(p.total_deductions),(p.net_salary)
    ) AS amounts(value)
    WHERE value IS NOT NULL AND value::double precision::text::numeric IS DISTINCT FROM value
  ) OR EXISTS(
    SELECT 1 FROM public.inventory i CROSS JOIN LATERAL (
      VALUES(i.current_stock),(i.avg_price)
    ) AS amounts(value)
    WHERE value IS NOT NULL AND value::double precision::text::numeric IS DISTINCT FROM value
  ) THEN
    RAISE EXCEPTION 'Rollback would lose decimal precision; retain numeric and reconcile before rollback';
  END IF;
END;
$preflight$;
ALTER TABLE public.payroll_slips DROP CONSTRAINT payroll_slips_amounts_finite;
ALTER TABLE public.inventory DROP CONSTRAINT inventory_values_finite;
ALTER TABLE public.payroll_slips
  ALTER COLUMN basic_salary TYPE double precision USING basic_salary::double precision,
  ALTER COLUMN total_advances TYPE double precision USING total_advances::double precision,
  ALTER COLUMN total_deductions TYPE double precision USING total_deductions::double precision,
  ALTER COLUMN net_salary TYPE double precision USING net_salary::double precision;
ALTER TABLE public.inventory
  ALTER COLUMN current_stock TYPE double precision USING current_stock::double precision,
  ALTER COLUMN avg_price TYPE double precision USING avg_price::double precision;
NOTIFY pgrst,'reload schema';
