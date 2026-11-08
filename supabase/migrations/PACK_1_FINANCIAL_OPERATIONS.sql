-- =============================================================================
-- حزمة 1: العمليات المالية والضمان والإقرارات (أوامر التشغيل، القيود، الضرائب، أعمار الديون، العهد وإقفال الصناديق)
-- =============================================================================


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- FILE: 20261105170000_document_numbering.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- Sequential document numbers per company, document type and year: INV-2026-0001.
--
-- Types: invoice INV, receipt voucher RV, payment voucher PV, contractor claim CLM, work order JO,
-- material receipt MR, material issue ISS.
-- The number is given by the database when the document is saved, in the same transaction, from a
-- locked counter row: no duplicates when two people save at once, and a save that fails gives no number
-- away (no gaps). Numbers the screens still make up (random INV-2026-48213 etc.) are replaced.
-- A signed-in user cannot change a number after saving. Inserts without a signed-in user (server
-- restore, SQL editor) keep the number they bring, so backups restore with their original numbers.
-- Existing documents keep their numbers; a new number that already exists in the company is skipped.

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $preflight$
BEGIN
  IF to_regclass('rawasi_private.job_order_link_originals') IS NULL THEN
    RAISE EXCEPTION 'Apply 20261105150000_job_order_links.sql first';
  END IF;
  IF to_regclass('rawasi_private.document_counters') IS NOT NULL THEN
    RAISE EXCEPTION 'document_numbering is already applied';
  END IF;
END;
$preflight$;

CREATE TABLE rawasi_private.document_counters (
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  year integer NOT NULL,
  last_number integer NOT NULL CHECK (last_number >= 0),
  PRIMARY KEY (company_id, doc_type, year)
);
REVOKE ALL ON rawasi_private.document_counters FROM PUBLIC, anon, authenticated;

-- TG_ARGV: [0] prefix, [1] number column, [2] date column
CREATE FUNCTION rawasi_private.assign_document_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_prefix text := TG_ARGV[0];
  v_col text := TG_ARGV[1];
  v_given text := NULLIF(trim(to_jsonb(NEW)->>TG_ARGV[1]), '');
  v_date date := COALESCE(NULLIF(to_jsonb(NEW)->>TG_ARGV[2], '')::date, current_date);
  v_year integer := extract(year FROM v_date)::integer;
  v_n integer;
  v_number text;
  v_taken boolean;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- the number stays as saved for signed-in users
    IF auth.uid() IS NOT NULL AND v_given IS DISTINCT FROM NULLIF(trim(to_jsonb(OLD)->>v_col), '') THEN
      NEW := jsonb_populate_record(NEW, jsonb_build_object(v_col, to_jsonb(OLD)->>v_col));
    END IF;
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL AND v_given IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'لا يمكن ترقيم مستند من غير شركة' USING ERRCODE = '23502';
  END IF;

  LOOP
    INSERT INTO rawasi_private.document_counters (company_id, doc_type, year, last_number)
    VALUES (NEW.company_id, v_prefix, v_year, 1)
    ON CONFLICT (company_id, doc_type, year)
      DO UPDATE SET last_number = rawasi_private.document_counters.last_number + 1
    RETURNING last_number INTO v_n;

    v_number := v_prefix || '-' || v_year || '-' || lpad(v_n::text, 4, '0');
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I.%I WHERE company_id = $1 AND %I = $2)', TG_TABLE_SCHEMA, TG_TABLE_NAME, v_col)
      INTO v_taken USING NEW.company_id, v_number;
    EXIT WHEN NOT v_taken;
  END LOOP;

  NEW := jsonb_populate_record(NEW, jsonb_build_object(v_col, v_number));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION rawasi_private.assign_document_number() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_doc_number BEFORE INSERT OR UPDATE OF invoice_number ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.assign_document_number('INV', 'invoice_number', 'date');
CREATE TRIGGER trg_doc_number BEFORE INSERT OR UPDATE OF receipt_number ON public.receipt_vouchers
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.assign_document_number('RV', 'receipt_number', 'date');
CREATE TRIGGER trg_doc_number BEFORE INSERT OR UPDATE OF voucher_number ON public.payment_vouchers
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.assign_document_number('PV', 'voucher_number', 'date');
CREATE TRIGGER trg_doc_number BEFORE INSERT OR UPDATE OF claim_number ON public.sub_claims
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.assign_document_number('CLM', 'claim_number', 'date');
CREATE TRIGGER trg_doc_number BEFORE INSERT OR UPDATE OF order_number ON public.job_orders
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.assign_document_number('JO', 'order_number', 'start_date');
CREATE TRIGGER trg_doc_number BEFORE INSERT OR UPDATE OF receipt_number ON public.material_receipts
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.assign_document_number('MR', 'receipt_number', 'receipt_date');
CREATE TRIGGER trg_doc_number BEFORE INSERT OR UPDATE OF issue_number ON public.material_issues
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.assign_document_number('ISS', 'issue_number', 'issue_date');



-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- FILE: 20261105170001_job_order_retention.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- Retention for new job orders. Existing orders keep an unspecified rate until reviewed.
BEGIN;
SET LOCAL lock_timeout = '10s';

ALTER TABLE public.job_orders
  ADD COLUMN retention_percent numeric(5,2)
  CONSTRAINT job_orders_retention_percent_range CHECK (retention_percent BETWEEN 0 AND 100);

ALTER TABLE public.job_orders
  ALTER COLUMN retention_percent SET DEFAULT 10;

COMMENT ON COLUMN public.job_orders.retention_percent IS
  'Customer invoice retention percentage configured on the job order; NULL means a legacy order has not been configured.';

NOTIFY pgrst, 'reload schema';

COMMIT;



-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- FILE: 20261105170002_invoice_line_accounting.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- Customer materials settle the amount due after line VAT and retention have been calculated.
BEGIN;
SET LOCAL lock_timeout = '10s';

ALTER TABLE public.material_receipts ADD COLUMN job_order_id uuid;
ALTER TABLE public.material_receipts ADD CONSTRAINT material_receipts_job_order_company_fkey
  FOREIGN KEY (job_order_id, company_id) REFERENCES public.job_orders (id, company_id);
ALTER TABLE public.material_receipts ADD CONSTRAINT customer_material_receipt_has_source
  CHECK (receipt_type IS DISTINCT FROM 'توريد عميل'
      OR (job_order_id IS NOT NULL AND project_id IS NOT NULL AND supplier_id IS NOT NULL)) NOT VALID;

CREATE INDEX material_receipts_customer_credit_idx
  ON public.material_receipts (company_id, job_order_id, supplier_id, receipt_date)
  WHERE receipt_type = 'توريد عميل' AND is_posted;

CREATE TRIGGER trg_job_order_link BEFORE INSERT OR UPDATE OF job_order_id, project_id ON public.material_receipts
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.check_job_order_link('project_id');

ALTER TABLE public.invoices
  ADD COLUMN line_accounting boolean NOT NULL DEFAULT false,
  ADD COLUMN customer_materials jsonb NOT NULL DEFAULT '[]'::jsonb
    CONSTRAINT invoices_customer_materials_array CHECK (jsonb_typeof(customer_materials) = 'array');

CREATE TABLE public.invoice_posted_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT rawasi_private.current_company_id() REFERENCES public.companies(id),
  invoice_id uuid NOT NULL,
  journal_header_id uuid NOT NULL,
  line_index integer NOT NULL CHECK (line_index > 0),
  job_order_id uuid NOT NULL,
  project_id uuid NOT NULL,
  description text NOT NULL,
  base_amount numeric(15,2) NOT NULL CHECK (base_amount > 0),
  tax_amount numeric(15,2) NOT NULL CHECK (tax_amount >= 0),
  retention_percent numeric(5,2) NOT NULL CHECK (retention_percent BETWEEN 0 AND 100),
  retention_amount numeric(15,2) NOT NULL CHECK (retention_amount >= 0),
  receivable_amount numeric(15,2) NOT NULL CHECK (receivable_amount >= 0),
  material_amount numeric(15,2) NOT NULL DEFAULT 0 CHECK (material_amount = 0),
  CONSTRAINT invoice_posted_lines_parent FOREIGN KEY (invoice_id, company_id) REFERENCES public.invoices (id, company_id),
  CONSTRAINT invoice_posted_lines_journal FOREIGN KEY (journal_header_id, company_id)
    REFERENCES public.journal_headers (id, company_id) ON DELETE CASCADE,
  CONSTRAINT invoice_posted_lines_order FOREIGN KEY (job_order_id, company_id) REFERENCES public.job_orders (id, company_id),
  CONSTRAINT invoice_posted_lines_project FOREIGN KEY (project_id, company_id) REFERENCES public.projects (id, company_id),
  CONSTRAINT invoice_posted_lines_index UNIQUE (invoice_id, company_id, line_index),
  CONSTRAINT invoice_posted_lines_note_reference UNIQUE (id, invoice_id, company_id),
  CHECK (receivable_amount = base_amount + tax_amount - retention_amount)
);

CREATE TABLE public.invoice_customer_material_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT rawasi_private.current_company_id() REFERENCES public.companies(id),
  invoice_id uuid NOT NULL,
  journal_header_id uuid NOT NULL,
  receipt_id uuid NOT NULL,
  receipt_journal_id uuid NOT NULL,
  amount numeric(15,2) NOT NULL CHECK (amount > 0),
  CONSTRAINT invoice_material_parent FOREIGN KEY (invoice_id, company_id) REFERENCES public.invoices (id, company_id),
  CONSTRAINT invoice_material_journal FOREIGN KEY (journal_header_id, company_id)
    REFERENCES public.journal_headers (id, company_id) ON DELETE CASCADE,
  CONSTRAINT invoice_material_source FOREIGN KEY (receipt_id, company_id) REFERENCES public.material_receipts (id, company_id),
  CONSTRAINT invoice_material_source_journal FOREIGN KEY (receipt_journal_id, company_id)
    REFERENCES public.journal_headers (id, company_id),
  CONSTRAINT invoice_material_unique_receipt UNIQUE (invoice_id, company_id, receipt_id)
);

CREATE INDEX invoice_material_by_receipt_idx
  ON public.invoice_customer_material_applications (company_id, receipt_id);
CREATE INDEX invoice_material_by_source_journal_idx
  ON public.invoice_customer_material_applications (company_id, receipt_journal_id);

INSERT INTO rawasi_private.company_scoped_tables(table_name)
VALUES ('invoice_posted_lines'), ('invoice_customer_material_applications');

CREATE TRIGGER aa_stamp_company_id BEFORE INSERT OR UPDATE OF company_id ON public.invoice_posted_lines
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id();
CREATE TRIGGER aa_stamp_company_id BEFORE INSERT OR UPDATE OF company_id ON public.invoice_customer_material_applications
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id();

ALTER TABLE public.invoice_posted_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_customer_material_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoice_posted_lines_view ON public.invoice_posted_lines FOR SELECT TO authenticated
  USING (rawasi_private.can_access('invoices','view') AND company_id = (SELECT rawasi_private.current_company_id()));
CREATE POLICY invoice_material_applications_view ON public.invoice_customer_material_applications FOR SELECT TO authenticated
  USING (rawasi_private.can_access('invoices','view') AND company_id = (SELECT rawasi_private.current_company_id()));

REVOKE ALL ON TABLE public.invoice_posted_lines, public.invoice_customer_material_applications
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.invoice_posted_lines, public.invoice_customer_material_applications TO authenticated;

CREATE FUNCTION rawasi_private.invoice_line_calculation(p_company uuid, p_lines jsonb, p_skip_tax boolean)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  item jsonb;
  order_row public.job_orders%ROWTYPE;
  order_id uuid;
  qty numeric;
  price numeric;
  line_base numeric;
  line_tax numeric;
  line_retention numeric;
  totals_base numeric := 0;
  totals_tax numeric := 0;
  totals_retention numeric := 0;
  lines jsonb := '[]'::jsonb;
BEGIN
  IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR p_lines = '[]'::jsonb THEN
    RAISE EXCEPTION 'أضف بند فاتورة واحد على الأقل' USING ERRCODE = '23514';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
    order_id := nullif(item->>'job_order_id','')::uuid;
    SELECT * INTO order_row FROM public.job_orders WHERE id = order_id AND company_id = p_company;
    IF NOT FOUND OR order_row.project_id IS NULL THEN
      RAISE EXCEPTION 'كل بند يحتاج أمر شغل مرتبط بمشروع في الشركة المفتوحة' USING ERRCODE = '23503';
    END IF;
    IF order_row.retention_percent IS NULL THEN
      RAISE EXCEPTION 'حدّد نسبة ضمان الأعمال في أمر الشغل % أولاً (اكتب صفر لو مفيش ضمان)', order_row.order_number
        USING ERRCODE = '23514';
    END IF;

    qty := nullif(item->>'quantity','')::numeric;
    price := nullif(item->>'unit_price','')::numeric;
    IF qty IS NULL OR price IS NULL OR qty <= 0 OR price <= 0
      OR qty::text IN ('NaN','Infinity','-Infinity') OR price::text IN ('NaN','Infinity','-Infinity')
      OR nullif(btrim(item->>'description'),'') IS NULL THEN
      RAISE EXCEPTION 'كل بند يحتاج بيان وكمية وسعر صحيحين' USING ERRCODE = '23514';
    END IF;

    line_base := round(qty * price, 2);
    IF line_base <= 0 THEN RAISE EXCEPTION 'قيمة بند الفاتورة أقل من هللة' USING ERRCODE = '23514'; END IF;
    line_tax := CASE WHEN p_skip_tax IS TRUE THEN 0 ELSE round(line_base * 0.15, 2) END;
    line_retention := round(line_base * order_row.retention_percent / 100, 2);
    totals_base := totals_base + line_base;
    totals_tax := totals_tax + line_tax;
    totals_retention := totals_retention + line_retention;

    lines := lines || jsonb_build_array(item || jsonb_build_object(
      'project_id', order_row.project_id, 'order_number', order_row.order_number,
      'total_price', line_base, 'base_amount', line_base, 'tax_amount', line_tax,
      'retention_percent', order_row.retention_percent, 'retention_amount', line_retention,
      'receivable_amount', line_base + line_tax - line_retention
    ));
  END LOOP;

  RETURN jsonb_build_object('lines', lines, 'taxable_amount', totals_base, 'tax_amount', totals_tax,
    'guarantee_amount', totals_retention, 'receivable_before_materials', totals_base + totals_tax - totals_retention);
END;
$$;

CREATE FUNCTION public.preview_invoice_work_order_lines(p_lines jsonb, p_skip_tax boolean)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE company uuid := rawasi_private.current_company_id();
BEGIN
  IF auth.uid() IS NULL OR company IS NULL OR NOT rawasi_private.can_access('invoices','view') THEN
    RAISE EXCEPTION 'لا توجد صلاحية لحساب بنود الفاتورة' USING ERRCODE = '42501';
  END IF;
  RETURN rawasi_private.invoice_line_calculation(company, p_lines, p_skip_tax);
END;
$$;

