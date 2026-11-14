-- Migration: sync_boq_actual_quantity_from_job_orders
-- Description: Update boq_budget actual_quantity & execution_status when job orders are marked as 'مكتمل'

CREATE OR REPLACE FUNCTION rawasi_private.sync_boq_from_logs_on_save()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_labor_qty numeric := 0;
    v_job_orders_completed_qty numeric := 0;
    v_direct_expenses numeric := 0;
    v_sub_claims_cost numeric := 0;
    v_abc_cost numeric := 0;
    v_inv_revenue numeric := 0;
    v_rv_revenue numeric := 0;
BEGIN
    IF NEW.project_id IS NOT NULL THEN
        -- 1. الكمية المنفذة: إنتاجية العمالة + كميات أوامر الشغل المكتملة
        SELECT COALESCE(SUM(COALESCE(l.productivity, l.completed_quantity, 0)), 0) INTO v_labor_qty
        FROM public.labor_daily_logs l
        LEFT JOIN public.job_orders jo ON l.job_order_id = jo.id
        WHERE l.project_id = NEW.project_id
          AND (l.work_item_id = NEW.id OR l.work_item_id = NEW.boq_item_id OR jo.boq_budget_id = NEW.id);

        SELECT COALESCE(SUM(COALESCE(jo.assigned_qty, 0)), 0) INTO v_job_orders_completed_qty
        FROM public.job_orders jo
        WHERE jo.project_id = NEW.project_id
          AND (jo.boq_budget_id = NEW.id OR (NEW.boq_item_id IS NOT NULL AND jo.boq_budget_id = NEW.boq_item_id))
          AND jo.status = 'مكتمل';

        NEW.actual_quantity := GREATEST(v_labor_qty, v_job_orders_completed_qty);

        -- تحديث حالة التنفيذ تلقائياً للبند بناءً على نسبة الإنجاز والكمية
        IF NEW.contract_quantity > 0 AND NEW.actual_quantity >= NEW.contract_quantity THEN
            NEW.execution_status := 'انتهى';
        ELSIF NEW.actual_quantity > 0 THEN
            NEW.execution_status := 'تحت التنفيذ';
        END IF;

        -- 2. تكلفة العمالة المباشرة
        NEW.actual_labor_cost := (
            SELECT COALESCE(SUM(COALESCE(l.attendance_value, 1) * COALESCE(l.daily_wage, 0)), 0)
            FROM public.labor_daily_logs l
            LEFT JOIN public.job_orders jo ON l.job_order_id = jo.id
            WHERE l.project_id = NEW.project_id
              AND (l.work_item_id = NEW.id OR l.work_item_id = NEW.boq_item_id OR jo.boq_budget_id = NEW.id)
        );

        -- 3. الخامات المباشرة
        NEW.actual_material_cost := (
            SELECT COALESCE(SUM(mil.total_price), 0)
            FROM public.material_issue_lines mil
            JOIN public.material_issues mi ON mi.id = mil.issue_id
            LEFT JOIN public.job_orders jo ON mil.job_order_id = jo.id
            WHERE mi.project_id = NEW.project_id
              AND (mil.boq_item_id = NEW.boq_item_id OR mil.boq_id = NEW.id OR jo.boq_budget_id = NEW.id)
        );

        -- 4. مستخلصات مقاولي الباطن المرحلة
        SELECT COALESCE(SUM(sc.net_amount), 0) INTO v_sub_claims_cost
        FROM public.sub_claims sc
        WHERE COALESCE(sc.is_posted, false) = true
          AND (sc.project_id = NEW.project_id OR NEW.project_id = ANY(sc.project_ids))
          AND (
              EXISTS (
                  SELECT 1 FROM public.contractor_assignments ca
                  LEFT JOIN public.job_orders jo ON ca.job_order_id = jo.id
                  WHERE ca.claim_id = sc.id
                    AND (ca.boq_budget_id = NEW.id OR ca.boq_item_id = NEW.boq_item_id OR jo.boq_budget_id = NEW.id)
              )
              OR EXISTS (
                  SELECT 1 FROM public.job_orders jo
                  WHERE sc.job_order_id = jo.id
                    AND (jo.boq_budget_id = NEW.id OR jo.boq_budget_id = NEW.boq_item_id)
              )
          );

        NEW.actual_subcontractor_cost := v_sub_claims_cost;

        -- 5. المصروفات المباشرة المرتبطة بأمر الشغل أو البند
        SELECT COALESCE(SUM(COALESCE(NULLIF(e.total_price, 0), e.paid_amount, 0)), 0) INTO v_direct_expenses
        FROM public.expenses e
        LEFT JOIN public.job_orders jo ON e.job_order_id = jo.id
        WHERE NOT COALESCE(e.is_deleted, false)
          AND e.project_id = NEW.project_id
          AND (jo.boq_budget_id = NEW.id OR jo.boq_budget_id = NEW.boq_item_id);

        -- 6. المصروفات الموزعة (ABC)
        SELECT COALESCE(SUM("المبلغ المحمل (ر.س)"), 0) INTO v_abc_cost
        FROM public.advanced_cost_allocation_view
        WHERE project_id = NEW.project_id
          AND (boq_budget_id = NEW.boq_item_id OR boq_budget_id = NEW.id);

        NEW.actual_expenses_cost := v_direct_expenses + v_sub_claims_cost + v_abc_cost;

        -- 7. الإيرادات الفعلية المحصلة
        SELECT COALESCE(SUM((line->>'total_price')::numeric), 0) INTO v_inv_revenue
        FROM public.invoices i,
        jsonb_array_elements(rawasi_private.json_array_or_empty(i.lines_data)) AS line
        WHERE (i.status LIKE '%عتمد%' OR i.status LIKE '%مدفوع%')
          AND ((line->>'boq_id') = NEW.id::text OR (line->>'boq_id') = NEW.boq_item_id::text);

        SELECT COALESCE(SUM(rv.amount), 0) INTO v_rv_revenue
        FROM public.receipt_vouchers rv
        JOIN public.job_orders jo ON rv.job_order_id = jo.id
        WHERE rv.invoice_id IS NULL
          AND (rv.status LIKE '%عتمد%' OR rv.status LIKE '%محصل%' OR rv.status LIKE '%مدفوع%')
          AND (jo.boq_budget_id = NEW.id OR jo.boq_budget_id = NEW.boq_item_id);

        NEW.actual_revenue := v_inv_revenue + v_rv_revenue;
    END IF;

    RETURN NEW;
