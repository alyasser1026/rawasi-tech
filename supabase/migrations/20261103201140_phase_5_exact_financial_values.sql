-- Exact decimal storage without imposing a new currency/quantity rounding policy.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL extra_float_digits=3;

DO $preflight$
BEGIN
  IF EXISTS(
    SELECT 1 FROM public.payroll_slips p CROSS JOIN LATERAL (
      VALUES(p.basic_salary::text),(p.total_advances::text),(p.total_deductions::text),
        (p.net_salary::text),(p.amount_to_pay::text),(p.allowances::text)
    ) AS amounts(value) WHERE value IN ('NaN','Infinity','-Infinity')
  ) OR EXISTS(
    SELECT 1 FROM public.inventory WHERE avg_price::text IN ('NaN','Infinity','-Infinity')
      OR current_stock::text IN ('NaN','Infinity','-Infinity')
  ) THEN
    RAISE EXCEPTION 'Nonfinite payroll/inventory values need reconciliation before phase 5';
  END IF;
END;
$preflight$;

-- Convert the shortest precise legacy decimal representation, rather than the
-- float-to-numeric cast that may round legacy floats to 15 significant digits.
ALTER TABLE public.payroll_slips
  ALTER COLUMN basic_salary TYPE numeric USING basic_salary::text::numeric,
  ALTER COLUMN total_advances TYPE numeric USING total_advances::text::numeric,
  ALTER COLUMN total_deductions TYPE numeric USING total_deductions::text::numeric,
  ALTER COLUMN net_salary TYPE numeric USING net_salary::text::numeric;
ALTER TABLE public.inventory
  ALTER COLUMN current_stock TYPE numeric USING current_stock::text::numeric,
  ALTER COLUMN avg_price TYPE numeric USING avg_price::text::numeric;

-- Preserve nullability, defaults, negative-net/stock behavior and decimal scales.
-- Numeric supports NaN/Infinity too, so exact storage also needs finite checks.
ALTER TABLE public.payroll_slips ADD CONSTRAINT payroll_slips_amounts_finite CHECK (
  (basic_salary IS NULL OR (basic_salary>'-Infinity'::numeric AND basic_salary<'Infinity'::numeric)) AND
  (total_advances IS NULL OR (total_advances>'-Infinity'::numeric AND total_advances<'Infinity'::numeric)) AND
  (total_deductions IS NULL OR (total_deductions>'-Infinity'::numeric AND total_deductions<'Infinity'::numeric)) AND
  (net_salary>'-Infinity'::numeric AND net_salary<'Infinity'::numeric) AND
  (amount_to_pay IS NULL OR (amount_to_pay>'-Infinity'::numeric AND amount_to_pay<'Infinity'::numeric)) AND
  (allowances IS NULL OR (allowances>'-Infinity'::numeric AND allowances<'Infinity'::numeric))
) NOT VALID;
ALTER TABLE public.inventory ADD CONSTRAINT inventory_values_finite CHECK (
  (current_stock IS NULL OR (current_stock>'-Infinity'::numeric AND current_stock<'Infinity'::numeric)) AND
  (avg_price IS NULL OR (avg_price>'-Infinity'::numeric AND avg_price<'Infinity'::numeric))
) NOT VALID;
ALTER TABLE public.payroll_slips VALIDATE CONSTRAINT payroll_slips_amounts_finite;
ALTER TABLE public.inventory VALIDATE CONSTRAINT inventory_values_finite;

NOTIFY pgrst,'reload schema';