CREATE FUNCTION rawasi_private.customer_material_net_applied(p_company uuid, p_receipt uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT coalesce(sum(a.amount), 0)
  FROM public.invoice_customer_material_applications a
  WHERE a.company_id = p_company AND a.receipt_id = p_receipt;
$$;

CREATE FUNCTION public.get_invoice_customer_materials(p_job_order_ids uuid[], p_partner_id uuid, p_on_date date)
RETURNS TABLE (receipt_id uuid, job_order_id uuid, receipt_number text, receipt_date date, available_amount numeric)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE company uuid := rawasi_private.current_company_id();
BEGIN
  IF auth.uid() IS NULL OR company IS NULL OR NOT rawasi_private.can_access('invoices','view')
    OR NOT rawasi_private.can_access('materials','view') OR NOT rawasi_private.can_access('journal','view') THEN
    RAISE EXCEPTION 'يلزم إذن عرض الفواتير والخامات والقيود لعرض رصيد خامات العميل' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT r.id, r.job_order_id, r.receipt_number::text, r.receipt_date,
    r.total_amount - coalesce(used.total, 0)
  FROM public.material_receipts r
  JOIN public.journal_headers h ON h.id = r.jv_id AND h.company_id = r.company_id
    AND h.reference_id = r.id AND h.v_type = 'inventory' AND h.status IN ('posted','مرحل','معتمد')
  LEFT JOIN LATERAL (
    SELECT rawasi_private.customer_material_net_applied(r.company_id, r.id) AS total
  ) used ON true
  WHERE r.company_id = company AND r.receipt_type = 'توريد عميل' AND r.is_posted
    AND r.job_order_id = ANY(p_job_order_ids) AND r.supplier_id = p_partner_id AND r.receipt_date <= p_on_date
    AND r.total_amount > coalesce(used.total, 0)
  ORDER BY r.receipt_date, r.id;
END;
$$;

-- The receipt and its 217 posting must survive as long as any invoice applies its credit.
CREATE FUNCTION rawasi_private.protect_applied_customer_material()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE applied boolean;
BEGIN
  IF TG_TABLE_NAME = 'material_receipts' THEN
    SELECT EXISTS (SELECT 1 FROM public.invoice_customer_material_applications
      WHERE company_id = OLD.company_id AND receipt_id = OLD.id) INTO applied;
  ELSIF TG_TABLE_NAME = 'journal_headers' THEN
    SELECT EXISTS (SELECT 1 FROM public.invoice_customer_material_applications
      WHERE company_id = OLD.company_id AND receipt_journal_id = OLD.id) INTO applied;
  ELSE
    PERFORM 1 FROM public.journal_headers WHERE id = OLD.header_id AND company_id = OLD.company_id FOR NO KEY UPDATE;
    SELECT EXISTS (SELECT 1 FROM public.invoice_customer_material_applications
      WHERE company_id = OLD.company_id AND receipt_journal_id = OLD.header_id) INTO applied;
  END IF;
  IF applied AND (TG_OP = 'DELETE' OR to_jsonb(OLD) IS DISTINCT FROM to_jsonb(NEW)) THEN
    RAISE EXCEPTION 'السند اتستخدم في فاتورة. فك ترحيل الفاتورة أولاً لإتاحة تعديل السند أو القيد' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_applied_customer_material BEFORE UPDATE OR DELETE ON public.material_receipts
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.protect_applied_customer_material();
CREATE TRIGGER trg_protect_applied_material_journal BEFORE UPDATE OR DELETE ON public.journal_headers
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.protect_applied_customer_material();
CREATE TRIGGER zz_protect_applied_material_lines BEFORE UPDATE OR DELETE ON public.journal_lines
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.protect_applied_customer_material();

-- Keep the installed version for old drafts and exact pre-use rollback.
DO $preserve$
DECLARE definition text := pg_get_functiondef('public.post_invoices_bulk(uuid[])'::regprocedure);
BEGIN
  IF position('CREATE OR REPLACE FUNCTION public.post_invoices_bulk(' in definition) <> 1 THEN
    RAISE EXCEPTION 'Unexpected invoice posting definition';
  END IF;
  EXECUTE replace(definition, 'CREATE OR REPLACE FUNCTION public.post_invoices_bulk(',
    'CREATE OR REPLACE FUNCTION rawasi_private.post_legacy_invoices(');
END;
$preserve$;

CREATE FUNCTION rawasi_private.post_invoice_lines_scoped(p_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  company uuid := rawasi_private.current_company_id();
  invoice public.invoices%ROWTYPE;
  receipt public.material_receipts%ROWTYPE;
  calculation jsonb;
  line jsonb;
  application jsonb;
  application_amount numeric;
  posted_217 numeric;
  previously_applied numeric;
  materials_total numeric;
  ar_account uuid;
  revenue_account uuid;
  retention_account uuid;
  vat_account uuid;
  materials_account uuid;
  header uuid;
  idx integer;
  source_note text;
BEGIN
  IF auth.uid() IS NULL OR company IS NULL OR NOT rawasi_private.can_access('invoices','view')
    OR NOT rawasi_private.can_access('invoices','post') THEN
    RAISE EXCEPTION 'لا توجد صلاحية لترحيل الفواتير' USING ERRCODE = '42501';
  END IF;
  IF coalesce(cardinality(p_ids),0) = 0 OR array_position(p_ids,NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'حدد فواتير صحيحة' USING ERRCODE = '23514';
  END IF;

  PERFORM i.id FROM public.invoices i WHERE i.company_id = company AND i.id = ANY(p_ids) ORDER BY i.id FOR UPDATE;
  IF EXISTS (SELECT FROM unnest(p_ids) selected(id) WHERE NOT EXISTS (
    SELECT FROM public.invoices i WHERE i.id = selected.id AND i.company_id = company
  )) THEN RAISE EXCEPTION 'الفاتورة غير موجودة في الشركة المفتوحة' USING ERRCODE = '42501'; END IF;

  PERFORM r.id FROM public.material_receipts r
  WHERE r.company_id = company AND r.id IN (
    SELECT (x->>'receipt_id')::uuid FROM public.invoices i
    CROSS JOIN LATERAL jsonb_array_elements(i.customer_materials) x
    WHERE i.company_id = company AND i.id = ANY(p_ids) AND i.line_accounting
  ) ORDER BY r.id FOR UPDATE;

  FOR invoice IN SELECT i.* FROM public.invoices i WHERE i.company_id = company AND i.id = ANY(p_ids) ORDER BY i.id LOOP
    IF invoice.status IN ('posted','مرحل','معتمد') THEN CONTINUE; END IF;
    IF NOT invoice.line_accounting THEN
      PERFORM rawasi_private.post_legacy_invoices(ARRAY[invoice.id]);
      CONTINUE;
    END IF;

    IF invoice.partner_id IS NULL THEN RAISE EXCEPTION 'اختار عميل للفاتورة' USING ERRCODE = '23514'; END IF;
    PERFORM j.id FROM public.job_orders j
    WHERE j.company_id = company AND j.id IN (
      SELECT (x->>'job_order_id')::uuid FROM jsonb_array_elements(invoice.lines_data) x
    ) ORDER BY j.id FOR SHARE;

    calculation := rawasi_private.invoice_line_calculation(company, invoice.lines_data, invoice.skip_zatca);
    IF invoice.lines_data IS DISTINCT FROM calculation->'lines'
      OR invoice.taxable_amount IS DISTINCT FROM (calculation->>'taxable_amount')::numeric
      OR invoice.tax_amount IS DISTINCT FROM (calculation->>'tax_amount')::numeric
      OR invoice.guarantee_amount IS DISTINCT FROM (calculation->>'guarantee_amount')::numeric THEN
      RAISE EXCEPTION 'بيانات أو نسب بنود الفاتورة اتغيرت. افتح الفاتورة واحفظها بعد المراجعة قبل الترحيل'
        USING ERRCODE = '23514';
    END IF;

    SELECT id INTO ar_account FROM public.accounts
    WHERE id = invoice.debit_account_id AND company_id = company AND is_transactional;
    SELECT id INTO revenue_account FROM public.accounts
    WHERE id = invoice.credit_account_id AND company_id = company AND is_transactional;
    IF ar_account IS NULL OR revenue_account IS NULL OR ar_account = revenue_account THEN
      RAISE EXCEPTION 'اختار حساب عميل وحساب إيراد مختلفين من دليل الشركة' USING ERRCODE = '23514';
    END IF;
    retention_account := CASE WHEN invoice.guarantee_amount > 0 THEN rawasi_private.require_company_account('124') END;
    vat_account := CASE WHEN invoice.tax_amount > 0 THEN rawasi_private.require_company_account('215') END;
    materials_account := NULL;
    materials_total := 0;
    IF invoice.customer_materials <> '[]'::jsonb THEN
      IF NOT rawasi_private.can_access('materials','view') OR NOT rawasi_private.can_access('journal','view') THEN
        RAISE EXCEPTION 'يلزم إذن عرض الخامات والقيود لتسوية رصيد خامات العميل' USING ERRCODE = '42501';
      END IF;
      materials_account := rawasi_private.require_company_account('217');
      IF (SELECT count(DISTINCT (x->>'receipt_id')::uuid) FROM jsonb_array_elements(invoice.customer_materials) x)
        <> jsonb_array_length(invoice.customer_materials) THEN
        RAISE EXCEPTION 'سند الخامات لازم يظهر مرة واحدة في الفاتورة' USING ERRCODE = '23514';
      END IF;
    END IF;

    FOR application IN SELECT value FROM jsonb_array_elements(invoice.customer_materials) LOOP
      application_amount := (application->>'amount')::numeric;
      IF application_amount IS NULL OR application_amount <= 0
        OR application_amount::text IN ('NaN','Infinity','-Infinity') OR application_amount <> round(application_amount,2) THEN
        RAISE EXCEPTION 'مبلغ تسوية الخامات لازم يكون أكبر من صفر وبحد أقصى منزلتين' USING ERRCODE = '23514';
      END IF;

      SELECT * INTO receipt FROM public.material_receipts r
      WHERE r.id = (application->>'receipt_id')::uuid AND r.company_id = company AND r.is_posted
        AND r.receipt_type = 'توريد عميل' AND r.supplier_id = invoice.partner_id AND r.receipt_date <= invoice.date
        AND EXISTS (SELECT FROM jsonb_array_elements(invoice.lines_data) x WHERE x->>'job_order_id' = r.job_order_id::text);
      IF NOT FOUND THEN RAISE EXCEPTION 'سند الخامات غير مرحّل أو غير مرتبط بنفس العميل وأمر الشغل' USING ERRCODE = '23514'; END IF;

      PERFORM 1 FROM public.journal_headers h WHERE h.id = receipt.jv_id AND h.company_id = company
        AND h.reference_id = receipt.id AND h.v_type = 'inventory' AND h.status IN ('posted','مرحل','معتمد') FOR NO KEY UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'قيد استلام الخامات غير مرحّل' USING ERRCODE = '23514'; END IF;

      SELECT coalesce(sum(l.credit - l.debit),0) INTO posted_217
      FROM public.journal_lines l WHERE l.header_id = receipt.jv_id AND l.company_id = company
        AND l.account_id = materials_account AND l.partner_id = receipt.supplier_id;
      previously_applied := rawasi_private.customer_material_net_applied(company, receipt.id);
      IF posted_217 <> receipt.total_amount OR application_amount > posted_217 - previously_applied THEN
        RAISE EXCEPTION 'رصيد سند الخامات % غير كافٍ أو مختلف عن القيد. راجع التسوية', receipt.receipt_number USING ERRCODE = '23514';
      END IF;
      materials_total := materials_total + application_amount;
    END LOOP;

    IF materials_total > (calculation->>'receivable_before_materials')::numeric
      OR invoice.materials_discount IS DISTINCT FROM materials_total
      OR invoice.total_amount IS DISTINCT FROM (calculation->>'receivable_before_materials')::numeric - materials_total THEN
      RAISE EXCEPTION 'راجع خصم الخامات وصافي الفاتورة واحفظ قبل الترحيل' USING ERRCODE = '23514';
    END IF;

    UPDATE public.invoices SET guarantee_acc_id = retention_account, tax_acc_id = vat_account,
      materials_acc_id = materials_account
    WHERE id = invoice.id AND company_id = company;

    INSERT INTO public.journal_headers (company_id, entry_date, description, reference_id, v_type, status)
    VALUES (company, invoice.date, 'ترحيل فاتورة مبيعات رقم: ' || invoice.invoice_number, invoice.id, 'فاتورة مبيعات', 'posted')
    RETURNING id INTO header;

    idx := 0;
    FOR line IN SELECT value FROM jsonb_array_elements(calculation->'lines') LOOP
      idx := idx + 1;
      INSERT INTO public.invoice_posted_lines (company_id, invoice_id, journal_header_id, line_index, job_order_id, project_id,
        description, base_amount, tax_amount, retention_percent, retention_amount, receivable_amount)
      VALUES (company, invoice.id, header, idx, (line->>'job_order_id')::uuid, (line->>'project_id')::uuid,
        line->>'description', (line->>'base_amount')::numeric, (line->>'tax_amount')::numeric,
        (line->>'retention_percent')::numeric, (line->>'retention_amount')::numeric, (line->>'receivable_amount')::numeric);

      INSERT INTO public.journal_lines (company_id, header_id, account_id, project_id, job_order_id, partner_id, debit, credit, notes)
      SELECT company, header, entry.account_id, (line->>'project_id')::uuid, (line->>'job_order_id')::uuid,
        entry.partner_id, entry.debit, entry.credit, entry.note
      FROM (VALUES
        (ar_account, invoice.partner_id, (line->>'receivable_amount')::numeric, 0::numeric, 'استحقاق بند الفاتورة'),
        (retention_account, invoice.partner_id, (line->>'retention_amount')::numeric, 0::numeric, 'ضمان أعمال البند'),
        (revenue_account, NULL::uuid, 0::numeric, (line->>'base_amount')::numeric, 'إيراد بند الفاتورة'),
        (vat_account, NULL::uuid, 0::numeric, (line->>'tax_amount')::numeric, 'ضريبة بند الفاتورة')
      ) entry(account_id,partner_id,debit,credit,note)
      WHERE entry.debit > 0 OR entry.credit > 0;
    END LOOP;

    FOR application IN SELECT value FROM jsonb_array_elements(invoice.customer_materials) LOOP
      SELECT * INTO STRICT receipt FROM public.material_receipts r
      WHERE r.id = (application->>'receipt_id')::uuid AND r.company_id = company;
      application_amount := (application->>'amount')::numeric;
      source_note := 'تسوية خامات العميل – سند ' || receipt.receipt_number;
      INSERT INTO public.invoice_customer_material_applications
        (company_id,invoice_id,journal_header_id,receipt_id,receipt_journal_id,amount)
      VALUES (company,invoice.id,header,receipt.id,receipt.jv_id,application_amount);
      INSERT INTO public.journal_lines (company_id,header_id,account_id,project_id,job_order_id,partner_id,debit,credit,notes)
      VALUES (company,header,materials_account,receipt.project_id,receipt.job_order_id,invoice.partner_id,application_amount,0,source_note),
             (company,header,ar_account,receipt.project_id,receipt.job_order_id,invoice.partner_id,0,application_amount,source_note);
    END LOOP;

    UPDATE public.invoices SET status = 'معتمد' WHERE id = invoice.id AND company_id = company;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.post_invoices_bulk(p_ids uuid[])
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT rawasi_private.post_invoice_lines_scoped(p_ids);
$$;

REVOKE ALL ON FUNCTION rawasi_private.post_legacy_invoices(uuid[]), rawasi_private.protect_applied_customer_material()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION rawasi_private.invoice_line_calculation(uuid,jsonb,boolean),
  rawasi_private.customer_material_net_applied(uuid,uuid),
  rawasi_private.post_invoice_lines_scoped(uuid[]), public.preview_invoice_work_order_lines(jsonb,boolean),
  public.get_invoice_customer_materials(uuid[],uuid,date) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rawasi_private.invoice_line_calculation(uuid,jsonb,boolean),
  rawasi_private.customer_material_net_applied(uuid,uuid),
  rawasi_private.post_invoice_lines_scoped(uuid[]), public.preview_invoice_work_order_lines(jsonb,boolean),
  public.get_invoice_customer_materials(uuid[],uuid,date) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;



-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- FILE: 20261105170003_invoice_adjustment_notes.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- Issued customer credit/debit notes. Positive note amounts take their sign from note_type.
BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
  IF to_regclass('public.invoice_posted_lines') IS NULL
     OR to_regprocedure('rawasi_private.assign_document_number()') IS NULL THEN
    RAISE EXCEPTION 'Apply invoice posting snapshots and document numbering first';
  END IF;
END;
$$;

CREATE TABLE public.invoice_adjustment_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT rawasi_private.current_company_id() REFERENCES public.companies(id) ON DELETE RESTRICT,
  invoice_id uuid NOT NULL,
  invoice_line_id uuid,
  original_journal_id uuid NOT NULL,
  journal_header_id uuid NOT NULL,
  request_id uuid NOT NULL,
  note_number text NOT NULL,
  note_type text NOT NULL CHECK (note_type IN ('credit', 'debit')),
  note_date date NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 1000),
  base_amount numeric(15,2) NOT NULL CHECK (base_amount > 0 AND base_amount < 'Infinity'::numeric),
  tax_amount numeric(15,2) NOT NULL CHECK (tax_amount >= 0 AND tax_amount < 'Infinity'::numeric),
  gross_amount numeric(15,2) GENERATED ALWAYS AS (base_amount + tax_amount) STORED,
  retention_amount numeric(15,2) NOT NULL CHECK (retention_amount BETWEEN 0 AND base_amount),
  material_reversal_amount numeric(15,2) NOT NULL DEFAULT 0
    CHECK (material_reversal_amount >= 0 AND material_reversal_amount < 'Infinity'::numeric),
  receivable_amount numeric(15,2) GENERATED ALWAYS AS (base_amount + tax_amount - retention_amount - material_reversal_amount) STORED,
  partner_id uuid NOT NULL,
  project_id uuid,
  job_order_id uuid,
  invoice_number text NOT NULL,
  seller_name text NOT NULL CHECK (octet_length(seller_name) BETWEEN 1 AND 255),
  seller_tax_number text NOT NULL CHECK (seller_tax_number ~ '^3[0-9]{13}3$'),
  created_by uuid NOT NULL,
  UNIQUE (id, company_id),
  UNIQUE (company_id, request_id),
  UNIQUE (company_id, note_number),
  UNIQUE (company_id, journal_header_id),
  CHECK (original_journal_id <> journal_header_id),
  CHECK (receivable_amount >= 0),
  CHECK (note_type = 'credit' OR material_reversal_amount = 0),
  FOREIGN KEY (invoice_id, company_id) REFERENCES public.invoices(id, company_id) ON DELETE RESTRICT,
  FOREIGN KEY (invoice_line_id, invoice_id, company_id)
    REFERENCES public.invoice_posted_lines(id, invoice_id, company_id) ON DELETE RESTRICT,
  FOREIGN KEY (original_journal_id, company_id) REFERENCES public.journal_headers(id, company_id) ON DELETE RESTRICT,
  FOREIGN KEY (journal_header_id, company_id) REFERENCES public.journal_headers(id, company_id) ON DELETE RESTRICT,
  FOREIGN KEY (partner_id, company_id) REFERENCES public.partners(id, company_id) ON DELETE RESTRICT,
  FOREIGN KEY (project_id, company_id) REFERENCES public.projects(id, company_id) ON DELETE RESTRICT,
  FOREIGN KEY (job_order_id, company_id) REFERENCES public.job_orders(id, company_id) ON DELETE RESTRICT
);

CREATE TABLE public.invoice_adjustment_material_reversals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT rawasi_private.current_company_id() REFERENCES public.companies(id) ON DELETE RESTRICT,
  note_id uuid NOT NULL,
  application_id uuid NOT NULL,
  receipt_id uuid NOT NULL,
  amount numeric(15,2) NOT NULL CHECK (amount > 0 AND amount < 'Infinity'::numeric),
  UNIQUE (company_id, note_id, application_id),
  FOREIGN KEY (note_id, company_id) REFERENCES public.invoice_adjustment_notes(id, company_id) ON DELETE RESTRICT,
  FOREIGN KEY (application_id) REFERENCES public.invoice_customer_material_applications(id) ON DELETE RESTRICT,
  FOREIGN KEY (receipt_id, company_id) REFERENCES public.material_receipts(id, company_id) ON DELETE RESTRICT
);

INSERT INTO rawasi_private.company_scoped_tables(table_name)
VALUES ('invoice_adjustment_notes'), ('invoice_adjustment_material_reversals');

CREATE INDEX invoice_adjustment_notes_invoice_idx ON public.invoice_adjustment_notes(company_id, invoice_id, invoice_line_id);
CREATE INDEX invoice_adjustment_notes_original_idx ON public.invoice_adjustment_notes(company_id, original_journal_id);
CREATE INDEX invoice_adjustment_notes_period_idx ON public.invoice_adjustment_notes(company_id, note_date);
CREATE INDEX invoice_adjustment_mat_rev_receipt_idx ON public.invoice_adjustment_material_reversals(company_id, receipt_id);
CREATE INDEX invoice_adjustment_mat_rev_app_idx ON public.invoice_adjustment_material_reversals(company_id, application_id);

CREATE TRIGGER aa_stamp_company_id BEFORE INSERT OR UPDATE OF company_id ON public.invoice_adjustment_notes
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id();
CREATE TRIGGER aa_stamp_company_id BEFORE INSERT OR UPDATE OF company_id ON public.invoice_adjustment_material_reversals
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id();
CREATE TRIGGER trg_credit_note_number BEFORE INSERT ON public.invoice_adjustment_notes
  FOR EACH ROW WHEN (NEW.note_type = 'credit')
  EXECUTE FUNCTION rawasi_private.assign_document_number('CN', 'note_number', 'note_date');
CREATE TRIGGER trg_debit_note_number BEFORE INSERT ON public.invoice_adjustment_notes
  FOR EACH ROW WHEN (NEW.note_type = 'debit')
  EXECUTE FUNCTION rawasi_private.assign_document_number('DN', 'note_number', 'note_date');

ALTER TABLE public.invoice_adjustment_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_adjustment_material_reversals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invoice_adjustment_notes, public.invoice_adjustment_material_reversals
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.invoice_adjustment_notes, public.invoice_adjustment_material_reversals TO authenticated;
CREATE POLICY invoice_adjustment_notes_read ON public.invoice_adjustment_notes FOR SELECT TO authenticated
  USING (rawasi_private.can_access('invoices', 'view') AND company_id = (SELECT rawasi_private.current_company_id()));
CREATE POLICY invoice_adjustment_mat_rev_read ON public.invoice_adjustment_material_reversals FOR SELECT TO authenticated
  USING (rawasi_private.can_access('invoices', 'view') AND company_id = (SELECT rawasi_private.current_company_id()));

CREATE FUNCTION rawasi_private.protect_issued_invoice_adjustment()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'الإشعار الصادر غير قابل للتعديل أو الحذف' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER trg_protect_issued_invoice_adjustment BEFORE UPDATE OR DELETE ON public.invoice_adjustment_notes
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.protect_issued_invoice_adjustment();
CREATE TRIGGER trg_protect_issued_material_reversal BEFORE UPDATE OR DELETE ON public.invoice_adjustment_material_reversals
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.protect_issued_invoice_adjustment();

CREATE FUNCTION rawasi_private.protect_invoice_adjustment_source()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF EXISTS (
    SELECT FROM public.invoice_adjustment_notes n
    WHERE n.company_id = OLD.company_id AND n.invoice_id = OLD.id
  ) AND NOT COALESCE(NEW.status IN ('posted', 'مرحل', 'معتمد'), false) THEN
    RAISE EXCEPTION 'الفاتورة مرتبطة بإشعار صادر، ولا يمكن فك ترحيلها' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_protect_invoice_adjustment_source BEFORE UPDATE OF status ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.protect_invoice_adjustment_source();

CREATE FUNCTION rawasi_private.protect_invoice_adjustment_journal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF EXISTS (
    SELECT FROM public.invoice_adjustment_notes n
    WHERE n.company_id = OLD.company_id AND OLD.id IN (n.original_journal_id, n.journal_header_id)
  ) THEN
    RAISE EXCEPTION 'لا يمكن تعديل أو حذف قيد مرتبط بإشعار صادر' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER aa_protect_invoice_adjustment_journal BEFORE UPDATE OR DELETE ON public.journal_headers
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.protect_invoice_adjustment_journal();

CREATE FUNCTION rawasi_private.protect_invoice_adjustment_journal_line()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_old_header uuid;
  v_new_header uuid;
  v_company uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN v_old_header := OLD.header_id; v_company := OLD.company_id; END IF;
  IF TG_OP <> 'DELETE' THEN v_new_header := NEW.header_id; v_company := NEW.company_id; END IF;
  -- Keep this guard after the existing line trigger, which first locks the affected headers.
  IF EXISTS (
    SELECT FROM public.invoice_adjustment_notes n
    WHERE n.company_id = v_company
      AND (n.original_journal_id IN (v_old_header, v_new_header) OR n.journal_header_id IN (v_old_header, v_new_header))
  ) THEN
    RAISE EXCEPTION 'لا يمكن تعديل سطور قيد مرتبط بإشعار صادر' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER zz_protect_invoice_adjustment_journal_line BEFORE INSERT OR UPDATE OR DELETE ON public.journal_lines
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.protect_invoice_adjustment_journal_line();

CREATE FUNCTION rawasi_private.invoice_adjustment_header(p_company_id uuid, p_invoice_id uuid)
RETURNS uuid LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT CASE WHEN count(*) = 1 AND bool_and(i.date = h.entry_date) THEN (array_agg(h.id))[1] END
  FROM public.journal_headers h
  JOIN public.invoices i ON i.company_id = h.company_id AND i.id = h.reference_id
  WHERE h.company_id = p_company_id AND h.reference_id = p_invoice_id
    AND h.v_type IN ('invoices', 'فاتورة مبيعات') AND h.status IN ('posted', 'مرحل', 'معتمد');
$$;

CREATE FUNCTION rawasi_private.invoice_adjustment_totals(p_company_id uuid, p_invoice_id uuid)
RETURNS TABLE (paid_amount numeric, net_adjustment numeric, balance numeric)
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT paid.amount, notes.amount, coalesce(i.total_amount, 0) + notes.amount - paid.amount
  FROM public.invoices i
  CROSS JOIN LATERAL (
    SELECT coalesce(sum(r.amount), 0) AS amount
    FROM public.receipt_vouchers r
    WHERE r.company_id = i.company_id AND r.invoice_id = i.id AND r.status IN ('posted', 'مرحل', 'معتمد')
      AND EXISTS (
        SELECT FROM public.journal_headers h
        WHERE h.company_id = r.company_id AND h.reference_id = r.id
          AND h.v_type IN ('receipt_vouchers', 'سند قبض') AND h.status IN ('posted', 'مرحل', 'معتمد')
      )
  ) paid
  CROSS JOIN LATERAL (
    SELECT coalesce(sum(CASE n.note_type WHEN 'debit' THEN n.receivable_amount ELSE -n.receivable_amount END), 0) AS amount
    FROM public.invoice_adjustment_notes n
    WHERE n.company_id = i.company_id AND n.invoice_id = i.id
  ) notes
  WHERE i.company_id = p_company_id AND i.id = p_invoice_id;
$$;

CREATE FUNCTION rawasi_private.invoice_adjustment_candidates(p_company_id uuid, p_invoice_id uuid, p_header_id uuid)
RETURNS TABLE (
  id uuid, line_index integer, description text, job_order_id uuid, project_id uuid, base_amount numeric,
  tax_amount numeric, retention_percent numeric, retention_amount numeric, receivable_amount numeric, review_reason text
) LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE
  v_invoice public.invoices%ROWTYPE;
  v_project_ids uuid[];
  v_order_ids uuid[];
  v_matches boolean;
