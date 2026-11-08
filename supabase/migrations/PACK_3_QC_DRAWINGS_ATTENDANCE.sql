-- =============================================================================
-- حزمة 3: مخططات المشاريع، فحوصات الموقع، الحضور والغياب، وأجهزة البصمة الذكية
-- =============================================================================


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- FILE: 20261105170014_project_drawings_and_site_inspections.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- =============================================================================
-- Migration: 20261105170014_project_drawings_and_site_inspections.sql
-- Description: المخططات التنفيذية (Shop Drawings)، الزيارات الميدانية والملاحظات
--              (Site Visits & Punch-List Pins)، مقارنة قبل وبعد، ودعم مرفقات فواتير الشراء
-- =============================================================================

DO $preflight$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'rawasi_private') THEN
    RAISE EXCEPTION 'Schema rawasi_private is required.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_company_id') THEN
    RAISE EXCEPTION 'Function rawasi_private.current_company_id() is required.';
  END IF;
END;
$preflight$;

-- 1. جدول المخططات التنفيذية (Shop Drawings) للمشاريع
CREATE TABLE IF NOT EXISTS public.project_drawings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT rawasi_private.current_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  title text NOT NULL,
  drawing_type text NOT NULL DEFAULT 'معماري',
  version text DEFAULT 'Rev-01',
  drawing_url text NOT NULL,
  file_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  CONSTRAINT project_drawings_company_id_uq UNIQUE (id, company_id),
  CONSTRAINT project_drawings_project_fkey FOREIGN KEY (project_id, company_id) REFERENCES public.projects(id, company_id) ON DELETE CASCADE
);

-- 2. جدول الزيارات الميدانية وملاحظات الجودة والمواقع على المخططات (Site Visits & Punch-List Pins)
CREATE TABLE IF NOT EXISTS public.project_site_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT rawasi_private.current_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  drawing_id uuid,
  boq_id uuid REFERENCES public.boq_budget(id) ON DELETE SET NULL,
  title text NOT NULL,
  stage text,
  visit_date date NOT NULL DEFAULT CURRENT_DATE,
  inspector_name text,
  notes text,
  status text NOT NULL DEFAULT 'مفتوحة' CHECK (status IN ('مفتوحة', 'قيد المعالجة', 'تم الإنجاز')),
  photo_before_url text,
  photo_after_url text,
  pin_x numeric(6,2),
  pin_y numeric(6,2),
  pin_color text DEFAULT '#ef4444',
  geo_lat numeric(10,7),
  geo_lng numeric(10,7),
  geo_location_name text,
  boq_item_name text,
  captured_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  CONSTRAINT project_site_visits_company_id_uq UNIQUE (id, company_id),
  CONSTRAINT project_site_visits_project_fkey FOREIGN KEY (project_id, company_id) REFERENCES public.projects(id, company_id) ON DELETE CASCADE,
  CONSTRAINT project_site_visits_drawing_fkey FOREIGN KEY (drawing_id, company_id) REFERENCES public.project_drawings(id, company_id) ON DELETE SET NULL
);

-- 3. إضافة عمود المرفق لفواتير وأوامر الشراء (Purchase Orders & Supplier Invoices)
ALTER TABLE public.supplier_invoices ADD COLUMN IF NOT EXISTS attachment_url text;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS attachment_url text;

-- 4. تسجيل الجداول في حماية العزل متعدد الشركات (Multi-Tenancy Registry)
INSERT INTO rawasi_private.company_scoped_tables(table_name)
VALUES ('project_drawings'), ('project_site_visits')
ON CONFLICT (table_name) DO NOTHING;

-- 5. الفهارس ومحفزات أختام الشركة (Indexes & Triggers)
CREATE INDEX IF NOT EXISTS project_drawings_company_proj_idx
  ON public.project_drawings(company_id, project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS project_site_visits_company_proj_idx
  ON public.project_site_visits(company_id, project_id, visit_date DESC);

CREATE INDEX IF NOT EXISTS project_site_visits_drawing_idx
  ON public.project_site_visits(company_id, drawing_id);

CREATE TRIGGER aa_stamp_company_id
  BEFORE INSERT OR UPDATE OF company_id ON public.project_drawings
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id();

CREATE TRIGGER aa_stamp_company_id
  BEFORE INSERT OR UPDATE OF company_id ON public.project_site_visits
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id();

-- 6. سياسات أمان مستوى الصف (Row Level Security - RLS)
ALTER TABLE public.project_drawings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_site_visits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.project_drawings FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_drawings TO authenticated;
GRANT ALL ON public.project_drawings TO service_role;

REVOKE ALL ON public.project_site_visits FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_site_visits TO authenticated;
GRANT ALL ON public.project_site_visits TO service_role;

CREATE POLICY project_drawings_read ON public.project_drawings
  FOR SELECT TO authenticated
  USING (company_id = rawasi_private.current_company_id());

CREATE POLICY project_drawings_insert ON public.project_drawings
  FOR INSERT TO authenticated
  WITH CHECK (company_id = rawasi_private.current_company_id());

CREATE POLICY project_drawings_update ON public.project_drawings
  FOR UPDATE TO authenticated
  USING (company_id = rawasi_private.current_company_id())
  WITH CHECK (company_id = rawasi_private.current_company_id());

CREATE POLICY project_drawings_delete ON public.project_drawings
  FOR DELETE TO authenticated
  USING (company_id = rawasi_private.current_company_id());

CREATE POLICY project_site_visits_read ON public.project_site_visits
  FOR SELECT TO authenticated
  USING (company_id = rawasi_private.current_company_id());

CREATE POLICY project_site_visits_insert ON public.project_site_visits
  FOR INSERT TO authenticated
  WITH CHECK (company_id = rawasi_private.current_company_id());

CREATE POLICY project_site_visits_update ON public.project_site_visits
  FOR UPDATE TO authenticated
  USING (company_id = rawasi_private.current_company_id())
  WITH CHECK (company_id = rawasi_private.current_company_id());

CREATE POLICY project_site_visits_delete ON public.project_site_visits
  FOR DELETE TO authenticated
  USING (company_id = rawasi_private.current_company_id());

-- 7. هوية النسخ والتحديث اللحظي عبر Supabase Realtime
ALTER TABLE public.project_drawings REPLICA IDENTITY USING INDEX project_drawings_company_id_uq;
ALTER TABLE public.project_site_visits REPLICA IDENTITY USING INDEX project_site_visits_company_id_uq;

DO $rt$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.project_drawings;
    ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.project_site_visits;
  END IF;
END;
$rt$;



-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- FILE: 20261106170015_employee_attendance.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- =============================================================================
-- Migration: 20261106170015_employee_attendance.sql
-- Description: Phase 11 - Employee Attendance (حضور وانصراف الموظفين), 
--              Partner Salaries (مرتبات الموظفين), and Payroll Absence Deductions
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- -----------------------------------------------------------------------------
-- 0. Preflight checks
-- -----------------------------------------------------------------------------
DO $preflight$
BEGIN
  IF to_regclass('public.companies') IS NULL THEN
    RAISE EXCEPTION 'Multi-company system is required before Phase 11.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'rawasi_private') THEN
    RAISE EXCEPTION 'Schema rawasi_private is required.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_company_id') THEN
    RAISE EXCEPTION 'Function rawasi_private.current_company_id() is required.';
  END IF;
END;
$preflight$;

