-- Rollback: 20261105170006_ar_aging_reports_down.sql
-- Description: Rollback public.get_aging_report and rawasi_private.require_aging_report_access

BEGIN;

DROP FUNCTION IF EXISTS public.get_aging_report(text, date);
DROP FUNCTION IF EXISTS rawasi_private.require_aging_report_access(text);

COMMIT;