BEGIN
  SELECT * INTO v_invoice FROM public.invoices i
  WHERE i.company_id = p_company_id AND i.id = p_invoice_id AND i.status IN ('posted', 'مرحل', 'معتمد');
  IF NOT FOUND OR p_header_id IS NULL OR v_invoice.partner_id IS NULL THEN RETURN; END IF;

  IF EXISTS (SELECT FROM public.invoice_posted_lines l WHERE l.company_id = p_company_id AND l.invoice_id = p_invoice_id) THEN
    -- Reconcile the source before the first note. Legacy line permissions can otherwise delete
    -- matching debit/credit lines and leave a journal balanced but incomplete.
    WITH source_entries AS (
      SELECT entry.account_id, entry.partner_id, l.project_id, l.job_order_id, entry.debit, entry.credit
      FROM public.invoice_posted_lines l
      CROSS JOIN LATERAL (VALUES
        (v_invoice.debit_account_id, v_invoice.partner_id, l.receivable_amount, 0::numeric),
        (v_invoice.guarantee_acc_id, v_invoice.partner_id, l.retention_amount, 0::numeric),
        (v_invoice.credit_account_id, NULL::uuid, 0::numeric, l.base_amount),
        (v_invoice.tax_acc_id, NULL::uuid, 0::numeric, l.tax_amount)
      ) entry(account_id, partner_id, debit, credit)
      WHERE l.company_id = p_company_id AND l.invoice_id = p_invoice_id AND l.journal_header_id = p_header_id
      UNION ALL
      SELECT entry.account_id, v_invoice.partner_id, r.project_id, r.job_order_id, entry.debit, entry.credit
      FROM public.invoice_customer_material_applications a
      JOIN public.material_receipts r ON r.company_id = a.company_id AND r.id = a.receipt_id
      CROSS JOIN LATERAL (VALUES
        (v_invoice.materials_acc_id, a.amount, 0::numeric), (v_invoice.debit_account_id, 0::numeric, a.amount)
      ) entry(account_id, debit, credit)
      WHERE a.company_id = p_company_id AND a.invoice_id = p_invoice_id AND a.journal_header_id = p_header_id
    ), expected AS (
      SELECT e.account_id, e.partner_id, e.project_id, e.job_order_id, sum(e.debit) AS debit, sum(e.credit) AS credit
      FROM source_entries e WHERE e.debit <> 0 OR e.credit <> 0
      GROUP BY e.account_id, e.partner_id, e.project_id, e.job_order_id
    ), actual AS (
      SELECT l.account_id, l.partner_id, l.project_id, l.job_order_id, sum(l.debit) AS debit, sum(l.credit) AS credit
      FROM public.journal_lines l
      WHERE l.company_id = p_company_id AND l.header_id = p_header_id AND (l.debit <> 0 OR l.credit <> 0)
      GROUP BY l.account_id, l.partner_id, l.project_id, l.job_order_id
    )
    SELECT NOT EXISTS (SELECT * FROM expected EXCEPT SELECT * FROM actual)
       AND NOT EXISTS (SELECT * FROM actual EXCEPT SELECT * FROM expected) INTO v_matches;
    IF NOT v_matches THEN RETURN; END IF;

    RETURN QUERY
    SELECT l.id, l.line_index::integer, l.description::text, l.job_order_id, l.project_id, l.base_amount::numeric,
      l.tax_amount::numeric, l.retention_percent::numeric, l.retention_amount::numeric, l.receivable_amount::numeric,
      CASE WHEN l.material_amount IS DISTINCT FROM 0 THEN 'البند فيه خصم مواد ويحتاج مراجعة محاسبية قبل إصدار الإشعار'
           WHEN l.base_amount <= 0 OR l.tax_amount < 0 OR l.retention_amount NOT BETWEEN 0 AND l.base_amount
             OR l.receivable_amount <> l.base_amount + l.tax_amount - l.retention_amount
             OR l.retention_amount <> round(l.base_amount * l.retention_percent / 100, 2)
             OR l.tax_amount <> CASE WHEN v_invoice.skip_zatca IS TRUE THEN 0 ELSE round(l.base_amount * 0.15, 2) END
           THEN 'مبالغ البند المرحّل تحتاج مراجعة محاسبية' END::text
    FROM public.invoice_posted_lines l
    WHERE l.company_id = p_company_id AND l.invoice_id = p_invoice_id AND l.journal_header_id = p_header_id;
    RETURN;
  END IF;

  -- Only a reconciled, single-scope legacy invoice can use its posted invoice totals.
  IF coalesce(v_invoice.materials_discount, 0) <> 0 OR coalesce(v_invoice.taxable_amount, 0) <= 0
     OR coalesce(v_invoice.tax_amount, 0) < 0
     OR coalesce(v_invoice.guarantee_amount, 0) NOT BETWEEN 0 AND v_invoice.taxable_amount
     OR v_invoice.total_amount IS DISTINCT FROM v_invoice.taxable_amount + coalesce(v_invoice.tax_amount, 0) - coalesce(v_invoice.guarantee_amount, 0)
     OR (v_invoice.lines_data IS NOT NULL AND v_invoice.lines_data <> 'null'::jsonb AND jsonb_typeof(v_invoice.lines_data) <> 'array')
     OR jsonb_array_length(rawasi_private.json_array_or_empty(v_invoice.lines_data)) > 1 THEN
    RETURN;
  END IF;

  SELECT array_agg(DISTINCT dimensions.project_id) FILTER (WHERE dimensions.project_id IS NOT NULL),
         array_agg(DISTINCT dimensions.job_order_id) FILTER (WHERE dimensions.job_order_id IS NOT NULL)
  INTO v_project_ids, v_order_ids
  FROM (
    SELECT l.project_id, l.job_order_id FROM public.journal_lines l WHERE l.header_id = p_header_id AND l.company_id = p_company_id
    UNION ALL SELECT unnest(v_invoice.project_ids), NULL::uuid
    UNION ALL SELECT NULL::uuid, h.job_order_id FROM public.journal_headers h WHERE h.id = p_header_id AND h.company_id = p_company_id
  ) dimensions;
  IF coalesce(cardinality(v_project_ids), 0) > 1 OR coalesce(cardinality(v_order_ids), 0) > 1 THEN RETURN; END IF;

  WITH expected AS (
    SELECT e.account_id, e.partner_id, sum(e.debit) AS debit, sum(e.credit) AS credit
    FROM (VALUES
      (v_invoice.debit_account_id, v_invoice.partner_id, v_invoice.total_amount, 0::numeric),
      (v_invoice.guarantee_acc_id, v_invoice.partner_id, coalesce(v_invoice.guarantee_amount, 0), 0::numeric),
      (v_invoice.credit_account_id, NULL::uuid, 0::numeric, v_invoice.taxable_amount),
      (v_invoice.tax_acc_id, NULL::uuid, 0::numeric, coalesce(v_invoice.tax_amount, 0))
    ) e(account_id, partner_id, debit, credit)
    WHERE e.debit <> 0 OR e.credit <> 0
    GROUP BY e.account_id, e.partner_id
  ), actual AS (
    SELECT l.account_id, l.partner_id, sum(l.debit) AS debit, sum(l.credit) AS credit
    FROM public.journal_lines l
    WHERE l.company_id = p_company_id AND l.header_id = p_header_id AND (l.debit <> 0 OR l.credit <> 0)
    GROUP BY l.account_id, l.partner_id
  )
  SELECT NOT EXISTS (SELECT * FROM expected EXCEPT SELECT * FROM actual)
     AND NOT EXISTS (SELECT * FROM actual EXCEPT SELECT * FROM expected) INTO v_matches;
  IF NOT v_matches THEN RETURN; END IF;

  RETURN QUERY SELECT NULL::uuid, 1, coalesce(nullif(btrim(v_invoice.description), ''), 'الفاتورة الأصلية')::text,
    v_order_ids[1], v_project_ids[1], v_invoice.taxable_amount::numeric, coalesce(v_invoice.tax_amount, 0)::numeric,
    round(100 * coalesce(v_invoice.guarantee_amount, 0) / v_invoice.taxable_amount, 2),
    coalesce(v_invoice.guarantee_amount, 0)::numeric, v_invoice.total_amount::numeric, NULL::text;
END;
$$;

CREATE FUNCTION rawasi_private.get_invoice_adjustment_balances(p_invoice_ids uuid[])
RETURNS TABLE (invoice_id uuid, paid_amount numeric, net_adjustment numeric, balance numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_company uuid := rawasi_private.current_company_id();
BEGIN
  IF auth.uid() IS NULL OR v_company IS NULL OR NOT rawasi_private.can_access('invoices', 'view') THEN
    RAISE EXCEPTION 'لا توجد صلاحية عرض أرصدة الفواتير' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT i.id, t.paid_amount, t.net_adjustment, t.balance
  FROM public.invoices i CROSS JOIN LATERAL rawasi_private.invoice_adjustment_totals(i.company_id, i.id) t
  WHERE i.company_id = v_company AND i.id = ANY(p_invoice_ids);
END;
$$;

CREATE OR REPLACE FUNCTION rawasi_private.customer_material_net_applied(p_company uuid, p_receipt uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT coalesce((
    SELECT sum(a.amount) FROM public.invoice_customer_material_applications a
    WHERE a.company_id = p_company AND a.receipt_id = p_receipt
  ), 0) - coalesce((
    SELECT sum(mr.amount) FROM public.invoice_adjustment_material_reversals mr
    WHERE mr.company_id = p_company AND mr.receipt_id = p_receipt
  ), 0);
$$;

CREATE FUNCTION rawasi_private.check_invoice_receipt_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_balance numeric;
BEGIN
  IF NEW.invoice_id IS NULL OR COALESCE(NEW.status NOT IN ('posted', 'مرحل', 'معتمد'), true) THEN
    RETURN NEW;
  END IF;
  PERFORM 1 FROM public.invoices i WHERE i.company_id = NEW.company_id AND i.id = NEW.invoice_id FOR UPDATE;
  SELECT t.balance INTO v_balance FROM rawasi_private.invoice_adjustment_totals(NEW.company_id, NEW.invoice_id) t;
  IF v_balance < 0 THEN
    RAISE EXCEPTION 'مبلغ سند القبض يتجاوز الرصيد المتبقي على الفاتورة بعد الإشعارات والتحصيلات السابقة' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER zz_check_invoice_receipt_balance
  AFTER INSERT OR UPDATE OF status, amount, invoice_id ON public.receipt_vouchers
  FOR EACH ROW WHEN (NEW.invoice_id IS NOT NULL AND NEW.status IN ('posted', 'مرحل', 'معتمد'))
  EXECUTE FUNCTION rawasi_private.check_invoice_receipt_balance();

CREATE FUNCTION rawasi_private.get_invoice_adjustment_options(p_invoice_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_company uuid := rawasi_private.current_company_id();
  v_invoice public.invoices%ROWTYPE;
  v_totals record;
  v_lines jsonb;
  v_header uuid;
  v_unreversed_materials numeric := 0;
  v_review text;
BEGIN
  IF auth.uid() IS NULL OR v_company IS NULL OR NOT rawasi_private.can_access('invoices', 'view') THEN
    RAISE EXCEPTION 'لا توجد صلاحية عرض إشعارات الفواتير' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_invoice FROM public.invoices i WHERE i.company_id = v_company AND i.id = p_invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'الفاتورة غير موجودة في الشركة المفتوحة' USING ERRCODE = 'P0002'; END IF;
  v_header := rawasi_private.invoice_adjustment_header(v_company, p_invoice_id);
  SELECT * INTO v_totals FROM rawasi_private.invoice_adjustment_totals(v_company, p_invoice_id);
  IF v_header IS NOT NULL THEN
    SELECT coalesce(sum(a.amount - coalesce(rev.total, 0)), 0)
    INTO v_unreversed_materials
    FROM public.invoice_customer_material_applications a
    LEFT JOIN LATERAL (
      SELECT sum(mr.amount) AS total
      FROM public.invoice_adjustment_material_reversals mr
      WHERE mr.company_id = a.company_id AND mr.application_id = a.id
    ) rev ON true
    WHERE a.company_id = v_company AND a.invoice_id = p_invoice_id AND a.journal_header_id = v_header;
  END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(c) || jsonb_build_object('remaining_base', c.base_amount + prior.base_delta) ORDER BY c.line_index), '[]'::jsonb)
  INTO v_lines
  FROM rawasi_private.invoice_adjustment_candidates(v_company, p_invoice_id, v_header) c
  CROSS JOIN LATERAL (
    SELECT coalesce(sum(CASE n.note_type WHEN 'debit' THEN n.base_amount ELSE -n.base_amount END), 0) AS base_delta
    FROM public.invoice_adjustment_notes n
    WHERE n.company_id = v_company AND n.invoice_id = p_invoice_id AND n.invoice_line_id IS NOT DISTINCT FROM c.id
  ) prior;
  IF v_invoice.status NOT IN ('posted', 'مرحل', 'معتمد') OR v_invoice.status IS NULL THEN
    v_review := 'يمكن إصدار الإشعار بعد ترحيل الفاتورة';
  ELSIF v_lines = '[]'::jsonb THEN
    v_review := 'تفاصيل الفاتورة أو قيدها الأصلي تحتاج مراجعة محاسبية قبل إصدار الإشعار';
  ELSIF NOT EXISTS (SELECT FROM public.companies c WHERE c.id = v_company AND c.country = 'SA' AND c.currency = 'SAR' AND c.tax_number IS NOT NULL) THEN
    v_review := 'يلزم تسجيل الرقم الضريبي للشركة السعودية قبل إصدار الإشعار';
  ELSIF EXISTS (SELECT FROM public.companies c WHERE c.id = v_company
    AND octet_length(coalesce(nullif(btrim(c.legal_name), ''), c.name)) > 255) THEN
    v_review := 'اسم الشركة أطول من الحد المدعوم في رمز الإشعار. راجع الاسم في إعدادات الشركة';
  END IF;
  RETURN jsonb_build_object('invoice_id', p_invoice_id, 'invoice_number', v_invoice.invoice_number,
    'paid_amount', v_totals.paid_amount, 'net_adjustment', v_totals.net_adjustment, 'balance', v_totals.balance,
    'unreversed_materials', v_unreversed_materials, 'lines', v_lines, 'review_reason', v_review);
END;
$$;

CREATE FUNCTION rawasi_private.issue_invoice_adjustment(
  p_request_id uuid, p_invoice_id uuid, p_invoice_line_id uuid, p_note_type text,
  p_note_date date, p_base_amount numeric, p_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_company uuid := rawasi_private.current_company_id();
  v_user uuid := auth.uid();
  v_seller public.companies%ROWTYPE;
  v_seller_name text;
  v_invoice public.invoices%ROWTYPE;
  v_note public.invoice_adjustment_notes%ROWTYPE;
  v_source_header uuid;
  v_header uuid;
  v_note_id uuid := gen_random_uuid();
  v_line record;
  v_prior record;
  v_totals record;
  v_app record;
  v_new_base numeric;
  v_tax_account uuid;
  v_retention_account uuid;
  v_materials_account uuid;
  v_tax numeric;
  v_retention numeric;
  v_line_receivable numeric;
  v_material_reversal numeric := 0;
  v_unreversed_materials numeric := 0;
  v_remaining_reversal numeric := 0;
  v_chunk numeric;
  v_receivable numeric;
  v_reversal_rows jsonb := '[]'::jsonb;
  v_sign integer;
  v_reason text := btrim(p_reason);
BEGIN
  IF v_user IS NULL OR v_company IS NULL OR NOT rawasi_private.can_access('invoices', 'view')
     OR NOT rawasi_private.can_access('invoices', 'post') THEN
    RAISE EXCEPTION 'لا توجد صلاحية إصدار إشعارات الفواتير' USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL OR p_invoice_id IS NULL OR p_note_type IS NULL OR p_note_type NOT IN ('credit', 'debit')
     OR p_note_date IS NULL OR NOT isfinite(p_note_date) OR p_note_date > (now() AT TIME ZONE 'Asia/Riyadh')::date
     OR p_base_amount IS NULL OR p_base_amount <= 0 OR p_base_amount >= 10000000000000
     OR p_base_amount <> round(p_base_amount, 2) OR v_reason IS NULL OR char_length(v_reason) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'بيانات الإشعار غير صحيحة' USING ERRCODE = '22023';
  END IF;

  -- One request and one invoice at a time, including while a receipt is being approved.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_company::text || ':invoice-adjustment:' || p_request_id::text, 0));
  SELECT * INTO v_note FROM public.invoice_adjustment_notes n WHERE n.company_id = v_company AND n.request_id = p_request_id;
  IF FOUND THEN
    IF (v_note.invoice_id, v_note.invoice_line_id, v_note.note_type, v_note.note_date, v_note.base_amount, v_note.reason)
       IS DISTINCT FROM (p_invoice_id, p_invoice_line_id, p_note_type, p_note_date, p_base_amount, v_reason) THEN
      RAISE EXCEPTION 'معرّف الطلب مستخدم بإشعار مختلف' USING ERRCODE = '23505';
    END IF;
    RETURN to_jsonb(v_note);
  END IF;

  SELECT * INTO v_invoice FROM public.invoices i WHERE i.company_id = v_company AND i.id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الفاتورة غير موجودة في الشركة المفتوحة' USING ERRCODE = 'P0002'; END IF;
  IF NOT COALESCE(v_invoice.status IN ('posted', 'مرحل', 'معتمد'), false) OR p_note_date < v_invoice.date THEN
    RAISE EXCEPTION 'يجب أن تكون الفاتورة مرحّلة وتاريخ الإشعار في تاريخ الفاتورة أو بعده' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_seller FROM public.companies c
  WHERE c.id = v_company AND c.is_active AND c.country = 'SA' AND c.currency = 'SAR' AND c.tax_number IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'يلزم تسجيل الرقم الضريبي للشركة السعودية قبل إصدار الإشعار' USING ERRCODE = '23514'; END IF;
  v_seller_name := coalesce(nullif(btrim(v_seller.legal_name), ''), v_seller.name);
  IF octet_length(v_seller_name) > 255 THEN
    RAISE EXCEPTION 'اسم الشركة أطول من الحد المدعوم في رمز الإشعار. راجع الاسم في إعدادات الشركة' USING ERRCODE = '23514';
  END IF;

  v_source_header := rawasi_private.invoice_adjustment_header(v_company, p_invoice_id);
  PERFORM 1 FROM public.journal_headers h
  WHERE h.company_id = v_company AND h.id = v_source_header AND h.reference_id = p_invoice_id
    AND h.entry_date = v_invoice.date AND h.v_type IN ('invoices', 'فاتورة مبيعات')
    AND h.status IN ('posted', 'مرحل', 'معتمد') FOR NO KEY UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'قيد الفاتورة الأصلي يحتاج مراجعة محاسبية' USING ERRCODE = '23514'; END IF;

  SELECT * INTO v_line FROM rawasi_private.invoice_adjustment_candidates(v_company, p_invoice_id, v_source_header) c
  WHERE c.id IS NOT DISTINCT FROM p_invoice_line_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'تفاصيل الفاتورة أو البند المحدد تحتاج مراجعة محاسبية' USING ERRCODE = '23514'; END IF;
  IF v_line.review_reason IS NOT NULL THEN RAISE EXCEPTION '%', v_line.review_reason USING ERRCODE = '23514'; END IF;

  SELECT coalesce(sum(CASE n.note_type WHEN 'debit' THEN n.base_amount ELSE -n.base_amount END), 0) AS base_delta,
    coalesce(sum(CASE n.note_type WHEN 'debit' THEN n.tax_amount ELSE -n.tax_amount END), 0) AS tax_delta,
    coalesce(sum(CASE n.note_type WHEN 'debit' THEN n.retention_amount ELSE -n.retention_amount END), 0) AS retention_delta
  INTO v_prior FROM public.invoice_adjustment_notes n
  WHERE n.company_id = v_company AND n.invoice_id = p_invoice_id AND n.invoice_line_id IS NOT DISTINCT FROM p_invoice_line_id;

  v_sign := CASE p_note_type WHEN 'debit' THEN 1 ELSE -1 END;
  v_new_base := v_line.base_amount + v_prior.base_delta + v_sign * p_base_amount;
  IF v_new_base < 0 THEN RAISE EXCEPTION 'مبلغ الإشعار الدائن يتجاوز المتبقي من أساس البند' USING ERRCODE = '23514'; END IF;
  -- On new invoices use the original snapshotted rate, even when the original amount rounded
  -- to zero. For unambiguous legacy invoices the historical posted amounts are the only basis.
  v_tax := v_sign * ((CASE WHEN v_line.id IS NULL THEN round(v_line.tax_amount * v_new_base / v_line.base_amount, 2)
      WHEN v_invoice.skip_zatca IS TRUE THEN 0 ELSE round(v_new_base * 0.15, 2) END) - v_line.tax_amount - v_prior.tax_delta);
  v_retention := v_sign * ((CASE WHEN v_line.id IS NULL THEN round(v_line.retention_amount * v_new_base / v_line.base_amount, 2)
      ELSE round(v_new_base * v_line.retention_percent / 100, 2) END) - v_line.retention_amount - v_prior.retention_delta);
  v_line_receivable := p_base_amount + v_tax - v_retention;

  SELECT * INTO v_totals FROM rawasi_private.invoice_adjustment_totals(v_company, p_invoice_id);
  IF p_note_type = 'credit' THEN
    IF v_line_receivable > greatest(v_totals.balance, 0) THEN
      PERFORM r.id FROM public.material_receipts r
      WHERE r.company_id = v_company AND r.id IN (
        SELECT a.receipt_id FROM public.invoice_customer_material_applications a
        WHERE a.company_id = v_company AND a.invoice_id = p_invoice_id AND a.journal_header_id = v_source_header
      ) ORDER BY r.id FOR UPDATE;
      SELECT coalesce(sum(a.amount - coalesce(rev.total, 0)), 0)
      INTO v_unreversed_materials
      FROM public.invoice_customer_material_applications a
      LEFT JOIN LATERAL (
        SELECT sum(mr.amount) AS total
        FROM public.invoice_adjustment_material_reversals mr
        WHERE mr.company_id = a.company_id AND mr.application_id = a.id
      ) rev ON true
      WHERE a.company_id = v_company AND a.invoice_id = p_invoice_id AND a.journal_header_id = v_source_header;
      v_material_reversal := v_line_receivable - greatest(v_totals.balance, 0);
    END IF;
    v_receivable := v_line_receivable - v_material_reversal;
    IF v_material_reversal > v_unreversed_materials OR v_receivable > v_totals.balance THEN
      RAISE EXCEPTION 'مبلغ الإشعار الدائن يتجاوز رصيد الفاتورة بعد التحصيل والإشعارات السابقة' USING ERRCODE = '23514';
    END IF;
  ELSE
    v_receivable := v_line_receivable;
  END IF;

  v_tax_account := v_invoice.tax_acc_id;
  v_retention_account := v_invoice.guarantee_acc_id;
  v_materials_account := v_invoice.materials_acc_id;
  -- A tiny new invoice can have a nonzero rate but no original tax/retention line after rounding.
  IF v_line.id IS NOT NULL AND v_tax > 0 AND v_tax_account IS NULL THEN
    v_tax_account := rawasi_private.require_company_account('215');
  END IF;
  IF v_line.id IS NOT NULL AND v_retention > 0 AND v_retention_account IS NULL THEN
    v_retention_account := rawasi_private.require_company_account('124');
  END IF;
  IF v_material_reversal > 0 AND v_materials_account IS NULL THEN
    v_materials_account := rawasi_private.require_company_account('217');
  END IF;
  IF EXISTS (
    SELECT FROM (VALUES (v_invoice.credit_account_id, p_base_amount), (v_invoice.debit_account_id, v_receivable),
      (v_retention_account, v_retention), (v_tax_account, v_tax), (v_materials_account, v_material_reversal)) needed(account_id, amount)
    WHERE needed.amount > 0 AND NOT EXISTS (
      SELECT FROM public.accounts a WHERE a.company_id = v_company AND a.id = needed.account_id AND a.is_transactional
    )
  ) THEN RAISE EXCEPTION 'أحد حسابات القيد الأصلي يحتاج مراجعة محاسبية' USING ERRCODE = '23514'; END IF;

  INSERT INTO public.journal_headers (company_id, entry_date, description, reference_id, v_type, status, job_order_id)
  VALUES (v_company, p_note_date,
    CASE p_note_type WHEN 'credit' THEN 'إشعار دائن للفاتورة ' ELSE 'إشعار مدين للفاتورة ' END || v_invoice.invoice_number,
    v_note_id, 'invoice_adjustment_notes', 'posted', v_line.job_order_id)
  RETURNING id INTO v_header;

  INSERT INTO public.journal_lines (company_id, header_id, account_id, partner_id, project_id, job_order_id, debit, credit, notes)
  SELECT v_company, v_header, item.account_id, item.partner_id, v_line.project_id, v_line.job_order_id,
    greatest(v_sign * item.normal_debit, 0), greatest(-v_sign * item.normal_debit, 0), item.description
  FROM (VALUES
    (v_invoice.debit_account_id, v_invoice.partner_id, v_receivable, 'تعديل ذمة العميل'),
    (v_retention_account, v_invoice.partner_id, v_retention, 'تعديل محتجز ضمان الأعمال'),
    (v_invoice.credit_account_id, NULL::uuid, -p_base_amount, 'تعديل الإيراد'),
    (v_tax_account, NULL::uuid, -v_tax, 'تعديل ضريبة المبيعات')
  ) item(account_id, partner_id, normal_debit, description)
  WHERE item.normal_debit <> 0;

  IF v_material_reversal > 0 THEN
    v_remaining_reversal := v_material_reversal;
    FOR v_app IN
      SELECT a.id AS application_id, r.id AS receipt_id, r.receipt_number, r.project_id, r.job_order_id,
             a.amount - coalesce(rev.total, 0) AS available_to_reverse
      FROM public.invoice_customer_material_applications a
      JOIN public.material_receipts r ON r.company_id = a.company_id AND r.id = a.receipt_id
      LEFT JOIN LATERAL (
        SELECT sum(mr.amount) AS total
        FROM public.invoice_adjustment_material_reversals mr
        WHERE mr.company_id = a.company_id AND mr.application_id = a.id
      ) rev ON true
      WHERE a.company_id = v_company AND a.invoice_id = p_invoice_id AND a.journal_header_id = v_source_header
        AND a.amount - coalesce(rev.total, 0) > 0
      ORDER BY (r.job_order_id IS DISTINCT FROM v_line.job_order_id), r.receipt_date DESC, a.id DESC
    LOOP
      EXIT WHEN v_remaining_reversal <= 0;
      v_chunk := least(v_remaining_reversal, v_app.available_to_reverse);
      INSERT INTO public.journal_lines (company_id, header_id, account_id, partner_id, project_id, job_order_id, debit, credit, notes)
      VALUES (v_company, v_header, v_materials_account, v_invoice.partner_id, v_app.project_id, v_app.job_order_id,
        0, v_chunk, 'عكس تسوية خامات العميل – سند ' || v_app.receipt_number);
      v_reversal_rows := v_reversal_rows || jsonb_build_array(jsonb_build_object(
        'application_id', v_app.application_id, 'receipt_id', v_app.receipt_id, 'amount', v_chunk
      ));
      v_remaining_reversal := v_remaining_reversal - v_chunk;
    END LOOP;
  END IF;

  INSERT INTO public.invoice_adjustment_notes (id, company_id, invoice_id, invoice_line_id, original_journal_id, journal_header_id,
    request_id, note_type, note_date, reason, base_amount, tax_amount, retention_amount, material_reversal_amount,
    partner_id, project_id, job_order_id, invoice_number, seller_name, seller_tax_number, created_by)
  VALUES (v_note_id, v_company, p_invoice_id, p_invoice_line_id, v_source_header, v_header, p_request_id, p_note_type,
    p_note_date, v_reason, p_base_amount, v_tax, v_retention, v_material_reversal, v_invoice.partner_id, v_line.project_id, v_line.job_order_id,
    v_invoice.invoice_number, v_seller_name, v_seller.tax_number, v_user)
  RETURNING * INTO v_note;

  IF v_reversal_rows <> '[]'::jsonb THEN
    INSERT INTO public.invoice_adjustment_material_reversals (company_id, note_id, application_id, receipt_id, amount)
    SELECT v_company, v_note_id, (x->>'application_id')::uuid, (x->>'receipt_id')::uuid, (x->>'amount')::numeric
    FROM jsonb_array_elements(v_reversal_rows) x;
  END IF;

  RETURN to_jsonb(v_note);
