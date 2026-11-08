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

DROP TRIGGER IF EXISTS aa_stamp_company_id ON public.project_drawings;
CREATE TRIGGER aa_stamp_company_id
  BEFORE INSERT OR UPDATE OF company_id ON public.project_drawings
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id();

DROP TRIGGER IF EXISTS aa_stamp_company_id ON public.project_site_visits;
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

DROP POLICY IF EXISTS project_drawings_read ON public.project_drawings;
CREATE POLICY project_drawings_read ON public.project_drawings
  FOR SELECT TO authenticated
  USING (company_id = rawasi_private.current_company_id());

DROP POLICY IF EXISTS project_drawings_insert ON public.project_drawings;
CREATE POLICY project_drawings_insert ON public.project_drawings
  FOR INSERT TO authenticated
  WITH CHECK (company_id = rawasi_private.current_company_id());

DROP POLICY IF EXISTS project_drawings_update ON public.project_drawings;
CREATE POLICY project_drawings_update ON public.project_drawings
  FOR UPDATE TO authenticated
  USING (company_id = rawasi_private.current_company_id())
  WITH CHECK (company_id = rawasi_private.current_company_id());

DROP POLICY IF EXISTS project_drawings_delete ON public.project_drawings;
CREATE POLICY project_drawings_delete ON public.project_drawings
  FOR DELETE TO authenticated
  USING (company_id = rawasi_private.current_company_id());

DROP POLICY IF EXISTS project_site_visits_read ON public.project_site_visits;
CREATE POLICY project_site_visits_read ON public.project_site_visits
  FOR SELECT TO authenticated
  USING (company_id = rawasi_private.current_company_id());

DROP POLICY IF EXISTS project_site_visits_insert ON public.project_site_visits;
CREATE POLICY project_site_visits_insert ON public.project_site_visits
  FOR INSERT TO authenticated
  WITH CHECK (company_id = rawasi_private.current_company_id());

DROP POLICY IF EXISTS project_site_visits_update ON public.project_site_visits;
CREATE POLICY project_site_visits_update ON public.project_site_visits
  FOR UPDATE TO authenticated
  USING (company_id = rawasi_private.current_company_id())
  WITH CHECK (company_id = rawasi_private.current_company_id());

DROP POLICY IF EXISTS project_site_visits_delete ON public.project_site_visits;
CREATE POLICY project_site_visits_delete ON public.project_site_visits
  FOR DELETE TO authenticated
  USING (company_id = rawasi_private.current_company_id());

-- 7. هوية النسخ والتحديث اللحظي عبر Supabase Realtime
ALTER TABLE public.project_drawings REPLICA IDENTITY USING INDEX project_drawings_company_id_uq;
ALTER TABLE public.project_site_visits REPLICA IDENTITY USING INDEX project_site_visits_company_id_uq;

DO $rt$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'project_drawings') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.project_drawings;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'project_site_visits') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.project_site_visits;
    END IF;
  END IF;
END;
$rt$;
