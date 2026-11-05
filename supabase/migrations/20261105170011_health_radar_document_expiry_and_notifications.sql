-- =============================================================================
-- Migration: 20261105170011_health_radar_document_expiry_and_notifications.sql
-- Description: Phase 6: الرقابة والتنبيهات ورادار صحة البيانات وتتبع انتهاء المستندات والإشعارات
-- =============================================================================

-- 1. Upgrade Notifications Table with company isolation & deduplication
-- -----------------------------------------------------------------------------
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS dedup_key text;

CREATE INDEX IF NOT EXISTS idx_notifications_comp_user_read
  ON public.notifications (company_id, user_id, is_read);

CREATE INDEX IF NOT EXISTS idx_notifications_dedup
  ON public.notifications (company_id, dedup_key);

-- Update RLS policies on notifications to enforce company isolation
DROP POLICY IF EXISTS notification_view ON public.notifications;
DROP POLICY IF EXISTS notification_edit ON public.notifications;
DROP POLICY IF EXISTS notification_select ON public.notifications;
DROP POLICY IF EXISTS notification_insert ON public.notifications;
DROP POLICY IF EXISTS notification_update ON public.notifications;
DROP POLICY IF EXISTS notification_delete ON public.notifications;

CREATE POLICY notification_select ON public.notifications
  FOR SELECT TO authenticated
  USING (
    (user_id = (SELECT auth.uid()) OR rawasi_private.is_admin())
    AND (company_id IS NULL OR company_id = (SELECT rawasi_private.current_company_id()))
  );

CREATE POLICY notification_insert ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    (user_id = (SELECT auth.uid()) OR rawasi_private.is_admin())
    AND (company_id IS NULL OR company_id = (SELECT rawasi_private.current_company_id()))
  );

CREATE POLICY notification_update ON public.notifications
  FOR UPDATE TO authenticated
  USING (
    (user_id = (SELECT auth.uid()) OR rawasi_private.is_admin())
    AND (company_id IS NULL OR company_id = (SELECT rawasi_private.current_company_id()))
  )
  WITH CHECK (
    (user_id = (SELECT auth.uid()) OR rawasi_private.is_admin())
    AND (company_id IS NULL OR company_id = (SELECT rawasi_private.current_company_id()))
  );

CREATE POLICY notification_delete ON public.notifications
  FOR DELETE TO authenticated
  USING (
    (user_id = (SELECT auth.uid()) OR rawasi_private.is_admin())
    AND (company_id IS NULL OR company_id = (SELECT rawasi_private.current_company_id()))
  );

-- 2. Projects Enhancements for Warranty & Retention Release Tracking
-- -----------------------------------------------------------------------------
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS handover_date date,
  ADD COLUMN IF NOT EXISTS warranty_period_months integer DEFAULT 12 CHECK (warranty_period_months >= 0),
  ADD COLUMN IF NOT EXISTS retention_release_date date;

COMMENT ON COLUMN public.projects.handover_date IS 'تاريخ الاستلام الابتدائي للمشروع وبدء فترة الضمان';
COMMENT ON COLUMN public.projects.warranty_period_months IS 'مدة ضمان الأعمال بالشهور (افتراضياً 12 شهراً)';
COMMENT ON COLUMN public.projects.retention_release_date IS 'تاريخ استحقاق فك المبالغ المحجوزة لضمان الأعمال';

-- 3. Company Documents Table (تتبع الوثائق والتراخيص والإقامات)
-- -----------------------------------------------------------------------------
CREATE TABLE public.company_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT rawasi_private.current_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
  document_number text NOT NULL,
  title text NOT NULL,
  doc_type text NOT NULL CHECK (doc_type IN (
    'worker_iqama',             -- إقامة عامل
    'municipality_license',     -- رخصة بلدية
    'asset_insurance',          -- تأمين معدة / مركبة
    'letter_of_guarantee',      -- خطاب ضمان بنكي
    'project_contract',         -- عقد مشروع
    'commercial_registration',  -- سجل تجاري
    'tax_certificate',          -- شهادة الزكاة والضريبة
    'other'                     -- أخرى
  )),
  issue_date date,
  expiry_date date NOT NULL,
  alert_days_before integer NOT NULL DEFAULT 30 CHECK (alert_days_before >= 0),
  partner_id uuid,
  project_id uuid,
  asset_id uuid,
  attachment_url text,
  notes text,
  is_renewed boolean NOT NULL DEFAULT false,
  renewal_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_documents_company_id_uq UNIQUE (id, company_id),
  FOREIGN KEY (partner_id, company_id) REFERENCES public.partners(id, company_id) ON DELETE SET NULL,
  FOREIGN KEY (project_id, company_id) REFERENCES public.projects(id, company_id) ON DELETE SET NULL,
  FOREIGN KEY (asset_id, company_id) REFERENCES public.fixed_assets(id, company_id) ON DELETE SET NULL
);

INSERT INTO rawasi_private.company_scoped_tables (table_name)
VALUES ('company_documents')
ON CONFLICT DO NOTHING;

CREATE TRIGGER aa_stamp_company_id
  BEFORE INSERT ON public.company_documents
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id();

