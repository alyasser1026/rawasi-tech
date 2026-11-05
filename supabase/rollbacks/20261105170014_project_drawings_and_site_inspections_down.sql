-- =============================================================================
-- Rollback Migration: 20261105170014_project_drawings_and_site_inspections_down.sql
-- =============================================================================

DO $rt$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime DROP TABLE public.project_site_visits;
    EXCEPTION WHEN undefined_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime DROP TABLE public.project_drawings;
    EXCEPTION WHEN undefined_object THEN NULL;
    END;
  END IF;
END;
$rt$;

DROP POLICY IF EXISTS project_site_visits_delete ON public.project_site_visits;
DROP POLICY IF EXISTS project_site_visits_update ON public.project_site_visits;
DROP POLICY IF EXISTS project_site_visits_insert ON public.project_site_visits;
DROP POLICY IF EXISTS project_site_visits_read ON public.project_site_visits;

DROP POLICY IF EXISTS project_drawings_delete ON public.project_drawings;
DROP POLICY IF EXISTS project_drawings_update ON public.project_drawings;
DROP POLICY IF EXISTS project_drawings_insert ON public.project_drawings;
DROP POLICY IF EXISTS project_drawings_read ON public.project_drawings;

DROP TRIGGER IF EXISTS aa_stamp_company_id ON public.project_site_visits;
DROP TRIGGER IF EXISTS aa_stamp_company_id ON public.project_drawings;

DELETE FROM rawasi_private.company_scoped_tables
WHERE table_name IN ('project_drawings', 'project_site_visits');

DROP TABLE IF EXISTS public.project_site_visits CASCADE;
DROP TABLE IF EXISTS public.project_drawings CASCADE;

ALTER TABLE public.supplier_invoices DROP COLUMN IF EXISTS attachment_url;
ALTER TABLE public.purchase_orders DROP COLUMN IF EXISTS attachment_url;
