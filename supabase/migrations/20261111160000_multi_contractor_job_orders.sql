-- Allow a single job order (أمر الشغل) to be open for multiple subcontractors simultaneously.
-- 1. Drop the single-assignment-per-job-order index (`contractor_assignments_one_per_job_order`).
-- 2. Replace with a partial unique index per (job_order_id, contractor_id) where claim_id IS NULL,
--    allowing multiple distinct contractors per job order without overwriting each other.
-- 3. Update `rawasi_private.auto_create_contractor_assignment()` so updating/inserting a job order
--    adds/updates only that specific contractor's assignment instead of overwriting all contractors.
-- 4. Update `rawasi_private.assignment_after_delete()` so deleting one contractor keeps the job order
--    assigned to any remaining contractors, reverting to 'تنفيذ ذاتي' only when none remain.
-- 5. Scope `subcontractor_claim_engine_view` and `assignment_details_view` material deductions by contractor.

BEGIN;
SET LOCAL lock_timeout = '10s';

-- 1 & 2: Replace single-contractor unique index with per-(job_order_id, contractor_id) active index
DROP INDEX IF EXISTS public.contractor_assignments_one_per_job_order;
CREATE UNIQUE INDEX IF NOT EXISTS contractor_assignments_per_jo_contractor_active_idx
  ON public.contractor_assignments USING btree (job_order_id, contractor_id)
  WHERE (job_order_id IS NOT NULL AND claim_id IS NULL);

-- 3: Safe multi-contractor trigger on job_orders
CREATE OR REPLACE FUNCTION rawasi_private.auto_create_contractor_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
BEGIN
  IF NEW.executor_type = 'مقاول باطن' AND NEW.contractor_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.contractor_id IS DISTINCT FROM NEW.contractor_id OR OLD.executor_type IS DISTINCT FROM NEW.executor_type) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.contractor_assignments
      WHERE job_order_id = NEW.id AND contractor_id = NEW.contractor_id
    ) THEN
      INSERT INTO public.contractor_assignments (
        job_order_id, contractor_id, project_id, boq_budget_id,
        assigned_qty, unit_price, status, company_id
      ) VALUES (
        NEW.id, NEW.contractor_id, NEW.project_id, NEW.boq_budget_id,
        NEW.assigned_qty, NEW.unit_price, 'جاري التنفيذ', NEW.company_id
      );
    ELSE
      UPDATE public.contractor_assignments
         SET project_id = NEW.project_id,
             boq_budget_id = NEW.boq_budget_id
       WHERE job_order_id = NEW.id
         AND contractor_id = NEW.contractor_id
         AND claim_id IS NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 4: Safe multi-contractor delete handler on contractor_assignments
CREATE OR REPLACE FUNCTION rawasi_private.assignment_after_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_remaining_contractor uuid;
BEGIN
  IF OLD.job_order_id IS NOT NULL THEN
    SELECT ca.contractor_id INTO v_remaining_contractor
      FROM public.contractor_assignments ca
     WHERE ca.job_order_id = OLD.job_order_id
     LIMIT 1;

    IF v_remaining_contractor IS NOT NULL THEN
      UPDATE public.job_orders
         SET executor_type = 'مقاول باطن',
             contractor_id = v_remaining_contractor
       WHERE id = OLD.job_order_id
         AND contractor_id IS NOT DISTINCT FROM OLD.contractor_id;
    ELSE
      UPDATE public.job_orders
         SET executor_type = 'تنفيذ ذاتي',
             contractor_id = NULL
       WHERE id = OLD.job_order_id
         AND contractor_id IS NOT DISTINCT FROM OLD.contractor_id;
    END IF;
  END IF;
  RETURN OLD;
END;
$function$;