-- -----------------------------------------------------------------------------
-- 1. Table: partner_salaries (سجل رواتب الموظفين الشهرية والبدلات وتاريخ السريان)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partner_salaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT rawasi_private.current_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL,
  basic_salary numeric(15, 2) NOT NULL DEFAULT 0 CHECK (basic_salary >= 0 AND basic_salary < 'Infinity'::numeric),
  allowances numeric(15, 2) NOT NULL DEFAULT 0 CHECK (allowances >= 0 AND allowances < 'Infinity'::numeric),
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  CONSTRAINT partner_salaries_company_id_uq UNIQUE (id, company_id),
  CONSTRAINT partner_salaries_partner_fkey FOREIGN KEY (partner_id, company_id) REFERENCES public.partners(id, company_id) ON DELETE RESTRICT,
  CONSTRAINT partner_salaries_date_order_chk CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

COMMENT ON TABLE public.partner_salaries IS 'سجل رواتب وبدلات الموظفين الشهرية وسجل التغييرات السارية مع تاريخ البداية والنهاية';

-- -----------------------------------------------------------------------------
-- 2. Table: employee_attendance (حضور وانصراف موظفي الشركة الشهريين)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT rawasi_private.current_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL,
  work_date date NOT NULL,
  status text NOT NULL DEFAULT 'حاضر' CHECK (status IN ('حاضر', 'غائب', 'نص يوم', 'إجازة مدفوعة', 'إجازة غير مدفوعة', 'مأمورية', 'عطلة')),
  check_in time,
  check_out time,
  late_minutes integer NOT NULL DEFAULT 0 CHECK (late_minutes >= 0),
  early_leave_minutes integer NOT NULL DEFAULT 0 CHECK (early_leave_minutes >= 0),
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employee_attendance_company_id_uq UNIQUE (id, company_id),
  CONSTRAINT employee_attendance_partner_fkey FOREIGN KEY (partner_id, company_id) REFERENCES public.partners(id, company_id) ON DELETE RESTRICT,
  CONSTRAINT employee_attendance_partner_date_uq UNIQUE (company_id, partner_id, work_date)
);

COMMENT ON TABLE public.employee_attendance IS 'سجل حضور وانصراف الموظفين الشهريين مع حالات الحضور والغياب والإجازات';

-- -----------------------------------------------------------------------------
-- 3. Extend payroll_slips with absence tracking columns
-- -----------------------------------------------------------------------------
ALTER TABLE public.payroll_slips
  ADD COLUMN IF NOT EXISTS absence_days numeric(6, 2) NOT NULL DEFAULT 0 CHECK (absence_days >= 0),
  ADD COLUMN IF NOT EXISTS absence_deduction numeric(15, 2) NOT NULL DEFAULT 0 CHECK (absence_deduction >= 0);

-- -----------------------------------------------------------------------------
-- 4. Multi-tenancy registry & indexes
-- -----------------------------------------------------------------------------
INSERT INTO rawasi_private.company_scoped_tables(table_name)
VALUES ('partner_salaries'), ('employee_attendance')
ON CONFLICT (table_name) DO NOTHING;

CREATE INDEX IF NOT EXISTS partner_salaries_lookup_idx
  ON public.partner_salaries(company_id, partner_id, effective_from DESC);

CREATE INDEX IF NOT EXISTS employee_attendance_lookup_idx
  ON public.employee_attendance(company_id, partner_id, work_date);

CREATE INDEX IF NOT EXISTS employee_attendance_month_idx
  ON public.employee_attendance(company_id, work_date);

-- Stamp company ID triggers
DROP TRIGGER IF EXISTS aa_stamp_company_id ON public.partner_salaries;
CREATE TRIGGER aa_stamp_company_id
  BEFORE INSERT OR UPDATE OF company_id ON public.partner_salaries
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id();

DROP TRIGGER IF EXISTS aa_stamp_company_id ON public.employee_attendance;
CREATE TRIGGER aa_stamp_company_id
  BEFORE INSERT OR UPDATE OF company_id ON public.employee_attendance
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id();

-- -----------------------------------------------------------------------------
-- 5. Business integrity triggers:
--    a) Prevent non-employees ('موظف' only)
--    b) Prevent modifying attendance in posted payroll month
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rawasi_private.trg_validate_employee_partner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_type text;
BEGIN
  SELECT p.partner_type INTO v_type
  FROM public.partners p
  WHERE p.id = NEW.partner_id AND p.company_id = NEW.company_id;

  IF v_type IS NULL THEN
    RAISE EXCEPTION 'الموظف المحدد غير موجود في الشركة النشطة' USING ERRCODE = '23503';
  END IF;

  IF v_type <> 'موظف' THEN
    RAISE EXCEPTION 'هذا السجل مخصص للموظفين بمرتب شهري فقط (نوع الشريك: موظف). العمالة اليومية تسجل في اليوميات.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_val_emp_partner_salary ON public.partner_salaries;
CREATE TRIGGER trg_val_emp_partner_salary
  BEFORE INSERT OR UPDATE OF partner_id, company_id ON public.partner_salaries
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.trg_validate_employee_partner();

DROP TRIGGER IF EXISTS trg_val_emp_attendance ON public.employee_attendance;
CREATE TRIGGER trg_val_emp_attendance
  BEFORE INSERT OR UPDATE OF partner_id, company_id ON public.employee_attendance
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.trg_validate_employee_partner();

-- Lock attendance if payroll is posted
CREATE OR REPLACE FUNCTION rawasi_private.trg_lock_attendance_on_posted_payroll()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_partner_id uuid;
  v_work_date date;
  v_target_month text;
  v_is_locked boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_partner_id := OLD.partner_id;
    v_work_date := OLD.work_date;
  ELSE
    v_partner_id := NEW.partner_id;
    v_work_date := NEW.work_date;
  END IF;

  v_target_month := to_char(v_work_date, 'YYYY-MM');

  SELECT EXISTS (
    SELECT 1 FROM public.payroll_slips ps
    WHERE ps.emp_id = v_partner_id
      AND ps.month = v_target_month
      AND ps.is_posted = true
  ) INTO v_is_locked;

  IF v_is_locked THEN
    RAISE EXCEPTION 'لا يمكن تعديل أو حذف أو إضافة سجل حضور في شهر (%s) تم اعتماد وترحيل مسيره المالي.', v_target_month
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_attendance_posted ON public.employee_attendance;
CREATE TRIGGER trg_lock_attendance_posted
  BEFORE INSERT OR UPDATE OR DELETE ON public.employee_attendance
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.trg_lock_attendance_on_posted_payroll();

-- -----------------------------------------------------------------------------
-- 6. Row-Level Security (RLS)
-- -----------------------------------------------------------------------------
ALTER TABLE public.partner_salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_attendance ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.partner_salaries FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_salaries TO authenticated;
GRANT ALL ON public.partner_salaries TO service_role;

REVOKE ALL ON public.employee_attendance FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_attendance TO authenticated;
GRANT ALL ON public.employee_attendance TO service_role;

-- Policies for partner_salaries (Controlled under payroll or attendance or admin)
DROP POLICY IF EXISTS partner_salaries_read ON public.partner_salaries;
CREATE POLICY partner_salaries_read ON public.partner_salaries
  FOR SELECT TO authenticated
  USING (
    company_id = rawasi_private.current_company_id()
    AND (
      rawasi_private.can_access('payroll', 'view')
      OR rawasi_private.can_access('attendance', 'view')
      OR rawasi_private.can_access('team', 'view')
      OR rawasi_private.is_admin()
    )
  );

