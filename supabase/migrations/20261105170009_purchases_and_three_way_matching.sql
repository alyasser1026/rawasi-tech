-- Migration: 20261105170009_purchases_and_three_way_matching.sql
-- Description: Phase 5 (Batch 1) - Purchase Orders, Material Receipt Linking, Supplier Invoices, and 3-Way Matching

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $preflight$
BEGIN
  IF to_regclass('public.companies') IS NULL THEN
    RAISE EXCEPTION 'Multi-company system is required before Phase 5';
  END IF;
  IF to_regclass('public.purchase_orders') IS NOT NULL THEN
    RAISE EXCEPTION 'public.purchase_orders already exists';
  END IF;
  IF to_regclass('public.supplier_invoices') IS NOT NULL THEN
    RAISE EXCEPTION 'public.supplier_invoices already exists';
  END IF;
END;
$preflight$;

-- =============================================================================
-- 1. PURCHASE ORDERS TABLE (أوامر الشراء للمشاريع)
-- =============================================================================
CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT rawasi_private.current_company_id() REFERENCES public.companies(id) ON DELETE RESTRICT,
  po_number text NOT NULL DEFAULT '',
  supplier_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE RESTRICT,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date date,
  subtotal numeric(15,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  tax_amount numeric(15,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount numeric(15,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'partially_received', 'received', 'closed', 'cancelled')),
  approved_by uuid,
  approved_at timestamptz,
  notes text,
  terms text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  CONSTRAINT purchase_orders_company_po_no_uq UNIQUE (company_id, po_number),
  CONSTRAINT purchase_orders_company_id_uq UNIQUE (id, company_id)
);

