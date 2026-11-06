-- =============================================================================
-- Rollback: 20261106200016_smart_attendance_devices_down.sql
-- Description: Clean Rollback for Phase 12 - Smart Anti-Fraud Attendance System
-- =============================================================================

BEGIN;

-- 1. Remove from realtime publication
DO $rt$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime DROP TABLE public.attendance_logs;
    EXCEPTION WHEN undefined_table OR undefined_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime DROP TABLE public.attendance_devices;
    EXCEPTION WHEN undefined_table OR undefined_object THEN NULL;
    END;
  END IF;
END;
$rt$;

-- 2. Drop RPC Functions
DROP FUNCTION IF EXISTS public.record_attendance_punch(uuid, text, text, text, text, numeric, numeric, uuid, numeric, boolean, text);
DROP FUNCTION IF EXISTS public.admin_reset_employee_device(uuid, text);
DROP FUNCTION IF EXISTS public.verify_and_bind_device(uuid, text, text, text);

-- 3. Drop triggers & sync functions
DROP TRIGGER IF EXISTS trg_sync_attendance_punch ON public.attendance_logs;
DROP FUNCTION IF EXISTS rawasi_private.trg_sync_punch_to_attendance();
DROP TRIGGER IF EXISTS trg_val_emp_attendance_log ON public.attendance_logs;
DROP TRIGGER IF EXISTS trg_val_emp_attendance_device ON public.attendance_devices;
DROP TRIGGER IF EXISTS aa_stamp_company_id ON public.attendance_logs;
DROP TRIGGER IF EXISTS aa_stamp_company_id ON public.attendance_devices;

-- 4. Drop tables
DROP TABLE IF EXISTS public.attendance_logs CASCADE;
DROP TABLE IF EXISTS public.attendance_devices CASCADE;

-- 5. Unregister from company_scoped_tables
DELETE FROM rawasi_private.company_scoped_tables
WHERE table_name IN ('attendance_devices', 'attendance_logs');

-- 6. Revert partners columns and index
DROP INDEX IF EXISTS public.partners_company_device_uq;
ALTER TABLE public.partners
  DROP COLUMN IF EXISTS is_device_locked,
  DROP COLUMN IF EXISTS device_bound_at,
  DROP COLUMN IF EXISTS device_os,
  DROP COLUMN IF EXISTS device_name,
  DROP COLUMN IF EXISTS device_id;

COMMIT;
