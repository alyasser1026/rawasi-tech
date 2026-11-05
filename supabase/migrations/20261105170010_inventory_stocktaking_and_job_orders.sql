-- Migration: 20261105170010_inventory_stocktaking_and_job_orders.sql
-- Description: Phase 5 (Batch 2) - Stocktaking Sessions, Item Cards, Moving Average Cost, Inventory Dashboard & Comprehensive Job Order (اوامر التشغيل) Links

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $preflight$
BEGIN
  IF to_regclass('public.purchase_orders') IS NULL THEN
    RAISE EXCEPTION 'Purchase orders system is required before Phase 5 Batch 2';
  END IF;
  IF to_regclass('public.stocktaking_sessions') IS NOT NULL THEN
    RAISE EXCEPTION 'public.stocktaking_sessions already exists';
  END IF;
END;
$preflight$;

-- =============================================================================
-- 1. LINK OPERATIONAL JOB ORDERS (أوامر التشغيل) TO PURCHASES, RECEIPTS & INVOICES
-- =============================================================================

-- A) Purchase Orders (أمر الشراء لكامل أمر التشغيل)
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS job_order_id uuid;

ALTER TABLE public.purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_job_order_fkey;

ALTER TABLE public.purchase_orders
  ADD CONSTRAINT purchase_orders_job_order_fkey
  FOREIGN KEY (job_order_id, company_id) REFERENCES public.job_orders(id, company_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS po_company_job_order_idx
  ON public.purchase_orders(company_id, job_order_id);

DROP TRIGGER IF EXISTS trg_job_order_link_po ON public.purchase_orders;
CREATE TRIGGER trg_job_order_link_po
  BEFORE INSERT OR UPDATE OF job_order_id, project_id ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.check_job_order_link('project_id');

-- B) Purchase Order Lines (بند أمر الشراء لأمر تشغيل محدد)
ALTER TABLE public.purchase_order_lines
  ADD COLUMN IF NOT EXISTS job_order_id uuid;

ALTER TABLE public.purchase_order_lines
  DROP CONSTRAINT IF EXISTS purchase_order_lines_job_order_fkey;

ALTER TABLE public.purchase_order_lines
  ADD CONSTRAINT purchase_order_lines_job_order_fkey
  FOREIGN KEY (job_order_id, company_id) REFERENCES public.job_orders(id, company_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS po_lines_company_job_order_idx
  ON public.purchase_order_lines(company_id, job_order_id);

-- C) Material Receipt Lines (سند استلام المواد مخصص لأمر تشغيل)
ALTER TABLE public.material_receipt_lines
  ADD COLUMN IF NOT EXISTS job_order_id uuid;

ALTER TABLE public.material_receipt_lines
  DROP CONSTRAINT IF EXISTS material_receipt_lines_job_order_fkey;

ALTER TABLE public.material_receipt_lines
  ADD CONSTRAINT material_receipt_lines_job_order_fkey
  FOREIGN KEY (job_order_id, company_id) REFERENCES public.job_orders(id, company_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS material_receipt_lines_job_order_idx
  ON public.material_receipt_lines(company_id, job_order_id);

-- D) Supplier Invoices & Lines (فاتورة المورد لأمر تشغيل)
ALTER TABLE public.supplier_invoices
  ADD COLUMN IF NOT EXISTS job_order_id uuid;

ALTER TABLE public.supplier_invoices
  DROP CONSTRAINT IF EXISTS supplier_invoices_job_order_fkey;