END;
$$;

CREATE FUNCTION public.get_invoice_adjustment_balances(p_invoice_ids uuid[])
RETURNS TABLE (invoice_id uuid, paid_amount numeric, net_adjustment numeric, balance numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT * FROM rawasi_private.get_invoice_adjustment_balances(p_invoice_ids);
$$;

CREATE FUNCTION public.get_invoice_adjustment_options(p_invoice_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT rawasi_private.get_invoice_adjustment_options(p_invoice_id);
$$;

CREATE FUNCTION public.issue_invoice_adjustment(
  p_request_id uuid, p_invoice_id uuid, p_invoice_line_id uuid, p_note_type text,
  p_note_date date, p_base_amount numeric, p_reason text
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT rawasi_private.issue_invoice_adjustment(p_request_id, p_invoice_id, p_invoice_line_id, p_note_type, p_note_date, p_base_amount, p_reason);
$$;

REVOKE ALL ON FUNCTION rawasi_private.protect_issued_invoice_adjustment(), rawasi_private.protect_invoice_adjustment_source(),
  rawasi_private.protect_invoice_adjustment_journal(), rawasi_private.protect_invoice_adjustment_journal_line(),
  rawasi_private.check_invoice_receipt_balance(),
  rawasi_private.invoice_adjustment_header(uuid, uuid), rawasi_private.invoice_adjustment_totals(uuid, uuid),
  rawasi_private.invoice_adjustment_candidates(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_invoice_adjustment_balances(uuid[]), public.get_invoice_adjustment_options(uuid),
  public.issue_invoice_adjustment(uuid, uuid, uuid, text, date, numeric, text),
  rawasi_private.customer_material_net_applied(uuid, uuid),
  rawasi_private.get_invoice_adjustment_balances(uuid[]), rawasi_private.get_invoice_adjustment_options(uuid),
  rawasi_private.issue_invoice_adjustment(uuid, uuid, uuid, text, date, numeric, text)
  FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_invoice_adjustment_balances(uuid[]), public.get_invoice_adjustment_options(uuid),
  public.issue_invoice_adjustment(uuid, uuid, uuid, text, date, numeric, text),
  rawasi_private.customer_material_net_applied(uuid, uuid),
  rawasi_private.get_invoice_adjustment_balances(uuid[]), rawasi_private.get_invoice_adjustment_options(uuid),
  rawasi_private.issue_invoice_adjustment(uuid, uuid, uuid, text, date, numeric, text)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;



-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- FILE: 20261105170004_vat_return.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- Internal VAT return with an explicit tax review for each document.
-- Source documents and the general ledger are never changed by a VAT review.
BEGIN;

CREATE TABLE public.vat_document_reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL DEFAULT rawasi_private.current_company_id() REFERENCES public.companies(id),
    source text NOT NULL CHECK (source IN ('invoice', 'expense', 'note')),
    source_id uuid NOT NULL,
    invoice_id uuid GENERATED ALWAYS AS (CASE WHEN source = 'invoice' THEN source_id END) STORED,
    expense_id uuid GENERATED ALWAYS AS (CASE WHEN source = 'expense' THEN source_id END) STORED,
    note_id uuid GENERATED ALWAYS AS (CASE WHEN source = 'note' THEN source_id END) STORED,
    category text NOT NULL,
    effective_tax_date date NOT NULL CHECK (isfinite(effective_tax_date)),
    recoverable_vat numeric(15,2) CHECK (recoverable_vat >= 0 AND recoverable_vat <> 'NaN'::numeric),
    evidence text NOT NULL CHECK (length(btrim(evidence)) BETWEEN 1 AND 500),
    source_document_date date NOT NULL,
    source_base numeric(15,2) NOT NULL,
    source_tax numeric(15,2) NOT NULL,
    source_skip_zatca boolean,
    source_journal_id uuid NOT NULL,
    reviewed_by uuid NOT NULL,
    reviewed_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, company_id),
    UNIQUE (company_id, source, source_id),
    FOREIGN KEY (invoice_id, company_id) REFERENCES public.invoices(id, company_id) ON DELETE CASCADE,
    FOREIGN KEY (expense_id, company_id) REFERENCES public.expenses(id, company_id) ON DELETE CASCADE,
    FOREIGN KEY (note_id, company_id) REFERENCES public.invoice_adjustment_notes(id, company_id) ON DELETE CASCADE,
    CHECK (
        (source IN ('invoice', 'note') AND recoverable_vat IS NULL AND category IN (
            'standard_sales', 'zero_sales', 'export_sales', 'exempt_sales', 'outside_scope'
        )) OR
        (source = 'expense' AND (
            (category IN ('standard_purchases', 'imports_paid') AND recoverable_vat IS NOT NULL)
            OR (category IN ('zero_purchases', 'exempt_purchases', 'outside_scope', 'noncompliant_purchase')
                AND recoverable_vat IS NULL)
        ))
    )
);

INSERT INTO rawasi_private.company_scoped_tables (table_name) VALUES ('vat_document_reviews');
CREATE TRIGGER aa_stamp_company_id BEFORE INSERT OR UPDATE OF company_id ON public.vat_document_reviews
    FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id();
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.vat_document_reviews
    FOR EACH ROW EXECUTE FUNCTION rawasi_private.log_audit_event();
ALTER TABLE public.vat_document_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY module_view ON public.vat_document_reviews FOR SELECT TO authenticated USING (
    rawasi_private.can_access('vat_return', 'view')
    AND rawasi_private.can_access('invoices', 'view')
    AND rawasi_private.can_access('expenses', 'view')
    AND rawasi_private.can_access('journal', 'view')
    AND company_id = (SELECT rawasi_private.current_company_id())
);
REVOKE ALL ON public.vat_document_reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vat_document_reviews TO authenticated;

CREATE TABLE public.vat_period_adjustments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL DEFAULT rawasi_private.current_company_id() REFERENCES public.companies(id),
    period_from date NOT NULL CHECK (isfinite(period_from)),
    period_to date NOT NULL CHECK (isfinite(period_to) AND period_to >= period_from AND period_to - period_from <= 366),
    prior_period_adjustment numeric(15,2) NOT NULL DEFAULT 0
        CHECK (prior_period_adjustment <> 'NaN'::numeric AND prior_period_adjustment::text NOT IN ('Infinity', '-Infinity')),
    carried_forward_credit numeric(15,2) NOT NULL DEFAULT 0
        CHECK (carried_forward_credit >= 0 AND carried_forward_credit <> 'NaN'::numeric AND carried_forward_credit < 'Infinity'::numeric),
    evidence text NOT NULL CHECK (length(btrim(evidence)) BETWEEN 1 AND 500),
    reviewed_by uuid NOT NULL,
    reviewed_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, company_id),
    UNIQUE (company_id, period_from, period_to)
);

INSERT INTO rawasi_private.company_scoped_tables (table_name) VALUES ('vat_period_adjustments');
CREATE TRIGGER aa_stamp_company_id BEFORE INSERT OR UPDATE OF company_id ON public.vat_period_adjustments
    FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id();
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.vat_period_adjustments
    FOR EACH ROW EXECUTE FUNCTION rawasi_private.log_audit_event();
ALTER TABLE public.vat_period_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY module_view ON public.vat_period_adjustments FOR SELECT TO authenticated USING (
    rawasi_private.can_access('vat_return', 'view')
    AND rawasi_private.can_access('invoices', 'view')
    AND rawasi_private.can_access('expenses', 'view')
    AND rawasi_private.can_access('journal', 'view')
    AND company_id = (SELECT rawasi_private.current_company_id())
);
REVOKE ALL ON public.vat_period_adjustments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vat_period_adjustments TO authenticated;

-- Match financial sources using the document reference and the journal's company and type.
-- Rows whose posting flag disagrees with their journal still surface for review.
CREATE VIEW rawasi_private.vat_document_sources WITH (security_invoker = true) AS
    SELECT i.company_id, 'invoice'::text AS source, i.id AS source_id, i.id AS invoice_id,
           i.invoice_number::text AS reference, i.date AS document_date,
           coalesce(i.taxable_amount, 0) AS base, coalesce(i.tax_amount, 0) AS recorded_tax,
           i.skip_zatca AS skip_zatca, j.id AS journal_id, j.posted_count,
           NULL::text AS note_type
    FROM public.invoices i
    LEFT JOIN LATERAL (
        SELECT (array_agg(h.id ORDER BY h.id))[1] AS id, count(*) AS posted_count
        FROM public.journal_headers h
        WHERE h.company_id = i.company_id AND h.reference_id = i.id
          AND h.v_type IN ('invoices', 'invoice', 'فاتورة مبيعات')
          AND h.status IN ('posted', 'مرحل', 'معتمد')
    ) j ON true
    WHERE i.company_id = (SELECT rawasi_private.current_company_id())
      AND (j.posted_count > 0 OR i.status IN ('posted', 'مرحل', 'معتمد', 'مدفوع', 'مسدد جزئي', 'مغلق'))

    UNION ALL
    SELECT e.company_id, 'expense', e.id, NULL::uuid, e.id::text, e.exp_date,
           coalesce(e.total_price, 0) - coalesce(e.discount_amount, 0), coalesce(e.vat_amount, 0),
           NULL::boolean, j.id, j.posted_count, NULL::text
    FROM public.expenses e
    LEFT JOIN LATERAL (
        SELECT (array_agg(h.id ORDER BY h.id))[1] AS id, count(*) AS posted_count
        FROM public.journal_headers h
        WHERE h.company_id = e.company_id AND h.reference_id = e.id
          AND h.v_type IN ('expense', 'expenses') AND h.status IN ('posted', 'مرحل', 'معتمد')
    ) j ON true
    WHERE e.company_id = (SELECT rawasi_private.current_company_id())
      AND (j.posted_count > 0 OR (e.is_posted AND NOT coalesce(e.is_deleted, false)))

    UNION ALL
    SELECT n.company_id, 'note', n.id, n.invoice_id, n.note_number, n.note_date,
           CASE n.note_type WHEN 'credit' THEN -n.base_amount ELSE n.base_amount END,
           CASE n.note_type WHEN 'credit' THEN -n.tax_amount ELSE n.tax_amount END,
           i.skip_zatca, h.id,
           CASE WHEN h.id IS NOT NULL AND oh.id IS NOT NULL THEN 1 ELSE 0 END,
           n.note_type
    FROM public.invoice_adjustment_notes n
    JOIN public.invoices i ON i.id = n.invoice_id AND i.company_id = n.company_id
    LEFT JOIN public.journal_headers h ON h.id = n.journal_header_id AND h.company_id = n.company_id
      AND h.reference_id = n.id AND h.status IN ('posted', 'مرحل', 'معتمد')
    LEFT JOIN public.journal_headers oh ON oh.id = n.original_journal_id AND oh.company_id = n.company_id
      AND oh.reference_id = i.id AND oh.v_type IN ('invoices', 'invoice', 'فاتورة مبيعات')
      AND oh.status IN ('posted', 'مرحل', 'معتمد')
    WHERE n.company_id = (SELECT rawasi_private.current_company_id());

CREATE VIEW rawasi_private.vat_document_review_state WITH (security_invoker = true) AS
    WITH matched AS (
        SELECT d.*, r.id AS review_id, r.category, r.effective_tax_date, r.recoverable_vat, r.evidence,
               (d.posted_count = 1
                   AND d.journal_id = r.source_journal_id
                   AND d.document_date = r.source_document_date
                   AND d.base = r.source_base AND d.recorded_tax = r.source_tax
                   AND d.skip_zatca IS NOT DISTINCT FROM r.source_skip_zatca) AS matches_review,
               CASE WHEN oi.posted_count = 1
                        AND oi.journal_id = ro.source_journal_id
                        AND oi.document_date = ro.source_document_date
                        AND oi.base = ro.source_base AND oi.recorded_tax = ro.source_tax
                        AND oi.skip_zatca IS NOT DISTINCT FROM ro.source_skip_zatca
                    THEN ro.category END AS original_category
        FROM rawasi_private.vat_document_sources d
        LEFT JOIN public.vat_document_reviews r ON r.company_id = d.company_id
          AND r.source = d.source AND r.source_id = d.source_id
        LEFT JOIN rawasi_private.vat_document_sources oi ON d.source = 'note'
          AND oi.source = 'invoice' AND oi.company_id = d.company_id AND oi.source_id = d.invoice_id
        LEFT JOIN public.vat_document_reviews ro ON ro.company_id = oi.company_id
          AND ro.source = 'invoice' AND ro.source_id = oi.source_id
    )
    SELECT *,
           coalesce(matches_review AND (source <> 'note' OR category = original_category), false) AS is_confirmed
    FROM matched;

REVOKE ALL ON rawasi_private.vat_document_sources, rawasi_private.vat_document_review_state FROM PUBLIC, anon, authenticated;
GRANT SELECT ON rawasi_private.vat_document_sources, rawasi_private.vat_document_review_state TO authenticated;

CREATE FUNCTION rawasi_private.require_vat_report_access(p_action text)
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
    v_company uuid := rawasi_private.current_company_id();
BEGIN
    IF auth.uid() IS NULL OR v_company IS NULL
        OR NOT rawasi_private.can_access('vat_return', 'view')
        OR NOT rawasi_private.can_access('vat_return', p_action)
        OR NOT rawasi_private.can_access('invoices', 'view')
        OR NOT rawasi_private.can_access('expenses', 'view')
        OR NOT rawasi_private.can_access('journal', 'view') THEN
        RAISE EXCEPTION 'تحتاج صلاحية الإقرار الضريبي والاطلاع على الفواتير والمصروفات واليومية' USING ERRCODE = '42501';
    END IF;
    RETURN v_company;