DROP POLICY IF EXISTS partner_salaries_insert ON public.partner_salaries;
CREATE POLICY partner_salaries_insert ON public.partner_salaries
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = rawasi_private.current_company_id()
    AND (
      rawasi_private.can_access('payroll', 'create')
      OR rawasi_private.can_access('team', 'edit')
      OR rawasi_private.is_admin()
    )
  );

DROP POLICY IF EXISTS partner_salaries_update ON public.partner_salaries;
CREATE POLICY partner_salaries_update ON public.partner_salaries
  FOR UPDATE TO authenticated
  USING (
    company_id = rawasi_private.current_company_id()
    AND (
      rawasi_private.can_access('payroll', 'edit')
      OR rawasi_private.can_access('team', 'edit')
      OR rawasi_private.is_admin()
    )
  )
  WITH CHECK (
    company_id = rawasi_private.current_company_id()
    AND (
      rawasi_private.can_access('payroll', 'edit')
      OR rawasi_private.can_access('team', 'edit')
      OR rawasi_private.is_admin()
    )
  );

DROP POLICY IF EXISTS partner_salaries_delete ON public.partner_salaries;
CREATE POLICY partner_salaries_delete ON public.partner_salaries
  FOR DELETE TO authenticated
  USING (
    company_id = rawasi_private.current_company_id()
    AND (
      rawasi_private.can_access('payroll', 'delete')
      OR rawasi_private.is_admin()
    )
  );

-- Policies for employee_attendance (Module: 'attendance')
DROP POLICY IF EXISTS employee_attendance_read ON public.employee_attendance;
CREATE POLICY employee_attendance_read ON public.employee_attendance
  FOR SELECT TO authenticated
  USING (
    company_id = rawasi_private.current_company_id()
    AND (
      rawasi_private.can_access('attendance', 'view')
      OR rawasi_private.can_access('payroll', 'view')
      OR rawasi_private.is_admin()
    )
  );

DROP POLICY IF EXISTS employee_attendance_insert ON public.employee_attendance;
CREATE POLICY employee_attendance_insert ON public.employee_attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = rawasi_private.current_company_id()
    AND (
      rawasi_private.can_access('attendance', 'create')
      OR rawasi_private.can_access('payroll', 'create')
      OR rawasi_private.is_admin()
    )
  );

DROP POLICY IF EXISTS employee_attendance_update ON public.employee_attendance;
CREATE POLICY employee_attendance_update ON public.employee_attendance
  FOR UPDATE TO authenticated
  USING (
    company_id = rawasi_private.current_company_id()
    AND (
      rawasi_private.can_access('attendance', 'edit')
      OR rawasi_private.can_access('payroll', 'edit')
      OR rawasi_private.is_admin()
    )
  )
  WITH CHECK (
    company_id = rawasi_private.current_company_id()
    AND (
      rawasi_private.can_access('attendance', 'edit')
      OR rawasi_private.can_access('payroll', 'edit')
      OR rawasi_private.is_admin()
    )
  );

DROP POLICY IF EXISTS employee_attendance_delete ON public.employee_attendance;
CREATE POLICY employee_attendance_delete ON public.employee_attendance
  FOR DELETE TO authenticated
  USING (
    company_id = rawasi_private.current_company_id()
    AND (
      rawasi_private.can_access('attendance', 'delete')
      OR rawasi_private.can_access('payroll', 'delete')
      OR rawasi_private.is_admin()
    )
  );