END;
$function$;

-- Also keep public version in sync if referenced anywhere
CREATE OR REPLACE FUNCTION public.sync_boq_from_logs_on_save()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    RETURN rawasi_private.sync_boq_from_logs_on_save();
END;
$function$;

-- Trigger function on job_orders to touch boq_budget
CREATE OR REPLACE FUNCTION rawasi_private.trigger_sync_boq_from_job_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_boq_id uuid;
BEGIN
    v_boq_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.boq_budget_id ELSE NEW.boq_budget_id END;
    IF v_boq_id IS NOT NULL THEN
        UPDATE public.boq_budget
        SET execution_status = execution_status
        WHERE id = v_boq_id;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.boq_budget_id IS NOT NULL AND OLD.boq_budget_id IS DISTINCT FROM NEW.boq_budget_id THEN
        UPDATE public.boq_budget
        SET execution_status = execution_status
        WHERE id = OLD.boq_budget_id;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS trg_job_order_sync_boq ON public.job_orders;
CREATE TRIGGER trg_job_order_sync_boq
AFTER INSERT OR UPDATE OF status, assigned_qty, boq_budget_id OR DELETE
ON public.job_orders
FOR EACH ROW
EXECUTE FUNCTION rawasi_private.trigger_sync_boq_from_job_order();

-- تحديث فوري لكافة بنود المقايسة
UPDATE public.boq_budget
SET execution_status = execution_status
WHERE id IN (SELECT DISTINCT boq_budget_id FROM public.job_orders WHERE boq_budget_id IS NOT NULL);