END;
$$;
REVOKE ALL ON FUNCTION rawasi_private.require_vat_report_access(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION rawasi_private.require_vat_report_access(text) TO authenticated;

CREATE FUNCTION public.save_vat_document_review(
    p_source text, p_source_id uuid, p_category text, p_effective_tax_date date,
    p_recoverable_vat numeric, p_evidence text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_company uuid := rawasi_private.require_vat_report_access('edit');
    d rawasi_private.vat_document_review_state%ROWTYPE;
    v_id uuid;
BEGIN
    IF p_source IS NULL OR p_source NOT IN ('invoice', 'expense', 'note') OR p_source_id IS NULL
        OR p_category IS NULL OR p_effective_tax_date IS NULL OR NOT isfinite(p_effective_tax_date)
        OR p_evidence IS NULL OR length(btrim(p_evidence)) NOT BETWEEN 1 AND 500 THEN
        RAISE EXCEPTION 'حدد المستند والتصنيف وتاريخ الاستحقاق الضريبي ومرجع المراجعة' USING ERRCODE = '22023';
    END IF;

    SELECT s.* INTO d FROM rawasi_private.vat_document_review_state s
    WHERE s.company_id = v_company AND s.source = p_source AND s.source_id = p_source_id;
    IF NOT FOUND OR d.posted_count <> 1 THEN
        RAISE EXCEPTION 'المستند غير متاح للمراجعة أو ليس له قيد مرحّل واحد مطابق' USING ERRCODE = '22023';
    END IF;
    IF d.base::text IN ('NaN', 'Infinity', '-Infinity') OR d.recorded_tax::text IN ('NaN', 'Infinity', '-Infinity')
        OR (p_source <> 'note' AND (d.base < 0 OR d.recorded_tax < 0)) THEN
        RAISE EXCEPTION 'مبالغ المستند غير صالحة للتصنيف' USING ERRCODE = '22023';
    END IF;
    IF p_source = 'note' AND p_category IS DISTINCT FROM d.original_category THEN
        RAISE EXCEPTION 'راجع تصنيف الفاتورة الأصلية أولاً واستخدم نفس التصنيف للإشعار' USING ERRCODE = '22023';
    END IF;

    IF p_source IN ('invoice', 'note') THEN
        IF p_recoverable_vat IS NOT NULL OR p_category NOT IN (
            'standard_sales', 'zero_sales', 'export_sales', 'exempt_sales', 'outside_scope'
        ) OR (p_category = 'standard_sales' AND (abs(d.base) <= 0 OR d.skip_zatca IS TRUE
            OR (p_source = 'invoice' AND abs(d.recorded_tax) <= 0)))
          OR (p_category <> 'standard_sales' AND d.recorded_tax <> 0) THEN
            RAISE EXCEPTION 'تصنيف المبيعات لا يطابق قيمة الضريبة المسجلة على المستند' USING ERRCODE = '22023';
        END IF;
    ELSE
        IF p_category NOT IN ('standard_purchases', 'imports_paid', 'zero_purchases', 'exempt_purchases',
                              'outside_scope', 'noncompliant_purchase') THEN
            RAISE EXCEPTION 'تصنيف المشتريات غير متاح' USING ERRCODE = '22023';
        ELSIF p_category IN ('standard_purchases', 'imports_paid') THEN
            IF d.base <= 0 OR d.recorded_tax <= 0 OR p_recoverable_vat IS NULL
                OR p_recoverable_vat NOT BETWEEN 0 AND d.recorded_tax
                OR p_recoverable_vat <> round(p_recoverable_vat, 2) THEN
                RAISE EXCEPTION 'أدخل ضريبة قابلة للخصم لا تتجاوز الضريبة المسجلة على مستند الشراء' USING ERRCODE = '22023';
            END IF;
        ELSIF p_recoverable_vat IS NOT NULL OR (p_category <> 'noncompliant_purchase' AND d.recorded_tax <> 0) THEN
            RAISE EXCEPTION 'تصنيف المشتريات لا يطابق قيمة الضريبة المسجلة على المستند' USING ERRCODE = '22023';
        END IF;
    END IF;

    INSERT INTO public.vat_document_reviews AS r (
        company_id, source, source_id, category, effective_tax_date, recoverable_vat, evidence,
        source_document_date, source_base, source_tax, source_skip_zatca, source_journal_id, reviewed_by
    ) VALUES (
        v_company, p_source, p_source_id, p_category, p_effective_tax_date, p_recoverable_vat, btrim(p_evidence),
        d.document_date, d.base, d.recorded_tax, d.skip_zatca, d.journal_id, auth.uid()
    )
    ON CONFLICT (company_id, source, source_id) DO UPDATE SET
        category = excluded.category, effective_tax_date = excluded.effective_tax_date,
        recoverable_vat = excluded.recoverable_vat, evidence = excluded.evidence,
        source_document_date = excluded.source_document_date, source_base = excluded.source_base,
        source_tax = excluded.source_tax, source_skip_zatca = excluded.source_skip_zatca,
        source_journal_id = excluded.source_journal_id,
        reviewed_by = excluded.reviewed_by, reviewed_at = now()
    RETURNING r.id INTO v_id;
    RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_vat_document_review(text, uuid, text, date, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_vat_document_review(text, uuid, text, date, numeric, text) TO authenticated;

CREATE FUNCTION public.save_vat_period_adjustments(
    p_from date, p_to date,
    p_prior_period_adjustment numeric,
    p_carried_forward_credit numeric,
    p_evidence text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_company uuid := rawasi_private.require_vat_report_access('edit');
    v_id uuid;
BEGIN
    IF p_from IS NULL OR p_to IS NULL OR NOT isfinite(p_from) OR NOT isfinite(p_to)
        OR p_to < p_from OR p_to - p_from > 366 THEN
        RAISE EXCEPTION 'حدد فترة ضريبية صحيحة لا تزيد على سنة' USING ERRCODE = '22023';
    END IF;
    IF p_prior_period_adjustment IS NULL
        OR p_prior_period_adjustment::text IN ('NaN', 'Infinity', '-Infinity')
        OR p_prior_period_adjustment <> round(p_prior_period_adjustment, 2) THEN
        RAISE EXCEPTION 'أدخل قيمة صحيحة لتصحيحات الفترات السابقة (خانة 14)' USING ERRCODE = '22023';
    END IF;
    IF p_carried_forward_credit IS NULL
        OR p_carried_forward_credit::text IN ('NaN', 'Infinity', '-Infinity')
        OR p_carried_forward_credit < 0
        OR p_carried_forward_credit <> round(p_carried_forward_credit, 2) THEN
        RAISE EXCEPTION 'أدخل رصيداً دائناً مرحلاً غير سالب (خانة 15)' USING ERRCODE = '22023';
    END IF;
    IF p_evidence IS NULL OR length(btrim(p_evidence)) NOT BETWEEN 1 AND 500 THEN
        RAISE EXCEPTION 'أدخل بيان أو مرجع اعتماد تسويات الفترة (خانة 14 و15)' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.vat_period_adjustments AS pa (
        company_id, period_from, period_to,
        prior_period_adjustment, carried_forward_credit,
        evidence, reviewed_by
    ) VALUES (
        v_company, p_from, p_to,
        p_prior_period_adjustment, p_carried_forward_credit,
        btrim(p_evidence), auth.uid()
    )
    ON CONFLICT (company_id, period_from, period_to) DO UPDATE SET
        prior_period_adjustment = excluded.prior_period_adjustment,
        carried_forward_credit = excluded.carried_forward_credit,
        evidence = excluded.evidence,
        reviewed_by = excluded.reviewed_by,
        reviewed_at = now()
    RETURNING pa.id INTO v_id;
    RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_vat_period_adjustments(date, date, numeric, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_vat_period_adjustments(date, date, numeric, numeric, text) TO authenticated;

CREATE FUNCTION public.get_vat_return(p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
    v_company uuid := rawasi_private.require_vat_report_access('view');
    v_account uuid := rawasi_private.company_account_id('215');
BEGIN
    IF p_from IS NULL OR p_to IS NULL OR NOT isfinite(p_from) OR NOT isfinite(p_to)
        OR p_to < p_from OR p_to - p_from > 366 THEN
        RAISE EXCEPTION 'حدد فترة ضريبية صحيحة لا تزيد على سنة' USING ERRCODE = '22023';
    END IF;

    RETURN (
        WITH entries AS MATERIALIZED (
            SELECT d.*, d.document_date BETWEEN p_from AND p_to AS in_document_period,
                   d.is_confirmed AND d.effective_tax_date BETWEEN p_from AND p_to AS in_tax_period
            FROM rawasi_private.vat_document_review_state d
            WHERE d.company_id = v_company AND (d.document_date BETWEEN p_from AND p_to
                OR d.effective_tax_date BETWEEN p_from AND p_to)
        ),
        transactions AS MATERIALIZED (
            SELECT e.*,
                CASE WHEN e.is_confirmed THEN e.effective_tax_date END AS tax_date,
                CASE WHEN NOT e.is_confirmed THEN 'review'
                     WHEN e.category IN ('outside_scope', 'noncompliant_purchase') THEN 'excluded'
                     ELSE 'confirmed' END AS status,
                CASE WHEN NOT e.is_confirmed THEN NULL::numeric
                     WHEN e.category IN ('outside_scope', 'noncompliant_purchase') THEN 0
                     WHEN e.source = 'expense' THEN coalesce(e.recoverable_vat, 0)
                     ELSE e.recorded_tax END AS confirmed_tax,
                CASE WHEN e.is_confirmed THEN NULL::text
                     WHEN e.posted_count = 0 THEN 'missing_posted_journal'
                     WHEN e.posted_count > 1 THEN 'multiple_posted_journals'
                     WHEN e.source = 'note' AND e.original_category IS NULL THEN 'original_review_required'
                     WHEN e.review_id IS NOT NULL THEN 'review_stale'
                     WHEN e.source = 'expense' THEN 'purchase_tax_eligibility_unverified'
                     ELSE 'tax_category_or_date_unverified' END AS review_reason
            FROM entries e
        ),
        gl AS MATERIALIZED (
            SELECT l.id, h.id AS header_id, h.entry_date AS date, h.v_type AS source,
                   h.reference_id AS source_id, h.description, l.credit - l.debit AS amount,
                   CASE WHEN h.v_type IN ('invoice', 'invoices', 'فاتورة مبيعات') THEN 'sale'
                        WHEN h.v_type IN ('expense', 'expenses') THEN 'purchase'
                        WHEN n.id IS NOT NULL THEN 'note'
                        WHEN h.v_type = 'manual_journals' OR h.v_type IS NULL THEN 'manual'
                        ELSE 'other' END AS kind
            FROM public.journal_lines l
            JOIN public.journal_headers h ON h.id = l.header_id AND h.company_id = l.company_id
            LEFT JOIN public.invoice_adjustment_notes n ON n.id = h.reference_id AND n.company_id = h.company_id
              AND n.journal_header_id = h.id
            WHERE l.company_id = v_company AND l.account_id = v_account
              AND h.entry_date BETWEEN p_from AND p_to AND h.status IN ('posted', 'مرحل', 'معتمد')
        ),
        gl_by_header AS (
            SELECT header_id, sum(amount) AS amount FROM gl GROUP BY header_id
        ),
        totals AS (
            SELECT coalesce(sum(CASE WHEN source = 'expense' THEN -recorded_tax ELSE recorded_tax END)
                       FILTER (WHERE in_document_period), 0) AS recorded_net,
                   sum(CASE WHEN source = 'expense' THEN -confirmed_tax ELSE confirmed_tax END)
                       FILTER (WHERE in_tax_period) AS confirmed_net,
                   count(*) FILTER (WHERE status = 'review' AND source <> 'expense') AS sales_review_count,
                   count(*) FILTER (WHERE status = 'review' AND source = 'expense') AS purchases_review_count,
                   (SELECT coalesce(sum(amount), 0) FROM gl) AS movement
            FROM transactions
        ),
        period_adj AS (
            SELECT pa.id, pa.prior_period_adjustment, pa.carried_forward_credit, pa.evidence, pa.reviewed_at
            FROM public.vat_period_adjustments pa
            WHERE pa.company_id = v_company AND pa.period_from = p_from AND pa.period_to = p_to
        ),
        box_definitions(number, label, categories, side) AS (
            VALUES
            (1, 'المبيعات الخاضعة للنسبة الأساسية', ARRAY['standard_sales'], 'sales'),
            (2, 'مبيعات للمواطنين تتحمل الدولة ضريبتها', NULL::text[], 'manual'),
            (3, 'المبيعات المحلية الخاضعة للنسبة الصفرية', ARRAY['zero_sales'], 'sales'),
            (4, 'الصادرات', ARRAY['export_sales'], 'sales'),
            (5, 'المبيعات المعفاة', ARRAY['exempt_sales'], 'sales'),
            (6, 'إجمالي المبيعات', ARRAY['standard_sales', 'zero_sales', 'export_sales', 'exempt_sales'], 'total_sales'),
            (7, 'المشتريات الخاضعة للنسبة الأساسية', ARRAY['standard_purchases'], 'purchases'),
            (8, 'الواردات المسددة ضريبتها عند الاستيراد', ARRAY['imports_paid'], 'purchases'),
            (9, 'الواردات الخاضعة للحساب العكسي', NULL::text[], 'manual'),
            (10, 'المشتريات الخاضعة للنسبة الصفرية', ARRAY['zero_purchases'], 'purchases'),
            (11, 'المشتريات المعفاة', ARRAY['exempt_purchases'], 'purchases'),
            (12, 'إجمالي المشتريات', ARRAY['standard_purchases', 'imports_paid', 'zero_purchases', 'exempt_purchases'], 'total_purchases'),
            (13, 'صافي الضريبة عن الفترة الحالية', NULL::text[], 'net'),
            (14, 'تصحيحات الفترات السابقة', NULL::text[], 'prior_adj'),
            (15, 'الضريبة المرحلة من الفترات السابقة', NULL::text[], 'credit_fwd'),
            (16, 'صافي الضريبة المستحقة', NULL::text[], 'final_net')
        ),
        boxes AS (
            SELECT b.number, b.label,
                CASE WHEN b.categories IS NOT NULL AND (a.cnt > 0 OR c.review_count = 0)
                    THEN coalesce(a.base, 0) END AS base,
                CASE WHEN b.categories IS NOT NULL AND (a.cnt > 0 OR c.review_count = 0)
                    THEN coalesce(a.adjustment, 0) END AS adjustment,
                CASE WHEN b.side = 'net' THEN
                         CASE WHEN totals.sales_review_count + totals.purchases_review_count = 0
                              THEN coalesce(totals.confirmed_net, 0)
                              ELSE totals.confirmed_net END
                     WHEN b.side = 'prior_adj' THEN pa.prior_period_adjustment
                     WHEN b.side = 'credit_fwd' THEN pa.carried_forward_credit
                     WHEN b.side = 'final_net' THEN
                         CASE WHEN pa.id IS NOT NULL AND totals.sales_review_count + totals.purchases_review_count = 0
                              THEN coalesce(totals.confirmed_net, 0) + pa.prior_period_adjustment - pa.carried_forward_credit END
                     WHEN b.categories IS NOT NULL AND (a.cnt > 0 OR c.review_count = 0)
                        THEN coalesce(a.tax, 0) END AS tax,
                CASE WHEN b.side = 'manual' THEN 'manual'
                     WHEN b.side IN ('prior_adj', 'credit_fwd') THEN
                         CASE WHEN pa.id IS NOT NULL THEN 'confirmed' ELSE 'manual' END
                     WHEN b.side = 'final_net' THEN
                         CASE WHEN pa.id IS NOT NULL AND totals.sales_review_count + totals.purchases_review_count = 0
                              THEN 'confirmed' ELSE 'pending' END
                     WHEN b.side IN ('total_sales', 'total_purchases', 'net') THEN 'partial'
                     WHEN c.review_count = 0 THEN 'confirmed'
                     WHEN a.cnt > 0 THEN 'partial'
                     ELSE 'pending' END AS status
            FROM box_definitions b CROSS JOIN totals
            LEFT JOIN period_adj pa ON true
            CROSS JOIN LATERAL (
                SELECT CASE WHEN b.side IN ('sales', 'total_sales') THEN totals.sales_review_count
                            ELSE totals.purchases_review_count END AS review_count
            ) c
            CROSS JOIN LATERAL (
                SELECT count(*) AS cnt, sum(t.base) FILTER (WHERE t.source <> 'note') AS base,
                       sum(t.base) FILTER (WHERE t.source = 'note') AS adjustment, sum(t.confirmed_tax) AS tax
                FROM transactions t WHERE t.in_tax_period AND t.category = ANY(b.categories)
            ) a
        )
        SELECT jsonb_build_object(
            'period', jsonb_build_object('from', p_from, 'to', p_to),
            'company', (SELECT jsonb_build_object('id', c.id, 'name', c.name, 'tax_number', c.tax_number)
                        FROM public.companies c WHERE c.id = v_company),
            'period_adjustments', (
                SELECT jsonb_build_object(
                    'prior_period_adjustment', pa.prior_period_adjustment,
                    'carried_forward_credit', pa.carried_forward_credit,
                    'evidence', pa.evidence,
                    'reviewed_at', pa.reviewed_at
                ) FROM period_adj pa
            ),
            'boxes', (SELECT jsonb_agg(to_jsonb(b) ORDER BY b.number) FROM boxes b),
            'transactions', coalesce((SELECT jsonb_agg(jsonb_build_object(
                'source', t.source, 'source_id', t.source_id, 'invoice_id', t.invoice_id,
                'reference', t.reference, 'document_date', t.document_date, 'tax_date', t.tax_date,
                'base', t.base, 'recorded_tax', t.recorded_tax, 'confirmed_tax', t.confirmed_tax,
                'recoverable_vat', t.recoverable_vat, 'category', t.category, 'original_category', t.original_category,
                'status', t.status, 'review_reason', t.review_reason, 'evidence', t.evidence,
                'in_document_period', t.in_document_period, 'in_tax_period', t.in_tax_period,
                'gl_215_amount', CASE WHEN v_account IS NOT NULL THEN coalesce(g.amount, 0) END
            ) ORDER BY t.document_date DESC, t.source, t.source_id)
            FROM transactions t LEFT JOIN gl_by_header g ON g.header_id = t.journal_id), '[]'::jsonb),
            'reconciliation', jsonb_build_object(
                'account_code', '215', 'posted_movement', CASE WHEN v_account IS NOT NULL THEN totals.movement END,
                'recorded_document_net', totals.recorded_net, 'confirmed_document_net', totals.confirmed_net,
                'variance_recorded', CASE WHEN v_account IS NOT NULL THEN totals.movement - totals.recorded_net END,
                'variance_confirmed', CASE WHEN v_account IS NOT NULL THEN totals.movement - totals.confirmed_net END,
                'lines', coalesce((SELECT jsonb_agg(to_jsonb(g) ORDER BY g.date, g.id) FROM gl g), '[]'::jsonb)
            )
        ) FROM totals
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_vat_return(date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_vat_return(date, date) TO authenticated;

COMMIT;



-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- FILE: 20261105170005_document_numbering_fix.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- Fix sequential document numbering across 9999 -> 10000 and legacy sequential gaps.
-- Preserves 4-digit padding for 0001..9999 while expanding cleanly to 5+ digits from 10000 onward,
-- and seeds new counters after the highest existing sequential number instead of back-filling gaps.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $preflight$
BEGIN
  IF to_regclass('rawasi_private.document_counters') IS NULL THEN
    RAISE EXCEPTION 'Apply 20261105170000_document_numbering.sql first';
  END IF;
END;
$preflight$;

-- Advance any already-initialized counter past existing sequential 4-digit numbers in its table.
DO $sync_existing_counters$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('INV', 'invoices', 'invoice_number'),
      ('RV',  'receipt_vouchers', 'receipt_number'),
      ('PV',  'payment_vouchers', 'voucher_number'),
      ('CLM', 'sub_claims', 'claim_number'),
      ('JO',  'job_orders', 'order_number'),
      ('MR',  'material_receipts', 'receipt_number'),
      ('ISS', 'material_issues', 'issue_number'),
      ('CN',  'invoice_adjustment_notes', 'note_number'),
      ('DN',  'invoice_adjustment_notes', 'note_number')
    ) AS t(doc_type, tbl, col)
    WHERE to_regclass('public.' || t.tbl) IS NOT NULL
  LOOP
    EXECUTE format(
      $q$
      UPDATE rawasi_private.document_counters dc
      SET last_number = GREATEST(
        dc.last_number,
        COALESCE((
          SELECT CASE
            WHEN bool_or(src.%1$I = ($1 || '-' || dc.year || '-9999'))
              THEN max((substring(src.%1$I FROM '^' || $1 || '-' || dc.year || '-([0-9]{4,9})$'))::integer)
            ELSE max((substring(src.%1$I FROM '^' || $1 || '-' || dc.year || '-([0-9]{4})$'))::integer)
          END
          FROM public.%2$I src
          WHERE src.company_id = dc.company_id
            AND src.%1$I LIKE ($1 || '-' || dc.year || '-%%')
        ), 0)
      )
      WHERE dc.doc_type = $1
      $q$,
      r.col, r.tbl
    ) USING r.doc_type;
  END LOOP;
END;
$sync_existing_counters$;

-- TG_ARGV: [0] prefix, [1] number column, [2] date column
CREATE OR REPLACE FUNCTION rawasi_private.assign_document_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_prefix text := TG_ARGV[0];
  v_col text := TG_ARGV[1];
  v_given text := NULLIF(trim(to_jsonb(NEW)->>TG_ARGV[1]), '');
  v_date date := COALESCE(NULLIF(to_jsonb(NEW)->>TG_ARGV[2], '')::date, current_date);
  v_year integer := extract(year FROM v_date)::integer;
  v_seed integer;
  v_n integer;
  v_number text;
  v_taken boolean;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- the number stays as saved for signed-in users
    IF auth.uid() IS NOT NULL AND v_given IS DISTINCT FROM NULLIF(trim(to_jsonb(OLD)->>v_col), '') THEN
      NEW := jsonb_populate_record(NEW, jsonb_build_object(v_col, to_jsonb(OLD)->>v_col));
    END IF;
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL AND v_given IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'لا يمكن ترقيم مستند من غير شركة' USING ERRCODE = '23502';
  END IF;

  LOOP
    UPDATE rawasi_private.document_counters
    SET last_number = last_number + 1
    WHERE company_id = NEW.company_id
      AND doc_type = v_prefix
      AND year = v_year
    RETURNING last_number INTO v_n;

    IF NOT FOUND THEN
      EXECUTE format(
        $q$
        SELECT COALESCE(
          CASE
            WHEN bool_or(%1$I = $2 || '-9999')
              THEN max((substring(%1$I FROM '^' || $2 || '-([0-9]{4,9})$'))::integer)
            ELSE max((substring(%1$I FROM '^' || $2 || '-([0-9]{4})$'))::integer)
          END,
          0
        )
        FROM %2$I.%3$I
        WHERE company_id = $1
          AND %1$I LIKE $2 || '-%%'
        $q$,
        v_col, TG_TABLE_SCHEMA, TG_TABLE_NAME
      ) INTO v_seed USING NEW.company_id, v_prefix || '-' || v_year;

      INSERT INTO rawasi_private.document_counters (company_id, doc_type, year, last_number)
      VALUES (NEW.company_id, v_prefix, v_year, v_seed + 1)
      ON CONFLICT (company_id, doc_type, year)
        DO UPDATE SET last_number = GREATEST(rawasi_private.document_counters.last_number, v_seed) + 1
      RETURNING last_number INTO v_n;
    END IF;

    v_number := v_prefix || '-' || v_year || '-' || lpad(v_n::text, greatest(4, length(v_n::text)), '0');
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I.%I WHERE company_id = $1 AND %I = $2)', TG_TABLE_SCHEMA, TG_TABLE_NAME, v_col)
      INTO v_taken USING NEW.company_id, v_number;
    EXIT WHEN NOT v_taken;
  END LOOP;

  NEW := jsonb_populate_record(NEW, jsonb_build_object(v_col, v_number));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION rawasi_private.assign_document_number() FROM PUBLIC, anon, authenticated;

COMMIT;



-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- FILE: 20261105170006_ar_aging_reports.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- Migration: 20261105170006_ar_aging_reports.sql
-- Description: Phase 2 aging reports for customers, subcontractors, and suppliers with point-in-time cutoffs and GL reconciliation.

BEGIN;

CREATE FUNCTION rawasi_private.require_aging_report_access(p_party_type text)
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
    v_company uuid := rawasi_private.current_company_id();
BEGIN
    IF auth.uid() IS NULL OR v_company IS NULL THEN
        RAISE EXCEPTION 'يتطلب الوصول تحديد الشركة والمستخدم المسجل' USING ERRCODE = '42501';
    END IF;

    IF NOT (
        rawasi_private.can_access('reports', 'view')
        OR rawasi_private.can_access('partners', 'view')
        OR rawasi_private.can_access('invoices', 'view')
        OR rawasi_private.can_access('subclaims', 'view')
        OR rawasi_private.can_access('materials', 'view')
        OR rawasi_private.can_access('journal', 'view')
    ) THEN
        RAISE EXCEPTION 'لا تملك صلاحية عرض تقارير أعمار الذمم' USING ERRCODE = '42501';
    END IF;

    IF p_party_type = 'customers' AND NOT (
        rawasi_private.can_access('invoices', 'view')
        OR rawasi_private.can_access('reports', 'view')
        OR rawasi_private.can_access('partners', 'view')
    ) THEN
        RAISE EXCEPTION 'لا تملك صلاحية عرض أعمار ذمم العملاء' USING ERRCODE = '42501';
    END IF;

    IF p_party_type = 'subcontractors' AND NOT (
        rawasi_private.can_access('subclaims', 'view')
        OR rawasi_private.can_access('reports', 'view')
        OR rawasi_private.can_access('partners', 'view')
    ) THEN
        RAISE EXCEPTION 'لا تملك صلاحية عرض أعمار ذمم مقاولي الباطن' USING ERRCODE = '42501';
    END IF;

    IF p_party_type = 'suppliers' AND NOT (
        rawasi_private.can_access('materials', 'view')
        OR rawasi_private.can_access('expenses', 'view')
        OR rawasi_private.can_access('reports', 'view')
        OR rawasi_private.can_access('partners', 'view')
    ) THEN
        RAISE EXCEPTION 'لا تملك صلاحية عرض أعمار ذمم الموردين' USING ERRCODE = '42501';
    END IF;

    RETURN v_company;
END;
$$;

REVOKE ALL ON FUNCTION rawasi_private.require_aging_report_access(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION rawasi_private.require_aging_report_access(text) TO authenticated;

-- Main comprehensive aging report function
CREATE FUNCTION public.get_aging_report(
    p_party_type text DEFAULT 'customers',
    p_as_of_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
    v_company uuid;
    v_as_of date := coalesce(p_as_of_date, CURRENT_DATE);
    v_gl_account_code text;
    v_gl_account_id uuid;
    v_gl_balance numeric := 0;
    v_gl_account_name text;
    v_company_name text;
    v_party_type text := lower(btrim(coalesce(p_party_type, 'customers')));
BEGIN
    IF v_party_type NOT IN ('customers', 'subcontractors', 'suppliers') THEN
        RAISE EXCEPTION 'نوع التقرير غير مدعوم: % (الأنواع المدعومة: customers, subcontractors, suppliers)', p_party_type USING ERRCODE = '22023';
    END IF;

    IF NOT isfinite(v_as_of) THEN
        RAISE EXCEPTION 'تاريخ التقرير غير صالح' USING ERRCODE = '22023';
    END IF;

    v_company := rawasi_private.require_aging_report_access(v_party_type);

    SELECT name INTO v_company_name FROM public.companies WHERE id = v_company;

    -- Pick the expected controlling GL account:
    -- Customers -> 123
    -- Subcontractors -> 212
    -- Suppliers -> 211
    IF v_party_type = 'customers' THEN
        v_gl_account_code := '123';
    ELSIF v_party_type = 'subcontractors' THEN
        v_gl_account_code := '212';
    ELSE
        v_gl_account_code := '211';
    END IF;

    SELECT id, name INTO v_gl_account_id, v_gl_account_name
    FROM public.accounts
    WHERE company_id = v_company AND code = v_gl_account_code
    LIMIT 1;

    -- Compute cumulative posted GL balance up to v_as_of
    IF v_gl_account_id IS NOT NULL THEN
        SELECT coalesce(
            CASE 
                -- 123 is Asset (normal debit balance): balance = debit - credit
                WHEN v_gl_account_code = '123' THEN sum(jl.debit - jl.credit)
                -- 211, 212 are Liabilities (normal credit balance): balance = credit - debit
                ELSE sum(jl.credit - jl.debit)
            END,
            0
        ) INTO v_gl_balance
        FROM public.journal_lines jl
        JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = jl.company_id
        WHERE jl.company_id = v_company
          AND jl.account_id = v_gl_account_id
          AND jh.status IN ('posted', 'مرحل', 'معتمد')
          AND jh.entry_date <= v_as_of;
    END IF;

    -- =========================================================================
    -- BRANCH 1: CUSTOMERS (العملاء - حساب 123)
    -- =========================================================================
    IF v_party_type = 'customers' THEN
        RETURN (
            WITH inv_receipts AS (
                SELECT r.invoice_id, sum(r.amount) AS paid_amount
                FROM public.receipt_vouchers r
                WHERE r.company_id = v_company
                  AND r.invoice_id IS NOT NULL
                  AND r.status IN ('posted', 'مرحل', 'معتمد')
                  AND r.date <= v_as_of
                  AND EXISTS (
                      SELECT 1 FROM public.journal_headers jh
                      WHERE jh.company_id = r.company_id AND jh.reference_id = r.id
                        AND jh.v_type IN ('receipt_vouchers', 'سند قبض')
                        AND jh.status IN ('posted', 'مرحل', 'معتمد')
                        AND jh.entry_date <= v_as_of
                  )
                GROUP BY r.invoice_id
            ),
            inv_adjustments AS (
                SELECT n.invoice_id,
                       sum(CASE n.note_type WHEN 'debit' THEN n.receivable_amount ELSE -n.receivable_amount END) AS net_adj
                FROM public.invoice_adjustment_notes n
                WHERE n.company_id = v_company
                  AND n.note_date <= v_as_of
                GROUP BY n.invoice_id
            ),
            inv_docs AS (
                SELECT 
                    i.id AS doc_id,
                    i.invoice_number AS doc_number,
                    'فاتورة مبيعات' AS doc_type,
                    i.date AS doc_date,
                    i.due_date AS due_date,
                    i.partner_id,
                    p.code AS partner_code,
                    coalesce(p.name, i.client_name, 'عميل غير محدد') AS partner_name,
                    p.phone AS partner_phone,
                    -- Primary project
                    CASE 
                        WHEN coalesce(cardinality(i.project_ids), 0) = 1 THEN i.project_ids[1]
                        ELSE NULL::uuid
                    END AS project_id,
                    CASE 
                        WHEN coalesce(cardinality(i.project_ids), 0) = 1 THEN pr."Property"
                        WHEN coalesce(cardinality(i.project_ids), 0) > 1 THEN 'مشاريع متعددة'
                        ELSE 'غير محدد'
                    END AS project_name,
                    i.total_amount AS original_amount,
                    coalesce(adj.net_adj, 0) AS adjustment_amount,
                    (coalesce(i.total_amount, 0) + coalesce(adj.net_adj, 0)) AS adjusted_total,
                    coalesce(rec.paid_amount, 0) AS paid_amount,
                    round(coalesce(i.total_amount, 0) + coalesce(adj.net_adj, 0) - coalesce(rec.paid_amount, 0), 2) AS remaining_balance
                FROM public.invoices i
                LEFT JOIN public.partners p ON p.id = i.partner_id AND p.company_id = i.company_id
                LEFT JOIN inv_receipts rec ON rec.invoice_id = i.id
                LEFT JOIN inv_adjustments adj ON adj.invoice_id = i.id
                LEFT JOIN public.projects pr ON pr.id = i.project_ids[1] AND pr.company_id = i.company_id
                WHERE i.company_id = v_company
                  AND i.status IN ('posted', 'مرحل', 'معتمد')
                  AND i.date <= v_as_of
                  AND EXISTS (
                      SELECT 1 FROM public.journal_headers jh
                      WHERE jh.company_id = i.company_id AND jh.reference_id = i.id
                        AND jh.v_type IN ('invoices', 'فاتورة مبيعات')
                        AND jh.status IN ('posted', 'مرحل', 'معتمد')
                        AND jh.entry_date <= v_as_of
                  )
            ),
            aged_docs AS (
                SELECT 
                    d.*,
                    CASE 
                        WHEN d.due_date IS NULL THEN NULL::integer
                        ELSE (v_as_of - d.due_date)
                    END AS overdue_days,
                    CASE 
                        WHEN d.due_date IS NULL THEN 'unspecified'
                        WHEN (v_as_of - d.due_date) <= 0 THEN 'current'
                        WHEN (v_as_of - d.due_date) <= 30 THEN 'days_1_30'
                        WHEN (v_as_of - d.due_date) <= 60 THEN 'days_31_60'
                        WHEN (v_as_of - d.due_date) <= 90 THEN 'days_61_90'
                        ELSE 'over_90'
                    END AS bucket
                FROM inv_docs d
                WHERE d.remaining_balance <> 0
            ),
            partner_agg AS (
                SELECT 
                    a.partner_id,
                    a.partner_code,
                    a.partner_name,
                    a.partner_phone,
                    count(*) AS open_docs_count,
                    round(sum(a.remaining_balance), 2) AS total_due,
                    round(sum(CASE WHEN a.bucket = 'current' THEN a.remaining_balance ELSE 0 END), 2) AS current_balance,
                    round(sum(CASE WHEN a.bucket = 'days_1_30' THEN a.remaining_balance ELSE 0 END), 2) AS days_1_30,
                    round(sum(CASE WHEN a.bucket = 'days_31_60' THEN a.remaining_balance ELSE 0 END), 2) AS days_31_60,
                    round(sum(CASE WHEN a.bucket = 'days_61_90' THEN a.remaining_balance ELSE 0 END), 2) AS days_61_90,
                    round(sum(CASE WHEN a.bucket = 'over_90' THEN a.remaining_balance ELSE 0 END), 2) AS over_90,
                    round(sum(CASE WHEN a.bucket = 'unspecified' THEN a.remaining_balance ELSE 0 END), 2) AS unspecified,
                    round(sum(CASE WHEN a.bucket <> 'current' AND a.bucket <> 'unspecified' THEN a.remaining_balance ELSE 0 END), 2) AS overdue_balance,
                    jsonb_agg(
                        jsonb_build_object(
                            'doc_id', a.doc_id,
                            'doc_number', a.doc_number,
                            'doc_type', a.doc_type,
                            'doc_date', a.doc_date,
                            'due_date', a.due_date,
                            'project_id', a.project_id,
                            'project_name', a.project_name,
                            'original_amount', a.original_amount,
                            'adjustment_amount', a.adjustment_amount,
                            'adjusted_total', a.adjusted_total,
                            'paid_amount', a.paid_amount,
                            'remaining_balance', a.remaining_balance,
                            'overdue_days', a.overdue_days,
                            'bucket', a.bucket
                        ) ORDER BY a.due_date NULLS LAST, a.doc_date
                    ) AS documents
                FROM aged_docs a
                GROUP BY a.partner_id, a.partner_code, a.partner_name, a.partner_phone
            ),
            project_agg AS (
                SELECT 
                    coalesce(a.project_id::text, 'unspecified') AS project_id,
                    coalesce(a.project_name, 'غير محدد') AS project_name,
                    count(*) AS open_docs_count,
                    round(sum(a.remaining_balance), 2) AS total_due,
                    round(sum(CASE WHEN a.bucket = 'current' THEN a.remaining_balance ELSE 0 END), 2) AS current_balance,
                    round(sum(CASE WHEN a.bucket = 'days_1_30' THEN a.remaining_balance ELSE 0 END), 2) AS days_1_30,
                    round(sum(CASE WHEN a.bucket = 'days_31_60' THEN a.remaining_balance ELSE 0 END), 2) AS days_31_60,
                    round(sum(CASE WHEN a.bucket = 'days_61_90' THEN a.remaining_balance ELSE 0 END), 2) AS days_61_90,
                    round(sum(CASE WHEN a.bucket = 'over_90' THEN a.remaining_balance ELSE 0 END), 2) AS over_90,
                    round(sum(CASE WHEN a.bucket = 'unspecified' THEN a.remaining_balance ELSE 0 END), 2) AS unspecified,
                    round(sum(CASE WHEN a.bucket <> 'current' AND a.bucket <> 'unspecified' THEN a.remaining_balance ELSE 0 END), 2) AS overdue_balance
                FROM aged_docs a
                GROUP BY a.project_id, a.project_name
            ),
            totals_agg AS (
                SELECT 
                    round(coalesce(sum(d.original_amount), 0), 2) AS total_invoiced,
                    round(coalesce(sum(d.adjusted_total), 0), 2) AS total_effective_invoiced,
                    round(coalesce(sum(d.paid_amount), 0), 2) AS total_collected,
                    round(coalesce(sum(d.remaining_balance), 0), 2) AS total_due,
                    round(coalesce(sum(CASE WHEN d.bucket = 'current' THEN d.remaining_balance ELSE 0 END), 0), 2) AS current_balance,
                    round(coalesce(sum(CASE WHEN d.bucket = 'days_1_30' THEN d.remaining_balance ELSE 0 END), 0), 2) AS days_1_30,
                    round(coalesce(sum(CASE WHEN d.bucket = 'days_31_60' THEN d.remaining_balance ELSE 0 END), 0), 2) AS days_31_60,
                    round(coalesce(sum(CASE WHEN d.bucket = 'days_61_90' THEN d.remaining_balance ELSE 0 END), 0), 2) AS days_61_90,
                    round(coalesce(sum(CASE WHEN d.bucket = 'over_90' THEN d.remaining_balance ELSE 0 END), 0), 2) AS over_90,
                    round(coalesce(sum(CASE WHEN d.bucket = 'unspecified' THEN d.remaining_balance ELSE 0 END), 0), 2) AS unspecified,
                    round(coalesce(sum(CASE WHEN d.bucket <> 'current' AND d.bucket <> 'unspecified' THEN d.remaining_balance ELSE 0 END), 0), 2) AS overdue_balance,
                    CASE 
                        WHEN coalesce(sum(d.adjusted_total), 0) > 0 
                        THEN round((coalesce(sum(d.paid_amount), 0) / sum(d.adjusted_total)) * 100, 2)
                        ELSE 0
                    END AS collection_rate_percent
                FROM aged_docs d
                FULL JOIN inv_docs id_all ON true
            ),
            sales_totals AS (
                SELECT 
                    coalesce(sum(i.adjusted_total), 0) AS total_sales,
                    coalesce(sum(i.paid_amount), 0) AS total_paid
                FROM inv_docs i
            )
            SELECT jsonb_build_object(
                'party_type', v_party_type,
                'as_of_date', v_as_of,
                'company', jsonb_build_object('id', v_company, 'name', v_company_name),
                'gl_reconciliation', jsonb_build_object(
                    'account_code', v_gl_account_code,
                    'account_name', v_gl_account_name,
                    'gl_balance', v_gl_balance,
                    'subledger_balance', coalesce((SELECT sum(total_due) FROM partner_agg), 0),
                    'variance', round(v_gl_balance - coalesce((SELECT sum(total_due) FROM partner_agg), 0), 2),
                    'is_reconciled', (round(v_gl_balance - coalesce((SELECT sum(total_due) FROM partner_agg), 0), 2) = 0)
                ),
                'kpis', jsonb_build_object(
                    'total_due', coalesce((SELECT sum(total_due) FROM partner_agg), 0),
                    'overdue_balance', coalesce((SELECT sum(overdue_balance) FROM partner_agg), 0),
                    'current_balance', coalesce((SELECT sum(current_balance) FROM partner_agg), 0),
                    'days_1_30', coalesce((SELECT sum(days_1_30) FROM partner_agg), 0),
                    'days_31_60', coalesce((SELECT sum(days_31_60) FROM partner_agg), 0),
                    'days_61_90', coalesce((SELECT sum(days_61_90) FROM partner_agg), 0),
                    'over_90', coalesce((SELECT sum(over_90) FROM partner_agg), 0),
                    'unspecified', coalesce((SELECT sum(unspecified) FROM partner_agg), 0),
                    'collection_rate_percent', (
                        SELECT CASE WHEN total_sales > 0 THEN round((total_paid / total_sales) * 100, 2) ELSE 0 END
                        FROM sales_totals
                    ),
                    'total_sales', (SELECT total_sales FROM sales_totals),
                    'total_collected', (SELECT total_paid FROM sales_totals)
                ),
                'top_debtors', coalesce((
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'partner_id', p.partner_id,
                            'partner_code', p.partner_code,
                            'partner_name', p.partner_name,
                            'total_due', p.total_due,
                            'overdue_balance', p.overdue_balance
                        ) ORDER BY p.total_due DESC
                    )
                    FROM (SELECT * FROM partner_agg ORDER BY total_due DESC LIMIT 5) p
                ), '[]'::jsonb),
                'partners', coalesce((
                    SELECT jsonb_agg(to_jsonb(p) ORDER BY p.total_due DESC)
                    FROM partner_agg p
                ), '[]'::jsonb),
                'projects', coalesce((
                    SELECT jsonb_agg(to_jsonb(pr) ORDER BY pr.total_due DESC)
                    FROM project_agg pr
                ), '[]'::jsonb)
            )
        );
    END IF;

    -- =========================================================================
    -- BRANCH 2: SUBCONTRACTORS (مقاولو الباطن - حساب 212)
    -- =========================================================================
    IF v_party_type = 'subcontractors' THEN
        RETURN (
            WITH claim_payments AS (
                SELECT pv.sub_claim_id, sum(pv.amount) AS paid_amount
                FROM public.payment_vouchers pv
                WHERE pv.company_id = v_company
                  AND pv.sub_claim_id IS NOT NULL
                  AND pv.status IN ('posted', 'مرحل', 'معتمد')
                  AND pv.date <= v_as_of
                  AND EXISTS (
                      SELECT 1 FROM public.journal_headers jh
                      WHERE jh.company_id = pv.company_id AND jh.reference_id = pv.id
                        AND jh.v_type IN ('payment_vouchers', 'سند صرف')
                        AND jh.status IN ('posted', 'مرحل', 'معتمد')
                        AND jh.entry_date <= v_as_of
                  )
                GROUP BY pv.sub_claim_id
            ),
            claim_docs AS (
                SELECT 
                    sc.id AS doc_id,
                    sc.claim_number AS doc_number,
                    'مستخلص مقاول باطن' AS doc_type,
                    sc.date AS doc_date,
                    CASE 
                        WHEN sc.date IS NOT NULL AND coalesce(sc.payment_period_days, 14) >= 0 
                        THEN (sc.date + coalesce(sc.payment_period_days, 14))
                        ELSE NULL::date
                    END AS due_date,
                    sc.payment_period_days,
                    sc.contractor_id AS partner_id,
                    p.code AS partner_code,
                    coalesce(p.name, 'مقاول غير محدد') AS partner_name,
                    p.phone AS partner_phone,
                    -- Project identification
                    CASE 
                        WHEN sc.project_id IS NOT NULL THEN sc.project_id
                        WHEN coalesce(cardinality(sc.project_ids), 0) = 1 THEN sc.project_ids[1]
                        ELSE NULL::uuid
                    END AS project_id,
                    CASE 
                        WHEN pr."Property" IS NOT NULL THEN pr."Property"
                        WHEN sc.project_names_text IS NOT NULL THEN sc.project_names_text
                        ELSE 'غير محدد'
                    END AS project_name,
                    sc.net_amount AS original_amount,
                    0::numeric AS adjustment_amount,
                    sc.net_amount AS adjusted_total,
                    coalesce(cp.paid_amount, 0) AS paid_amount,
                    round(coalesce(sc.net_amount, 0) - coalesce(cp.paid_amount, 0), 2) AS remaining_balance
                FROM public.sub_claims sc
                LEFT JOIN public.partners p ON p.id = sc.contractor_id AND p.company_id = sc.company_id
                LEFT JOIN claim_payments cp ON cp.sub_claim_id = sc.id
                LEFT JOIN public.projects pr ON pr.id = coalesce(sc.project_id, sc.project_ids[1]) AND pr.company_id = sc.company_id
                WHERE sc.company_id = v_company
                  AND sc.is_posted IS TRUE
                  AND sc.date <= v_as_of
                  AND EXISTS (
                      SELECT 1 FROM public.journal_headers jh
                      WHERE jh.company_id = sc.company_id AND jh.reference_id = sc.id
                        AND jh.v_type IN ('sub_claims', 'مستخلص مقاول باطن', 'مستخلص', 'invoices')
                        AND jh.status IN ('posted', 'مرحل', 'معتمد')
                        AND jh.entry_date <= v_as_of
                  )
            ),
            aged_docs AS (
                SELECT 
                    d.*,
                    CASE 
                        WHEN d.due_date IS NULL THEN NULL::integer
                        ELSE (v_as_of - d.due_date)
                    END AS overdue_days,
                    CASE 
                        WHEN d.due_date IS NULL THEN 'unspecified'
                        WHEN (v_as_of - d.due_date) <= 0 THEN 'current'
                        WHEN (v_as_of - d.due_date) <= 30 THEN 'days_1_30'
                        WHEN (v_as_of - d.due_date) <= 60 THEN 'days_31_60'
                        WHEN (v_as_of - d.due_date) <= 90 THEN 'days_61_90'
                        ELSE 'over_90'
                    END AS bucket
                FROM claim_docs d
                WHERE d.remaining_balance <> 0
            ),
            partner_agg AS (
                SELECT 
                    a.partner_id,
                    a.partner_code,
                    a.partner_name,
                    a.partner_phone,
                    count(*) AS open_docs_count,
                    round(sum(a.remaining_balance), 2) AS total_due,
                    round(sum(CASE WHEN a.bucket = 'current' THEN a.remaining_balance ELSE 0 END), 2) AS current_balance,
                    round(sum(CASE WHEN a.bucket = 'days_1_30' THEN a.remaining_balance ELSE 0 END), 2) AS days_1_30,
                    round(sum(CASE WHEN a.bucket = 'days_31_60' THEN a.remaining_balance ELSE 0 END), 2) AS days_31_60,
                    round(sum(CASE WHEN a.bucket = 'days_61_90' THEN a.remaining_balance ELSE 0 END), 2) AS days_61_90,
                    round(sum(CASE WHEN a.bucket = 'over_90' THEN a.remaining_balance ELSE 0 END), 2) AS over_90,
                    round(sum(CASE WHEN a.bucket = 'unspecified' THEN a.remaining_balance ELSE 0 END), 2) AS unspecified,
                    round(sum(CASE WHEN a.bucket <> 'current' AND a.bucket <> 'unspecified' THEN a.remaining_balance ELSE 0 END), 2) AS overdue_balance,
                    jsonb_agg(
                        jsonb_build_object(
                            'doc_id', a.doc_id,
                            'doc_number', a.doc_number,
                            'doc_type', a.doc_type,
                            'doc_date', a.doc_date,
                            'due_date', a.due_date,
                            'payment_period_days', a.payment_period_days,
                            'project_id', a.project_id,
                            'project_name', a.project_name,
                            'original_amount', a.original_amount,
                            'adjusted_total', a.adjusted_total,
                            'paid_amount', a.paid_amount,
                            'remaining_balance', a.remaining_balance,
                            'overdue_days', a.overdue_days,
                            'bucket', a.bucket
                        ) ORDER BY a.due_date NULLS LAST, a.doc_date
                    ) AS documents
                FROM aged_docs a
                GROUP BY a.partner_id, a.partner_code, a.partner_name, a.partner_phone
            ),
            project_agg AS (
                SELECT 
                    coalesce(a.project_id::text, 'unspecified') AS project_id,
                    coalesce(a.project_name, 'غير محدد') AS project_name,
                    count(*) AS open_docs_count,
                    round(sum(a.remaining_balance), 2) AS total_due,
                    round(sum(CASE WHEN a.bucket = 'current' THEN a.remaining_balance ELSE 0 END), 2) AS current_balance,
                    round(sum(CASE WHEN a.bucket = 'days_1_30' THEN a.remaining_balance ELSE 0 END), 2) AS days_1_30,
                    round(sum(CASE WHEN a.bucket = 'days_31_60' THEN a.remaining_balance ELSE 0 END), 2) AS days_31_60,
                    round(sum(CASE WHEN a.bucket = 'days_61_90' THEN a.remaining_balance ELSE 0 END), 2) AS days_61_90,
                    round(sum(CASE WHEN a.bucket = 'over_90' THEN a.remaining_balance ELSE 0 END), 2) AS over_90,
                    round(sum(CASE WHEN a.bucket = 'unspecified' THEN a.remaining_balance ELSE 0 END), 2) AS unspecified,
                    round(sum(CASE WHEN a.bucket <> 'current' AND a.bucket <> 'unspecified' THEN a.remaining_balance ELSE 0 END), 2) AS overdue_balance
                FROM aged_docs a
                GROUP BY a.project_id, a.project_name
            ),
            claim_totals AS (
                SELECT 
                    coalesce(sum(c.adjusted_total), 0) AS total_claims,
                    coalesce(sum(c.paid_amount), 0) AS total_paid
                FROM claim_docs c
            )
            SELECT jsonb_build_object(
                'party_type', v_party_type,
                'as_of_date', v_as_of,
                'company', jsonb_build_object('id', v_company, 'name', v_company_name),
                'gl_reconciliation', jsonb_build_object(
                    'account_code', v_gl_account_code,
                    'account_name', v_gl_account_name,
                    'gl_balance', v_gl_balance,
                    'subledger_balance', coalesce((SELECT sum(total_due) FROM partner_agg), 0),
                    'variance', round(v_gl_balance - coalesce((SELECT sum(total_due) FROM partner_agg), 0), 2),
                    'is_reconciled', (round(v_gl_balance - coalesce((SELECT sum(total_due) FROM partner_agg), 0), 2) = 0)
                ),
                'kpis', jsonb_build_object(
                    'total_due', coalesce((SELECT sum(total_due) FROM partner_agg), 0),
                    'overdue_balance', coalesce((SELECT sum(overdue_balance) FROM partner_agg), 0),
                    'current_balance', coalesce((SELECT sum(current_balance) FROM partner_agg), 0),
                    'days_1_30', coalesce((SELECT sum(days_1_30) FROM partner_agg), 0),
                    'days_31_60', coalesce((SELECT sum(days_31_60) FROM partner_agg), 0),
                    'days_61_90', coalesce((SELECT sum(days_61_90) FROM partner_agg), 0),
                    'over_90', coalesce((SELECT sum(over_90) FROM partner_agg), 0),
                    'unspecified', coalesce((SELECT sum(unspecified) FROM partner_agg), 0),
                    'payment_rate_percent', (
                        SELECT CASE WHEN total_claims > 0 THEN round((total_paid / total_claims) * 100, 2) ELSE 0 END
                        FROM claim_totals
                    ),
                    'total_claims', (SELECT total_claims FROM claim_totals),
                    'total_paid', (SELECT total_paid FROM claim_totals)
                ),
                'top_debtors', coalesce((
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'partner_id', p.partner_id,
                            'partner_code', p.partner_code,
                            'partner_name', p.partner_name,
                            'total_due', p.total_due,
                            'overdue_balance', p.overdue_balance
                        ) ORDER BY p.total_due DESC
                    )
                    FROM (SELECT * FROM partner_agg ORDER BY total_due DESC LIMIT 5) p
                ), '[]'::jsonb),
                'partners', coalesce((
                    SELECT jsonb_agg(to_jsonb(p) ORDER BY p.total_due DESC)
                    FROM partner_agg p
                ), '[]'::jsonb),
                'projects', coalesce((
                    SELECT jsonb_agg(to_jsonb(pr) ORDER BY pr.total_due DESC)
                    FROM project_agg pr
                ), '[]'::jsonb)
            )
        );
    END IF;

    -- =========================================================================
    -- BRANCH 3: SUPPLIERS (الموردون - حساب 211)
    -- =========================================================================
    -- Supplier dues come from posted material receipts to 211 (rpc_post_material_receipt),
    -- on-credit expenses where creditor_account is 211, and posted payment_vouchers to partner_id on 211.
    RETURN (
        WITH supplier_payments AS (
            -- All payments debited to 211 (or linked to partner_id) up to as_of
            SELECT jl.partner_id, sum(jl.debit) AS total_paid
            FROM public.journal_lines jl
            JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = jl.company_id
            WHERE jl.company_id = v_company
              AND jl.account_id = v_gl_account_id
              AND jl.partner_id IS NOT NULL
              AND jh.status IN ('posted', 'مرحل', 'معتمد')
              AND jh.entry_date <= v_as_of
            GROUP BY jl.partner_id
        ),
        receipt_supp_docs AS (
            SELECT 
                mr.id AS doc_id,
                mr.receipt_number AS doc_number,
                'سند استلام مواد' AS doc_type,
                mr.receipt_date AS doc_date,
                mr.receipt_date + 30 AS due_date, -- default 30-day term for supplier material receipts
                mr.supplier_id AS partner_id,
                p.code AS partner_code,
                coalesce(p.name, 'مورد غير محدد') AS partner_name,
                p.phone AS partner_phone,
                mr.project_id,
                coalesce(pr."Property", 'غير محدد') AS project_name,
                mr.total_amount AS original_amount,
                0::numeric AS adjustment_amount,
                mr.total_amount AS adjusted_total
            FROM public.material_receipts mr
            LEFT JOIN public.partners p ON p.id = mr.supplier_id AND p.company_id = mr.company_id
            LEFT JOIN public.projects pr ON pr.id = mr.project_id AND pr.company_id = mr.company_id
            WHERE mr.company_id = v_company
              AND mr.is_posted IS TRUE
              AND mr.receipt_type <> 'توريد عميل' -- client materials belong to 217, not 211!
              AND mr.receipt_date <= v_as_of
              AND EXISTS (
                  SELECT 1 FROM public.journal_headers jh
                  JOIN public.journal_lines jl ON jl.header_id = jh.id AND jl.company_id = jh.company_id
                  WHERE jh.company_id = mr.company_id AND jh.reference_id = mr.id
                    AND jh.v_type = 'inventory'
                    AND jl.account_id = v_gl_account_id
                    AND jh.status IN ('posted', 'مرحل', 'معتمد')
                    AND jh.entry_date <= v_as_of
              )
        ),
        expense_supp_docs AS (
            SELECT 
                e.id AS doc_id,
                coalesce(e.site_ref, 'EXP-' || substring(e.id::text, 1, 8)) AS doc_number,
                'فاتورة مشتريات/مصروف آجل' AS doc_type,
                e.exp_date AS doc_date,
                e.exp_date + 30 AS due_date,
                e.payee_id AS partner_id,
                p.code AS partner_code,
                coalesce(p.name, e.payee_name, 'مورد غير محدد') AS partner_name,
                p.phone AS partner_phone,
                e.project_id,
                coalesce(pr."Property", 'غير محدد') AS project_name,
                (e.total_price + coalesce(e.vat_amount, 0) - coalesce(e.discount_amount, 0)) AS original_amount,
                0::numeric AS adjustment_amount,
                (e.total_price + coalesce(e.vat_amount, 0) - coalesce(e.discount_amount, 0)) AS adjusted_total
            FROM public.expenses e
            LEFT JOIN public.partners p ON p.id = e.payee_id AND p.company_id = e.company_id
            LEFT JOIN public.projects pr ON pr.id = e.project_id AND pr.company_id = e.company_id
            WHERE e.company_id = v_company
              AND e.is_posted IS TRUE
              AND e.exp_date <= v_as_of
              AND EXISTS (
                  SELECT 1 FROM public.journal_headers jh
                  JOIN public.journal_lines jl ON jl.header_id = jh.id AND jl.company_id = jh.company_id
                  WHERE jh.company_id = e.company_id AND jh.reference_id = e.id
                    AND jl.account_id = v_gl_account_id AND jl.credit > 0
                    AND jh.status IN ('posted', 'مرحل', 'معتمد')
                    AND jh.entry_date <= v_as_of
              )
        ),
        all_supp_docs AS (
            SELECT * FROM receipt_supp_docs
            UNION ALL
            SELECT * FROM expense_supp_docs
        ),
        -- FIFO settlement of supplier payments against supplier documents (oldest first)
        supp_cumulative AS (
            SELECT 
                d.*,
                coalesce(sp.total_paid, 0) AS partner_total_paid,
                coalesce(sum(d.adjusted_total) OVER (
                    PARTITION BY d.partner_id 
                    ORDER BY d.doc_date, d.doc_id 
                    ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
                ), 0) AS prior_docs_total,
                sum(d.adjusted_total) OVER (
                    PARTITION BY d.partner_id 
                    ORDER BY d.doc_date, d.doc_id 
                    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                ) AS cumulative_docs_total
            FROM all_supp_docs d
            LEFT JOIN supplier_payments sp ON sp.partner_id = d.partner_id
        ),
        supp_allocated AS (
            SELECT 
                c.doc_id,
                c.doc_number,
                c.doc_type,
                c.doc_date,
                c.due_date,
                c.partner_id,
                c.partner_code,
                c.partner_name,
                c.partner_phone,
                c.project_id,
                c.project_name,
                c.original_amount,
                c.adjustment_amount,
                c.adjusted_total,
                round(
                    CASE 
                        -- Fully paid
                        WHEN c.partner_total_paid >= c.cumulative_docs_total THEN c.adjusted_total
                        -- Partially paid
                        WHEN c.partner_total_paid > c.prior_docs_total THEN (c.partner_total_paid - c.prior_docs_total)
                        -- Unpaid
                        ELSE 0
                    END,
                    2
                ) AS paid_amount,
                round(
                    CASE 
                        -- Fully paid
                        WHEN c.partner_total_paid >= c.cumulative_docs_total THEN 0
                        -- Partially paid
                        WHEN c.partner_total_paid > c.prior_docs_total THEN (c.cumulative_docs_total - c.partner_total_paid)
                        -- Unpaid
                        ELSE c.adjusted_total
                    END,
                    2
                ) AS remaining_balance
            FROM supp_cumulative c
        ),
        aged_docs AS (
            SELECT 
                a.*,
                CASE 
                    WHEN a.due_date IS NULL THEN NULL::integer
                    ELSE (v_as_of - a.due_date)
                END AS overdue_days,
                CASE 
                    WHEN a.due_date IS NULL THEN 'unspecified'
                    WHEN (v_as_of - a.due_date) <= 0 THEN 'current'
                    WHEN (v_as_of - a.due_date) <= 30 THEN 'days_1_30'
                    WHEN (v_as_of - a.due_date) <= 60 THEN 'days_31_60'
                    WHEN (v_as_of - a.due_date) <= 90 THEN 'days_61_90'
                    ELSE 'over_90'
                END AS bucket
            FROM supp_allocated a
            WHERE a.remaining_balance <> 0
        ),
        partner_agg AS (
            SELECT 
                a.partner_id,
                a.partner_code,
                a.partner_name,
                a.partner_phone,
                count(*) AS open_docs_count,
                round(sum(a.remaining_balance), 2) AS total_due,
                round(sum(CASE WHEN a.bucket = 'current' THEN a.remaining_balance ELSE 0 END), 2) AS current_balance,
                round(sum(CASE WHEN a.bucket = 'days_1_30' THEN a.remaining_balance ELSE 0 END), 2) AS days_1_30,
                round(sum(CASE WHEN a.bucket = 'days_31_60' THEN a.remaining_balance ELSE 0 END), 2) AS days_31_60,
                round(sum(CASE WHEN a.bucket = 'days_61_90' THEN a.remaining_balance ELSE 0 END), 2) AS days_61_90,
                round(sum(CASE WHEN a.bucket = 'over_90' THEN a.remaining_balance ELSE 0 END), 2) AS over_90,
                round(sum(CASE WHEN a.bucket = 'unspecified' THEN a.remaining_balance ELSE 0 END), 2) AS unspecified,
                round(sum(CASE WHEN a.bucket <> 'current' AND a.bucket <> 'unspecified' THEN a.remaining_balance ELSE 0 END), 2) AS overdue_balance,
                jsonb_agg(
                    jsonb_build_object(
                        'doc_id', a.doc_id,
                        'doc_number', a.doc_number,
                        'doc_type', a.doc_type,
                        'doc_date', a.doc_date,
                        'due_date', a.due_date,
                        'project_id', a.project_id,
                        'project_name', a.project_name,
                        'original_amount', a.original_amount,
                        'adjusted_total', a.adjusted_total,
                        'paid_amount', a.paid_amount,
                        'remaining_balance', a.remaining_balance,
                        'overdue_days', a.overdue_days,
                        'bucket', a.bucket
                    ) ORDER BY a.due_date NULLS LAST, a.doc_date
                ) AS documents
            FROM aged_docs a
            GROUP BY a.partner_id, a.partner_code, a.partner_name, a.partner_phone
        ),
        project_agg AS (
            SELECT 
                coalesce(a.project_id::text, 'unspecified') AS project_id,
                coalesce(a.project_name, 'غير محدد') AS project_name,
                count(*) AS open_docs_count,
                round(sum(a.remaining_balance), 2) AS total_due,
                round(sum(CASE WHEN a.bucket = 'current' THEN a.remaining_balance ELSE 0 END), 2) AS current_balance,
                round(sum(CASE WHEN a.bucket = 'days_1_30' THEN a.remaining_balance ELSE 0 END), 2) AS days_1_30,
                round(sum(CASE WHEN a.bucket = 'days_31_60' THEN a.remaining_balance ELSE 0 END), 2) AS days_31_60,
                round(sum(CASE WHEN a.bucket = 'days_61_90' THEN a.remaining_balance ELSE 0 END), 2) AS days_61_90,
                round(sum(CASE WHEN a.bucket = 'over_90' THEN a.remaining_balance ELSE 0 END), 2) AS over_90,
                round(sum(CASE WHEN a.bucket = 'unspecified' THEN a.remaining_balance ELSE 0 END), 2) AS unspecified,
                round(sum(CASE WHEN a.bucket <> 'current' AND a.bucket <> 'unspecified' THEN a.remaining_balance ELSE 0 END), 2) AS overdue_balance
            FROM aged_docs a
            GROUP BY a.project_id, a.project_name
        ),
        supp_totals AS (
            SELECT 
                coalesce(sum(s.adjusted_total), 0) AS total_invoiced,
                coalesce(sum(s.paid_amount), 0) AS total_paid
            FROM supp_allocated s
        )
        SELECT jsonb_build_object(
            'party_type', v_party_type,
            'as_of_date', v_as_of,
            'company', jsonb_build_object('id', v_company, 'name', v_company_name),
            'gl_reconciliation', jsonb_build_object(
                'account_code', v_gl_account_code,
                'account_name', v_gl_account_name,
                'gl_balance', v_gl_balance,
                'subledger_balance', coalesce((SELECT sum(total_due) FROM partner_agg), 0),
                'variance', round(v_gl_balance - coalesce((SELECT sum(total_due) FROM partner_agg), 0), 2),
                'is_reconciled', (round(v_gl_balance - coalesce((SELECT sum(total_due) FROM partner_agg), 0), 2) = 0)
            ),
            'kpis', jsonb_build_object(
                'total_due', coalesce((SELECT sum(total_due) FROM partner_agg), 0),
                'overdue_balance', coalesce((SELECT sum(overdue_balance) FROM partner_agg), 0),
                'current_balance', coalesce((SELECT sum(current_balance) FROM partner_agg), 0),
                'days_1_30', coalesce((SELECT sum(days_1_30) FROM partner_agg), 0),
                'days_31_60', coalesce((SELECT sum(days_31_60) FROM partner_agg), 0),
                'days_61_90', coalesce((SELECT sum(days_61_90) FROM partner_agg), 0),
                'over_90', coalesce((SELECT sum(over_90) FROM partner_agg), 0),
                'unspecified', coalesce((SELECT sum(unspecified) FROM partner_agg), 0),
                'payment_rate_percent', (
                    SELECT CASE WHEN total_invoiced > 0 THEN round((total_paid / total_invoiced) * 100, 2) ELSE 0 END
                    FROM supp_totals
                ),
                'total_invoiced', (SELECT total_invoiced FROM supp_totals),
                'total_paid', (SELECT total_paid FROM supp_totals)
            ),
            'top_debtors', coalesce((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'partner_id', p.partner_id,
                        'partner_code', p.partner_code,
                        'partner_name', p.partner_name,
                        'total_due', p.total_due,
                        'overdue_balance', p.overdue_balance
                    ) ORDER BY p.total_due DESC
                )
                FROM (SELECT * FROM partner_agg ORDER BY total_due DESC LIMIT 5) p
            ), '[]'::jsonb),
            'partners', coalesce((
                SELECT jsonb_agg(to_jsonb(p) ORDER BY p.total_due DESC)
                FROM partner_agg p
            ), '[]'::jsonb),
            'projects', coalesce((
                SELECT jsonb_agg(to_jsonb(pr) ORDER BY pr.total_due DESC)
                FROM project_agg pr
            ), '[]'::jsonb)
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_aging_report(text, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_aging_report(text, date) TO authenticated;

COMMIT;



-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- FILE: 20261105170007_custodies_and_cash_closings.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- Migration: 20261105170007_custodies_and_cash_closings.sql
-- Description: Phase 3 - Site Custodies (حساب 125), Custody Settlements, and Daily Cash Closings with GL 527 reconciliations

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $preflight$
BEGIN
  IF to_regclass('public.companies') IS NULL THEN
    RAISE EXCEPTION 'Multi-company system is required before Phase 3';
  END IF;
END;
$preflight$;

-- =============================================================================
-- 1. SITE CUSTODIES TABLE (عُهد المواقع والموظفين - حساب 125)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.site_custodies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT rawasi_private.current_company_id() REFERENCES public.companies(id) ON DELETE RESTRICT,
  custody_number text NOT NULL DEFAULT '',
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE RESTRICT,
  project_id uuid REFERENCES public.projects(id) ON DELETE RESTRICT,
  title text NOT NULL,
  opened_date date NOT NULL DEFAULT CURRENT_DATE,
  disbursed_amount numeric(15,2) NOT NULL DEFAULT 0 CHECK (disbursed_amount >= 0),
  spent_amount numeric(15,2) NOT NULL DEFAULT 0 CHECK (spent_amount >= 0),
  remaining_amount numeric(15,2) NOT NULL DEFAULT 0,
  max_days integer NOT NULL DEFAULT 30 CHECK (max_days > 0),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'settled', 'cancelled')),
  notes text,
  settlement_date date,
  settlement_type text CHECK (settlement_type IN ('cash_return', 'salary_deduction', 'carry_forward', 'cleared', NULL)),
  settlement_reference_id uuid,
  settlement_notes text,
  payment_voucher_id uuid REFERENCES public.payment_vouchers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  CONSTRAINT site_custodies_company_custody_no_uq UNIQUE (company_id, custody_number),
  CONSTRAINT site_custodies_company_id_uq UNIQUE (id, company_id)
);

COMMENT ON TABLE public.site_custodies IS 'سجل عُهد المواقع والمهندسين وتتبع مبالغها وتسوياتها (حساب 125)';

-- =============================================================================
-- 2. DAILY CASH CLOSINGS TABLE (إقفال الخزينة اليومي ومحاضر الجرد)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.daily_cash_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT rawasi_private.current_company_id() REFERENCES public.companies(id) ON DELETE RESTRICT,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  closing_date date NOT NULL DEFAULT CURRENT_DATE,
  closed_at timestamptz NOT NULL DEFAULT now(),
  system_balance numeric(15,2) NOT NULL DEFAULT 0,
  actual_cash numeric(15,2) NOT NULL DEFAULT 0,
  difference numeric(15,2) NOT NULL DEFAULT 0,
  difference_type text NOT NULL CHECK (difference_type IN ('exact', 'shortage', 'surplus')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  notes text,
  approved_by uuid,
  approved_at timestamptz,
  journal_header_id uuid REFERENCES public.journal_headers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  CONSTRAINT daily_cash_closings_safe_date_uq UNIQUE (company_id, account_id, closing_date),
  CONSTRAINT daily_cash_closings_company_id_uq UNIQUE (id, company_id)
);

COMMENT ON TABLE public.daily_cash_closings IS 'محاضر إقفال الخزينة اليومية ومقارنة الرصيد الدفتري بالفعلي ومعالجة الفروقات في 527';

-- =============================================================================
-- 3. LINK PAYMENT VOUCHERS & EXPENSES TO CUSTODIES
-- =============================================================================
ALTER TABLE public.payment_vouchers
  ADD COLUMN custody_id uuid;

ALTER TABLE public.payment_vouchers
  ADD CONSTRAINT payment_vouchers_custody_fkey
  FOREIGN KEY (custody_id, company_id) REFERENCES public.site_custodies(id, company_id) ON DELETE RESTRICT;

ALTER TABLE public.expenses
  ADD COLUMN custody_id uuid;

ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_custody_fkey
  FOREIGN KEY (custody_id, company_id) REFERENCES public.site_custodies(id, company_id) ON DELETE RESTRICT;

ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_payment_method_check;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_payment_method_check
  CHECK (payment_method IS NULL OR payment_method = ANY (ARRAY['كاش'::text, 'نقدي'::text, 'تحويل بنكي'::text, 'شيك'::text, 'عهدة'::text, 'عُهدة'::text, 'آجل'::text, 'تسوية داخلية'::text]));

ALTER TABLE public.receipt_vouchers DROP CONSTRAINT IF EXISTS receipt_vouchers_payment_method_check;
ALTER TABLE public.receipt_vouchers ADD CONSTRAINT receipt_vouchers_payment_method_check
  CHECK (payment_method IS NULL OR payment_method = ANY (ARRAY['نقدي (كاش)'::text, 'نقدي'::text, 'كاش'::text, 'تحويل بنكي'::text, 'شيك'::text]));

-- Register new tables in rawasi_private.company_scoped_tables
INSERT INTO rawasi_private.company_scoped_tables(table_name)
VALUES ('site_custodies'), ('daily_cash_closings');

-- Indexes
CREATE INDEX site_custodies_company_partner_idx ON public.site_custodies(company_id, partner_id);
CREATE INDEX site_custodies_company_project_idx ON public.site_custodies(company_id, project_id);
CREATE INDEX site_custodies_company_status_idx ON public.site_custodies(company_id, status);
CREATE INDEX daily_cash_closings_acc_date_idx ON public.daily_cash_closings(company_id, account_id, closing_date);
CREATE INDEX payment_vouchers_custody_idx ON public.payment_vouchers(company_id, custody_id);
CREATE INDEX expenses_custody_idx ON public.expenses(company_id, custody_id);

-- Triggers for company stamping and document numbering
CREATE TRIGGER aa_stamp_company_id BEFORE INSERT OR UPDATE OF company_id ON public.site_custodies
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id();

CREATE TRIGGER aa_stamp_company_id BEFORE INSERT OR UPDATE OF company_id ON public.daily_cash_closings
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id();

CREATE TRIGGER trg_custody_number BEFORE INSERT ON public.site_custodies
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.assign_document_number('CUST', 'custody_number', 'opened_date');

-- =============================================================================
-- 4. ROW LEVEL SECURITY POLICIES
-- =============================================================================
ALTER TABLE public.site_custodies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_cash_closings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.site_custodies, public.daily_cash_closings FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE ON public.site_custodies TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.daily_cash_closings TO authenticated;
GRANT ALL ON public.site_custodies, public.daily_cash_closings TO service_role;

CREATE POLICY site_custodies_read ON public.site_custodies FOR SELECT TO authenticated
  USING (
    (rawasi_private.can_access('expenses', 'view') OR rawasi_private.can_access('payments', 'view') OR rawasi_private.can_access('journal', 'view'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY site_custodies_insert ON public.site_custodies FOR INSERT TO authenticated
  WITH CHECK (
    (rawasi_private.can_access('expenses', 'create') OR rawasi_private.can_access('payments', 'create'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY site_custodies_update ON public.site_custodies FOR UPDATE TO authenticated
  USING (
    (rawasi_private.can_access('expenses', 'edit') OR rawasi_private.can_access('payments', 'edit'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY daily_cash_closings_read ON public.daily_cash_closings FOR SELECT TO authenticated
  USING (
    (rawasi_private.can_access('journal', 'view') OR rawasi_private.can_access('cashflows', 'view'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY daily_cash_closings_insert ON public.daily_cash_closings FOR INSERT TO authenticated
  WITH CHECK (
    (rawasi_private.can_access('journal', 'create') OR rawasi_private.can_access('cashflows', 'create'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

CREATE POLICY daily_cash_closings_update ON public.daily_cash_closings FOR UPDATE TO authenticated
  USING (
    (rawasi_private.can_access('journal', 'edit') OR rawasi_private.can_access('cashflows', 'edit'))
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

-- =============================================================================
-- 5. FUNCTION: SYNC CUSTODY EXPENSES ON EXPENSE POST/UNPOST
-- =============================================================================
CREATE OR REPLACE FUNCTION rawasi_private.sync_custody_spent()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_custody_id uuid;
  v_total_spent numeric(15,2);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_custody_id := OLD.custody_id;
  ELSE
    v_custody_id := NEW.custody_id;
  END IF;

  IF v_custody_id IS NOT NULL THEN
    SELECT coalesce(sum(coalesce(e.total_price, 0) + coalesce(e.vat_amount, 0) - coalesce(e.discount_amount, 0)), 0)
    INTO v_total_spent
    FROM public.expenses e
    WHERE e.custody_id = v_custody_id
      AND e.is_posted IS TRUE;

    UPDATE public.site_custodies
    SET spent_amount = v_total_spent,
        remaining_amount = round(disbursed_amount - v_total_spent, 2),
        updated_at = now()
    WHERE id = v_custody_id;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_sync_custody_spent
AFTER INSERT OR UPDATE OF custody_id, is_posted, total_price, vat_amount, discount_amount OR DELETE
ON public.expenses
FOR EACH ROW EXECUTE FUNCTION rawasi_private.sync_custody_spent();

-- =============================================================================
-- 6. RPC: CREATE SITE CUSTODY & DISBURSE CASH
-- =============================================================================
CREATE OR REPLACE FUNCTION public.create_site_custody(
  p_partner_id uuid,
  p_project_id uuid,
  p_title text,
  p_amount numeric,
  p_safe_acc_id uuid,
  p_payment_method text DEFAULT 'نقدي',
  p_notes text DEFAULT NULL,
  p_max_days integer DEFAULT 30
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_company uuid;
  v_custody_id uuid;
  v_acc_125 uuid;
  v_pv_id uuid;
  v_header_id uuid;
  v_partner_name text;
  v_voucher_number text;
BEGIN
  IF auth.uid() IS NULL AND current_setting('role', true) IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'يلزم تسجيل الدخول لإنشاء وصرف العهدة' USING ERRCODE = '42501';
  END IF;

  IF NOT (rawasi_private.can_access('payments', 'create') OR rawasi_private.can_access('expenses', 'create')) THEN
    RAISE EXCEPTION 'لا توجد صلاحية صرف عهدة جديدة' USING ERRCODE = '42501';
  END IF;

  IF p_partner_id IS NULL THEN
    RAISE EXCEPTION 'يلزم تحديد صاحب العهدة (المهندس أو المشرف)' USING ERRCODE = '23514';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'مبلغ العهدة يجب أن يكون أكبر من الصفر' USING ERRCODE = '23514';
  END IF;

  IF p_safe_acc_id IS NULL THEN
    RAISE EXCEPTION 'يلزم تحديد حساب الخزينة أو البنك المنصرف منه' USING ERRCODE = '23514';
  END IF;

  v_company := rawasi_private.current_company_id();
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'لم يتم تحديد الشركة الحالية' USING ERRCODE = '42501';
  END IF;

  -- Verify partner belongs to company
  SELECT name INTO v_partner_name FROM public.partners WHERE id = p_partner_id AND company_id = v_company;
  IF v_partner_name IS NULL THEN
    RAISE EXCEPTION 'الشريك المحدد غير موجود في الشركة' USING ERRCODE = '23503';
  END IF;

  -- Look up account 125
  v_acc_125 := rawasi_private.require_company_account('125');

  -- Verify safe account
  IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE id = p_safe_acc_id AND company_id = v_company) THEN
    RAISE EXCEPTION 'حساب الخزينة/البنك المحدد غير موجود في الشركة' USING ERRCODE = '23503';
  END IF;

  -- 1. Insert custody record
  INSERT INTO public.site_custodies (
    company_id, partner_id, project_id, title, opened_date,
    disbursed_amount, spent_amount, remaining_amount, max_days,
    status, notes
  ) VALUES (
    v_company, p_partner_id, p_project_id, btrim(p_title), CURRENT_DATE,
    round(p_amount, 2), 0, round(p_amount, 2), coalesce(p_max_days, 30),
    'open', p_notes
  ) RETURNING id INTO v_custody_id;

  -- 2. Insert payment voucher linked to custody
  INSERT INTO public.payment_vouchers (
    company_id, voucher_number, date, amount, partner_id,
    credit_account_id, debit_account_id, payment_method,
    description, notes, custody_id, project_ids, status
  ) VALUES (
    v_company, '', CURRENT_DATE, round(p_amount, 2), p_partner_id,
    p_safe_acc_id, v_acc_125, coalesce(p_payment_method, 'نقدي'),
    'صرف عهدة للمهندس: ' || v_partner_name || ' (' || btrim(p_title) || ')',
    p_notes, v_custody_id, CASE WHEN p_project_id IS NOT NULL THEN ARRAY[p_project_id] ELSE NULL END, 'مسودة'
  ) RETURNING id, voucher_number INTO v_pv_id, v_voucher_number;

  -- 3. Post payment voucher to journal (Debit 125 with partner_id, Credit safe/bank)
  INSERT INTO public.journal_headers (
    company_id, entry_date, description, reference_id, v_type, status
  ) VALUES (
    v_company, CURRENT_DATE, 'صرف عهدة رقم ' || v_voucher_number || ' - ' || v_partner_name,
    v_pv_id, 'payment_vouchers', 'posted'
  ) RETURNING id INTO v_header_id;

  -- Line 1: Debit 125 (عُهد الموظفين والمواقع) with partner_id
  INSERT INTO public.journal_lines (
    company_id, header_id, account_id, partner_id, project_id, debit, credit, notes
  ) VALUES (
    v_company, v_header_id, v_acc_125, p_partner_id, p_project_id, round(p_amount, 2), 0,
    'إثبات صرف عهدة: ' || btrim(p_title)
  );

  -- Line 2: Credit safe/bank (الخزينة/البنك)
  INSERT INTO public.journal_lines (
    company_id, header_id, account_id, partner_id, project_id, debit, credit, notes
  ) VALUES (
    v_company, v_header_id, p_safe_acc_id, NULL, p_project_id, 0, round(p_amount, 2),
    'صرف نقدية عهدة - سند صرف ' || v_voucher_number
  );

  -- Update payment voucher to posted
  UPDATE public.payment_vouchers
  SET is_posted = true, status = 'معتمد'
  WHERE id = v_pv_id;

  -- Update custody with payment voucher reference
  UPDATE public.site_custodies
  SET payment_voucher_id = v_pv_id
  WHERE id = v_custody_id;

  RETURN v_custody_id;
END;
$$;

-- =============================================================================
-- 7. RPC: SETTLE SITE CUSTODY (تسوية العهدة - رد نقدي / خصم راتب 216 / ترحيل)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.settle_site_custody(
  p_custody_id uuid,
  p_settlement_type text,
  p_destination_id uuid DEFAULT NULL,
  p_settlement_date date DEFAULT CURRENT_DATE,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_company uuid;
  v_custody public.site_custodies%ROWTYPE;
  v_acc_125 uuid;
  v_acc_216 uuid;
  v_spent numeric(15,2);
  v_remaining numeric(15,2);
  v_rv_id uuid;
  v_jh_id uuid;
  v_new_custody_id uuid;
  v_partner_name text;
  v_rv_number text;
BEGIN
  IF auth.uid() IS NULL AND current_setting('role', true) IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'يلزم تسجيل الدخول لتسوية العهدة' USING ERRCODE = '42501';
  END IF;

  IF NOT (rawasi_private.can_access('payments', 'edit') OR rawasi_private.can_access('expenses', 'edit') OR rawasi_private.can_access('journal', 'create')) THEN
    RAISE EXCEPTION 'لا توجد صلاحية تسوية العهد' USING ERRCODE = '42501';
  END IF;

  v_company := rawasi_private.current_company_id();

  SELECT * INTO v_custody
  FROM public.site_custodies
  WHERE id = p_custody_id AND company_id = v_company
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'العهدة غير موجودة أو غير تابعة للشركة الحالية' USING ERRCODE = '23503';
  END IF;

  IF v_custody.status <> 'open' THEN
    RAISE EXCEPTION 'العهدة مغلقة أو تمت تسويتها مسبقاً' USING ERRCODE = '23514';
  END IF;

  IF p_settlement_type NOT IN ('cash_return', 'salary_deduction', 'carry_forward', 'cleared') THEN
    RAISE EXCEPTION 'نوع التسوية غير صالح: %', p_settlement_type USING ERRCODE = '22023';
  END IF;

  SELECT name INTO v_partner_name FROM public.partners WHERE id = v_custody.partner_id AND company_id = v_company;
  v_acc_125 := rawasi_private.require_company_account('125');

  -- Recalculate exact posted expenses
  SELECT coalesce(sum(coalesce(total_price, 0) + coalesce(vat_amount, 0) - coalesce(discount_amount, 0)), 0)
  INTO v_spent
  FROM public.expenses
  WHERE custody_id = v_custody.id
    AND company_id = v_company
    AND is_posted IS TRUE;

  v_remaining := round(v_custody.disbursed_amount - v_spent, 2);

  IF v_remaining < 0 THEN
    RAISE EXCEPTION 'المصروفات المسجلة (%) تتجاوز إجمالي المبلغ المنصرف للعهدة (%)', v_spent, v_custody.disbursed_amount USING ERRCODE = '23514';
  END IF;

  -- If there is a remaining balance, execute chosen settlement action
  IF v_remaining > 0 THEN
    -- A) Cash Return (سند قبض - رد نقدي للخزينة/البنك)
    IF p_settlement_type = 'cash_return' THEN
      IF p_destination_id IS NULL THEN
        RAISE EXCEPTION 'يلزم تحديد حساب الخزينة أو البنك المردود إليه' USING ERRCODE = '23514';
      END IF;

      INSERT INTO public.receipt_vouchers (
        company_id, receipt_number, date, amount, partner_id,
        safe_bank_acc_id, partner_acc_id, payment_method, notes, status
      ) VALUES (
        v_company, '', coalesce(p_settlement_date, CURRENT_DATE), v_remaining, v_custody.partner_id,
        p_destination_id, v_acc_125, 'نقدي (كاش)',
        'رد متبقي عهدة رقم: ' || v_custody.custody_number || ' - المهندس: ' || v_partner_name, 'مسودة'
      ) RETURNING id, receipt_number INTO v_rv_id, v_rv_number;

      -- Post receipt voucher directly
      INSERT INTO public.journal_headers (
        company_id, entry_date, description, reference_id, v_type, status
      ) VALUES (
        v_company, coalesce(p_settlement_date, CURRENT_DATE),
        'رد متبقي عهدة رقم ' || v_custody.custody_number || ' بسند قبض ' || v_rv_number,
        v_rv_id, 'receipt_vouchers', 'posted'
      ) RETURNING id INTO v_jh_id;

      -- Debit safe/bank
      INSERT INTO public.journal_lines (
        company_id, header_id, account_id, partner_id, project_id, debit, credit, notes
      ) VALUES (
        v_company, v_jh_id, p_destination_id, NULL, v_custody.project_id, v_remaining, 0,
        'تحصيل متبقي عهدة ' || v_custody.custody_number
      );

      -- Credit 125 with partner_id
      INSERT INTO public.journal_lines (
        company_id, header_id, account_id, partner_id, project_id, debit, credit, notes
      ) VALUES (
        v_company, v_jh_id, v_acc_125, v_custody.partner_id, v_custody.project_id, 0, v_remaining,
        'تسوية متبقي عهدة ' || v_custody.custody_number
      );

      UPDATE public.receipt_vouchers SET status = 'معتمد' WHERE id = v_rv_id;

    -- B) Salary Deduction (خصم من الراتب على حساب 216 رواتب وأجور مستحقة)
    ELSIF p_settlement_type = 'salary_deduction' THEN
      v_acc_216 := rawasi_private.require_company_account('216');

      INSERT INTO public.journal_headers (
        company_id, entry_date, description, reference_id, v_type, status
      ) VALUES (
        v_company, coalesce(p_settlement_date, CURRENT_DATE),
        'تسوية متبقي عهدة ' || v_custody.custody_number || ' بالخصم من راتب: ' || v_partner_name,
        v_custody.id, 'manual_journals', 'posted'
      ) RETURNING id INTO v_jh_id;

      -- Debit 216 (أجور مستحقة) with partner_id
      INSERT INTO public.journal_lines (
        company_id, header_id, account_id, partner_id, project_id, debit, credit, notes
      ) VALUES (
        v_company, v_jh_id, v_acc_216, v_custody.partner_id, v_custody.project_id, v_remaining, 0,
        'خصم متبقي عهدة من مستحقات الراتب'
      );

      -- Credit 125 (عُهد الموظفين) with partner_id
      INSERT INTO public.journal_lines (
        company_id, header_id, account_id, partner_id, project_id, debit, credit, notes
      ) VALUES (
        v_company, v_jh_id, v_acc_125, v_custody.partner_id, v_custody.project_id, 0, v_remaining,
        'تسوية وقفل عهدة ' || v_custody.custody_number
      );

    -- C) Carry Forward (ترحيل لعهدة جديدة تالية)
    ELSIF p_settlement_type = 'carry_forward' THEN
      INSERT INTO public.site_custodies (
        company_id, partner_id, project_id, title, opened_date,
        disbursed_amount, spent_amount, remaining_amount, max_days,
        status, notes
      ) VALUES (
        v_company, v_custody.partner_id, coalesce(p_destination_id, v_custody.project_id),
        'مرحل من عهدة ' || v_custody.custody_number || ' - ' || v_custody.title,
        coalesce(p_settlement_date, CURRENT_DATE),
        v_remaining, 0, v_remaining, v_custody.max_days,
        'open', 'رصيد مرحل من العهدة السابقة: ' || v_custody.custody_number
      ) RETURNING id INTO v_new_custody_id;
    END IF;
  ELSE
    p_settlement_type := 'cleared';
  END IF;

  -- Mark current custody as settled
  UPDATE public.site_custodies
  SET status = 'settled',
      spent_amount = v_spent,
      remaining_amount = 0,
      settlement_date = coalesce(p_settlement_date, CURRENT_DATE),
      settlement_type = p_settlement_type,
      settlement_reference_id = coalesce(v_rv_id, v_jh_id, v_new_custody_id),
      settlement_notes = p_notes,
      updated_at = now()
  WHERE id = v_custody.id;

  RETURN jsonb_build_object(
    'custody_id', v_custody.id,
    'custody_number', v_custody.custody_number,
    'settlement_type', p_settlement_type,
    'disbursed_amount', v_custody.disbursed_amount,
    'spent_amount', v_spent,
    'remaining_settled', v_remaining,
    'receipt_voucher_id', v_rv_id,
    'journal_header_id', v_jh_id,
    'new_custody_id', v_new_custody_id
  );
END;
$$;

-- =============================================================================
-- 8. RPC: GET CUSTODIES SUMMARY & MONITORING
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_site_custodies_summary(
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_company uuid;
  v_result jsonb;
BEGIN
  v_company := rawasi_private.current_company_id();
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'لم يتم تحديد الشركة الحالية' USING ERRCODE = '42501';
  END IF;

  WITH custodies_data AS (
    SELECT 
      sc.id,
      sc.custody_number,
      sc.partner_id,
      p.code AS partner_code,
      p.name AS partner_name,
      p.phone AS partner_phone,
      sc.project_id,
      coalesce(pr."Property", 'غير محدد') AS project_name,
      sc.title,
      sc.opened_date,
      sc.disbursed_amount,
      sc.spent_amount,
      sc.remaining_amount,
      sc.max_days,
      sc.status,
      sc.notes,
      sc.settlement_date,
      sc.settlement_type,
      sc.settlement_notes,
      (CURRENT_DATE - sc.opened_date) AS days_open,
      CASE 
        WHEN sc.status = 'open' AND (CURRENT_DATE - sc.opened_date) > sc.max_days THEN true
        ELSE false
      END AS is_overdue,
      (
        SELECT count(*)::int 
        FROM public.expenses e 
        WHERE e.custody_id = sc.id AND e.company_id = sc.company_id
      ) AS expenses_count,
      (
        SELECT coalesce(jsonb_agg(
          jsonb_build_object(
            'id', e.id,
            'exp_date', e.exp_date,
            'description', e.description,
            'amount', (coalesce(e.total_price, 0) + coalesce(e.vat_amount, 0) - coalesce(e.discount_amount, 0)),
            'is_posted', e.is_posted
          ) ORDER BY e.exp_date DESC
        ), '[]'::jsonb)
        FROM public.expenses e
        WHERE e.custody_id = sc.id AND e.company_id = sc.company_id
      ) AS expenses
    FROM public.site_custodies sc
    JOIN public.partners p ON p.id = sc.partner_id AND p.company_id = sc.company_id
    LEFT JOIN public.projects pr ON pr.id = sc.project_id AND pr.company_id = sc.company_id
    WHERE sc.company_id = v_company
      AND (p_status IS NULL OR sc.status = p_status)
    ORDER BY sc.opened_date DESC, sc.created_at DESC
  ),
  kpi_agg AS (
    SELECT 
      count(*)::int AS total_custodies,
      count(*) FILTER (WHERE status = 'open')::int AS active_custodies,
      count(*) FILTER (WHERE is_overdue IS TRUE)::int AS overdue_custodies,
      coalesce(sum(disbursed_amount) FILTER (WHERE status = 'open'), 0) AS total_active_disbursed,
      coalesce(sum(spent_amount) FILTER (WHERE status = 'open'), 0) AS total_active_spent,
      coalesce(sum(remaining_amount) FILTER (WHERE status = 'open'), 0) AS total_active_remaining,
      coalesce(sum(remaining_amount) FILTER (WHERE is_overdue IS TRUE), 0) AS total_overdue_amount
    FROM custodies_data
  )
  SELECT jsonb_build_object(
    'kpis', to_jsonb(k),
    'custodies', coalesce((SELECT jsonb_agg(to_jsonb(c)) FROM custodies_data c), '[]'::jsonb)
  ) INTO v_result
  FROM kpi_agg k;

  RETURN v_result;
END;
$$;

-- =============================================================================
-- 9. RPC: GET CASH CLOSING PREVIEW (مقارنة رصيد الخزينة الدفتري بالجرد)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_cash_closing_preview(
  p_account_id uuid,
  p_closing_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_company uuid;
  v_as_of date := coalesce(p_closing_date, CURRENT_DATE);
  v_acc record;
  v_system_balance numeric(15,2);
  v_last_closing record;
  v_already_closed boolean;
BEGIN
  v_company := rawasi_private.current_company_id();
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'لم يتم تحديد الشركة الحالية' USING ERRCODE = '42501';
  END IF;

  SELECT id, code, name INTO v_acc
  FROM public.accounts
  WHERE id = p_account_id AND company_id = v_company;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'حساب الخزينة/البنك غير موجود في الشركة' USING ERRCODE = '23503';
  END IF;

  -- Cumulative posted GL balance for this safe up to v_as_of
  SELECT coalesce(sum(jl.debit - jl.credit), 0)
  INTO v_system_balance
  FROM public.journal_lines jl
  JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = jl.company_id
  WHERE jl.company_id = v_company
    AND jl.account_id = p_account_id
    AND jh.status IN ('posted', 'مرحل', 'معتمد')
    AND jh.entry_date <= v_as_of;

  -- Last closing
  SELECT closing_date, closed_at, system_balance, actual_cash, difference, status
  INTO v_last_closing
  FROM public.daily_cash_closings
  WHERE company_id = v_company AND account_id = p_account_id
  ORDER BY closing_date DESC, closed_at DESC
  LIMIT 1;

  -- Already closed today?
  SELECT EXISTS (
    SELECT 1 FROM public.daily_cash_closings
    WHERE company_id = v_company AND account_id = p_account_id AND closing_date = v_as_of
  ) INTO v_already_closed;

  RETURN jsonb_build_object(
    'account_id', v_acc.id,
    'account_code', v_acc.code,
    'account_name', v_acc.name,
    'closing_date', v_as_of,
    'system_balance', round(v_system_balance, 2),
    'is_already_closed_today', v_already_closed,
    'last_closing', CASE WHEN v_last_closing.closing_date IS NOT NULL THEN to_jsonb(v_last_closing) ELSE NULL END
  );
END;
$$;

-- =============================================================================
-- 10. RPC: CREATE DAILY CASH CLOSING (تسجيل محضر إقفال الخزينة)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.create_daily_cash_closing(
  p_account_id uuid,
  p_closing_date date,
  p_actual_cash numeric,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_company uuid;
  v_closing_date date := coalesce(p_closing_date, CURRENT_DATE);
  v_system_balance numeric(15,2);
  v_diff numeric(15,2);
  v_diff_type text;
  v_status text;
  v_closing_id uuid;
BEGIN
  IF auth.uid() IS NULL AND current_setting('role', true) IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'يلزم تسجيل الدخول لإقفال الخزينة' USING ERRCODE = '42501';
  END IF;

  IF NOT (rawasi_private.can_access('journal', 'create') OR rawasi_private.can_access('cashflows', 'create')) THEN
    RAISE EXCEPTION 'لا توجد صلاحية إقفال الخزينة' USING ERRCODE = '42501';
  END IF;

  v_company := rawasi_private.current_company_id();
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'لم يتم تحديد الشركة الحالية' USING ERRCODE = '42501';
  END IF;

  IF p_account_id IS NULL THEN
    RAISE EXCEPTION 'يلزم تحديد حساب الخزينة' USING ERRCODE = '23514';
  END IF;

  IF p_actual_cash IS NULL OR p_actual_cash < 0 THEN
    RAISE EXCEPTION 'المبلغ الفعلي لا يمكن أن يكون سالباً' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.daily_cash_closings
    WHERE company_id = v_company AND account_id = p_account_id AND closing_date = v_closing_date
  ) THEN
    RAISE EXCEPTION 'تم إقفال هذه الخزينة لهذا التاريخ مسبقاً' USING ERRCODE = '23505';
  END IF;

  -- Calculate GL balance
  SELECT coalesce(sum(jl.debit - jl.credit), 0)
  INTO v_system_balance
  FROM public.journal_lines jl
  JOIN public.journal_headers jh ON jh.id = jl.header_id AND jh.company_id = jl.company_id
  WHERE jl.company_id = v_company
    AND jl.account_id = p_account_id
    AND jh.status IN ('posted', 'مرحل', 'معتمد')
    AND jh.entry_date <= v_closing_date;

  v_diff := round(p_actual_cash - v_system_balance, 2);

  IF v_diff = 0 THEN
    v_diff_type := 'exact';
    v_status := 'approved'; -- Exactly matched, automatically approved
  ELSIF v_diff < 0 THEN
    v_diff_type := 'shortage'; -- عجز
    v_status := 'pending'; -- requires manager approval to post to 527
  ELSE
    v_diff_type := 'surplus'; -- زيادة
    v_status := 'pending';
  END IF;

  INSERT INTO public.daily_cash_closings (
    company_id, account_id, closing_date, closed_at,
    system_balance, actual_cash, difference, difference_type,
    status, notes
  ) VALUES (
    v_company, p_account_id, v_closing_date, now(),
    round(v_system_balance, 2), round(p_actual_cash, 2), v_diff, v_diff_type,
    v_status, p_notes
  ) RETURNING id INTO v_closing_id;

  RETURN v_closing_id;
END;
$$;

-- =============================================================================
-- 11. RPC: APPROVE CASH CLOSING & POST VARIANCE TO GL 527
-- =============================================================================
CREATE OR REPLACE FUNCTION public.approve_cash_closing(
  p_closing_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_company uuid;
  v_closing public.daily_cash_closings%ROWTYPE;
  v_acc_527 uuid;
  v_safe_name text;
  v_jh_id uuid;
  v_abs_diff numeric(15,2);
BEGIN
  IF auth.uid() IS NULL AND current_setting('role', true) IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'يلزم تسجيل الدخول لاعتماد إقفال الخزينة' USING ERRCODE = '42501';
  END IF;

  IF NOT (rawasi_private.can_access('journal', 'edit') OR rawasi_private.can_access('cashflows', 'edit')) THEN
    RAISE EXCEPTION 'لا توجد صلاحية اعتماد إقفال وفروقات الخزينة' USING ERRCODE = '42501';
  END IF;

  v_company := rawasi_private.current_company_id();

  SELECT * INTO v_closing
  FROM public.daily_cash_closings
  WHERE id = p_closing_id AND company_id = v_company
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'محضر إقفال الخزينة غير موجود' USING ERRCODE = '23503';
  END IF;

  IF v_closing.status = 'approved' THEN
    RETURN jsonb_build_object('closing_id', v_closing.id, 'status', 'approved', 'message', 'معتمد مسبقاً');
  END IF;

  SELECT name INTO v_safe_name FROM public.accounts WHERE id = v_closing.account_id AND company_id = v_company;
  v_acc_527 := rawasi_private.require_company_account('527');
  v_abs_diff := abs(v_closing.difference);

  IF v_closing.difference <> 0 THEN
    -- Post journal entry for difference
    INSERT INTO public.journal_headers (
      company_id, entry_date, description, reference_id, v_type, status
    ) VALUES (
      v_company, v_closing.closing_date,
      'تسوية فروق جرد خزينة: ' || v_safe_name || ' بتاريخ ' || v_closing.closing_date,
      v_closing.id, 'manual_journals', 'posted'
    ) RETURNING id INTO v_jh_id;

    -- Shortage (عجز: actual < system -> Debit 527 مصروف فروقات، Credit Safe الخزينة)
    IF v_closing.difference < 0 THEN
      -- Debit 527
      INSERT INTO public.journal_lines (
        company_id, header_id, account_id, partner_id, debit, credit, notes
      ) VALUES (
        v_company, v_jh_id, v_acc_527, NULL, v_abs_diff, 0,
        'عجز جرد خزينة ' || v_safe_name || ' في ' || v_closing.closing_date
      );
      -- Credit Safe
      INSERT INTO public.journal_lines (
        company_id, header_id, account_id, partner_id, debit, credit, notes
      ) VALUES (
        v_company, v_jh_id, v_closing.account_id, NULL, 0, v_abs_diff,
        'تخفيض رصيد الخزينة بموجب محضر الجرد المعتمد'
      );

    -- Surplus (زيادة: actual > system -> Debit Safe الخزينة، Credit 527 تسويات)
    ELSE
      -- Debit Safe
      INSERT INTO public.journal_lines (
        company_id, header_id, account_id, partner_id, debit, credit, notes
      ) VALUES (
        v_company, v_jh_id, v_closing.account_id, NULL, v_abs_diff, 0,
        'إثبات زيادة نقدية بجرد خزينة ' || v_safe_name || ' في ' || v_closing.closing_date
      );
      -- Credit 527
      INSERT INTO public.journal_lines (
        company_id, header_id, account_id, partner_id, debit, credit, notes
      ) VALUES (
        v_company, v_jh_id, v_acc_527, NULL, 0, v_abs_diff,
        'فروق جرد موجبة تسويات هللات'
      );
    END IF;
  END IF;

  UPDATE public.daily_cash_closings
  SET status = 'approved',
      approved_by = auth.uid(),
      approved_at = now(),
      journal_header_id = v_jh_id,
      notes = coalesce(p_notes, notes)
  WHERE id = v_closing.id;

  RETURN jsonb_build_object(
    'closing_id', v_closing.id,
    'status', 'approved',
    'journal_header_id', v_jh_id,
    'difference', v_closing.difference
  );
END;
$$;

-- =============================================================================
-- 12. RPC: GET CASH CLOSINGS HISTORY
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_daily_cash_closings_history(
  p_account_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_company uuid;
  v_list jsonb;
BEGIN
  v_company := rawasi_private.current_company_id();
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'لم يتم تحديد الشركة الحالية' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'account_id', c.account_id,
      'account_code', a.code,
      'account_name', a.name,
      'closing_date', c.closing_date,
      'closed_at', c.closed_at,
      'system_balance', c.system_balance,
      'actual_cash', c.actual_cash,
      'difference', c.difference,
      'difference_type', c.difference_type,
      'status', c.status,
      'notes', c.notes,
      'approved_at', c.approved_at,
      'journal_header_id', c.journal_header_id
    ) ORDER BY c.closing_date DESC, c.closed_at DESC
  ), '[]'::jsonb)
  INTO v_list
  FROM public.daily_cash_closings c
  JOIN public.accounts a ON a.id = c.account_id AND a.company_id = c.company_id
  WHERE c.company_id = v_company
    AND (p_account_id IS NULL OR c.account_id = p_account_id)
  LIMIT coalesce(p_limit, 50);

  RETURN v_list;
END;
$$;

COMMIT;


