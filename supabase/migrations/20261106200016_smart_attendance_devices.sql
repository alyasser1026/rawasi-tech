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
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'attendance_devices') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.attendance_devices;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'attendance_logs') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.attendance_logs;
    END IF;
  END IF;
END;
$rt$;

COMMIT;
