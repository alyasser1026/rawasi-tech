-- =============================================================================
-- Rollback: 20261105170011_health_radar_document_expiry_and_notifications_down.sql
-- Description: Revert Phase 6: الرقابة والتنبيهات ورادار صحة البيانات
-- =============================================================================

-- 1. Unsched pg_cron job if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('daily_health_and_expiry_scan')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily_health_and_expiry_scan');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
END;
$$;

-- 2. Drop Subclaims Trigger & Function
DROP TRIGGER IF EXISTS trg_notify_subclaim_created ON public.sub_claims;
DROP FUNCTION IF EXISTS rawasi_private.notify_subclaim_created();

-- 3. Drop RPC Functions
DROP FUNCTION IF EXISTS public.run_daily_health_and_expiry_scans();
DROP FUNCTION IF EXISTS rawasi_private.run_daily_health_and_expiry_scans();
DROP FUNCTION IF EXISTS public.mark_company_document_renewed(uuid, date);
DROP FUNCTION IF EXISTS public.upsert_company_document(uuid, text, text, text, date, date, integer, uuid, uuid, uuid, text, text);
DROP FUNCTION IF EXISTS public.get_document_expiry_alerts(integer);
DROP FUNCTION IF EXISTS public.get_system_health_radar();

-- 4. Drop company_documents Table, Triggers & Metadata
DROP TRIGGER IF EXISTS trg_company_documents_touch_updated_at ON public.company_documents;
DROP TRIGGER IF EXISTS aa_stamp_company_id ON public.company_documents;

DROP POLICY IF EXISTS company_documents_delete ON public.company_documents;
DROP POLICY IF EXISTS company_documents_edit ON public.company_documents;
DROP POLICY IF EXISTS company_documents_create ON public.company_documents;
DROP POLICY IF EXISTS company_documents_view ON public.company_documents;

DELETE FROM rawasi_private.company_scoped_tables WHERE table_name = 'company_documents';

DROP TABLE IF EXISTS public.company_documents CASCADE;

-- 5. Remove added columns from projects
ALTER TABLE public.projects
  DROP COLUMN IF EXISTS retention_release_date,
  DROP COLUMN IF EXISTS warranty_period_months,
  DROP COLUMN IF EXISTS handover_date;

-- 6. Revert Notifications Table RLS & Columns
DROP POLICY IF EXISTS notification_delete ON public.notifications;
DROP POLICY IF EXISTS notification_update ON public.notifications;
DROP POLICY IF EXISTS notification_insert ON public.notifications;
DROP POLICY IF EXISTS notification_select ON public.notifications;

CREATE POLICY notification_view ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR rawasi_private.is_admin());

CREATE POLICY notification_edit ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()) OR rawasi_private.is_admin())
  WITH CHECK (user_id = (SELECT auth.uid()) OR rawasi_private.is_admin());

DROP INDEX IF EXISTS public.idx_notifications_dedup;
DROP INDEX IF EXISTS public.idx_notifications_comp_user_read;

ALTER TABLE public.notifications
  DROP COLUMN IF EXISTS dedup_key,
  DROP COLUMN IF EXISTS company_id;

ALTER TABLE public.invoices DROP COLUMN IF EXISTS retention_released;
ALTER TABLE public.sub_claims DROP COLUMN IF EXISTS retention_released;