ALTER TABLE public.supplier_invoices
  ADD CONSTRAINT supplier_invoices_job_order_fkey
  FOREIGN KEY (job_order_id, company_id) REFERENCES public.job_orders(id, company_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS supplier_invoices_job_order_idx
  ON public.supplier_invoices(company_id, job_order_id);

DROP TRIGGER IF EXISTS trg_job_order_link_supp_inv ON public.supplier_invoices;
CREATE TRIGGER trg_job_order_link_supp_inv
  BEFORE INSERT OR UPDATE OF job_order_id, project_id ON public.supplier_invoices
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.check_job_order_link('project_id');

ALTER TABLE public.supplier_invoice_lines
  ADD COLUMN IF NOT EXISTS job_order_id uuid;

ALTER TABLE public.supplier_invoice_lines
  DROP CONSTRAINT IF EXISTS supplier_invoice_lines_job_order_fkey;

ALTER TABLE public.supplier_invoice_lines
  ADD CONSTRAINT supplier_invoice_lines_job_order_fkey
  FOREIGN KEY (job_order_id, company_id) REFERENCES public.job_orders(id, company_id) ON DELETE SET NULL;

-- =============================================================================
-- 2. EXTEND MATERIAL ITEMS (حدود الطلب، كمية إعادة الطلب، المتوسط المرجح للتكلفة)
-- =============================================================================
ALTER TABLE public.material_items
  ADD COLUMN IF NOT EXISTS min_order_level numeric(15,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reorder_qty numeric(15,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS moving_avg_cost numeric(15,2) NOT NULL DEFAULT 0;

-- =============================================================================
-- 3. STOCKTAKING SESSIONS (جلسات الجرد الميداني للمخازن والمواقع)
-- =============================================================================
CREATE TABLE public.stocktaking_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT rawasi_private.current_company_id() REFERENCES public.companies(id) ON DELETE RESTRICT,
  session_number text NOT NULL DEFAULT '',
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  job_order_id uuid,
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'counted', 'approved', 'posted', 'cancelled')),
  is_posted boolean NOT NULL DEFAULT false,
  journal_header_id uuid REFERENCES public.journal_headers(id) ON DELETE SET NULL,
  total_difference_amount numeric(15,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  CONSTRAINT stocktaking_sessions_company_session_no_uq UNIQUE (company_id, session_number),
  CONSTRAINT stocktaking_sessions_job_order_fkey FOREIGN KEY (job_order_id, company_id) REFERENCES public.job_orders(id, company_id) ON DELETE SET NULL,
  CONSTRAINT stocktaking_sessions_company_id_uq UNIQUE (id, company_id)
);

CREATE TRIGGER aa_stamp_company_id BEFORE INSERT OR UPDATE OF company_id ON public.stocktaking_sessions
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id();

CREATE TRIGGER trg_stocktaking_session_number BEFORE INSERT ON public.stocktaking_sessions
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.assign_document_number('STK', 'session_number', 'session_date');

CREATE TRIGGER trg_job_order_link_stk BEFORE INSERT OR UPDATE OF job_order_id, project_id ON public.stocktaking_sessions
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.check_job_order_link('project_id');

-- =============================================================================
-- 4. STOCKTAKING LINES (بنود الجرد الفعلي والفروق المحاسبية)
-- =============================================================================
CREATE TABLE public.stocktaking_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT rawasi_private.current_company_id() REFERENCES public.companies(id) ON DELETE RESTRICT,
  session_id uuid NOT NULL,
  item_id uuid NOT NULL,
  job_order_id uuid,
  system_quantity numeric(15,3) NOT NULL DEFAULT 0,
  actual_quantity numeric(15,3) NOT NULL DEFAULT 0 CHECK (actual_quantity >= 0),
  difference_quantity numeric(15,3) GENERATED ALWAYS AS (actual_quantity - system_quantity) STORED,
  unit_cost numeric(15,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  difference_amount numeric(15,2) GENERATED ALWAYS AS ((actual_quantity - system_quantity) * unit_cost) STORED,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stocktaking_lines_session_fkey FOREIGN KEY (session_id, company_id) REFERENCES public.stocktaking_sessions(id, company_id) ON DELETE CASCADE,
  CONSTRAINT stocktaking_lines_item_fkey FOREIGN KEY (item_id, company_id) REFERENCES public.material_items(id, company_id) ON DELETE RESTRICT,
  CONSTRAINT stocktaking_lines_job_order_fkey FOREIGN KEY (job_order_id, company_id) REFERENCES public.job_orders(id, company_id) ON DELETE SET NULL,
  CONSTRAINT stocktaking_lines_company_id_uq UNIQUE (id, company_id)
);

CREATE TRIGGER aa_stamp_company_id BEFORE INSERT OR UPDATE OF company_id ON public.stocktaking_lines
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id();

-- Register with company-scoped tables
INSERT INTO rawasi_private.company_scoped_tables(table_name)
VALUES ('stocktaking_sessions'), ('stocktaking_lines')
ON CONFLICT (table_name) DO NOTHING;

-- Indexes
CREATE INDEX stocktaking_sessions_company_proj_idx ON public.stocktaking_sessions(company_id, project_id);
CREATE INDEX stocktaking_sessions_company_jo_idx ON public.stocktaking_sessions(company_id, job_order_id);
CREATE INDEX stocktaking_sessions_company_status_idx ON public.stocktaking_sessions(company_id, status);
CREATE INDEX stocktaking_lines_session_idx ON public.stocktaking_lines(company_id, session_id);
CREATE INDEX stocktaking_lines_item_idx ON public.stocktaking_lines(company_id, item_id);

-- RLS & Grants
ALTER TABLE public.stocktaking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stocktaking_lines ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stocktaking_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stocktaking_lines TO authenticated;
GRANT ALL ON public.stocktaking_sessions, public.stocktaking_lines TO service_role;

CREATE POLICY stocktaking_sessions_select ON public.stocktaking_sessions FOR SELECT TO authenticated
  USING (
    (rawasi_private.can_access('materials', 'view') OR rawasi_private.can_access('accounting', 'view'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY stocktaking_sessions_insert ON public.stocktaking_sessions FOR INSERT TO authenticated
  WITH CHECK (
    (rawasi_private.can_access('materials', 'create') OR rawasi_private.can_access('accounting', 'create'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY stocktaking_sessions_update ON public.stocktaking_sessions FOR UPDATE TO authenticated
  USING (
    (rawasi_private.can_access('materials', 'edit') OR rawasi_private.can_access('accounting', 'edit'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY stocktaking_lines_select ON public.stocktaking_lines FOR SELECT TO authenticated
  USING (
    (rawasi_private.can_access('materials', 'view') OR rawasi_private.can_access('accounting', 'view'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY stocktaking_lines_insert ON public.stocktaking_lines FOR INSERT TO authenticated
  WITH CHECK (
    (rawasi_private.can_access('materials', 'create') OR rawasi_private.can_access('accounting', 'create'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

-- =============================================================================
-- 5. RPC: CREATE STOCKTAKING SESSION
-- =============================================================================
CREATE OR REPLACE FUNCTION public.create_stocktaking_session(
  p_project_id uuid,
  p_job_order_id uuid,
  p_session_date date,
  p_notes text,
  p_lines jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company uuid := rawasi_private.current_company_id();
  v_session_id uuid;
  v_line jsonb;
  v_item_id uuid;
  v_actual_qty numeric;
  v_system_qty numeric;
  v_unit_cost numeric;
  v_line_jo uuid;
BEGIN
  IF NOT (rawasi_private.can_access('materials', 'create') OR rawasi_private.can_access('accounting', 'create')) THEN
    RAISE EXCEPTION 'غير مصرح بإنشاء جلسات جرد المخزون' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.stocktaking_sessions (
    company_id, project_id, job_order_id, session_date, status, notes
  ) VALUES (
    v_company, p_project_id, p_job_order_id, coalesce(p_session_date, CURRENT_DATE), 'counted', p_notes
  ) RETURNING id INTO v_session_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_item_id := (v_line->>'item_id')::uuid;
    v_actual_qty := coalesce((v_line->>'actual_quantity')::numeric, 0);
    v_line_jo := coalesce((v_line->>'job_order_id')::uuid, p_job_order_id);

    -- Calculate system quantity in the company / project if not supplied
    IF (v_line ? 'system_quantity') THEN
      v_system_qty := (v_line->>'system_quantity')::numeric;
    ELSE
      -- Total receipts minus total issues for this item in this project
      SELECT coalesce(
        (SELECT sum(mrl.quantity) FROM public.material_receipt_lines mrl
         JOIN public.material_receipts mr ON mr.id = mrl.receipt_id
         WHERE mrl.company_id = v_company AND mrl.item_id = v_item_id AND mr.is_posted
           AND (p_project_id IS NULL OR mr.project_id = p_project_id)
           AND (v_line_jo IS NULL OR mrl.job_order_id = v_line_jo)), 0
      ) - coalesce(
        (SELECT sum(mil.quantity) FROM public.material_issue_lines mil
         JOIN public.material_issues mi ON mi.id = mil.issue_id
         WHERE mil.company_id = v_company AND mil.item_id = v_item_id AND mi.is_posted
           AND (p_project_id IS NULL OR mi.project_id = p_project_id)
           AND (v_line_jo IS NULL OR mil.job_order_id = v_line_jo)), 0
      ) INTO v_system_qty;
    END IF;

    -- Unit cost (from item moving average cost, or default unit price, or fallback)
    SELECT coalesce(
      nullif(moving_avg_cost, 0),
      nullif(default_unit_price, 0),
      (v_line->>'unit_cost')::numeric,
      0
    ) INTO v_unit_cost
    FROM public.material_items
    WHERE id = v_item_id AND company_id = v_company;

    INSERT INTO public.stocktaking_lines (
      company_id, session_id, item_id, job_order_id, system_quantity, actual_quantity, unit_cost, notes
    ) VALUES (
      v_company, v_session_id, v_item_id, v_line_jo, v_system_qty, v_actual_qty, v_unit_cost, v_line->>'notes'
    );
  END LOOP;

  -- Update total difference amount on session
  UPDATE public.stocktaking_sessions
  SET total_difference_amount = coalesce((
    SELECT sum(difference_amount) FROM public.stocktaking_lines WHERE session_id = v_session_id
  ), 0)
  WHERE id = v_session_id;

  RETURN v_session_id;
END;
$$;

-- =============================================================================
-- 6. RPC: POST STOCKTAKING SESSION (اعتماد وترحيل قيد التسوية الجردية)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.post_stocktaking_session(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company uuid := rawasi_private.current_company_id();
  v_session public.stocktaking_sessions%ROWTYPE;
  v_acc_126 uuid; -- مخزون الخامات والمواد
  v_acc_527 uuid; -- تسويات وفروق جردية
  v_jh_id uuid;
  v_tot_diff numeric;
  v_line record;
BEGIN
  IF NOT (rawasi_private.can_access('materials', 'edit') OR rawasi_private.can_access('accounting', 'edit')) THEN
    RAISE EXCEPTION 'غير مصرح بترحيل جلسات جرد المخزون' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_session
  FROM public.stocktaking_sessions
  WHERE id = p_session_id AND company_id = v_company
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'جلسة الجرد غير موجودة' USING ERRCODE = '23503';
  END IF;

  IF v_session.is_posted THEN
    RAISE EXCEPTION 'جلسة الجرد مرحلة مسبقاً' USING ERRCODE = '23514';
  END IF;

  v_acc_126 := rawasi_private.require_company_account('126');
  v_acc_527 := rawasi_private.require_company_account('527');

  -- Recalculate total difference
  SELECT coalesce(sum(difference_amount), 0) INTO v_tot_diff
  FROM public.stocktaking_lines
  WHERE session_id = p_session_id;

  -- Create GL Journal Entry if there is any difference
  IF v_tot_diff <> 0 THEN
    INSERT INTO public.journal_headers (
      company_id, entry_date, description, reference_id, v_type, status
    ) VALUES (
      v_company,
      v_session.session_date,
      'قيد تسوية فروق جرد مخزني - جلسة رقم ' || v_session.session_number || coalesce(' - مشروع ' || (SELECT "Property" FROM public.projects WHERE id = v_session.project_id), ''),
      p_session_id,
      'inventory_adjustment',
      'posted'
    ) RETURNING id INTO v_jh_id;

    IF v_tot_diff < 0 THEN
      -- Shortage (عجز جردي: الفعلي أقل من الدفتري)
      -- مدين: تسويات وفروق جردية (527)
      -- دائن: مخزون الخامات والمواد (126)
      INSERT INTO public.journal_lines (header_id, account_id, debit, credit, notes, job_order_id, company_id)
      VALUES (v_jh_id, v_acc_527, abs(v_tot_diff), 0, 'عجز جردي - جلسة ' || v_session.session_number, v_session.job_order_id, v_company);

      INSERT INTO public.journal_lines (header_id, account_id, debit, credit, notes, job_order_id, company_id)
      VALUES (v_jh_id, v_acc_126, 0, abs(v_tot_diff), 'تخفيض المخزون بالفارق الفعلي للجرد', v_session.job_order_id, v_company);
    ELSE
      -- Surplus (زيادة جردية: الفعلي أكبر من الدفتري)
      -- مدين: مخزون الخامات والمواد (126)
      -- دائن: تسويات وفروق جردية (527)
      INSERT INTO public.journal_lines (header_id, account_id, debit, credit, notes, job_order_id, company_id)
      VALUES (v_jh_id, v_acc_126, v_tot_diff, 0, 'إثبات زيادة جردية - جلسة ' || v_session.session_number, v_session.job_order_id, v_company);

      INSERT INTO public.journal_lines (header_id, account_id, debit, credit, notes, job_order_id, company_id)
      VALUES (v_jh_id, v_acc_527, 0, v_tot_diff, 'أرباح تسوية فروق الجرد', v_session.job_order_id, v_company);
    END IF;
  END IF;

  -- Update items' moving average cost
  FOR v_line IN SELECT item_id, unit_cost FROM public.stocktaking_lines WHERE session_id = p_session_id AND unit_cost > 0 LOOP
    UPDATE public.material_items
    SET moving_avg_cost = v_line.unit_cost
    WHERE id = v_line.item_id AND company_id = v_company;
  END LOOP;

  -- Mark session as posted
  UPDATE public.stocktaking_sessions
  SET is_posted = true,
      status = 'posted',
      journal_header_id = v_jh_id,
      total_difference_amount = v_tot_diff,
      updated_at = now()
  WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'session_id', p_session_id,
    'session_number', v_session.session_number,
    'total_difference_amount', v_tot_diff,
    'journal_header_id', v_jh_id,
    'status', 'posted'
  );
END;
$$;

-- =============================================================================
-- 7. RPC: GET ITEM STOCK CARD (كارت الصنف والحركة المخزنية الشاملة)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_item_stock_card(
  p_item_id uuid,
  p_project_id uuid DEFAULT NULL,
  p_job_order_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company uuid := rawasi_private.current_company_id();
  v_item record;
  v_movements jsonb;
  v_current_stock numeric := 0;
  v_total_in numeric := 0;
  v_total_out numeric := 0;
BEGIN
  IF NOT (rawasi_private.can_access('materials', 'view') OR rawasi_private.can_access('accounting', 'view')) THEN
    RAISE EXCEPTION 'غير مصرح بالاطلاع على كارت الصنف' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_item
  FROM public.material_items
  WHERE id = p_item_id AND company_id = v_company;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الصنف غير موجود' USING ERRCODE = '23503';
  END IF;

  WITH all_movements AS (
    -- 1. Inward Receipts (توريد مواد للمخزن أو المشروع)
    SELECT
      mr.receipt_date AS move_date,
      'توريد خامات (سند استلام)' AS doc_type,
      mr.receipt_number AS doc_number,
      mr.id AS doc_id,
      coalesce(mrl.job_order_id, mr.job_order_id) AS job_order_id,
      jo.order_number AS job_order_number,
      mr.project_id,
      p."Property" AS project_name,
      part.name AS entity_name,
      mrl.quantity AS qty_in,
      0::numeric AS qty_out,
      mrl.unit_price AS unit_cost,
      mrl.created_at AS sort_ts
    FROM public.material_receipt_lines mrl
    JOIN public.material_receipts mr ON mr.id = mrl.receipt_id
    LEFT JOIN public.projects p ON p.id = mr.project_id
    LEFT JOIN public.job_orders jo ON jo.id = coalesce(mrl.job_order_id, mr.job_order_id)
    LEFT JOIN public.partners part ON part.id = mr.supplier_id
    WHERE mrl.company_id = v_company
      AND mrl.item_id = p_item_id
      AND mr.is_posted
      AND (p_project_id IS NULL OR mr.project_id = p_project_id)
      AND (p_job_order_id IS NULL OR coalesce(mrl.job_order_id, mr.job_order_id) = p_job_order_id)

    UNION ALL

    -- 2. Outward Issues (صرف مواد لمشروع / أمر تشغيل مقاول باطن)
    SELECT
      mi.issue_date AS move_date,
      'صرف خامات (سند صرف)' AS doc_type,
      mi.issue_number AS doc_number,
      mi.id AS doc_id,
      coalesce(mil.job_order_id, mi.job_order_id) AS job_order_id,
      jo.order_number AS job_order_number,
      mi.project_id,
      p."Property" AS project_name,
      coalesce(part.name, mi.contractor_text_name) AS entity_name,
      0::numeric AS qty_in,
      mil.quantity AS qty_out,
      mil.unit_price AS unit_cost,
      mi.created_at AS sort_ts
    FROM public.material_issue_lines mil
    JOIN public.material_issues mi ON mi.id = mil.issue_id
    LEFT JOIN public.projects p ON p.id = mi.project_id
    LEFT JOIN public.job_orders jo ON jo.id = coalesce(mil.job_order_id, mi.job_order_id)
    LEFT JOIN public.partners part ON part.id = mi.subcontractor_id
    WHERE mil.company_id = v_company
      AND mil.item_id = p_item_id
      AND mi.is_posted
      AND (p_project_id IS NULL OR mi.project_id = p_project_id)
      AND (p_job_order_id IS NULL OR coalesce(mil.job_order_id, mi.job_order_id) = p_job_order_id)

    UNION ALL

    -- 3. Stocktaking Adjustments (تسويات جردية)
    SELECT
      st.session_date AS move_date,
      'تسوية جرد فعلي' AS doc_type,
      st.session_number AS doc_number,
      st.id AS doc_id,
      coalesce(stl.job_order_id, st.job_order_id) AS job_order_id,
      jo.order_number AS job_order_number,
      st.project_id,
      p."Property" AS project_name,
      'لجنة الجرد والمطابقة' AS entity_name,
      CASE WHEN stl.difference_quantity > 0 THEN stl.difference_quantity ELSE 0 END AS qty_in,
      CASE WHEN stl.difference_quantity < 0 THEN abs(stl.difference_quantity) ELSE 0 END AS qty_out,
      stl.unit_cost,
      stl.created_at AS sort_ts
    FROM public.stocktaking_lines stl
    JOIN public.stocktaking_sessions st ON st.id = stl.session_id
    LEFT JOIN public.projects p ON p.id = st.project_id
    LEFT JOIN public.job_orders jo ON jo.id = coalesce(stl.job_order_id, st.job_order_id)
    WHERE stl.company_id = v_company
      AND stl.item_id = p_item_id
      AND st.is_posted
      AND (p_project_id IS NULL OR st.project_id = p_project_id)
      AND (p_job_order_id IS NULL OR coalesce(stl.job_order_id, st.job_order_id) = p_job_order_id)
  ),
  movements_with_running AS (
    SELECT
      m.*,
      sum(m.qty_in - m.qty_out) OVER (ORDER BY m.move_date, m.sort_ts) AS running_qty
    FROM all_movements m
  )
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'move_date', m.move_date,
      'doc_type', m.doc_type,
      'doc_number', m.doc_number,
      'doc_id', m.doc_id,
      'job_order_id', m.job_order_id,
      'job_order_number', m.job_order_number,
      'project_id', m.project_id,
      'project_name', m.project_name,
      'entity_name', m.entity_name,
      'qty_in', m.qty_in,
      'qty_out', m.qty_out,
      'unit_cost', m.unit_cost,
      'running_qty', m.running_qty
    ) ORDER BY m.move_date DESC, m.sort_ts DESC
  ), '[]'::jsonb),
  coalesce(sum(m.qty_in), 0),
  coalesce(sum(m.qty_out), 0)
  INTO v_movements, v_total_in, v_total_out
  FROM movements_with_running m;

  v_current_stock := v_total_in - v_total_out;

  RETURN jsonb_build_object(
    'item', jsonb_build_object(
      'id', v_item.id,
      'code', v_item.item_code,
      'name', v_item.item_name,
      'unit', v_item.default_unit,
      'moving_avg_cost', v_item.moving_avg_cost,
      'min_order_level', v_item.min_order_level,
      'reorder_qty', v_item.reorder_qty,
      'total_in', v_total_in,
      'total_out', v_total_out,
      'current_stock', v_current_stock,
      'total_value', v_current_stock * v_item.moving_avg_cost
    ),
    'movements', v_movements
  );
END;
$$;

-- =============================================================================
-- 8. RPC: GET INVENTORY DASHBOARD SUMMARY (تقييم المخزون، حد الطلب، الركود)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_inventory_dashboard_summary(
  p_project_id uuid DEFAULT NULL,
  p_job_order_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company uuid := rawasi_private.current_company_id();
  v_kpis jsonb;
  v_low_stock jsonb;
  v_stagnant jsonb;
  v_stocktakes jsonb;
  v_gl_126_balance numeric := 0;
BEGIN
  IF NOT (rawasi_private.can_access('materials', 'view') OR rawasi_private.can_access('accounting', 'view')) THEN
    RAISE EXCEPTION 'غير مصرح بالاطلاع على تقارير المخزون' USING ERRCODE = '42501';
  END IF;

  -- 1. Account 126 GL Balance
  SELECT coalesce(sum(jl.debit - jl.credit), 0) INTO v_gl_126_balance
  FROM public.journal_lines jl
  JOIN public.accounts a ON a.id = jl.account_id
  JOIN public.journal_headers jh ON jh.id = jl.header_id
  WHERE a.company_id = v_company AND a.code = '126' AND jh.status IN ('posted', 'مرحل', 'معتمد');

  -- Item inventory calculations
  WITH item_balances AS (
    SELECT
      mi.id AS item_id,
      mi.item_code,
      mi.item_name,
      mi.default_unit,
      mi.min_order_level,
      mi.reorder_qty,
      mi.moving_avg_cost,
      coalesce(r.total_received, 0) - coalesce(i.total_issued, 0) + coalesce(s.total_adjustment, 0) AS current_stock,
      coalesce(r.last_receipt, i.last_issue) AS last_movement_date
    FROM public.material_items mi
    LEFT JOIN LATERAL (
      SELECT sum(mrl.quantity) AS total_received, max(mr.receipt_date) AS last_receipt
      FROM public.material_receipt_lines mrl
      JOIN public.material_receipts mr ON mr.id = mrl.receipt_id
      WHERE mrl.company_id = v_company AND mrl.item_id = mi.id AND mr.is_posted
        AND (p_project_id IS NULL OR mr.project_id = p_project_id)
        AND (p_job_order_id IS NULL OR coalesce(mrl.job_order_id, mr.job_order_id) = p_job_order_id)
    ) r ON true
    LEFT JOIN LATERAL (
      SELECT sum(mil.quantity) AS total_issued, max(mi2.issue_date) AS last_issue
      FROM public.material_issue_lines mil
      JOIN public.material_issues mi2 ON mi2.id = mil.issue_id
      WHERE mil.company_id = v_company AND mil.item_id = mi.id AND mi2.is_posted
        AND (p_project_id IS NULL OR mi2.project_id = p_project_id)
        AND (p_job_order_id IS NULL OR coalesce(mil.job_order_id, mi2.job_order_id) = p_job_order_id)
    ) i ON true
    LEFT JOIN LATERAL (
      SELECT sum(stl.difference_quantity) AS total_adjustment
      FROM public.stocktaking_lines stl
      JOIN public.stocktaking_sessions st ON st.id = stl.session_id
      WHERE stl.company_id = v_company AND stl.item_id = mi.id AND st.is_posted
        AND (p_project_id IS NULL OR st.project_id = p_project_id)
        AND (p_job_order_id IS NULL OR coalesce(stl.job_order_id, st.job_order_id) = p_job_order_id)
    ) s ON true
    WHERE mi.company_id = v_company
  )
  SELECT
    jsonb_build_object(
      'total_items_count', count(*),
      'total_inventory_valuation', coalesce(sum(current_stock * moving_avg_cost), 0),
      'gl_126_balance', v_gl_126_balance,
      'valuation_gl_variance', coalesce(sum(current_stock * moving_avg_cost), 0) - v_gl_126_balance,
      'low_stock_count', count(*) FILTER (WHERE current_stock <= min_order_level AND min_order_level > 0),
      'stagnant_count', count(*) FILTER (WHERE current_stock > 0 AND (last_movement_date IS NULL OR last_movement_date < CURRENT_DATE - 60))
    ),
    coalesce(jsonb_agg(
      jsonb_build_object(
        'item_id', item_id,
        'item_code', item_code,
        'item_name', item_name,
        'unit', default_unit,
        'current_stock', current_stock,
        'min_order_level', min_order_level,
        'reorder_qty', reorder_qty,
        'suggested_po_qty', greatest(reorder_qty, min_order_level * 2 - current_stock)
      )
    ) FILTER (WHERE current_stock <= min_order_level AND min_order_level > 0), '[]'::jsonb),
    coalesce(jsonb_agg(
      jsonb_build_object(
        'item_id', item_id,
        'item_code', item_code,
        'item_name', item_name,
        'unit', default_unit,
        'current_stock', current_stock,
        'moving_avg_cost', moving_avg_cost,
        'stagnant_value', current_stock * moving_avg_cost,
        'last_movement_date', last_movement_date,
        'days_dormant', CURRENT_DATE - coalesce(last_movement_date, CURRENT_DATE - 365)
      )
    ) FILTER (WHERE current_stock > 0 AND (last_movement_date IS NULL OR last_movement_date < CURRENT_DATE - 60)), '[]'::jsonb)
  INTO v_kpis, v_low_stock, v_stagnant
  FROM item_balances;

  -- Recent stocktaking sessions
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', st.id,
      'session_number', st.session_number,
      'session_date', st.session_date,
      'project_name', p."Property",
      'job_order_number', jo.order_number,
      'total_difference_amount', st.total_difference_amount,
      'status', st.status,
      'is_posted', st.is_posted
    ) ORDER BY st.session_date DESC, st.session_number DESC
  ), '[]'::jsonb) INTO v_stocktakes
  FROM public.stocktaking_sessions st
  LEFT JOIN public.projects p ON p.id = st.project_id
  LEFT JOIN public.job_orders jo ON jo.id = st.job_order_id
  WHERE st.company_id = v_company
    AND (p_project_id IS NULL OR st.project_id = p_project_id)
    AND (p_job_order_id IS NULL OR st.job_order_id = p_job_order_id)
  LIMIT 20;

  RETURN jsonb_build_object(
    'kpis', v_kpis,
    'low_stock_items', v_low_stock,
    'stagnant_items', v_stagnant,
    'recent_stocktakes', v_stocktakes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_stocktaking_session(uuid, uuid, date, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.post_stocktaking_session(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_item_stock_card(uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_inventory_dashboard_summary(uuid, uuid) TO authenticated, service_role;

COMMIT;