-- -----------------------------------------------------------------------------
-- 7. Calculation Function: get_employee_absence_summary
--    حساب ملخص الحضور والغياب والخصومات حسب المعيار المعتمد (الراتب ÷ 30 يوماً)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_employee_absence_summary(
  p_partner_id uuid,
  p_month text,
  p_cutoff_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  partner_id uuid,
  month text,
  cutoff_date date,
  basic_salary numeric,
  allowances numeric,
  daily_rate numeric,
  days_present numeric,
  days_absent numeric,
  days_half numeric,
  days_paid_leave numeric,
  days_unpaid_leave numeric,
  days_mission numeric,
  days_holiday numeric,
  days_weekend numeric,
  unrecorded_days numeric,
  total_absence_days numeric,
  absence_deduction numeric,
  is_locked boolean
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_cid uuid := rawasi_private.current_company_id();
  v_start_date date;
  v_end_of_month date;
  v_effective_cutoff date;
  v_basic_salary numeric := 0;
  v_allowances numeric := 0;
  v_daily_rate numeric := 0;
  v_days_present numeric := 0;
  v_days_absent numeric := 0;
  v_days_half numeric := 0;
  v_days_paid_leave numeric := 0;
  v_days_unpaid_leave numeric := 0;
  v_days_mission numeric := 0;
  v_days_holiday numeric := 0;
  v_days_weekend numeric := 0;
  v_unrecorded_days numeric := 0;
  v_total_absence_days numeric := 0;
  v_total_deduction numeric := 0;
  v_is_locked boolean := false;
  v_cur_day date;
  v_rec record;
  v_day_salary numeric;
  v_day_rate numeric;
BEGIN
  IF p_partner_id IS NULL OR p_month IS NULL OR p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'معاملات الموظف والشهر غير صحيحة' USING ERRCODE = '23514';
  END IF;

  -- 1. Validate employee belongs to active company
  PERFORM 1 FROM public.partners p
  WHERE p.id = p_partner_id AND p.company_id = v_cid AND p.partner_type = 'موظف';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الموظف غير موجود أو ليس موظفاً شهرياً في الشركة الحالية' USING ERRCODE = '23503';
  END IF;

  v_start_date := (p_month || '-01')::date;
  v_end_of_month := (v_start_date + interval '1 month - 1 day')::date;
  v_effective_cutoff := LEAST(COALESCE(p_cutoff_date, v_end_of_month), v_end_of_month);

  -- Check if month is locked
  SELECT COALESCE(ps.is_posted, false) INTO v_is_locked
  FROM public.payroll_slips ps
  WHERE ps.emp_id = p_partner_id AND ps.month = p_month;
  v_is_locked := COALESCE(v_is_locked, false);

  -- 2. Fetch current/latest salary for the employee
  SELECT ps.basic_salary, ps.allowances
  INTO v_basic_salary, v_allowances
  FROM public.partner_salaries ps
  WHERE ps.company_id = v_cid
    AND ps.partner_id = p_partner_id
    AND ps.is_active = true
    AND ps.effective_from <= v_effective_cutoff
    AND (ps.effective_to IS NULL OR ps.effective_to >= v_start_date)
  ORDER BY ps.effective_from DESC, ps.created_at DESC
  LIMIT 1;

  -- Fallback to existing payroll slip draft if partner_salaries not yet created for this employee
  IF v_basic_salary IS NULL OR v_basic_salary = 0 THEN
    SELECT COALESCE(ps.basic_salary, 0), COALESCE(ps.allowances, 0)
    INTO v_basic_salary, v_allowances
    FROM public.payroll_slips ps
    WHERE ps.emp_id = p_partner_id AND ps.month = p_month;
  END IF;

  v_basic_salary := COALESCE(v_basic_salary, 0);
  v_allowances := COALESCE(v_allowances, 0);
  -- Standard Saudi Labor base: salary / 30
  v_daily_rate := ROUND(v_basic_salary / 30.0, 4);

  -- 3. Iterate over calendar days up to cutoff date
  v_cur_day := v_start_date;
  WHILE v_cur_day <= v_effective_cutoff LOOP
    -- Determine day salary rate if mid-month change occurred
    SELECT ps.basic_salary INTO v_day_salary
    FROM public.partner_salaries ps
    WHERE ps.company_id = v_cid
      AND ps.partner_id = p_partner_id
      AND ps.is_active = true
      AND ps.effective_from <= v_cur_day
      AND (ps.effective_to IS NULL OR ps.effective_to >= v_cur_day)
    ORDER BY ps.effective_from DESC, ps.created_at DESC
    LIMIT 1;

    v_day_rate := ROUND(COALESCE(v_day_salary, v_basic_salary) / 30.0, 4);

    -- Find attendance record for current day
    SELECT ea.status INTO v_rec
    FROM public.employee_attendance ea
    WHERE ea.company_id = v_cid
      AND ea.partner_id = p_partner_id
      AND ea.work_date = v_cur_day;

    IF v_rec.status IS NOT NULL THEN
      CASE v_rec.status
        WHEN 'حاضر' THEN
          v_days_present := v_days_present + 1;
        WHEN 'غائب' THEN
          v_days_absent := v_days_absent + 1;
          v_total_deduction := v_total_deduction + v_day_rate;
        WHEN 'نص يوم' THEN
          v_days_half := v_days_half + 1;
          v_total_deduction := v_total_deduction + ROUND(v_day_rate * 0.5, 4);
        WHEN 'إجازة مدفوعة' THEN
          v_days_paid_leave := v_days_paid_leave + 1;
        WHEN 'إجازة غير مدفوعة' THEN
          v_days_unpaid_leave := v_days_unpaid_leave + 1;
          v_total_deduction := v_total_deduction + v_day_rate;
        WHEN 'مأمورية' THEN
          v_days_mission := v_days_mission + 1;
        WHEN 'عطلة' THEN
          v_days_holiday := v_days_holiday + 1;
        ELSE
          v_days_present := v_days_present + 1;
      END CASE;
    ELSE
      -- No explicit record. If Friday (isodow = 5), treat as rest day without deduction
      IF extract(isodow from v_cur_day) = 5 THEN
        v_days_weekend := v_days_weekend + 1;
      ELSE
        v_unrecorded_days := v_unrecorded_days + 1;
      END IF;
    END IF;

    v_cur_day := v_cur_day + interval '1 day';
  END LOOP;

  v_total_absence_days := (v_days_absent * 1.0) + (v_days_half * 0.5) + (v_days_unpaid_leave * 1.0);
  v_total_deduction := ROUND(v_total_deduction, 2);

  RETURN QUERY SELECT
    p_partner_id,
    p_month,
    v_effective_cutoff,
    v_basic_salary,
    v_allowances,
    ROUND(v_daily_rate, 2),
    v_days_present,
    v_days_absent,
    v_days_half,
    v_days_paid_leave,
    v_days_unpaid_leave,
    v_days_mission,
    v_days_holiday,
    v_days_weekend,
    v_unrecorded_days,
    v_total_absence_days,
    v_total_deduction,
    v_is_locked;
END;
$$;

-- -----------------------------------------------------------------------------
-- 8. Bulk Company Attendance Fetcher (for monthly UI grid)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_company_monthly_attendance(
  p_month text,
  p_cutoff_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_cid uuid := rawasi_private.current_company_id();
  v_start_date date;
  v_end_of_month date;
  v_effective_cutoff date;
  v_days_in_month integer;
  v_result jsonb;
BEGIN
  IF p_month IS NULL OR p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'تنسيق الشهر غير صالح' USING ERRCODE = '23514';
  END IF;

  v_start_date := (p_month || '-01')::date;
  v_end_of_month := (v_start_date + interval '1 month - 1 day')::date;
  v_effective_cutoff := LEAST(COALESCE(p_cutoff_date, v_end_of_month), v_end_of_month);
  v_days_in_month := extract(day from v_end_of_month)::integer;

  WITH emp_list AS (
    SELECT p.id, p.name, p.job_role, p.identity_number, p.phone
    FROM public.partners p
    WHERE p.company_id = v_cid
      AND p.partner_type = 'موظف'
      AND COALESCE(p.is_active, true) = true
    ORDER BY p.name, p.id
  ),
  emp_summaries AS (
    SELECT e.id AS emp_id,
           s.*
    FROM emp_list e
    CROSS JOIN LATERAL public.get_employee_absence_summary(e.id, p_month, v_effective_cutoff) s
  ),
  attendance_data AS (
    SELECT ea.partner_id,
           jsonb_agg(
             jsonb_build_object(
               'day', extract(day from ea.work_date)::integer,
               'date', to_char(ea.work_date, 'YYYY-MM-DD'),
               'status', ea.status,
               'check_in', to_char(ea.check_in, 'HH24:MI'),
               'check_out', to_char(ea.check_out, 'HH24:MI'),
               'late_minutes', ea.late_minutes,
               'early_leave_minutes', ea.early_leave_minutes,
               'notes', ea.notes
             ) ORDER BY ea.work_date
           ) AS records
    FROM public.employee_attendance ea
    WHERE ea.company_id = v_cid
      AND to_char(ea.work_date, 'YYYY-MM') = p_month
    GROUP BY ea.partner_id
  )
  SELECT jsonb_build_object(
    'month', p_month,
    'cutoff_date', to_char(v_effective_cutoff, 'YYYY-MM-DD'),
    'days_in_month', v_days_in_month,
    'employees', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', e.id,
            'name', e.name,
            'job_role', e.job_role,
            'identity_number', e.identity_number,
            'phone', e.phone,
            'summary', to_jsonb(s),
            'attendance', COALESCE(ad.records, '[]'::jsonb)
          ) ORDER BY e.name
        )
        FROM emp_list e
        LEFT JOIN emp_summaries s ON s.emp_id = e.id
        LEFT JOIN attendance_data ad ON ad.partner_id = e.id
      ),
      '[]'::jsonb
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- -----------------------------------------------------------------------------
-- 9. Quick Actions: mark unrecorded days & set public holiday
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_unrecorded_days(
  p_month text,
  p_cutoff_date date DEFAULT CURRENT_DATE,
  p_target_status text DEFAULT 'حاضر'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_cid uuid := rawasi_private.current_company_id();
  v_start_date date;
  v_end_of_month date;
  v_effective_cutoff date;
  v_cur_day date;
  v_emp record;
  v_inserted integer := 0;
BEGIN
  IF NOT rawasi_private.can_access('attendance', 'create') AND NOT rawasi_private.is_admin() THEN
    RAISE EXCEPTION 'لا توجد صلاحية تسجيل الحضور' USING ERRCODE = '42501';
  END IF;

  IF p_target_status NOT IN ('حاضر', 'غائب', 'إجازة مدفوعة', 'عطلة') THEN
    RAISE EXCEPTION 'الحالة المستهدفة غير صالحة' USING ERRCODE = '23514';
  END IF;

  v_start_date := (p_month || '-01')::date;
  v_end_of_month := (v_start_date + interval '1 month - 1 day')::date;
  v_effective_cutoff := LEAST(COALESCE(p_cutoff_date, v_end_of_month), v_end_of_month);

  FOR v_emp IN
    SELECT p.id FROM public.partners p
    WHERE p.company_id = v_cid AND p.partner_type = 'موظف' AND COALESCE(p.is_active, true) = true
  LOOP
    -- Check if employee month is locked
    IF EXISTS (
      SELECT 1 FROM public.payroll_slips ps
      WHERE ps.emp_id = v_emp.id AND ps.month = p_month AND ps.is_posted = true
    ) THEN
      CONTINUE; -- Skip locked employees
    END IF;

    v_cur_day := v_start_date;
    WHILE v_cur_day <= v_effective_cutoff LOOP
      -- If not Friday and not already registered, insert default status
      IF extract(isodow from v_cur_day) <> 5 THEN
        INSERT INTO public.employee_attendance (
          company_id, partner_id, work_date, status, notes
        )
        VALUES (
          v_cid, v_emp.id, v_cur_day, p_target_status, 'تسجيل سريع آلي'
        )
        ON CONFLICT (company_id, partner_id, work_date) DO NOTHING;

        IF FOUND THEN
          v_inserted := v_inserted + 1;
        END IF;
      END IF;
      v_cur_day := v_cur_day + interval '1 day';
    END LOOP;
  END LOOP;

  RETURN v_inserted;
END;
$$;

-- -----------------------------------------------------------------------------
-- 10. Update save_payroll_drafts & save_and_post_payroll
--     لدعم خصم الغياب المحسوب وقيد الاستحقاق الصافي بدقة
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_payroll_drafts(
  p_month text,
  p_cutoff_date date,
  p_rows jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  r record;
  saved integer := 0;
  existing public.payroll_slips%ROWTYPE;
  found_existing boolean;
  first_day date;
  opening numeric;
  deductions numeric;
  advances numeric;
  net numeric;
  v_absence_days numeric;
  v_absence_deduction numeric;
BEGIN
  IF p_month IS NULL OR p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' OR p_cutoff_date IS NULL
    OR p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RAISE EXCEPTION 'بيانات مسودة الرواتب غير صحيحة' USING ERRCODE = '23514';
  END IF;

  first_day := (p_month || '-01')::date;
  IF p_cutoff_date < first_day OR p_cutoff_date > (first_day + interval '1 month - 1 day')::date THEN
    RAISE EXCEPTION 'تاريخ القطع خارج الشهر المحدد' USING ERRCODE = '23514';
  END IF;

  IF NOT rawasi_private.can_access('payroll', 'view') OR NOT rawasi_private.can_access('partners', 'view')
    OR NOT rawasi_private.can_access('journal', 'view') OR NOT rawasi_private.can_access('payments', 'view')
    OR NOT rawasi_private.can_access('violations', 'view') THEN
    RAISE EXCEPTION 'يلزم عرض الموظفين والمسير والحركات المرتبطة لحساب الرصيد' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM jsonb_to_recordset(p_rows) AS x(emp_id uuid) GROUP BY emp_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'الموظف مكرر في الاختيار' USING ERRCODE = '23514';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('rawasi:payroll:' || p_month, 0));

  FOR r IN SELECT * FROM jsonb_to_recordset(p_rows) AS x(
    emp_id uuid,
    basic_salary numeric,
    allowances numeric,
    amount_to_pay numeric,
    status text,
    absence_days numeric,
    absence_deduction numeric
  ) ORDER BY emp_id LOOP

    IF r.emp_id IS NULL OR r.basic_salary IS NULL OR r.allowances IS NULL OR r.amount_to_pay IS NULL
      OR r.basic_salary < 0 OR r.allowances < 0 OR r.amount_to_pay < 0
      OR r.basic_salary >= 'Infinity'::numeric OR r.allowances >= 'Infinity'::numeric OR r.amount_to_pay >= 'Infinity'::numeric THEN
      RAISE EXCEPTION 'بيانات الراتب والبدلات والصرف يجب أن تكون مبالغ صحيحة غير سالبة' USING ERRCODE = '23514';
    END IF;

    PERFORM 1 FROM public.partners WHERE id = r.emp_id AND partner_type = 'موظف';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'الحفظ والترحيل هنا للموظفين الشهريين فقط' USING ERRCODE = '23514';
    END IF;

    SELECT * INTO existing FROM public.payroll_slips WHERE emp_id = r.emp_id AND month = p_month FOR UPDATE;
    found_existing := FOUND;

    IF found_existing AND (existing.is_posted OR existing.journal_header_id IS NOT NULL OR
      EXISTS (SELECT 1 FROM public.journal_headers WHERE reference_id = existing.id)) THEN
      RAISE EXCEPTION 'أحد الرواتب مرحل؛ يجب فك ترحيله قبل الحفظ' USING ERRCODE = '23514';
    END IF;

    IF (found_existing AND NOT rawasi_private.can_access('payroll', 'edit')) OR
      (NOT found_existing AND NOT rawasi_private.can_access('payroll', 'create')) THEN
      RAISE EXCEPTION 'لا توجد صلاحية حفظ الراتب' USING ERRCODE = '42501';
    END IF;

    v_absence_days := COALESCE(r.absence_days, 0);
    v_absence_deduction := COALESCE(r.absence_deduction, 0);

    SELECT COALESCE(SUM(credit - debit), 0) INTO opening
    FROM public.partner_statement_ledger
    WHERE partner_id = r.emp_id AND transaction_date < first_day;

    SELECT total_violations, total_payments INTO deductions, advances
    FROM public.pull_payroll_module_data(extract(month from first_day)::integer, extract(year from first_day)::integer, p_cutoff_date)
    WHERE partner_id = r.emp_id;

    -- Net = opening + basic_salary - absence_deduction + allowances - violations - advances
    net := opening + r.basic_salary - v_absence_deduction + r.allowances - COALESCE(deductions, 0) - COALESCE(advances, 0);

    IF r.amount_to_pay > GREATEST(net, 0) THEN
      RAISE EXCEPTION 'مبلغ الصرف المخطط أكبر من الرصيد المتاح' USING ERRCODE = '23514';
    END IF;

    IF r.status IS NULL OR r.status NOT IN ('غير مدفوع', 'مدفوع') THEN
      RAISE EXCEPTION 'حالة المسير غير صحيحة' USING ERRCODE = '23514';
    END IF;

    IF found_existing THEN
      UPDATE public.payroll_slips
      SET basic_salary = r.basic_salary,
          allowances = r.allowances,
          absence_days = v_absence_days,
          absence_deduction = v_absence_deduction,
          total_advances = COALESCE(advances, 0),
          total_deductions = COALESCE(deductions, 0),
          previous_balance = opening,
          net_salary = net,
          amount_to_pay = r.amount_to_pay,
          status = r.status,
          cutoff_date = p_cutoff_date
      WHERE id = existing.id;
    ELSE
      INSERT INTO public.payroll_slips (
        emp_id, month, basic_salary, allowances, absence_days, absence_deduction,
        total_advances, total_deductions, previous_balance,
        net_salary, amount_to_pay, status, cutoff_date, is_posted
      )
      VALUES (
        r.emp_id, p_month, r.basic_salary, r.allowances, v_absence_days, v_absence_deduction,
        COALESCE(advances, 0), COALESCE(deductions, 0), opening,
        net, r.amount_to_pay, r.status, p_cutoff_date, false
      );
    END IF;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'تعذر حفظ الراتب؛ راجع الصلاحيات' USING ERRCODE = '42501';
    END IF;

    saved := saved + 1;
  END LOOP;

  RETURN saved;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_and_post_payroll(
  p_month text,
  p_cutoff_date date,
  p_rows jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  s public.payroll_slips%ROWTYPE;
  expense_account uuid;
  liability_account uuid;
  header uuid;
  posted integer := 0;
  v_net_entitlement numeric;
BEGIN
  IF NOT rawasi_private.can_access('payroll', 'edit') OR NOT rawasi_private.can_access('journal', 'create')
    OR NOT rawasi_private.can_access('accounts', 'view') THEN
    RAISE EXCEPTION 'لا توجد صلاحية ترحيل الرواتب' USING ERRCODE = '42501';
  END IF;

  PERFORM public.save_payroll_drafts(p_month, p_cutoff_date, p_rows);

  expense_account := rawasi_private.require_company_account('512');
  liability_account := rawasi_private.require_company_account('216');

  FOR s IN SELECT p.* FROM public.payroll_slips p
    WHERE p.month = p_month AND p.emp_id IN (SELECT x.emp_id FROM jsonb_to_recordset(p_rows) AS x(emp_id uuid))
    ORDER BY p.emp_id FOR UPDATE LOOP

    v_net_entitlement := s.basic_salary - COALESCE(s.absence_deduction, 0) + COALESCE(s.allowances, 0);

    IF v_net_entitlement <= 0 THEN
      RAISE EXCEPTION 'لا يمكن ترحيل راتب بلا استحقاق موجب بعد خصم الغياب والبدلات' USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.labor_daily_logs l
      WHERE l.worker_partner_id = s.emp_id AND l.is_posted
        AND to_char(l.work_date, 'YYYY-MM') = p_month AND l.daily_wage > 0
    ) THEN
      RAISE EXCEPTION 'الموظف له يوميات مرحلة في الشهر؛ صحح التصنيف أو الاستحقاق لتجنب تكرار المصروف' USING ERRCODE = '23514';
    END IF;

    INSERT INTO public.journal_headers(entry_date, description, status, v_type, reference_id)
    VALUES (
      p_cutoff_date,
      'استحقاق راتب شهري ' || p_month || ' بعد خصم الغياب (' || COALESCE(s.absence_deduction, 0) || ' ر.س)',
      'posted',
      'payroll_slips',
      s.id
    ) RETURNING id INTO header;

    INSERT INTO public.journal_lines(header_id, account_id, partner_id, debit, credit, notes)
    VALUES (
      header, expense_account, NULL, v_net_entitlement, 0,
      'مصروف الراتب والبدلات بعد خصم الغياب (' || COALESCE(s.absence_deduction, 0) || ' ر.س)'
    ), (
      header, liability_account, s.emp_id, 0, v_net_entitlement,
      'استحقاق الموظف بعد خصم الغياب؛ السلف والجزاءات من شاشاتها'
    );

    UPDATE public.payroll_slips
    SET is_posted = true, journal_header_id = header
    WHERE id = s.id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'تعذر تحديث حالة الراتب' USING ERRCODE = '42501';
    END IF;

    posted := posted + 1;
  END LOOP;

  IF posted = 0 THEN
    RAISE EXCEPTION 'لم يتم ترحيل أي راتب' USING ERRCODE = '23514';
  END IF;

  RETURN posted;
END;
$$;

-- -----------------------------------------------------------------------------
-- 11. Realtime Publication
-- -----------------------------------------------------------------------------
DO $rt$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.partner_salaries;
    ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.employee_attendance;
  END IF;
END;
$rt$;

COMMIT;



-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- FILE: 20261106200016_smart_attendance_devices.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- =============================================================================
-- Migration: 20261106200016_smart_attendance_devices.sql
-- Description: Phase 12 - Smart Anti-Fraud Attendance System (نظام البصمة الذكية)
--              1:1 Device Binding, Biometric Punch Logs, Geofencing, and
--              Automatic Synchronization with employee_attendance.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- -----------------------------------------------------------------------------
-- 0. Preflight checks
-- -----------------------------------------------------------------------------
DO $preflight$
BEGIN
  IF to_regclass('public.companies') IS NULL THEN
    RAISE EXCEPTION 'Multi-company system is required before Phase 12.';
  END IF;
  IF to_regclass('public.employee_attendance') IS NULL THEN
    RAISE EXCEPTION 'employee_attendance table (Phase 11) is required before Phase 12.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'rawasi_private') THEN
    RAISE EXCEPTION 'Schema rawasi_private is required.';
  END IF;
END;
$preflight$;

-- -----------------------------------------------------------------------------
-- 1. Extend partners table with 1:1 Device Binding hardware columns
-- -----------------------------------------------------------------------------
ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS device_id text,
  ADD COLUMN IF NOT EXISTS device_name text,
  ADD COLUMN IF NOT EXISTS device_os text,
  ADD COLUMN IF NOT EXISTS device_bound_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_device_locked boolean NOT NULL DEFAULT true;

-- Strict 1:1 hardware lock: a device cannot be actively bound to multiple employees in the same company
CREATE UNIQUE INDEX IF NOT EXISTS partners_company_device_uq
  ON public.partners (company_id, device_id)
  WHERE device_id IS NOT NULL AND is_device_locked = true AND partner_type = 'موظف';

-- -----------------------------------------------------------------------------
-- 2. Table: attendance_devices (سجل توثيق وتاريخ الأجهزة المعتمدة والمفكوكة)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT rawasi_private.current_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL,
  device_id text NOT NULL,
  device_name text,
  device_os text,
  app_version text,
  bound_at timestamptz NOT NULL DEFAULT now(),
  unbound_at timestamptz,
  unbound_by uuid DEFAULT auth.uid(),
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_devices_company_id_uq UNIQUE (id, company_id),
  CONSTRAINT attendance_devices_partner_fkey FOREIGN KEY (partner_id, company_id) REFERENCES public.partners(id, company_id) ON DELETE RESTRICT
);