-- 5: Contractor-scoped material deductions in subcontractor_claim_engine_view
CREATE OR REPLACE VIEW public.subcontractor_claim_engine_view WITH (security_invoker = true) AS
 WITH material_deductions AS (
         SELECT mil.job_order_id,
            COALESCE(mi.subcontractor_id, jo.contractor_id) AS subcontractor_id,
            sum(COALESCE(mil.total_price, 0::numeric)) AS total_materials
           FROM public.material_issue_lines mil
             LEFT JOIN public.material_issues mi ON mil.issue_id = mi.id
             LEFT JOIN public.job_orders jo ON mil.job_order_id = jo.id
          WHERE mil.job_order_id IS NOT NULL
          GROUP BY mil.job_order_id, COALESCE(mi.subcontractor_id, jo.contractor_id)
        ), expense_deductions AS (
         SELECT exp.job_order_id,
            exp.payee_id,
            sum(COALESCE(exp.total_price, 0::numeric)) AS total_expenses
           FROM public.expenses exp
          WHERE exp.job_order_id IS NOT NULL AND exp.is_deleted = false AND exp.is_deducted_from_contractor = true
          GROUP BY exp.job_order_id, exp.payee_id
        )
 SELECT ca.id AS assignment_id,
    ca.job_order_id,
    jo.order_number,
    ca.contractor_id,
    ca.project_id,
    b.work_item AS boq_item_name,
    ca.status AS assignment_status,
    ca.claim_id,
    COALESCE(ca.assigned_qty, 0::numeric) AS executed_qty,
    COALESCE(ca.unit_price, 0::numeric) AS contract_unit_price,
    COALESCE(ca.assigned_qty, 0::numeric) * COALESCE(ca.unit_price, 0::numeric) AS gross_total_amount,
    COALESCE(md.total_materials, 0::numeric) AS materials_deduction,
    COALESCE(ed.total_expenses, 0::numeric) AS expenses_deduction,
    COALESCE(md.total_materials, 0::numeric) + COALESCE(ed.total_expenses, 0::numeric) AS total_operational_deductions,
    COALESCE(ca.assigned_qty, 0::numeric) * COALESCE(ca.unit_price, 0::numeric) - (COALESCE(md.total_materials, 0::numeric) + COALESCE(ed.total_expenses, 0::numeric)) AS net_before_financial_deductions
   FROM public.contractor_assignments ca
     JOIN public.job_orders jo ON ca.job_order_id = jo.id
     LEFT JOIN public.boq_budget b ON ca.boq_budget_id = b.id
     LEFT JOIN material_deductions md ON ca.job_order_id = md.job_order_id AND ca.contractor_id = md.subcontractor_id
     LEFT JOIN expense_deductions ed ON ca.job_order_id = ed.job_order_id AND ca.contractor_id = ed.payee_id;

-- Scope assignment_details_view similarly
CREATE OR REPLACE VIEW public.assignment_details_view WITH (security_invoker = true) AS
 SELECT ca.id AS assignment_id,
    ca.job_order_id,
    ca.contractor_id,
    'خامات'::text AS record_type,
    mil.item_name AS item_description,
    mil.quantity AS qty,
    mil.total_price AS cost,
    true AS is_deductible
   FROM public.contractor_assignments ca
     JOIN public.job_orders jo ON ca.job_order_id = jo.id
     JOIN public.material_issue_lines mil ON ca.job_order_id = mil.job_order_id
     LEFT JOIN public.material_issues mi ON mil.issue_id = mi.id
  WHERE COALESCE(mi.subcontractor_id, jo.contractor_id) = ca.contractor_id
UNION ALL
 SELECT ca.id AS assignment_id,
    ca.job_order_id,
    ca.contractor_id,
    'مصروفات'::text AS record_type,
    e.description AS item_description,
    e.quantity AS qty,
    e.total_price AS cost,
    e.is_deducted_from_contractor AS is_deductible
   FROM public.contractor_assignments ca
     JOIN public.expenses e ON ca.job_order_id = e.job_order_id
  WHERE e.is_deleted = false AND (e.payee_id = ca.contractor_id OR e.payee_id IS NULL);

NOTIFY pgrst, 'reload schema';

COMMIT;
