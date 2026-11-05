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