COMMENT ON TABLE public.attendance_devices IS 'سجل توثيق واعتماد وفك ارتباط هواتف الموظفين لمنع التلاعب';

-- -----------------------------------------------------------------------------
-- 3. Table: attendance_logs (سجل بصمات الحضور والانصراف الحية مع السيلفي والموقع)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT rawasi_private.current_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL,
  project_id uuid,
  punch_type text NOT NULL CHECK (punch_type IN ('in', 'out', 'حضور', 'انصراف')),
  punch_time timestamptz NOT NULL DEFAULT now(),
  device_id text NOT NULL,
  device_name text,
  selfie_url text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  distance_meters numeric(10, 2),
  is_mocked boolean NOT NULL DEFAULT false,
  verification_status text NOT NULL DEFAULT 'verified' CHECK (verification_status IN ('verified', 'flagged', 'rejected', 'manual_approved')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_logs_company_id_uq UNIQUE (id, company_id),
  CONSTRAINT attendance_logs_partner_fkey FOREIGN KEY (partner_id, company_id) REFERENCES public.partners(id, company_id) ON DELETE RESTRICT,
  CONSTRAINT attendance_logs_project_fkey FOREIGN KEY (project_id, company_id) REFERENCES public.projects(id, company_id) ON DELETE SET NULL
);

