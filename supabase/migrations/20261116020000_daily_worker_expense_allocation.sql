-- =====================================================================
-- Migration: Allocate Unassigned Expenses to Villas & Job Orders
--            by Day and Worker Count (Strict Company Isolation)
-- =====================================================================

-- 1. Replace public.advanced_cost_allocation_view so that any expense
--    without a villa (project_id IS NULL) or without a job order
--    (job_order_id IS NULL) is allocated across the active villas and
--    job orders according to the expense date (exp_date = work_date)
--    and the number of workers (عدد العمالة) working on each job order
--    on that day, strictly within the same company_id.
CREATE OR REPLACE VIEW public.advanced_cost_allocation_view AS
WITH daily_job_workers AS (
    SELECT
        jo.company_id,
        l.work_date,
        to_char((l.work_date)::timestamp with time zone, 'YYYY-MM'::text) AS work_month,
        jo.project_id,
        jo.id AS job_order_id,
        jo.order_number,
        jo.boq_budget_id,
        COALESCE(p.project_name, 'مشروع غير محدد'::text) AS project_name,
        COALESCE(b.item_name, jo.order_description, 'بند غير محدد'::text) AS item_name,
        SUM(COALESCE(l.number_of_workers, l.attendance_value, 1::numeric)) AS daily_workers
    FROM public.labor_attendance l
    JOIN public.job_orders jo ON l.job_order_id = jo.id
    LEFT JOIN public.projects p ON jo.project_id = p.id
    LEFT JOIN public.boq_budget b ON jo.boq_budget_id = b.id
    WHERE COALESCE(l.number_of_workers, l.attendance_value, 1::numeric) > 0::numeric
    GROUP BY
        jo.company_id,
        l.work_date,
        to_char((l.work_date)::timestamp with time zone, 'YYYY-MM'::text),
        jo.project_id,
        jo.id,
        jo.order_number,
        jo.boq_budget_id,
        p.project_name,
        b.item_name,
        jo.order_description
),
monthly_job_workers AS (
    SELECT
        d.company_id,
        d.work_month,
        d.project_id,
        d.job_order_id,
        d.order_number,
        d.boq_budget_id,
        d.project_name,
        d.item_name,
        SUM(d.daily_workers) AS monthly_workers
    FROM daily_job_workers d
    GROUP BY
        d.company_id,
        d.work_month,
        d.project_id,
        d.job_order_id,
        d.order_number,
        d.boq_budget_id,
        d.project_name,
        d.item_name
),
company_all_job_workers AS (
    SELECT
        d.company_id,
        d.project_id,
        d.job_order_id,
        d.order_number,
        d.boq_budget_id,
        d.project_name,
        d.item_name,
        SUM(d.daily_workers) AS total_workers
    FROM daily_job_workers d
    GROUP BY
        d.company_id,
        d.project_id,
        d.job_order_id,
        d.order_number,
        d.boq_budget_id,
        d.project_name,
        d.item_name
),
eligible_expenses AS (
    SELECT
        e.id,
        e.company_id,
        e.project_id AS source_project_id,
        e.job_order_id AS source_job_order_id,
        e.exp_date,
        to_char((e.exp_date)::timestamp with time zone, 'YYYY-MM'::text) AS exp_month,
        COALESCE(e.category, 'مصروفات عامة ومشتركة'::text) AS category,
        COALESCE(
            NULLIF(btrim(e.description), ''::text),
            NULLIF(btrim(e.notes), ''::text),
            NULLIF(btrim(e.cost_center), ''::text),
            NULLIF(btrim(e.category), ''::text),
            'مصروف عام موزع حسب العمالة'::text
        ) AS description,
        GREATEST(
            COALESCE(e.amount, 0::numeric)
            + COALESCE(e.tax_amount, 0::numeric)
            - COALESCE(e.discount_amount, 0::numeric),
            0::numeric
        ) AS net_amount
    FROM public.expenses e
    WHERE (e.project_id IS NULL OR e.job_order_id IS NULL)
      AND GREATEST(
            COALESCE(e.amount, 0::numeric)
            + COALESCE(e.tax_amount, 0::numeric)
            - COALESCE(e.discount_amount, 0::numeric),
            0::numeric
          ) > 0::numeric
),
matched_targets AS (
    -- Tier 1: Exact same-day worker count (within same company, and same project if source_project_id is set)
    SELECT
        e.id AS expense_id,
        e.company_id,
        e.exp_date,
        e.exp_month,
        e.category,
        e.description,
        e.net_amount,
        d.project_id,
        d.job_order_id,
        d.order_number,
        d.boq_budget_id,
        d.project_name,
        d.item_name,
        d.daily_workers AS worker_weight,
        SUM(d.daily_workers) OVER (PARTITION BY e.id) AS total_weight,
        'توزيع يومي مباشر (حسب عدد العمالة باليوم)'::text AS allocation_method
    FROM eligible_expenses e
    JOIN daily_job_workers d
      ON d.company_id = e.company_id
     AND d.work_date = e.exp_date
     AND (e.source_project_id IS NULL OR d.project_id = e.source_project_id)

    UNION ALL

    -- Tier 2: Fallback to same-month worker ratio if no workers logged on exact exp_date
    SELECT
        e.id AS expense_id,
        e.company_id,
        e.exp_date,
        e.exp_month,
        e.category,
        e.description,
        e.net_amount,
        m.project_id,
        m.job_order_id,
        m.order_number,
        m.boq_budget_id,
        m.project_name,
        m.item_name,
        m.monthly_workers AS worker_weight,
        SUM(m.monthly_workers) OVER (PARTITION BY e.id) AS total_weight,
        'توزيع نسبي حسب عمالة الشهر (لعدم تسجيل عمالة بنفس اليوم)'::text AS allocation_method
    FROM eligible_expenses e
    JOIN monthly_job_workers m
      ON m.company_id = e.company_id
     AND m.work_month = e.exp_month
     AND (e.source_project_id IS NULL OR m.project_id = e.source_project_id)
    WHERE NOT EXISTS (
        SELECT 1
        FROM daily_job_workers d2
        WHERE d2.company_id = e.company_id
          AND d2.work_date = e.exp_date
          AND (e.source_project_id IS NULL OR d2.project_id = e.source_project_id)
    )

    UNION ALL

    -- Tier 3: Fallback to overall company active job orders worker ratio if month has no attendance yet
    SELECT
        e.id AS expense_id,
        e.company_id,
        e.exp_date,
        e.exp_month,
        e.category,
        e.description,
        e.net_amount,
        c.project_id,
        c.job_order_id,
        c.order_number,
        c.boq_budget_id,
        c.project_name,
        c.item_name,
        c.total_workers AS worker_weight,
        SUM(c.total_workers) OVER (PARTITION BY e.id) AS total_weight,
        'توزيع نسبي حسب إجمالي العمالة المسجلة بأوامر الشغل'::text AS allocation_method
    FROM eligible_expenses e
    JOIN company_all_job_workers c
      ON c.company_id = e.company_id
     AND (e.source_project_id IS NULL OR c.project_id = e.source_project_id)
    WHERE NOT EXISTS (
        SELECT 1
        FROM daily_job_workers d2
        WHERE d2.company_id = e.company_id
          AND d2.work_date = e.exp_date
          AND (e.source_project_id IS NULL OR d2.project_id = e.source_project_id)
    )
      AND NOT EXISTS (
        SELECT 1
        FROM monthly_job_workers m2
        WHERE m2.company_id = e.company_id
          AND m2.work_month = e.exp_month
          AND (e.source_project_id IS NULL OR m2.project_id = e.source_project_id)
    )
)
SELECT
    (((t.expense_id)::text || '_'::text) || (t.job_order_id)::text) AS id,
    t.expense_id AS "كود الحركة المرجعي",
    t.project_id,
    t.job_order_id,
    t.order_number AS "رقم أمر التشغيل",
    t.boq_budget_id,
    t.exp_month AS "شهر التحميل المالي",
    t.exp_date AS "تاريخ المصروف الأصلي",
    t.project_name AS "اسم الفيلا المحمل عليها",
    t.item_name AS "البند المحمل عليه",
    t.category AS "التصنيف الرئيسي",
    t.description AS "البيان / الوصف",
    t.net_amount AS "قيمة الفاتورة الأصلية (ر.س)",
    t.worker_weight AS "عمال اليوم للأمر",
    t.worker_weight AS "يوميات الشهر للأمر",
    ROUND(((t.worker_weight / NULLIF(t.total_weight, 0::numeric)) * 100::numeric), 2) AS "نسبة التحميل (%)",
    ROUND((t.net_amount * (t.worker_weight / NULLIF(t.total_weight, 0::numeric))), 2) AS "المبلغ المحمل (ر.س)",
    t.allocation_method AS "آلية التوزيع"
FROM matched_targets t
WHERE t.total_weight > 0::numeric;

-- 2. Mark unassigned expenses as auto-distributed for clear reporting
UPDATE public.expenses
SET is_auto_distributed = true
WHERE project_id IS NULL OR job_order_id IS NULL;