CREATE TRIGGER trg_company_documents_touch_updated_at
  BEFORE UPDATE ON public.company_documents
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.touch_updated_at();

ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY company_documents_view ON public.company_documents
  FOR SELECT TO authenticated
  USING (
    (rawasi_private.can_access('audit_logs', 'view') OR rawasi_private.can_access('accounting', 'view') OR rawasi_private.can_access('reports', 'view'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY company_documents_create ON public.company_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    (rawasi_private.can_access('audit_logs', 'create') OR rawasi_private.can_access('accounting', 'create') OR rawasi_private.can_access('reports', 'create'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY company_documents_edit ON public.company_documents
  FOR UPDATE TO authenticated
  USING (
    (rawasi_private.can_access('audit_logs', 'edit') OR rawasi_private.can_access('accounting', 'edit') OR rawasi_private.can_access('reports', 'edit'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  )
  WITH CHECK (
    (rawasi_private.can_access('audit_logs', 'edit') OR rawasi_private.can_access('accounting', 'edit') OR rawasi_private.can_access('reports', 'edit'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY company_documents_delete ON public.company_documents
  FOR DELETE TO authenticated
  USING (
    (rawasi_private.can_access('audit_logs', 'delete') OR rawasi_private.can_access('accounting', 'delete') OR rawasi_private.can_access('reports', 'delete'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

-- 4. RPC: get_system_health_radar() (رادار صحة البيانات والتشوهات)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_system_health_radar()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rawasi_private
AS $$
DECLARE
  v_company_id uuid;
  v_checks jsonb := '[]'::jsonb;
  v_total_issues integer := 0;
  v_critical_count integer := 0;
  v_medium_count integer := 0;
  v_warning_count integer := 0;

  -- 1. Zero amount journals
  v_c1_count integer := 0;
  v_c1_items jsonb := '[]'::jsonb;

  -- 2. Orphaned journal lines
  v_c2_count integer := 0;
  v_c2_items jsonb := '[]'::jsonb;

  -- 3. Zero amount invoices
  v_c3_count integer := 0;
  v_c3_items jsonb := '[]'::jsonb;

  -- 4. Unlinked receipt vouchers
  v_c4_count integer := 0;
  v_c4_items jsonb := '[]'::jsonb;

  -- 5. Unposted subclaims
  v_c5_count integer := 0;
  v_c5_items jsonb := '[]'::jsonb;

  -- 6. Negative stock
  v_c6_count integer := 0;
  v_c6_items jsonb := '[]'::jsonb;

  -- 7. Overdue site custodies
  v_c7_count integer := 0;
  v_c7_items jsonb := '[]'::jsonb;

  -- 8. Unclosed cash boxes
  v_c8_count integer := 0;
  v_c8_items jsonb := '[]'::jsonb;

  -- 9. Unbalanced journals
  v_c9_count integer := 0;
  v_c9_items jsonb := '[]'::jsonb;
BEGIN
  v_company_id := rawasi_private.current_company_id();
  IF NOT (rawasi_private.can_access('audit_logs', 'view') OR rawasi_private.can_access('accounting', 'view') OR rawasi_private.is_admin()) THEN
    RAISE EXCEPTION 'غير مصرح بعرض رادار صحة البيانات' USING ERRCODE = '42501';
  END IF;

  -- 1. Zero amount / empty journals
  SELECT count(*),
         COALESCE(jsonb_agg(sub.item), '[]'::jsonb)
  INTO v_c1_count, v_c1_items
  FROM (
    SELECT jsonb_build_object(
      'id', jh.id,
      'identifier', COALESCE(jh.v_type, 'قيد') || ' #' || substring(jh.id::text, 1, 8),
      'date', jh.entry_date,
      'description', COALESCE(jh.description, 'بدون بيان'),
      'amount', COALESCE(sum(jl.debit), 0)
    ) AS item
    FROM public.journal_headers jh
    LEFT JOIN public.journal_lines jl ON jl.header_id = jh.id
    WHERE jh.company_id = v_company_id
    GROUP BY jh.id, jh.v_type, jh.entry_date, jh.description
    HAVING COALESCE(sum(jl.debit), 0) = 0 OR count(jl.id) = 0
    LIMIT 20
  ) sub;

  -- 2. Orphaned journal lines
  SELECT count(*),
         COALESCE(jsonb_agg(sub.item), '[]'::jsonb)
  INTO v_c2_count, v_c2_items
  FROM (
    SELECT jsonb_build_object(
      'id', jl.id,
      'identifier', COALESCE(jl.notes, 'سطر يتيم'),
      'header_id', jl.header_id,
      'amount', COALESCE(jl.debit, jl.credit, 0)
    ) AS item
    FROM public.journal_lines jl
    WHERE jl.company_id = v_company_id
      AND (jl.header_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.journal_headers jh WHERE jh.id = jl.header_id AND jh.company_id = v_company_id
      ))
    LIMIT 20
  ) sub;

  -- 3. Zero amount invoices
  SELECT count(*),
         COALESCE(jsonb_agg(sub.item), '[]'::jsonb)
  INTO v_c3_count, v_c3_items
  FROM (
    SELECT jsonb_build_object(
      'id', inv.id,
      'identifier', inv.invoice_number,
      'date', inv.date,
      'description', COALESCE(inv.client_name, 'بدون عميل'),
      'amount', COALESCE(inv.total_amount, 0)
    ) AS item
    FROM public.invoices inv
    WHERE inv.company_id = v_company_id
      AND (inv.total_amount IS NULL OR inv.total_amount <= 0)
    LIMIT 20
  ) sub;

  -- 4. Unlinked receipt vouchers
  SELECT count(*),
         COALESCE(jsonb_agg(sub.item), '[]'::jsonb)
  INTO v_c4_count, v_c4_items
  FROM (
    SELECT jsonb_build_object(
      'id', rv.id,
      'identifier', COALESCE(rv.receipt_number, substring(rv.id::text, 1, 8)),
      'date', rv.date,
      'description', 'سند قبض غير مربوط بفاتورة أو شريك',
      'amount', rv.amount
    ) AS item
    FROM public.receipt_vouchers rv
    WHERE rv.company_id = v_company_id
      AND (rv.partner_id IS NULL OR (rv.invoice_id IS NULL AND NOT EXISTS (
        SELECT 1 FROM public.journal_lines jl WHERE jl.reference_id = rv.id AND jl.company_id = v_company_id
      )))
    LIMIT 20
  ) sub;

  -- 5. Unposted approved subclaims
  SELECT count(*),
         COALESCE(jsonb_agg(sub.item), '[]'::jsonb)
  INTO v_c5_count, v_c5_items
  FROM (
    SELECT jsonb_build_object(
      'id', sc.id,
      'identifier', sc.claim_number,
      'date', sc.date,
      'description', 'مستخلص معتمد بدون قيد محاسبي',
      'amount', COALESCE(sc.net_amount, sc.total_amount, 0)
    ) AS item
    FROM public.sub_claims sc
    WHERE sc.company_id = v_company_id
      AND sc.status IN ('approved', 'معتمد')
      AND (
        (sc.jv_header_id IS NULL AND sc.jv_id IS NULL)
        OR NOT EXISTS (
          SELECT 1 FROM public.journal_headers jh
          WHERE (jh.id = sc.jv_header_id OR jh.id = sc.jv_id) AND jh.company_id = v_company_id
        )
      )
    LIMIT 20
  ) sub;

  -- 6. Negative stock
  SELECT count(*),
         COALESCE(jsonb_agg(sub.item), '[]'::jsonb)
  INTO v_c6_count, v_c6_items
  FROM (
    WITH item_calc AS (
      SELECT
        mi.id,
        mi.item_code,
        mi.item_name,
        (
          COALESCE((
            SELECT sum(mrl.quantity)
            FROM public.material_receipt_lines mrl
            JOIN public.material_receipts mr ON mr.id = mrl.receipt_id
            WHERE mrl.company_id = v_company_id AND mrl.item_id = mi.id AND mr.is_posted
          ), 0)
          -
          COALESCE((
            SELECT sum(mil.quantity)
            FROM public.material_issue_lines mil
            JOIN public.material_issues mi2 ON mi2.id = mil.issue_id
            WHERE mil.company_id = v_company_id AND mil.item_id = mi.id AND mi2.is_posted
          ), 0)
          +
          COALESCE((
            SELECT sum(stl.difference_quantity)
            FROM public.stocktaking_lines stl
            JOIN public.stocktaking_sessions st ON st.id = stl.session_id
            WHERE stl.company_id = v_company_id AND stl.item_id = mi.id AND st.is_posted
          ), 0)
        ) AS current_stock
      FROM public.material_items mi
      WHERE mi.company_id = v_company_id
    )
    SELECT jsonb_build_object(
      'id', ic.id,
      'identifier', ic.item_code,
      'description', ic.item_name,
      'amount', ic.current_stock
    ) AS item
    FROM item_calc ic
    WHERE ic.current_stock < 0
    LIMIT 20
  ) sub;

  -- 7. Overdue site custodies (> 30 days)
  SELECT count(*),
         COALESCE(jsonb_agg(sub.item), '[]'::jsonb)
  INTO v_c7_count, v_c7_items
  FROM (
    SELECT jsonb_build_object(
      'id', sc.id,
      'identifier', sc.custody_number,
      'date', sc.opened_date,
      'description', COALESCE(p.name, sc.title, 'المهندس / المشرف'),
      'amount', sc.remaining_amount
    ) AS item
    FROM public.site_custodies sc
    LEFT JOIN public.partners p ON p.id = sc.partner_id
    WHERE sc.company_id = v_company_id
      AND sc.status = 'open'
      AND sc.opened_date < (CURRENT_DATE - (COALESCE(sc.max_days, 30) || ' days')::interval)
      AND sc.remaining_amount > 0
    LIMIT 20
  ) sub;

  -- 8. Unclosed cash boxes
  SELECT count(*),
         COALESCE(jsonb_agg(sub.item), '[]'::jsonb)
  INTO v_c8_count, v_c8_items
  FROM (
    WITH cash_accounts AS (
      SELECT a.id AS account_id, a.code, a.name
      FROM public.accounts a
      WHERE a.company_id = v_company_id AND a.code LIKE '122%'
    ),
    recent_tx AS (
      SELECT ca.account_id, ca.code, ca.name, max(jh.entry_date) AS last_tx_date
      FROM cash_accounts ca
      JOIN public.journal_lines jl ON jl.account_id = ca.account_id AND jl.company_id = v_company_id
      JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = v_company_id
      WHERE jh.entry_date >= (CURRENT_DATE - INTERVAL '7 days') AND jh.entry_date < CURRENT_DATE
      GROUP BY ca.account_id, ca.code, ca.name
    )
    SELECT jsonb_build_object(
      'id', rt.account_id,
      'identifier', rt.code,
      'date', rt.last_tx_date,
      'description', rt.name || ' (لم يتم إقفالها لآخر حركة)',
      'amount', 0
    ) AS item
    FROM recent_tx rt
    WHERE NOT EXISTS (
      SELECT 1 FROM public.daily_cash_closings dcc
      WHERE dcc.company_id = v_company_id
        AND dcc.account_id = rt.account_id
        AND dcc.closing_date = rt.last_tx_date
    )
    LIMIT 20
  ) sub;

  -- 9. Unbalanced journal entries
  SELECT count(*),
         COALESCE(jsonb_agg(sub.item), '[]'::jsonb)
  INTO v_c9_count, v_c9_items
  FROM (
    SELECT jsonb_build_object(
      'id', jh.id,
      'identifier', COALESCE(jh.v_type, 'قيد') || ' #' || substring(jh.id::text, 1, 8),
      'date', jh.entry_date,
      'description', COALESCE(jh.description, 'قيد غير متوازن'),
      'amount', ROUND(ABS(COALESCE(sum(jl.debit), 0) - COALESCE(sum(jl.credit), 0)), 2)
    ) AS item
    FROM public.journal_headers jh
    JOIN public.journal_lines jl ON jl.header_id = jh.id
    WHERE jh.company_id = v_company_id
    GROUP BY jh.id, jh.v_type, jh.entry_date, jh.description
    HAVING ABS(COALESCE(sum(jl.debit), 0) - COALESCE(sum(jl.credit), 0)) > 0.001
    LIMIT 20
  ) sub;

  -- Build check objects
  v_critical_count := v_c1_count + v_c2_count + v_c5_count + v_c6_count + v_c9_count;
  v_medium_count := v_c3_count + v_c7_count;
  v_warning_count := v_c4_count + v_c8_count;
  v_total_issues := v_critical_count + v_medium_count + v_warning_count;

  v_checks := jsonb_build_array(
    jsonb_build_object(
      'id', 'zero_amount_journals',
      'title_ar', 'قيود بمبالغ صفرية أو خالية من البنود',
      'severity', 'critical',
      'count', v_c1_count,
      'action_url', '/journal',
      'items', v_c1_items
    ),
    jsonb_build_object(
      'id', 'orphaned_journal_lines',
      'title_ar', 'سطور قيود يتيمة بدون رأس قيد',
      'severity', 'critical',
      'count', v_c2_count,
      'action_url', '/audit',
      'items', v_c2_items
    ),
    jsonb_build_object(
      'id', 'unbalanced_journals',
      'title_ar', 'قيود محاسبية غير متوازنة (المدين لا يساوي الدائن)',
      'severity', 'critical',
      'count', v_c9_count,
      'action_url', '/journal-errors',
      'items', v_c9_items
    ),
    jsonb_build_object(
      'id', 'unposted_subclaims',
      'title_ar', 'مستخلصات مقاولين معتمدة بدون قيد محاسبي',
      'severity', 'critical',
      'count', v_c5_count,
      'action_url', '/subclaims',
      'items', v_c5_items
    ),
    jsonb_build_object(
      'id', 'negative_stock',
      'title_ar', 'أرصدة أصناف مخزنية سالبة',
      'severity', 'critical',
      'count', v_c6_count,
      'action_url', '/inventory',
      'items', v_c6_items
    ),
    jsonb_build_object(
      'id', 'zero_amount_invoices',
      'title_ar', 'فواتير مبيعات بقيمة صفرية أو سالبة',
      'severity', 'medium',
      'count', v_c3_count,
      'action_url', '/invoices',
      'items', v_c3_items
    ),
    jsonb_build_object(
      'id', 'overdue_custodies',
      'title_ar', 'عهد مواقع مفتوحة تجاوزت 30 يوماً دون تسوية',
      'severity', 'medium',
      'count', v_c7_count,
      'action_url', '/custodies',
      'items', v_c7_items
    ),
    jsonb_build_object(
      'id', 'unlinked_receipt_vouchers',
      'title_ar', 'سندات قبض غير مربوطة بفاتورة أو شريك',
      'severity', 'warning',
      'count', v_c4_count,
      'action_url', '/ReceiptVouchers',
      'items', v_c4_items
    ),
    jsonb_build_object(
      'id', 'unclosed_cash_boxes',
      'title_ar', 'خزائن نقدية لم يتم إقفالها لآخر يوم عمل',
      'severity', 'warning',
      'count', v_c8_count,
      'action_url', '/cash-closing',
      'items', v_c8_items
    )
  );

  RETURN jsonb_build_object(
    'total_issues', v_total_issues,
    'critical_count', v_critical_count,
    'medium_count', v_medium_count,
    'warning_count', v_warning_count,
    'scanned_at', now(),
    'checks', v_checks
  );
END;
$$;

-- 5. RPC: get_document_expiry_alerts() (تنبيهات انتهاء المستندات وفك ضمان الأعمال)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_document_expiry_alerts(
  p_days_threshold integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rawasi_private
AS $$
DECLARE
  v_company_id uuid;
  v_docs jsonb := '[]'::jsonb;
  v_retentions jsonb := '[]'::jsonb;
  v_expired_count integer := 0;
  v_critical_count integer := 0;
  v_upcoming_count integer := 0;
  v_retention_due_count integer := 0;
  v_total_docs integer := 0;
BEGIN
  v_company_id := rawasi_private.current_company_id();
  IF NOT (rawasi_private.can_access('audit_logs', 'view') OR rawasi_private.can_access('accounting', 'view') OR rawasi_private.can_access('reports', 'view') OR rawasi_private.is_admin()) THEN
    RAISE EXCEPTION 'غير مصرح بعرض تنبيهات انتهاء المستندات' USING ERRCODE = '42501';
  END IF;

  -- 1. Documents
  SELECT
    COALESCE(jsonb_agg(sub.doc), '[]'::jsonb),
    COALESCE(count(*), 0),
    COALESCE(count(*) FILTER (WHERE sub.status = 'expired'), 0),
    COALESCE(count(*) FILTER (WHERE sub.status = 'critical'), 0),
    COALESCE(count(*) FILTER (WHERE sub.status = 'upcoming'), 0)
  INTO v_docs, v_total_docs, v_expired_count, v_critical_count, v_upcoming_count
  FROM (
    SELECT jsonb_build_object(
      'id', cd.id,
      'document_number', cd.document_number,
      'title', cd.title,
      'doc_type', cd.doc_type,
      'doc_type_ar', CASE cd.doc_type
        WHEN 'worker_iqama' THEN 'إقامة عامل'
        WHEN 'municipality_license' THEN 'رخصة بلدية'
        WHEN 'asset_insurance' THEN 'تأمين معدة / مركبة'
        WHEN 'letter_of_guarantee' THEN 'خطاب ضمان بنكي'
        WHEN 'project_contract' THEN 'عقد مشروع'
        WHEN 'commercial_registration' THEN 'سجل تجاري'
        WHEN 'tax_certificate' THEN 'شهادة الزكاة والضريبة'
        ELSE 'أخرى'
      END,
      'issue_date', cd.issue_date,
      'expiry_date', cd.expiry_date,
      'days_left', (cd.expiry_date - CURRENT_DATE),
      'status', CASE
        WHEN cd.is_renewed THEN 'renewed'
        WHEN cd.expiry_date < CURRENT_DATE THEN 'expired'
        WHEN (cd.expiry_date - CURRENT_DATE) <= 10 THEN 'critical'
        WHEN (cd.expiry_date - CURRENT_DATE) <= COALESCE(cd.alert_days_before, p_days_threshold) THEN 'upcoming'
        ELSE 'safe'
      END,
      'alert_days_before', cd.alert_days_before,
      'is_renewed', cd.is_renewed,
      'renewal_date', cd.renewal_date,
      'partner_id', cd.partner_id,
      'partner_name', p.name,
      'project_id', cd.project_id,
      'project_name', pr."Property",
      'asset_id', cd.asset_id,
      'asset_name', fa.name,
      'attachment_url', cd.attachment_url,
      'notes', cd.notes
    ) AS doc,
    CASE
      WHEN cd.is_renewed THEN 'renewed'
      WHEN cd.expiry_date < CURRENT_DATE THEN 'expired'
      WHEN (cd.expiry_date - CURRENT_DATE) <= 10 THEN 'critical'
      WHEN (cd.expiry_date - CURRENT_DATE) <= COALESCE(cd.alert_days_before, p_days_threshold) THEN 'upcoming'
      ELSE 'safe'
    END AS status
    FROM public.company_documents cd
    LEFT JOIN public.partners p ON p.id = cd.partner_id
    LEFT JOIN public.projects pr ON pr.id = cd.project_id
    LEFT JOIN public.fixed_assets fa ON fa.id = cd.asset_id
    WHERE cd.company_id = v_company_id
    ORDER BY cd.expiry_date ASC
  ) sub;

  -- 2. Project Retention Warranty Releases
  WITH proj_retentions AS (
    SELECT pr.id AS project_id,
           pr."Property" AS project_name,
           pr.client_name,
           pr.handover_date,
           COALESCE(pr.warranty_period_months, 12) AS warranty_months,
           COALESCE(
             pr.retention_release_date,
             (COALESCE(pr.handover_date, pr.actual_completion_date, CURRENT_DATE) + (COALESCE(pr.warranty_period_months, 12) || ' months')::interval)::date
           ) AS release_date,
           COALESCE((
             SELECT sum(inv.retention_amount)
             FROM public.invoices inv
             WHERE pr.id = ANY(inv.project_ids) AND inv.company_id = v_company_id AND inv.retention_released = false
           ), 0) AS client_retention_unreleased,
           COALESCE((
             SELECT sum(sc.retention_amount)
             FROM public.sub_claims sc
             WHERE ((sc.project_id = pr.id) OR (sc.project_ids IS NOT NULL AND sc.project_ids ? pr.id::text)) AND sc.company_id = v_company_id AND sc.retention_released = false
           ), 0) AS sub_retention_unreleased
    FROM public.projects pr
    WHERE pr.company_id = v_company_id
  )
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'project_id', r.project_id,
      'project_name', r.project_name,
      'client_name', r.client_name,
      'handover_date', r.handover_date,
      'warranty_months', r.warranty_months,
      'release_date', r.release_date,
      'days_left', (r.release_date - CURRENT_DATE),
      'status', CASE
        WHEN r.release_date < CURRENT_DATE THEN 'overdue'
        WHEN (r.release_date - CURRENT_DATE) <= 30 THEN 'due_soon'
        ELSE 'active'
      END,
      'client_retention_unreleased', r.client_retention_unreleased,
      'sub_retention_unreleased', r.sub_retention_unreleased,
      'total_retention_unreleased', (r.client_retention_unreleased + r.sub_retention_unreleased)
    ) ORDER BY r.release_date ASC), '[]'::jsonb),
    COALESCE(count(*) FILTER (WHERE r.release_date <= (CURRENT_DATE + INTERVAL '30 days')), 0)
  INTO v_retentions, v_retention_due_count
  FROM proj_retentions r
  WHERE (r.client_retention_unreleased > 0 OR r.sub_retention_unreleased > 0);

  RETURN jsonb_build_object(
    'summary', jsonb_build_object(
      'total_documents', v_total_docs,
      'expired_count', v_expired_count,
      'critical_count', v_critical_count,
      'upcoming_count', v_upcoming_count,
      'retention_due_count', v_retention_due_count
    ),
    'documents', v_docs,
    'retention_guarantees', v_retentions
  );
END;
$$;

-- 6. RPC: Document Management (upsert and mark renewed)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_company_document(
  p_id uuid,
  p_document_number text,
  p_title text,
  p_doc_type text,
  p_expiry_date date,
  p_issue_date date DEFAULT NULL,
  p_alert_days_before integer DEFAULT 30,
  p_partner_id uuid DEFAULT NULL,
  p_project_id uuid DEFAULT NULL,
  p_asset_id uuid DEFAULT NULL,
  p_attachment_url text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rawasi_private
AS $$
DECLARE
  v_company_id uuid;
  v_res public.company_documents%ROWTYPE;
BEGIN
  v_company_id := rawasi_private.current_company_id();
  IF NOT (rawasi_private.can_access('audit_logs', 'create') OR rawasi_private.can_access('accounting', 'create') OR rawasi_private.can_access('reports', 'create') OR rawasi_private.is_admin()) THEN
    RAISE EXCEPTION 'غير مصرح بإضافة أو تعديل وثائق الشركة' USING ERRCODE = '42501';
  END IF;

  IF p_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.company_documents WHERE id = p_id AND company_id = v_company_id) THEN
    UPDATE public.company_documents
    SET document_number = p_document_number,
        title = p_title,
        doc_type = p_doc_type,
        issue_date = p_issue_date,
        expiry_date = p_expiry_date,
        alert_days_before = COALESCE(p_alert_days_before, 30),
        partner_id = p_partner_id,
        project_id = p_project_id,
        asset_id = p_asset_id,
        attachment_url = p_attachment_url,
        notes = p_notes,
        is_renewed = false,
        updated_at = now()
    WHERE id = p_id AND company_id = v_company_id
    RETURNING * INTO v_res;
  ELSE
    INSERT INTO public.company_documents (
      company_id, document_number, title, doc_type, issue_date, expiry_date,
      alert_days_before, partner_id, project_id, asset_id, attachment_url, notes
    ) VALUES (
      v_company_id, p_document_number, p_title, p_doc_type, p_issue_date, p_expiry_date,
      COALESCE(p_alert_days_before, 30), p_partner_id, p_project_id, p_asset_id, p_attachment_url, p_notes
    ) RETURNING * INTO v_res;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'document', row_to_json(v_res)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_company_document_renewed(
  p_document_id uuid,
  p_new_expiry_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rawasi_private
AS $$
DECLARE
  v_company_id uuid;
  v_doc public.company_documents%ROWTYPE;
BEGIN
  v_company_id := rawasi_private.current_company_id();
  IF NOT (rawasi_private.can_access('audit_logs', 'edit') OR rawasi_private.can_access('accounting', 'edit') OR rawasi_private.can_access('reports', 'edit') OR rawasi_private.is_admin()) THEN
    RAISE EXCEPTION 'غير مصرح بتحديث حالة المستند' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_doc FROM public.company_documents
  WHERE id = p_document_id AND company_id = v_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'المستند غير موجود في الشركة الحالية' USING ERRCODE = 'P0002';
  END IF;

  IF p_new_expiry_date IS NOT NULL THEN
    UPDATE public.company_documents
    SET expiry_date = p_new_expiry_date,
        is_renewed = false,
        renewal_date = CURRENT_DATE,
        updated_at = now()
    WHERE id = p_document_id AND company_id = v_company_id
    RETURNING * INTO v_doc;
  ELSE
    UPDATE public.company_documents
    SET is_renewed = true,
        renewal_date = CURRENT_DATE,
        updated_at = now()
    WHERE id = p_document_id AND company_id = v_company_id
    RETURNING * INTO v_doc;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'document_id', v_doc.id,
    'is_renewed', v_doc.is_renewed,
    'expiry_date', v_doc.expiry_date
  );
END;
$$;

-- 7. Trigger: trg_notify_subclaim_created (إشعار لحظي عند تسجيل مستخلص مقاول جديد)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rawasi_private.notify_subclaim_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rawasi_private
AS $$
DECLARE
  v_user_id uuid;
  v_claim_no text;
  v_amount numeric;
  v_partner_name text;
  v_dedup text;
BEGIN
  v_claim_no := COALESCE(NEW.claim_number, 'غير محدد');
  v_amount := COALESCE(NEW.net_amount, NEW.total_amount, 0);

  IF NEW.contractor_id IS NOT NULL THEN
    SELECT name INTO v_partner_name FROM public.partners WHERE id = NEW.contractor_id;
  END IF;
  v_dedup := 'subclaim_created:' || NEW.id;

  FOR v_user_id IN
    SELECT uc.user_id FROM public.user_companies uc
    WHERE uc.company_id = NEW.company_id AND uc.is_active = true
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.company_id = NEW.company_id AND n.user_id = v_user_id AND n.dedup_key = v_dedup
    ) THEN
      INSERT INTO public.notifications (
        company_id, user_id, type, title, message, content, related_id, dedup_key
      ) VALUES (
        NEW.company_id,
        v_user_id,
        'subclaim_new',
        'مستخلص مقاول جديد: ' || v_claim_no,
        'تم تسجيل مستخلص جديد للمقاول ' || COALESCE(v_partner_name, '') || ' بقيمة صافية ' || v_amount || ' ر.س.',
        'مستخلص مقاول جديد قيد التدقيق والمراجعة.',
        NEW.id,
        v_dedup
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_subclaim_created ON public.sub_claims;
CREATE TRIGGER trg_notify_subclaim_created
  AFTER INSERT ON public.sub_claims
  FOR EACH ROW
  EXECUTE FUNCTION rawasi_private.notify_subclaim_created();

-- 8. Daily Background Scan Engine (الفحص اليومي الشامل بدون تكرار)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rawasi_private.run_daily_health_and_expiry_scans()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rawasi_private
AS $$
DECLARE
  v_comp RECORD;
  v_user_id uuid;
  v_doc RECORD;
  v_inv RECORD;
  v_cust RECORD;
  v_proj RECORD;
  v_count integer := 0;
  v_dedup text;
  v_days_left integer;
BEGIN
  -- Loop over each active company
  FOR v_comp IN SELECT id, code, legal_name FROM public.companies WHERE is_active = true LOOP

    -- A. Document Expirations
    FOR v_doc IN
      SELECT cd.id, cd.title, cd.document_number, cd.expiry_date, cd.alert_days_before
      FROM public.company_documents cd
      WHERE cd.company_id = v_comp.id
        AND NOT cd.is_renewed
        AND cd.expiry_date <= (CURRENT_DATE + (COALESCE(cd.alert_days_before, 30) || ' days')::interval)
    LOOP
      v_days_left := (v_doc.expiry_date - CURRENT_DATE);
      v_dedup := 'doc_exp:' || v_doc.id || ':' || v_doc.expiry_date;

      FOR v_user_id IN
        SELECT uc.user_id FROM public.user_companies uc
        WHERE uc.company_id = v_comp.id AND uc.is_active = true
      LOOP
        IF NOT EXISTS (
          SELECT 1 FROM public.notifications n
          WHERE n.company_id = v_comp.id AND n.user_id = v_user_id AND n.dedup_key = v_dedup
        ) THEN
          INSERT INTO public.notifications (
            company_id, user_id, type, title, message, content, related_id, dedup_key
          ) VALUES (
            v_comp.id,
            v_user_id,
            'document_expiry',
            'تنبيه انتهاء مستند: ' || v_doc.title,
            'المستند رقم (' || v_doc.document_number || ') ' ||
              CASE WHEN v_days_left < 0 THEN 'منتهي الصلاحية منذ ' || ABS(v_days_left) || ' يوم.'
                   WHEN v_days_left = 0 THEN 'ينتهي اليوم!'
                   ELSE 'ينتهي خلال ' || v_days_left || ' يوم.' END,
            'وثيقة ومستند شركة بحاجة إلى تجديد عاجل.',
            v_doc.id,
            v_dedup
          );
          v_count := v_count + 1;
        END IF;
      END LOOP;
    END LOOP;

    -- B. Overdue Invoices
    FOR v_inv IN
      SELECT inv.id, inv.invoice_number, inv.due_date, inv.client_name,
             (inv.total_amount - COALESCE(inv.paid_amount, 0)) AS remaining
      FROM public.invoices inv
      WHERE inv.company_id = v_comp.id
        AND inv.due_date < CURRENT_DATE
        AND inv.status NOT IN ('paid', 'مدفوعة')
        AND (inv.total_amount - COALESCE(inv.paid_amount, 0)) > 0
    LOOP
      v_dedup := 'inv_overdue:' || v_inv.id || ':' || v_inv.due_date;
      FOR v_user_id IN
        SELECT uc.user_id FROM public.user_companies uc
        WHERE uc.company_id = v_comp.id AND uc.is_active = true
      LOOP
        IF NOT EXISTS (
          SELECT 1 FROM public.notifications n
          WHERE n.company_id = v_comp.id AND n.user_id = v_user_id AND n.dedup_key = v_dedup
        ) THEN
          INSERT INTO public.notifications (
            company_id, user_id, type, title, message, content, related_id, dedup_key
          ) VALUES (
            v_comp.id,
            v_user_id,
            'invoice_overdue',
            'فاتورة مبيعات متأخرة: ' || v_inv.invoice_number,
            'الفاتورة رقم (' || v_inv.invoice_number || ') للعميل ' || COALESCE(v_inv.client_name, 'العميل') ||
              ' بقيمة متبقية ' || v_inv.remaining || ' ر.س تجاوزت موعد استحقاقها (' || v_inv.due_date || ').',
            'مطالبة مالية متأخرة التحصيل تتطلب المتابعة مع العميل.',
            v_inv.id,
            v_dedup
          );
          v_count := v_count + 1;
        END IF;
      END LOOP;
    END LOOP;

    -- C. Overdue Site Custodies
    FOR v_cust IN
      SELECT sc.id, sc.custody_number, COALESCE(p.name, sc.title, 'الموظف') AS custodian_name, sc.opened_date, sc.remaining_amount
      FROM public.site_custodies sc
      LEFT JOIN public.partners p ON p.id = sc.partner_id
      WHERE sc.company_id = v_comp.id
        AND sc.status = 'open'
        AND sc.opened_date < (CURRENT_DATE - (COALESCE(sc.max_days, 30) || ' days')::interval)
        AND sc.remaining_amount > 0
    LOOP
      v_dedup := 'custody_overdue:' || v_cust.id;
      FOR v_user_id IN
        SELECT uc.user_id FROM public.user_companies uc
        WHERE uc.company_id = v_comp.id AND uc.is_active = true
      LOOP
        IF NOT EXISTS (
          SELECT 1 FROM public.notifications n
          WHERE n.company_id = v_comp.id AND n.user_id = v_user_id AND n.dedup_key = v_dedup
        ) THEN
          INSERT INTO public.notifications (
            company_id, user_id, type, title, message, content, related_id, dedup_key
          ) VALUES (
            v_comp.id,
            v_user_id,
            'custody_overdue',
            'عهدة موقع متأخرة: ' || v_cust.custody_number,
            'عهدة ' || v_cust.custodian_name || ' برصيد ' || v_cust.remaining_amount ||
              ' ر.س مفتوحة منذ تاريخ ' || v_cust.opened_date || ' (أكثر من 30 يوماً).',
            'عهدة موقع مفتوحة تتطلب التسوية أو الاسترداد.',
            v_cust.id,
            v_dedup
          );
          v_count := v_count + 1;
        END IF;
      END LOOP;
    END LOOP;

    -- D. Retention Warranty Releases Due
    FOR v_proj IN
      WITH r_summary AS (
        SELECT pr.id, pr."Property" AS project_name,
               COALESCE(
                 pr.retention_release_date,
                 (COALESCE(pr.handover_date, pr.actual_completion_date, CURRENT_DATE) + (COALESCE(pr.warranty_period_months, 12) || ' months')::interval)::date
               ) AS release_date,
               (
                 COALESCE((SELECT sum(inv.retention_amount) FROM public.invoices inv WHERE pr.id = ANY(inv.project_ids) AND inv.company_id = v_comp.id AND inv.retention_released = false), 0)
                 +
                 COALESCE((SELECT sum(sc.retention_amount) FROM public.sub_claims sc WHERE ((sc.project_id = pr.id) OR (sc.project_ids IS NOT NULL AND sc.project_ids ? pr.id::text)) AND sc.company_id = v_comp.id AND sc.retention_released = false), 0)
               ) AS total_retention
        FROM public.projects pr
        WHERE pr.company_id = v_comp.id
      )
      SELECT * FROM r_summary
      WHERE total_retention > 0 AND release_date <= (CURRENT_DATE + INTERVAL '30 days')
    LOOP
      v_dedup := 'retention_due:' || v_proj.id || ':' || v_proj.release_date;
      FOR v_user_id IN
        SELECT uc.user_id FROM public.user_companies uc
        WHERE uc.company_id = v_comp.id AND uc.is_active = true
      LOOP
        IF NOT EXISTS (
          SELECT 1 FROM public.notifications n
          WHERE n.company_id = v_comp.id AND n.user_id = v_user_id AND n.dedup_key = v_dedup
        ) THEN
          INSERT INTO public.notifications (
            company_id, user_id, type, title, message, content, related_id, dedup_key
          ) VALUES (
            v_comp.id,
            v_user_id,
            'retention_due',
            'استحقاق فك ضمان أعمال: ' || v_proj.project_name,
            'مشروع ' || v_proj.project_name || ' اقترب موعد فك ضمان الأعمال (' || v_proj.release_date || ') بإجمالي محجوز ' || v_proj.total_retention || ' ر.س.',
            'ضمان أعمال مستحق الفك في الموعد المحدد.',
            v_proj.id,
            v_dedup
          );
          v_count := v_count + 1;
        END IF;
      END LOOP;
    END LOOP;

  END LOOP;

  RETURN v_count;
END;
$$;

-- Public wrapper to trigger scan manually from frontend
CREATE OR REPLACE FUNCTION public.run_daily_health_and_expiry_scans()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rawasi_private
AS $$
BEGIN
  IF NOT (rawasi_private.can_access('audit_logs', 'view') OR rawasi_private.can_access('accounting', 'view') OR rawasi_private.is_admin()) THEN
    RAISE EXCEPTION 'غير مصرح بتشغيل الفحص التلقائي' USING ERRCODE = '42501';
  END IF;

  RETURN rawasi_private.run_daily_health_and_expiry_scans();
END;
$$;

-- 9. pg_cron Schedule (إذا كان الملحق مفعلاً)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('daily_health_and_expiry_scan')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily_health_and_expiry_scan');

      PERFORM cron.schedule(
        'daily_health_and_expiry_scan',
        '0 6 * * *',
        'SELECT rawasi_private.run_daily_health_and_expiry_scans();'
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'pg_cron schedule notice: %', SQLERRM;
    END;
  END IF;
END;
$$;

-- 10. Permissions & Grants
-- -----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.get_system_health_radar() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_document_expiry_alerts(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_company_document(uuid, text, text, text, date, date, integer, uuid, uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_company_document_renewed(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_daily_health_and_expiry_scans() TO authenticated;
GRANT EXECUTE ON FUNCTION rawasi_private.run_daily_health_and_expiry_scans() TO authenticated;