COMMENT ON TABLE public.attendance_logs IS 'سجل عمليات التبصيم الحية اليومية مع الصور السيلفي وإحداثيات الموقع وفحص التزييف';

-- -----------------------------------------------------------------------------
-- 4. Multi-tenancy registry & indexes
-- -----------------------------------------------------------------------------
INSERT INTO rawasi_private.company_scoped_tables(table_name)
VALUES ('attendance_devices'), ('attendance_logs')
ON CONFLICT (table_name) DO NOTHING;

CREATE INDEX IF NOT EXISTS attendance_devices_lookup_idx
  ON public.attendance_devices(company_id, partner_id, is_active);

CREATE INDEX IF NOT EXISTS attendance_logs_emp_date_idx
  ON public.attendance_logs(company_id, partner_id, punch_time DESC);

CREATE INDEX IF NOT EXISTS attendance_logs_company_time_idx
  ON public.attendance_logs(company_id, punch_time DESC);

-- Automatic company ID stamping triggers
DROP TRIGGER IF EXISTS aa_stamp_company_id ON public.attendance_devices;
CREATE TRIGGER aa_stamp_company_id
  BEFORE INSERT OR UPDATE OF company_id ON public.attendance_devices
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id();

DROP TRIGGER IF EXISTS aa_stamp_company_id ON public.attendance_logs;
CREATE TRIGGER aa_stamp_company_id
  BEFORE INSERT OR UPDATE OF company_id ON public.attendance_logs
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id();

