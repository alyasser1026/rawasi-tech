BEGIN;
SET LOCAL lock_timeout = '10s';

DROP INDEX IF EXISTS public.contractor_assignments_per_jo_contractor_active_idx;
CREATE UNIQUE INDEX IF NOT EXISTS contractor_assignments_one_per_job_order
  ON public.contractor_assignments USING btree (job_order_id)
  WHERE (job_order_id IS NOT NULL);

CREATE OR REPLACE FUNCTION rawasi_private.auto_create_contractor_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
begin
  if new.executor_type = 'مقاول باطن' and new.contractor_id is not null
     and (tg_op = 'INSERT' or old.contractor_id is distinct from new.contractor_id or old.executor_type is distinct from new.executor_type) then
    if not exists (select 1 from public.contractor_assignments where job_order_id = new.id) then
      insert into public.contractor_assignments (job_order_id, contractor_id, project_id, boq_budget_id, assigned_qty, unit_price, status)
      values (new.id, new.contractor_id, new.project_id, new.boq_budget_id, new.assigned_qty, new.unit_price, 'جاري التنفيذ');
    else
      update public.contractor_assignments set contractor_id = new.contractor_id where job_order_id = new.id and claim_id is null;
    end if;
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION rawasi_private.assignment_after_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if old.job_order_id is not null then
    update public.job_orders
       set executor_type = 'تنفيذ ذاتي', contractor_id = null
     where id = old.job_order_id and contractor_id is not distinct from old.contractor_id;
  end if;
  return old;
end $function$;

NOTIFY pgrst, 'reload schema';
COMMIT;
