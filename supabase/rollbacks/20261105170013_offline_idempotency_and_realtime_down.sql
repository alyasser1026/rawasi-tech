-- Rollback: 20261105170013_offline_idempotency_and_realtime_down.sql
-- Description: Revert Phase 8 Offline Draft Queue Idempotency, Telegram Attachments Registry, Draft-Only RPCs, and Realtime Publication

BEGIN;

-- 1. Restore original REPLICA IDENTITY and supabase_realtime publication state
DO $restore_realtime$
DECLARE
  r record;
  v_has_pub boolean;
BEGIN
  IF to_regclass('rawasi_private.phase8_realtime_originals') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime' AND NOT puballtables
    ) INTO v_has_pub;

    FOR r IN
      SELECT table_name, was_in_publication, prev_replident, prev_replident_index, created_index_name
      FROM rawasi_private.phase8_realtime_originals
      ORDER BY table_name
    LOOP
      IF to_regclass(format('public.%I', r.table_name)) IS NOT NULL THEN
        IF v_has_pub AND NOT r.was_in_publication AND EXISTS (
          SELECT 1 FROM pg_publication_tables
          WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = r.table_name
        ) THEN
          EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE ONLY public.%I', r.table_name);
        END IF;

        IF r.prev_replident = 'd' THEN
          EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY DEFAULT', r.table_name);
        ELSIF r.prev_replident = 'n' THEN
          EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY NOTHING', r.table_name);
        ELSIF r.prev_replident = 'f' THEN
          EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', r.table_name);
        ELSIF r.prev_replident = 'i' AND r.prev_replident_index IS NOT NULL THEN
          EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY USING INDEX %I', r.table_name, r.prev_replident_index);
        END IF;

        IF r.created_index_name IS NOT NULL THEN
          EXECUTE format('DROP INDEX IF EXISTS public.%I', r.created_index_name);
        END IF;
      END IF;
    END LOOP;

    DROP TABLE rawasi_private.phase8_realtime_originals;
  END IF;
END;
$restore_realtime$;

-- 2. Drop Phase 8 RPCs
DROP FUNCTION IF EXISTS public.save_expense_draft(jsonb);
DROP FUNCTION IF EXISTS public.save_labor_log_draft(jsonb);
DROP FUNCTION IF EXISTS public.register_company_attachment(jsonb);

-- 3. Drop company_attachments table & multi-company metadata
DROP TRIGGER IF EXISTS aa_stamp_company_id ON public.company_attachments;
DROP POLICY IF EXISTS company_attachments_delete ON public.company_attachments;
DROP POLICY IF EXISTS company_attachments_insert ON public.company_attachments;
DROP POLICY IF EXISTS company_attachments_read ON public.company_attachments;

DELETE FROM rawasi_private.company_scoped_tables WHERE table_name = 'company_attachments';

DROP TABLE IF EXISTS public.company_attachments CASCADE;

-- 4. Drop idempotency constraints & columns on expenses and labor_daily_logs
ALTER TABLE public.expenses
  DROP CONSTRAINT IF EXISTS expenses_company_client_req_uq,
  DROP COLUMN IF EXISTS client_request_id;

ALTER TABLE public.labor_daily_logs
  DROP CONSTRAINT IF EXISTS labor_daily_logs_company_client_req_uq,
  DROP COLUMN IF EXISTS client_request_id;

COMMIT;