-- -----------------------------------------------------------------------------
-- 5. Business integrity: Employee Partner Validation
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_val_emp_attendance_device ON public.attendance_devices;
CREATE TRIGGER trg_val_emp_attendance_device
  BEFORE INSERT OR UPDATE OF partner_id, company_id ON public.attendance_devices
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.trg_validate_employee_partner();

DROP TRIGGER IF EXISTS trg_val_emp_attendance_log ON public.attendance_logs;
CREATE TRIGGER trg_val_emp_attendance_log
  BEFORE INSERT OR UPDATE OF partner_id, company_id ON public.attendance_logs
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.trg_validate_employee_partner();

-- -----------------------------------------------------------------------------
-- 6. Trigger: Auto-synchronize verified mobile punch with employee_attendance
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rawasi_private.trg_sync_punch_to_attendance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_work_date date;
  v_time time;
  v_target_month text;
  v_is_locked boolean;
  v_existing_id uuid;
BEGIN
  -- Only synchronize verified or manual approved punches
  IF NEW.verification_status NOT IN ('verified', 'manual_approved') THEN
    RETURN NEW;
  END IF;

  -- Compute local Saudi date & time (UTC+3)
  v_work_date := (NEW.punch_time AT TIME ZONE 'Asia/Riyadh')::date;
  v_time := (NEW.punch_time AT TIME ZONE 'Asia/Riyadh')::time;
  v_target_month := to_char(v_work_date, 'YYYY-MM');

  -- Check if monthly payroll is already posted for this employee
  SELECT EXISTS (
    SELECT 1 FROM public.payroll_slips ps
    WHERE ps.emp_id = NEW.partner_id
      AND ps.month = v_target_month
      AND ps.is_posted = true
  ) INTO v_is_locked;

  IF v_is_locked THEN
    -- If payroll is posted, log without raising exception so punch is recorded in logs but not altering closed ledger
    RETURN NEW;
  END IF;

  SELECT ea.id INTO v_existing_id
  FROM public.employee_attendance ea
  WHERE ea.company_id = NEW.company_id
    AND ea.partner_id = NEW.partner_id
    AND ea.work_date = v_work_date;

  IF NEW.punch_type IN ('in', 'حضور') THEN
    IF v_existing_id IS NOT NULL THEN
      UPDATE public.employee_attendance
      SET check_in = COALESCE(check_in, v_time),
          status = CASE WHEN status = 'غائب' THEN 'حاضر' ELSE status END,
          updated_at = now()
      WHERE id = v_existing_id;
    ELSE
      INSERT INTO public.employee_attendance (
        company_id, partner_id, work_date, status, check_in, notes
      )
      VALUES (
        NEW.company_id, NEW.partner_id, v_work_date, 'حاضر', v_time, 'بصمة ذكية - هاتف معتمد'
      )
      ON CONFLICT (company_id, partner_id, work_date)
      DO UPDATE SET
        check_in = COALESCE(public.employee_attendance.check_in, EXCLUDED.check_in),
        status = CASE WHEN public.employee_attendance.status = 'غائب' THEN 'حاضر' ELSE public.employee_attendance.status END,
        updated_at = now();
    END IF;
  ELSIF NEW.punch_type IN ('out', 'انصراف') THEN
    IF v_existing_id IS NOT NULL THEN
      UPDATE public.employee_attendance
      SET check_out = v_time,
          updated_at = now()
      WHERE id = v_existing_id;
    ELSE
      INSERT INTO public.employee_attendance (
        company_id, partner_id, work_date, status, check_out, notes
      )
      VALUES (
        NEW.company_id, NEW.partner_id, v_work_date, 'حاضر', v_time, 'بصمة انصراف ذكية'
      )
      ON CONFLICT (company_id, partner_id, work_date)
      DO UPDATE SET
        check_out = EXCLUDED.check_out,
        updated_at = now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_attendance_punch ON public.attendance_logs;
CREATE TRIGGER trg_sync_attendance_punch
  AFTER INSERT ON public.attendance_logs
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.trg_sync_punch_to_attendance();

-- -----------------------------------------------------------------------------
-- 7. Row-Level Security (RLS)
-- -----------------------------------------------------------------------------
ALTER TABLE public.attendance_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.attendance_devices FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_devices TO authenticated;
GRANT ALL ON public.attendance_devices TO service_role;

REVOKE ALL ON public.attendance_logs FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_logs TO authenticated;
GRANT ALL ON public.attendance_logs TO service_role;

-- Policies for attendance_devices
DROP POLICY IF EXISTS attendance_devices_select ON public.attendance_devices;
CREATE POLICY attendance_devices_select ON public.attendance_devices
  FOR SELECT TO authenticated
  USING (
    company_id = rawasi_private.current_company_id()
    AND (
      rawasi_private.can_access('attendance', 'view')
      OR rawasi_private.can_access('team', 'view')
      OR rawasi_private.is_admin()
    )
  );

DROP POLICY IF EXISTS attendance_devices_modify ON public.attendance_devices;
CREATE POLICY attendance_devices_modify ON public.attendance_devices
  FOR ALL TO authenticated
  USING (
    company_id = rawasi_private.current_company_id()
    AND (
      rawasi_private.can_access('attendance', 'edit')
      OR rawasi_private.is_admin()
    )
  )
  WITH CHECK (
    company_id = rawasi_private.current_company_id()
    AND (
      rawasi_private.can_access('attendance', 'edit')
      OR rawasi_private.is_admin()
    )
  );

-- Policies for attendance_logs
DROP POLICY IF EXISTS attendance_logs_select ON public.attendance_logs;
CREATE POLICY attendance_logs_select ON public.attendance_logs
  FOR SELECT TO authenticated
  USING (
    company_id = rawasi_private.current_company_id()
    AND (
      rawasi_private.can_access('attendance', 'view')
      OR rawasi_private.is_admin()
      OR partner_id IN (
        SELECT p.id FROM public.partners p
        WHERE p.company_id = rawasi_private.current_company_id()
          AND p.id = attendance_logs.partner_id
      )
    )
  );

DROP POLICY IF EXISTS attendance_logs_insert ON public.attendance_logs;
CREATE POLICY attendance_logs_insert ON public.attendance_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = rawasi_private.current_company_id()
    AND (
      rawasi_private.can_access('attendance', 'create')
      OR rawasi_private.is_admin()
      OR partner_id IN (
        SELECT p.id FROM public.partners p
        WHERE p.company_id = rawasi_private.current_company_id()
          AND p.id = attendance_logs.partner_id
      )
    )
  );

