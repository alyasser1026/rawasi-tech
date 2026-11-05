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