-- =============================================================================
-- 2. PURCHASE ORDER LINES TABLE (بنود أمر الشراء)
-- =============================================================================
CREATE TABLE public.purchase_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT rawasi_private.current_company_id() REFERENCES public.companies(id) ON DELETE RESTRICT,
  po_id uuid NOT NULL,
  item_id uuid REFERENCES public.material_items(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  description text,
  quantity numeric(15,3) NOT NULL CHECK (quantity > 0),
  received_quantity numeric(15,3) NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
  invoiced_quantity numeric(15,3) NOT NULL DEFAULT 0 CHECK (invoiced_quantity >= 0),
  unit text NOT NULL DEFAULT 'وحدة',
  unit_price numeric(15,2) NOT NULL CHECK (unit_price >= 0),
  total_price numeric(15,2) NOT NULL CHECK (total_price >= 0),
  tax_rate numeric(5,2) NOT NULL DEFAULT 15.00,
  tax_amount numeric(15,2) NOT NULL DEFAULT 0,
  boq_item_id uuid REFERENCES public.boq_budget(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT po_lines_po_fkey FOREIGN KEY (po_id, company_id) REFERENCES public.purchase_orders(id, company_id) ON DELETE CASCADE,
  CONSTRAINT po_lines_company_id_uq UNIQUE (id, company_id)
);

-- =============================================================================
-- 3. LINK MATERIAL RECEIPTS TO PURCHASE ORDERS
-- =============================================================================
ALTER TABLE public.material_receipts
  ADD COLUMN po_id uuid;

ALTER TABLE public.material_receipts
  ADD CONSTRAINT material_receipts_po_fkey
  FOREIGN KEY (po_id, company_id) REFERENCES public.purchase_orders(id, company_id) ON DELETE SET NULL;

ALTER TABLE public.material_receipt_lines
  ADD COLUMN po_line_id uuid;

ALTER TABLE public.material_receipt_lines
  ADD CONSTRAINT material_receipt_lines_po_line_fkey
  FOREIGN KEY (po_line_id, company_id) REFERENCES public.purchase_order_lines(id, company_id) ON DELETE SET NULL;

ALTER TABLE public.material_receipt_lines
  ADD CONSTRAINT material_receipt_lines_id_company_key
  UNIQUE (id, company_id);

-- =============================================================================
-- 4. SUPPLIER INVOICES (فواتير الموردين الضريبية)
-- =============================================================================
CREATE TABLE public.supplier_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT rawasi_private.current_company_id() REFERENCES public.companies(id) ON DELETE RESTRICT,
  invoice_number text NOT NULL DEFAULT '',
  supplier_invoice_ref text NOT NULL,
  supplier_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE RESTRICT,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  po_id uuid,
  receipt_id uuid,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  subtotal numeric(15,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  tax_amount numeric(15,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount numeric(15,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  paid_amount numeric(15,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'posted', 'paid', 'cancelled')),
  is_posted boolean NOT NULL DEFAULT false,
  journal_header_id uuid REFERENCES public.journal_headers(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  CONSTRAINT supplier_invoices_company_inv_no_uq UNIQUE (company_id, invoice_number),
  CONSTRAINT supplier_invoices_po_fkey FOREIGN KEY (po_id, company_id) REFERENCES public.purchase_orders(id, company_id) ON DELETE SET NULL,
  CONSTRAINT supplier_invoices_receipt_fkey FOREIGN KEY (receipt_id, company_id) REFERENCES public.material_receipts(id, company_id) ON DELETE SET NULL,
  CONSTRAINT supplier_invoices_company_id_uq UNIQUE (id, company_id)
);

-- =============================================================================
-- 5. SUPPLIER INVOICE LINES (بنود فاتورة المورد)
-- =============================================================================
CREATE TABLE public.supplier_invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT rawasi_private.current_company_id() REFERENCES public.companies(id) ON DELETE RESTRICT,
  invoice_id uuid NOT NULL,
  po_line_id uuid,
  receipt_line_id uuid,
  item_name text NOT NULL,
  quantity numeric(15,3) NOT NULL CHECK (quantity > 0),
  unit text NOT NULL DEFAULT 'وحدة',
  unit_price numeric(15,2) NOT NULL CHECK (unit_price >= 0),
  total_price numeric(15,2) NOT NULL CHECK (total_price >= 0),
  tax_rate numeric(5,2) NOT NULL DEFAULT 15.00,
  tax_amount numeric(15,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supp_inv_lines_inv_fkey FOREIGN KEY (invoice_id, company_id) REFERENCES public.supplier_invoices(id, company_id) ON DELETE CASCADE,
  CONSTRAINT supp_inv_lines_po_line_fkey FOREIGN KEY (po_line_id, company_id) REFERENCES public.purchase_order_lines(id, company_id) ON DELETE SET NULL,
  CONSTRAINT supp_inv_lines_receipt_line_fkey FOREIGN KEY (receipt_line_id, company_id) REFERENCES public.material_receipt_lines(id, company_id) ON DELETE SET NULL,
  CONSTRAINT supp_inv_lines_company_id_uq UNIQUE (id, company_id)
);

-- Register new tables in rawasi_private.company_scoped_tables
INSERT INTO rawasi_private.company_scoped_tables(table_name)
VALUES ('purchase_orders'), ('purchase_order_lines'), ('supplier_invoices'), ('supplier_invoice_lines');

-- Indexes
CREATE INDEX purchase_orders_company_supplier_idx ON public.purchase_orders(company_id, supplier_id);
CREATE INDEX purchase_orders_company_project_idx ON public.purchase_orders(company_id, project_id);
CREATE INDEX purchase_orders_company_status_idx ON public.purchase_orders(company_id, status);
CREATE INDEX po_lines_po_id_idx ON public.purchase_order_lines(company_id, po_id);
CREATE INDEX material_receipts_po_idx ON public.material_receipts(company_id, po_id);
CREATE INDEX material_receipt_lines_po_line_idx ON public.material_receipt_lines(company_id, po_line_id);
CREATE INDEX supplier_invoices_company_supp_idx ON public.supplier_invoices(company_id, supplier_id);
CREATE INDEX supplier_invoices_company_po_idx ON public.supplier_invoices(company_id, po_id);
CREATE INDEX supplier_invoices_company_status_idx ON public.supplier_invoices(company_id, status);
CREATE INDEX supplier_inv_lines_inv_idx ON public.supplier_invoice_lines(company_id, invoice_id);

-- Triggers for company stamping and document numbering
CREATE TRIGGER aa_stamp_company_id BEFORE INSERT OR UPDATE OF company_id ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id();

CREATE TRIGGER aa_stamp_company_id BEFORE INSERT OR UPDATE OF company_id ON public.purchase_order_lines
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id();

CREATE TRIGGER aa_stamp_company_id BEFORE INSERT OR UPDATE OF company_id ON public.supplier_invoices
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id();

CREATE TRIGGER aa_stamp_company_id BEFORE INSERT OR UPDATE OF company_id ON public.supplier_invoice_lines
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id();

CREATE TRIGGER trg_doc_number BEFORE INSERT ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.assign_document_number('PO', 'po_number', 'order_date');

CREATE TRIGGER trg_doc_number BEFORE INSERT ON public.supplier_invoices
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.assign_document_number('SINV', 'invoice_number', 'invoice_date');

-- Enable RLS
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_invoice_lines ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_lines TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_invoice_lines TO authenticated;
GRANT ALL ON public.purchase_orders, public.purchase_order_lines, public.supplier_invoices, public.supplier_invoice_lines TO service_role;

-- RLS Policies
CREATE POLICY po_select ON public.purchase_orders FOR SELECT TO authenticated
  USING (
    (rawasi_private.can_access('materials', 'view') OR rawasi_private.can_access('accounting', 'view'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY po_insert ON public.purchase_orders FOR INSERT TO authenticated
  WITH CHECK (
    (rawasi_private.can_access('materials', 'create') OR rawasi_private.can_access('accounting', 'create'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY po_update ON public.purchase_orders FOR UPDATE TO authenticated
  USING (
    (rawasi_private.can_access('materials', 'edit') OR rawasi_private.can_access('accounting', 'edit'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY po_lines_select ON public.purchase_order_lines FOR SELECT TO authenticated
  USING (
    (rawasi_private.can_access('materials', 'view') OR rawasi_private.can_access('accounting', 'view'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY po_lines_insert ON public.purchase_order_lines FOR INSERT TO authenticated
  WITH CHECK (
    (rawasi_private.can_access('materials', 'create') OR rawasi_private.can_access('accounting', 'create'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY supp_inv_select ON public.supplier_invoices FOR SELECT TO authenticated
  USING (
    (rawasi_private.can_access('materials', 'view') OR rawasi_private.can_access('accounting', 'view') OR rawasi_private.can_access('invoices', 'view'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY supp_inv_insert ON public.supplier_invoices FOR INSERT TO authenticated
  WITH CHECK (
    (rawasi_private.can_access('materials', 'create') OR rawasi_private.can_access('accounting', 'create') OR rawasi_private.can_access('invoices', 'create'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY supp_inv_update ON public.supplier_invoices FOR UPDATE TO authenticated
  USING (
    (rawasi_private.can_access('materials', 'edit') OR rawasi_private.can_access('accounting', 'edit') OR rawasi_private.can_access('invoices', 'edit'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY supp_inv_lines_select ON public.supplier_invoice_lines FOR SELECT TO authenticated
  USING (
    (rawasi_private.can_access('materials', 'view') OR rawasi_private.can_access('accounting', 'view'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY supp_inv_lines_insert ON public.supplier_invoice_lines FOR INSERT TO authenticated
  WITH CHECK (
    (rawasi_private.can_access('materials', 'create') OR rawasi_private.can_access('accounting', 'create'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

-- =============================================================================
-- 6. STORED PROCEDURES & RPCS
-- =============================================================================

-- 6.1 CREATE PURCHASE ORDER
CREATE OR REPLACE FUNCTION public.create_purchase_order(
  p_supplier_id uuid,
  p_project_id uuid DEFAULT NULL,
  p_order_date date DEFAULT CURRENT_DATE,
  p_expected_delivery date DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_terms text DEFAULT NULL,
  p_lines jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company uuid := rawasi_private.current_company_id();
  v_po_id uuid;
  v_item record;
  v_line_qty numeric;
  v_line_price numeric;
  v_line_total numeric;
  v_line_tax numeric;
  v_subtotal numeric(15,2) := 0;
  v_tax_total numeric(15,2) := 0;
BEGIN
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'يلزم تحديد الشركة المفتوحة لإصدار أمر الشراء' USING ERRCODE = '42501';
  END IF;

  IF NOT (rawasi_private.can_access('materials', 'create') OR rawasi_private.can_access('accounting', 'create')) THEN
    RAISE EXCEPTION 'ليس لديك صلاحية إنشاء أمر شراء' USING ERRCODE = '42501';
  END IF;

  IF jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'يلزم إضافة بند واحد على الأقل في أمر الشراء' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.purchase_orders (
    company_id, supplier_id, project_id, order_date, expected_delivery_date,
    subtotal, tax_amount, total_amount, status, notes, terms
  ) VALUES (
    v_company, p_supplier_id, p_project_id, coalesce(p_order_date, CURRENT_DATE),
    p_expected_delivery, 0, 0, 0, 'draft', p_notes, p_terms
  ) RETURNING id INTO v_po_id;

  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_lines) AS (
    item_id uuid,
    item_name text,
    description text,
    quantity numeric,
    unit text,
    unit_price numeric,
    tax_rate numeric,
    boq_item_id uuid,
    notes text
  )
  LOOP
    v_line_qty := coalesce(v_item.quantity, 0);
    v_line_price := coalesce(v_item.unit_price, 0);

    IF v_line_qty <= 0 THEN
      RAISE EXCEPTION 'الكمية المطلوبة للبند (%) يجب أن تكون أكبر من صفر', v_item.item_name USING ERRCODE = '23514';
    END IF;

    v_line_total := round(v_line_qty * v_line_price, 2);
    v_line_tax := round(v_line_total * (coalesce(v_item.tax_rate, 15.00) / 100.00), 2);

    INSERT INTO public.purchase_order_lines (
      company_id, po_id, item_id, item_name, description, quantity,
      unit, unit_price, total_price, tax_rate, tax_amount, boq_item_id, notes
    ) VALUES (
      v_company, v_po_id, v_item.item_id, v_item.item_name, v_item.description,
      v_line_qty, coalesce(v_item.unit, 'وحدة'), v_line_price, v_line_total,
      coalesce(v_item.tax_rate, 15.00), v_line_tax, v_item.boq_item_id, v_item.notes
    );

    v_subtotal := v_subtotal + v_line_total;
    v_tax_total := v_tax_total + v_line_tax;
  END LOOP;

  UPDATE public.purchase_orders
  SET subtotal = v_subtotal,
      tax_amount = v_tax_total,
      total_amount = v_subtotal + v_tax_total
  WHERE id = v_po_id;

  RETURN v_po_id;
END;
$$;

-- 6.2 APPROVE PURCHASE ORDER
CREATE OR REPLACE FUNCTION public.approve_purchase_order(
  p_po_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company uuid := rawasi_private.current_company_id();
  v_po record;
BEGIN
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'يلزم تحديد الشركة المفتوحة' USING ERRCODE = '42501';
  END IF;

  IF NOT (rawasi_private.can_access('materials', 'edit') OR rawasi_private.can_access('accounting', 'edit')) THEN
    RAISE EXCEPTION 'ليس لديك صلاحية اعتماد أمر الشراء' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_po
  FROM public.purchase_orders
  WHERE id = p_po_id AND company_id = v_company
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'أمر الشراء غير موجود' USING ERRCODE = 'P0002';
  END IF;

  IF v_po.status <> 'draft' THEN
    RAISE EXCEPTION 'أمر الشراء بحالة (%)- ولا يمكن اعتماده إلا من حالة مسودة', v_po.status USING ERRCODE = '23514';
  END IF;

  UPDATE public.purchase_orders
  SET status = 'approved',
      approved_by = auth.uid(),
      approved_at = now(),
      updated_at = now()
  WHERE id = p_po_id;

  RETURN jsonb_build_object(
    'po_id', p_po_id,
    'status', 'approved',
    'po_number', v_po.po_number
  );
END;
$$;

-- 6.3 RECEIVE MATERIALS FROM PURCHASE ORDER (استلام خامات من أمر الشراء وتوليد قيد المخزون)
CREATE OR REPLACE FUNCTION public.receive_materials_from_po(
  p_po_id uuid,
  p_receipt_date date DEFAULT CURRENT_DATE,
  p_lines jsonb DEFAULT '[]'::jsonb,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company uuid := rawasi_private.current_company_id();
  v_po record;
  v_receipt_id uuid;
  v_receipt_num text;
  v_jh_id uuid;
  v_acc_126 uuid; -- مخزون الخامات والمواد
  v_acc_218 uuid; -- بضاعة مستلمة غير مفوترة (GRNI)
  v_line record;
  v_po_line record;
  v_qty numeric;
  v_total_receipt numeric(15,2) := 0;
  v_all_received boolean := true;
  v_lines_count integer := 0;
BEGIN
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'يلزم تحديد الشركة المفتوحة' USING ERRCODE = '42501';
  END IF;

  IF NOT (rawasi_private.can_access('materials', 'create') OR rawasi_private.can_access('accounting', 'create')) THEN
    RAISE EXCEPTION 'ليس لديك صلاحية تسجيل استلام مواد' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_po
  FROM public.purchase_orders
  WHERE id = p_po_id AND company_id = v_company
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'أمر الشراء غير موجود' USING ERRCODE = 'P0002';
  END IF;

  IF v_po.status NOT IN ('approved', 'partially_received') THEN
    RAISE EXCEPTION 'لا يمكن الاستلام من أمر شراء بحالة (%)، يلزم اعتماده أولاً', v_po.status USING ERRCODE = '23514';
  END IF;

  v_acc_126 := rawasi_private.require_company_account('126');
  v_acc_218 := rawasi_private.require_company_account('218');

  -- Create Material Receipt Record
  INSERT INTO public.material_receipts (
    company_id, po_id, project_id, supplier_id, receipt_date,
    total_amount, status, receipt_type, is_posted, notes
  ) VALUES (
    v_company, p_po_id, v_po.project_id, v_po.supplier_id,
    coalesce(p_receipt_date, CURRENT_DATE), 0, 'معتمد', 'توريد خامات', true,
    coalesce(p_notes, 'استلام من أمر شراء رقم: ' || v_po.po_number)
  ) RETURNING id, receipt_number INTO v_receipt_id, v_receipt_num;

  -- Create Journal Header for Inventory Receipt
  INSERT INTO public.journal_headers (
    company_id, entry_date, description, reference_id, v_type, status
  ) VALUES (
    v_company, coalesce(p_receipt_date, CURRENT_DATE),
    'إثبات استلام مواد من أمر شراء ' || v_po.po_number || ' بسند استلام ' || v_receipt_num,
    v_receipt_id, 'material_receipts', 'posted'
  ) RETURNING id INTO v_jh_id;

  FOR v_line IN SELECT * FROM jsonb_to_recordset(p_lines) AS (
    po_line_id uuid,
    quantity numeric,
    notes text
  )
  LOOP
    v_qty := coalesce(v_line.quantity, 0);
    IF v_qty > 0 THEN
      SELECT * INTO v_po_line
      FROM public.purchase_order_lines
      WHERE id = v_line.po_line_id AND po_id = p_po_id AND company_id = v_company
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'بند أمر الشراء غير موجود' USING ERRCODE = 'P0002';
      END IF;

      -- Check remaining quantity
      IF (v_po_line.received_quantity + v_qty) > v_po_line.quantity THEN
        RAISE EXCEPTION 'الكمية المستلمة للبند (%) تتجاوز الكمية المطلوبة بأمر الشراء (المطلوب: %، المستلم سابقاً: %، المستلم حالياً: %)',
          v_po_line.item_name, v_po_line.quantity, v_po_line.received_quantity, v_qty USING ERRCODE = '23514';
      END IF;

      -- Insert receipt line
      INSERT INTO public.material_receipt_lines (
        company_id, receipt_id, po_line_id, item_id, item_name,
        quantity, unit, unit_price, total_price, project_id, boq_item_id
      ) VALUES (
        v_company, v_receipt_id, v_po_line.id, v_po_line.item_id, v_po_line.item_name,
        v_qty, v_po_line.unit, v_po_line.unit_price, round(v_qty * v_po_line.unit_price, 2),
        v_po.project_id, v_po_line.boq_item_id
      );

      -- Update PO line received quantity
      UPDATE public.purchase_order_lines
      SET received_quantity = received_quantity + v_qty
      WHERE id = v_po_line.id;

      v_total_receipt := v_total_receipt + round(v_qty * v_po_line.unit_price, 2);
      v_lines_count := v_lines_count + 1;
    END IF;
  END LOOP;

  IF v_lines_count = 0 THEN
    RAISE EXCEPTION 'يلزم استلام كمية واحدة على الأقل' USING ERRCODE = '23514';
  END IF;

  -- 1. Debit: Inventory Account (126) for exact received value
  INSERT INTO public.journal_lines (
    company_id, header_id, account_id, project_id, partner_id, debit, credit, notes
  ) VALUES (
    v_company, v_jh_id, v_acc_126, v_po.project_id, v_po.supplier_id,
    v_total_receipt, 0, 'إثبات إضافة المخزون بسند ' || v_receipt_num
  );

  -- 2. Credit: Goods Received Not Invoiced GRNI (218)
  INSERT INTO public.journal_lines (
    company_id, header_id, account_id, project_id, partner_id, debit, credit, notes
  ) VALUES (
    v_company, v_jh_id, v_acc_218, v_po.project_id, v_po.supplier_id,
    0, v_total_receipt, 'استحقاق توريد مواد غير مفوترة - أمر شراء ' || v_po.po_number
  );

  -- Update receipt totals and link to JV
  UPDATE public.material_receipts
  SET total_amount = v_total_receipt,
      jv_id = v_jh_id
  WHERE id = v_receipt_id;

  -- Check if all lines are fully received
  SELECT bool_and(received_quantity >= quantity) INTO v_all_received
  FROM public.purchase_order_lines
  WHERE po_id = p_po_id AND company_id = v_company;

  UPDATE public.purchase_orders
  SET status = CASE WHEN v_all_received THEN 'received' ELSE 'partially_received' END,
      updated_at = now()
  WHERE id = p_po_id;

  RETURN jsonb_build_object(
    'receipt_id', v_receipt_id,
    'receipt_number', v_receipt_num,
    'journal_header_id', v_jh_id,
    'total_amount', v_total_receipt,
    'po_status', CASE WHEN v_all_received THEN 'received' ELSE 'partially_received' END
  );
END;
$$;

-- 6.4 CREATE SUPPLIER INVOICE (فاتورة مورد مع مطابقة ثلاثية 3-Way Matching)
CREATE OR REPLACE FUNCTION public.create_supplier_invoice(
  p_supplier_id uuid,
  p_supplier_ref text,
  p_po_id uuid DEFAULT NULL,
  p_receipt_id uuid DEFAULT NULL,
  p_invoice_date date DEFAULT CURRENT_DATE,
  p_due_date date DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_lines jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company uuid := rawasi_private.current_company_id();
  v_inv_id uuid;
  v_item record;
  v_line_qty numeric;
  v_line_price numeric;
  v_line_total numeric;
  v_line_tax numeric;
  v_subtotal numeric(15,2) := 0;
  v_tax_total numeric(15,2) := 0;
  v_proj_id uuid;
BEGIN
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'يلزم تحديد الشركة المفتوحة' USING ERRCODE = '42501';
  END IF;

  IF NOT (rawasi_private.can_access('materials', 'create') OR rawasi_private.can_access('accounting', 'create') OR rawasi_private.can_access('invoices', 'create')) THEN
    RAISE EXCEPTION 'ليس لديك صلاحية تسجيل فاتورة مورد' USING ERRCODE = '42501';
  END IF;

  IF trim(coalesce(p_supplier_ref, '')) = '' THEN
    RAISE EXCEPTION 'يلزم تسجيل رقم فاتورة المورد الضريبية الأصلية' USING ERRCODE = '23514';
  END IF;

  IF jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'يلزم إضافة بند واحد على الأقل في فاتورة المورد' USING ERRCODE = '23514';
  END IF;

  -- Get project from PO if provided
  IF p_po_id IS NOT NULL THEN
    SELECT project_id INTO v_proj_id FROM public.purchase_orders WHERE id = p_po_id AND company_id = v_company;
  END IF;

  INSERT INTO public.supplier_invoices (
    company_id, supplier_invoice_ref, supplier_id, project_id, po_id, receipt_id,
    invoice_date, due_date, subtotal, tax_amount, total_amount, paid_amount,
    status, is_posted, notes
  ) VALUES (
    v_company, p_supplier_ref, p_supplier_id, v_proj_id, p_po_id, p_receipt_id,
    coalesce(p_invoice_date, CURRENT_DATE), p_due_date, 0, 0, 0, 0,
    'draft', false, p_notes
  ) RETURNING id INTO v_inv_id;

  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_lines) AS (
    po_line_id uuid,
    receipt_line_id uuid,
    item_name text,
    quantity numeric,
    unit text,
    unit_price numeric,
    tax_rate numeric,
    notes text
  )
  LOOP
    v_line_qty := coalesce(v_item.quantity, 0);
    v_line_price := coalesce(v_item.unit_price, 0);

    IF v_line_qty <= 0 THEN
      RAISE EXCEPTION 'الكمية للبند (%) يجب أن تكون أكبر من صفر', v_item.item_name USING ERRCODE = '23514';
    END IF;

    v_line_total := round(v_line_qty * v_line_price, 2);
    v_line_tax := round(v_line_total * (coalesce(v_item.tax_rate, 15.00) / 100.00), 2);

    INSERT INTO public.supplier_invoice_lines (
      company_id, invoice_id, po_line_id, receipt_line_id, item_name,
      quantity, unit, unit_price, total_price, tax_rate, tax_amount, notes
    ) VALUES (
      v_company, v_inv_id, v_item.po_line_id, v_item.receipt_line_id, v_item.item_name,
      v_line_qty, coalesce(v_item.unit, 'وحدة'), v_line_price, v_line_total,
      coalesce(v_item.tax_rate, 15.00), v_line_tax, v_item.notes
    );

    v_subtotal := v_subtotal + v_line_total;
    v_tax_total := v_tax_total + v_line_tax;
  END LOOP;

  UPDATE public.supplier_invoices
  SET subtotal = v_subtotal,
      tax_amount = v_tax_total,
      total_amount = v_subtotal + v_tax_total
  WHERE id = v_inv_id;

  RETURN v_inv_id;
END;
$$;

-- 6.5 POST SUPPLIER INVOICE (إقفال وسيط 218 وإثبات ذمة المورد 211 وضريبة المشتريات 215)
CREATE OR REPLACE FUNCTION public.post_supplier_invoice(
  p_invoice_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company uuid := rawasi_private.current_company_id();
  v_inv record;
  v_jh_id uuid;
  v_acc_211 uuid; -- الموردون
  v_acc_215 uuid; -- ضريبة القيمة المضافة
  v_acc_218 uuid; -- وسيط بضاعة مستلمة غير مفوترة
  v_line record;
  v_po_all_closed boolean := false;
BEGIN
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'يلزم تحديد الشركة المفتوحة' USING ERRCODE = '42501';
  END IF;

  IF NOT (rawasi_private.can_access('materials', 'edit') OR rawasi_private.can_access('accounting', 'create')) THEN
    RAISE EXCEPTION 'ليس لديك صلاحية ترحيل فاتورة المورد' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_inv
  FROM public.supplier_invoices
  WHERE id = p_invoice_id AND company_id = v_company
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'فاتورة المورد غير موجودة' USING ERRCODE = 'P0002';
  END IF;

  IF v_inv.is_posted THEN
    RAISE EXCEPTION 'فاتورة المورد مرحلة مسبقاً' USING ERRCODE = '23514';
  END IF;

  v_acc_211 := rawasi_private.require_company_account('211');
  v_acc_215 := rawasi_private.require_company_account('215');
  v_acc_218 := rawasi_private.require_company_account('218');

  -- Create Journal Entry for Supplier Invoice
  INSERT INTO public.journal_headers (
    company_id, entry_date, description, reference_id, v_type, status
  ) VALUES (
    v_company, v_inv.invoice_date,
    'إثبات فاتورة مورد ' || v_inv.supplier_invoice_ref || ' (رقم النظام: ' || v_inv.invoice_number || ')',
    v_inv.id, 'supplier_invoices', 'posted'
  ) RETURNING id INTO v_jh_id;

  -- 1. Debit: Goods Received Not Invoiced (218) for subtotal (إقفال وسيط الاستلام)
  INSERT INTO public.journal_lines (
    company_id, header_id, account_id, project_id, partner_id, debit, credit, notes
  ) VALUES (
    v_company, v_jh_id, v_acc_218, v_inv.project_id, v_inv.supplier_id,
    v_inv.subtotal, 0, 'إقفال وسيط الاستلام لفاتورة ' || v_inv.supplier_invoice_ref
  );

  -- 2. Debit: Input VAT Account (215)
  IF v_inv.tax_amount > 0 THEN
    INSERT INTO public.journal_lines (
      company_id, header_id, account_id, project_id, partner_id, debit, credit, notes
    ) VALUES (
      v_company, v_jh_id, v_acc_215, v_inv.project_id, v_inv.supplier_id,
      v_inv.tax_amount, 0, 'ضريبة مدخلات مشتريات 15% - فاتورة ' || v_inv.supplier_invoice_ref
    );
  END IF;

  -- 3. Credit: Supplier Liability Account (211) for full invoice total
  INSERT INTO public.journal_lines (
    company_id, header_id, account_id, project_id, partner_id, debit, credit, notes
  ) VALUES (
    v_company, v_jh_id, v_acc_211, v_inv.project_id, v_inv.supplier_id,
    0, v_inv.total_amount, 'إثبات استحقاق ذمة المورد - فاتورة ' || v_inv.supplier_invoice_ref
  );

  -- Update PO lines invoiced quantity if PO linked
  IF v_inv.po_id IS NOT NULL THEN
    FOR v_line IN
      SELECT po_line_id, sum(quantity) AS qty
      FROM public.supplier_invoice_lines
      WHERE invoice_id = v_inv.id AND po_line_id IS NOT NULL
      GROUP BY po_line_id
    LOOP
      UPDATE public.purchase_order_lines
      SET invoiced_quantity = invoiced_quantity + v_line.qty
      WHERE id = v_line.po_line_id;
    END LOOP;

    -- Check if PO is now fully closed
    SELECT bool_and(received_quantity >= quantity AND invoiced_quantity >= quantity) INTO v_po_all_closed
    FROM public.purchase_order_lines
    WHERE po_id = v_inv.po_id AND company_id = v_company;

    IF v_po_all_closed THEN
      UPDATE public.purchase_orders SET status = 'closed', updated_at = now() WHERE id = v_inv.po_id;
    END IF;
  END IF;

  UPDATE public.supplier_invoices
  SET is_posted = true,
      status = 'posted',
      journal_header_id = v_jh_id,
      updated_at = now()
  WHERE id = v_inv.id;

  RETURN jsonb_build_object(
    'invoice_id', v_inv.id,
    'invoice_number', v_inv.invoice_number,
    'journal_header_id', v_jh_id,
    'status', 'posted'
  );
END;
$$;

-- 6.6 GET PURCHASE ORDER 3-WAY MATCHING
CREATE OR REPLACE FUNCTION public.get_purchase_order_matching(
  p_po_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company uuid := rawasi_private.current_company_id();
  v_po record;
  v_lines jsonb;
  v_receipts jsonb;
  v_invoices jsonb;
BEGIN
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'يلزم تحديد الشركة المفتوحة' USING ERRCODE = '42501';
  END IF;

  SELECT po.*, p.name AS supplier_name, pr."Property" AS project_name
  INTO v_po
  FROM public.purchase_orders po
  JOIN public.partners p ON p.id = po.supplier_id
  LEFT JOIN public.projects pr ON pr.id = po.project_id
  WHERE po.id = p_po_id AND po.company_id = v_company;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'أمر الشراء غير موجود' USING ERRCODE = 'P0002';
  END IF;

  -- 1. Lines matching
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'line_id', l.id,
      'item_name', l.item_name,
      'ordered_qty', l.quantity,
      'received_qty', l.received_quantity,
      'invoiced_qty', l.invoiced_quantity,
      'remaining_to_receive', greatest(0, l.quantity - l.received_quantity),
      'remaining_to_invoice', greatest(0, l.quantity - l.invoiced_quantity),
      'unit', l.unit,
      'po_unit_price', l.unit_price,
      'po_total_price', l.total_price,
      'is_fully_received', (l.received_quantity >= l.quantity),
      'is_fully_invoiced', (l.invoiced_quantity >= l.quantity)
    ) ORDER BY l.item_name
  ), '[]'::jsonb) INTO v_lines
  FROM public.purchase_order_lines l
  WHERE l.po_id = p_po_id AND l.company_id = v_company;

  -- 2. Linked receipts
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'receipt_id', r.id,
      'receipt_number', r.receipt_number,
      'receipt_date', r.receipt_date,
      'total_amount', r.total_amount,
      'status', r.status,
      'is_posted', r.is_posted
    ) ORDER BY r.receipt_date DESC
  ), '[]'::jsonb) INTO v_receipts
  FROM public.material_receipts r
  WHERE r.po_id = p_po_id AND r.company_id = v_company;

  -- 3. Linked supplier invoices
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'invoice_id', si.id,
      'invoice_number', si.invoice_number,
      'supplier_ref', si.supplier_invoice_ref,
      'invoice_date', si.invoice_date,
      'subtotal', si.subtotal,
      'tax_amount', si.tax_amount,
      'total_amount', si.total_amount,
      'status', si.status,
      'is_posted', si.is_posted
    ) ORDER BY si.invoice_date DESC
  ), '[]'::jsonb) INTO v_invoices
  FROM public.supplier_invoices si
  WHERE si.po_id = p_po_id AND si.company_id = v_company;

  RETURN jsonb_build_object(
    'po_id', v_po.id,
    'po_number', v_po.po_number,
    'supplier_name', v_po.supplier_name,
    'project_name', v_po.project_name,
    'order_date', v_po.order_date,
    'status', v_po.status,
    'total_amount', v_po.total_amount,
    'lines', v_lines,
    'receipts', v_receipts,
    'invoices', v_invoices
  );
END;
$$;

-- 6.7 GET PURCHASE ORDERS SUMMARY
CREATE OR REPLACE FUNCTION public.get_purchase_orders_summary(
  p_status text DEFAULT 'all',
  p_project_id uuid DEFAULT NULL,
  p_supplier_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company uuid := rawasi_private.current_company_id();
  v_kpis jsonb;
  v_pos jsonb;
BEGIN
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'يلزم تحديد الشركة المفتوحة' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'total_pos', count(*),
    'draft_pos', count(*) FILTER (WHERE status = 'draft'),
    'approved_pos', count(*) FILTER (WHERE status = 'approved'),
    'partially_received_pos', count(*) FILTER (WHERE status = 'partially_received'),
    'received_pos', count(*) FILTER (WHERE status = 'received'),
    'closed_pos', count(*) FILTER (WHERE status = 'closed'),
    'total_orders_value', coalesce(sum(total_amount), 0)
  ) INTO v_kpis
  FROM public.purchase_orders
  WHERE company_id = v_company;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', po.id,
      'po_number', po.po_number,
      'order_date', po.order_date,
      'expected_delivery_date', po.expected_delivery_date,
      'supplier_id', po.supplier_id,
      'supplier_name', p.name,
      'project_id', po.project_id,
      'project_name', pr."Property",
      'subtotal', po.subtotal,
      'tax_amount', po.tax_amount,
      'total_amount', po.total_amount,
      'status', po.status,
      'notes', po.notes,
      'lines_count', (SELECT count(*) FROM public.purchase_order_lines pol WHERE pol.po_id = po.id)
    ) ORDER BY po.order_date DESC, po.po_number DESC
  ), '[]'::jsonb) INTO v_pos
  FROM public.purchase_orders po
  JOIN public.partners p ON p.id = po.supplier_id
  LEFT JOIN public.projects pr ON pr.id = po.project_id
  WHERE po.company_id = v_company
    AND (p_status = 'all' OR po.status = p_status)
    AND (p_project_id IS NULL OR po.project_id = p_project_id)
    AND (p_supplier_id IS NULL OR po.supplier_id = p_supplier_id);

  RETURN jsonb_build_object(
    'kpis', v_kpis,
    'orders', v_pos
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_purchase_order(uuid, uuid, date, date, text, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_purchase_order(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.receive_materials_from_po(uuid, date, jsonb, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_supplier_invoice(uuid, text, uuid, uuid, date, date, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.post_supplier_invoice(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_purchase_order_matching(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_purchase_orders_summary(text, uuid, uuid) TO authenticated, service_role;

COMMIT;