-- -----------------------------------------------------------------------------
-- 8. RPC: verify_and_bind_device (فحص وربط الجهاز عند تسجيل الدخول)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_and_bind_device(
  p_partner_id uuid,
  p_device_id text,
  p_device_name text DEFAULT 'هاتف غير محدد',
  p_device_os text DEFAULT 'نظام غير محدد'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_cid uuid := rawasi_private.current_company_id();
  v_part record;
  v_other_part record;
BEGIN
  IF p_partner_id IS NULL OR p_device_id IS NULL OR length(trim(p_device_id)) = 0 THEN
    RAISE EXCEPTION 'بيانات الموظف ومعرف الجهاز مطلوبة' USING ERRCODE = '23514';
  END IF;

  SELECT p.id, p.name, p.device_id, p.device_name, p.device_os, p.device_bound_at, p.is_device_locked
  INTO v_part
  FROM public.partners p
  WHERE p.id = p_partner_id AND p.company_id = v_cid AND p.partner_type = 'موظف';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الموظف غير موجود أو ليس موظفاً في الشركة النشطة' USING ERRCODE = '23503';
  END IF;

  -- 1. If employee does not have a bound device yet:
  IF v_part.device_id IS NULL OR length(trim(v_part.device_id)) = 0 THEN
    -- Check if this phone is already locked to another employee in the same company
    SELECT p.name INTO v_other_part
    FROM public.partners p
    WHERE p.company_id = v_cid
      AND p.device_id = p_device_id
      AND p.is_device_locked = true
      AND p.id <> p_partner_id;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'status', 'device_already_bound_to_other',
        'message', 'هذا الهاتف مقترن بالفعل بحساب موظف آخر (' || v_other_part.name || '). لا يمكن تسجيل أكثر من موظف على نفس الجهاز لمنع التلاعب.'
      );
    END IF;

    -- Bind this device as the official hardware
    UPDATE public.partners
    SET device_id = p_device_id,
        device_name = p_device_name,
        device_os = p_device_os,
        device_bound_at = now(),
        is_device_locked = true
    WHERE id = p_partner_id;

    INSERT INTO public.attendance_devices (
      company_id, partner_id, device_id, device_name, device_os, is_active, notes
    )
    VALUES (
      v_cid, p_partner_id, p_device_id, p_device_name, p_device_os, true, 'تم الربط الأولي بنجاح'
    );

    RETURN jsonb_build_object(
      'success', true,
      'status', 'bound_first_time',
      'message', 'تم قفل واعتماد هذا الجهاز رسمياً لحسابك بنجاح',
      'device_name', p_device_name
    );
  END IF;

  -- 2. If employee already has a bound device:
  IF v_part.device_id = p_device_id THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', 'device_matched',
      'message', 'الجهاز معتمد ومطابق للهاتف المسجل',
      'device_name', v_part.device_name,
      'bound_at', to_char(v_part.device_bound_at, 'YYYY-MM-DD HH24:MI')
    );
  ELSE
    -- Device mismatch! Reject login
    RETURN jsonb_build_object(
      'success', false,
      'status', 'device_mismatch',
      'message', 'حسابك مقفل على جهاز آخر معتمد (' || COALESCE(v_part.device_name, 'هاتفك السابق') || '). يرجى مراجعة إدارة الموارد البشرية لفك قفل الجهاز.',
      'bound_device_name', v_part.device_name,
      'bound_at', to_char(v_part.device_bound_at, 'YYYY-MM-DD HH24:MI')
    );
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 9. RPC: admin_reset_employee_device (فك ارتباط جهاز الموظف بواسطة الإدارة)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_reset_employee_device(
  p_partner_id uuid,
  p_reason text DEFAULT 'تغيير الجهاز بمعرفة الإدارة'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_cid uuid := rawasi_private.current_company_id();
  v_emp_name text;
BEGIN
  IF NOT rawasi_private.can_access('attendance', 'edit') AND NOT rawasi_private.is_admin() THEN
    RAISE EXCEPTION 'لا توجد صلاحية لفك ارتباط أجهزة الموظفين' USING ERRCODE = '42501';
  END IF;

  SELECT p.name INTO v_emp_name
  FROM public.partners p
  WHERE p.id = p_partner_id AND p.company_id = v_cid AND p.partner_type = 'موظف';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الموظف غير موجود في الشركة النشطة' USING ERRCODE = '23503';
  END IF;

  -- Deactivate existing active device logs
  UPDATE public.attendance_devices
  SET is_active = false,
      unbound_at = now(),
      unbound_by = auth.uid(),
      notes = COALESCE(notes, '') || ' | تم فك الارتباط: ' || COALESCE(p_reason, 'بدون سبب')
  WHERE company_id = v_cid AND partner_id = p_partner_id AND is_active = true;

  -- Clear device fields on partner
  UPDATE public.partners
  SET device_id = NULL,
      device_name = NULL,
      device_os = NULL,
      device_bound_at = NULL,
      is_device_locked = false
  WHERE id = p_partner_id AND company_id = v_cid;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم فك ارتباط الجهاز للموظف (' || v_emp_name || ') بنجاح. يمكنه الآن تسجيل الدخول من جهازه الجديد واعتماده.'
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 10. RPC: record_attendance_punch (تسجيل بصمة ذكية مع فحص العتاد والتزييف)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_attendance_punch(
  p_partner_id uuid,
  p_punch_type text,
  p_device_id text,
  p_device_name text DEFAULT 'هاتف ذكي',
  p_selfie_url text DEFAULT NULL,
  p_latitude numeric DEFAULT NULL,
  p_longitude numeric DEFAULT NULL,
  p_project_id uuid DEFAULT NULL,
  p_distance_meters numeric DEFAULT NULL,
  p_is_mocked boolean DEFAULT false,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_cid uuid := rawasi_private.current_company_id();
  v_part record;
  v_verification_status text := 'verified';
  v_log_id uuid;
BEGIN
  IF p_partner_id IS NULL OR p_punch_type IS NULL OR p_device_id IS NULL THEN
    RAISE EXCEPTION 'بيانات البصمة الأساسية مطلوبة' USING ERRCODE = '23514';
  END IF;

  SELECT p.id, p.name, p.device_id, p.is_device_locked
  INTO v_part
  FROM public.partners p
  WHERE p.id = p_partner_id AND p.company_id = v_cid AND p.partner_type = 'موظف';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الموظف غير موجود أو ليس موظفاً شهرياً' USING ERRCODE = '23503';
  END IF;

  -- Check hardware lock: device must match bound device
  IF v_part.is_device_locked AND (v_part.device_id IS NULL OR v_part.device_id <> p_device_id) THEN
    RAISE EXCEPTION 'لا يمكن التبصيم من هذا الجهاز؛ حسابك مقفل على جهاز آخر معتمد' USING ERRCODE = '23514';
  END IF;

  -- Anti-Mock GPS check: if GPS is mocked, flag the punch
  IF p_is_mocked = true THEN
    v_verification_status := 'flagged';
  END IF;

  INSERT INTO public.attendance_logs (
    company_id, partner_id, project_id, punch_type, device_id, device_name,
    selfie_url, latitude, longitude, distance_meters, is_mocked, verification_status, notes
  )
  VALUES (
    v_cid, p_partner_id, p_project_id, p_punch_type, p_device_id, p_device_name,
    p_selfie_url, p_latitude, p_longitude, p_distance_meters, p_is_mocked, v_verification_status, p_notes
  )
  RETURNING id INTO v_log_id;

  RETURN jsonb_build_object(
    'success', true,
    'log_id', v_log_id,
    'status', v_verification_status,
    'message', CASE WHEN v_verification_status = 'flagged'
                 THEN 'تم تسجيل البصمة ولكن تم رصد اشتباه في تزييف الموقع (Mock GPS)'
                 ELSE 'تم تسجيل البصمة بنجاح واعتمادها'
               END
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 11. Storage bucket setup (in Supabase environment)
-- -----------------------------------------------------------------------------
DO $storage$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('attendance-selfies', 'attendance-selfies', false)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END;
$storage$;

-- -----------------------------------------------------------------------------
-- 12. Realtime Publication
-- -----------------------------------------------------------------------------
DO $rt$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.attendance_devices;
    ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.attendance_logs;
  END IF;
END;
$rt$;

COMMIT;


