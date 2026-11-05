-- Work orders linked to every document and journal line.
--
-- 1. Penalties, receipt vouchers and material issues get a work order (job_order_id), like daily logs,
--    expenses, contractor assignments, payment vouchers and manual journals already have.
--    Invoice lines carry it inside lines_data (job_order_id per line).
-- 2. A work order must belong to the same company and the same villa as the document. When the document
--    has no villa yet, the work order's villa is filled in. Material issue lines follow their issue's work order.
-- 3. A work order that has documents or journal lines cannot be deleted or moved to another villa.
-- 4. Journal lines get job_order_id. Every line of an entry made from a document takes the document's
--    work order. partner_id is not touched: it stays on the partner's own line only, as everywhere else.
--    Invoices with several work orders get one revenue line per work order, and contractor claims one
--    cost line per work order, split in proportion to the invoice lines / assigned work.
-- 5. The work order ledger view includes penalties, invoice lines and receipts, and no longer shows
--    deleted expenses. The performance view counts costs only, less penalties.
-- The replaced functions and views are kept in rawasi_private.job_order_link_originals for the rollback.

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $preflight$
BEGIN
  IF to_regprocedure('rawasi_private.require_company_account(text)') IS NULL THEN
    RAISE EXCEPTION 'Apply the multi-company migrations first';
  END IF;
  IF to_regclass('rawasi_private.job_order_link_originals') IS NOT NULL THEN
    RAISE EXCEPTION 'job_order_links is already applied';
  END IF;
END;
$preflight$;

CREATE TABLE rawasi_private.job_order_link_originals (
  name text PRIMARY KEY,
  definition text NOT NULL
);
REVOKE ALL ON rawasi_private.job_order_link_originals FROM PUBLIC, anon, authenticated;

INSERT INTO rawasi_private.job_order_link_originals (name, definition) VALUES
  ('public.post_invoices_bulk(uuid[])', pg_get_functiondef('public.post_invoices_bulk(uuid[])'::regprocedure)),
  ('public.post_sub_claim(uuid)', pg_get_functiondef('public.post_sub_claim(uuid)'::regprocedure)),
  ('public.job_order_ledger_view', pg_get_viewdef('public.job_order_ledger_view'::regclass)),
  ('public.job_order_performance', pg_get_viewdef('public.job_order_performance'::regclass));

-- 1. Columns
ALTER TABLE public.violations ADD COLUMN job_order_id uuid;
ALTER TABLE public.receipt_vouchers ADD COLUMN job_order_id uuid;
ALTER TABLE public.material_issues ADD COLUMN job_order_id uuid;
ALTER TABLE public.journal_lines ADD COLUMN job_order_id uuid;

ALTER TABLE public.violations ADD CONSTRAINT violations_job_order_id_company_fkey
  FOREIGN KEY (job_order_id, company_id) REFERENCES public.job_orders (id, company_id);
ALTER TABLE public.receipt_vouchers ADD CONSTRAINT receipt_vouchers_job_order_id_company_fkey
  FOREIGN KEY (job_order_id, company_id) REFERENCES public.job_orders (id, company_id);
ALTER TABLE public.material_issues ADD CONSTRAINT material_issues_job_order_id_company_fkey
  FOREIGN KEY (job_order_id, company_id) REFERENCES public.job_orders (id, company_id);
ALTER TABLE public.journal_lines ADD CONSTRAINT journal_lines_job_order_id_company_fkey
  FOREIGN KEY (job_order_id, company_id) REFERENCES public.job_orders (id, company_id);

CREATE INDEX idx_jo_link_labor_daily_logs ON public.labor_daily_logs (job_order_id) WHERE job_order_id IS NOT NULL;
CREATE INDEX idx_jo_link_expenses ON public.expenses (job_order_id) WHERE job_order_id IS NOT NULL;
CREATE INDEX idx_jo_link_contractor_assignments ON public.contractor_assignments (job_order_id) WHERE job_order_id IS NOT NULL;
CREATE INDEX idx_jo_link_material_issue_lines ON public.material_issue_lines (job_order_id) WHERE job_order_id IS NOT NULL;
CREATE INDEX idx_jo_link_material_issues ON public.material_issues (job_order_id) WHERE job_order_id IS NOT NULL;
CREATE INDEX idx_jo_link_payment_vouchers ON public.payment_vouchers (job_order_id) WHERE job_order_id IS NOT NULL;
CREATE INDEX idx_jo_link_receipt_vouchers ON public.receipt_vouchers (job_order_id) WHERE job_order_id IS NOT NULL;
CREATE INDEX idx_jo_link_violations ON public.violations (job_order_id) WHERE job_order_id IS NOT NULL;
CREATE INDEX idx_jo_link_sub_claims ON public.sub_claims (job_order_id) WHERE job_order_id IS NOT NULL;
CREATE INDEX idx_jo_link_manual_journals ON public.manual_journals (job_order_id) WHERE job_order_id IS NOT NULL;
CREATE INDEX idx_jo_link_journal_headers ON public.journal_headers (job_order_id) WHERE job_order_id IS NOT NULL;
CREATE INDEX idx_jo_link_journal_lines ON public.journal_lines (job_order_id) WHERE job_order_id IS NOT NULL;
CREATE INDEX idx_jo_link_invoices_lines ON public.invoices USING gin (lines_data jsonb_path_ops);

-- Number helpers for the JSON invoice lines (text that is not a number counts as nothing).
CREATE FUNCTION rawasi_private.safe_numeric(p text)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN p ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$' THEN trim(p)::numeric END
$$;

CREATE FUNCTION rawasi_private.invoice_line_total(p_line jsonb)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT COALESCE(
    rawasi_private.safe_numeric(p_line->>'quantity') * rawasi_private.safe_numeric(p_line->>'unit_price'),
    rawasi_private.safe_numeric(p_line->>'total_price'),
    0)
$$;

CREATE FUNCTION rawasi_private.json_array_or_empty(p jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN jsonb_typeof(p) = 'array' THEN p ELSE '[]'::jsonb END
$$;

REVOKE ALL ON FUNCTION rawasi_private.safe_numeric(text), rawasi_private.invoice_line_total(jsonb),
  rawasi_private.json_array_or_empty(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION rawasi_private.safe_numeric(text), rawasi_private.invoice_line_total(jsonb),
  rawasi_private.json_array_or_empty(jsonb) TO authenticated, service_role;

-- 2. The work order must be in the same company and villa as the document.
--    TG_ARGV[0] = 'project_id' (one villa column) or 'project_ids' (villa array).
CREATE FUNCTION rawasi_private.check_job_order_link()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  jo record;
BEGIN
  IF NEW.job_order_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT j.project_id, j.company_id INTO jo FROM public.job_orders j WHERE j.id = NEW.job_order_id;
  IF NOT FOUND OR jo.company_id IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'أمر الشغل المختار مش موجود في الشركة المفتوحة' USING ERRCODE = '23503';
  END IF;
  IF TG_ARGV[0] = 'project_ids' THEN
    IF NEW.project_ids IS NULL OR cardinality(NEW.project_ids) = 0 THEN
      NEW.project_ids := ARRAY[jo.project_id];
    ELSIF NOT (jo.project_id = ANY (NEW.project_ids)) THEN
      RAISE EXCEPTION 'أمر الشغل المختار تبع فيلا مش من الفيلات المختارة' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF NEW.project_id IS NULL THEN
      NEW.project_id := jo.project_id;
    ELSIF NEW.project_id <> jo.project_id THEN
      RAISE EXCEPTION 'أمر الشغل المختار تبع فيلا غير الفيلا المختارة' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_job_order_link BEFORE INSERT OR UPDATE OF job_order_id, project_id ON public.labor_daily_logs
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.check_job_order_link('project_id');
CREATE TRIGGER trg_job_order_link BEFORE INSERT OR UPDATE OF job_order_id, project_id ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.check_job_order_link('project_id');
CREATE TRIGGER trg_job_order_link BEFORE INSERT OR UPDATE OF job_order_id, project_id ON public.contractor_assignments
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.check_job_order_link('project_id');
CREATE TRIGGER trg_job_order_link BEFORE INSERT OR UPDATE OF job_order_id, project_id ON public.violations
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.check_job_order_link('project_id');
CREATE TRIGGER trg_job_order_link BEFORE INSERT OR UPDATE OF job_order_id, project_id ON public.material_issues
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.check_job_order_link('project_id');
CREATE TRIGGER trg_job_order_link BEFORE INSERT OR UPDATE OF job_order_id, project_id ON public.manual_journals
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.check_job_order_link('project_id');
CREATE TRIGGER trg_job_order_link BEFORE INSERT OR UPDATE OF job_order_id, project_ids ON public.payment_vouchers
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.check_job_order_link('project_ids');
CREATE TRIGGER trg_job_order_link BEFORE INSERT OR UPDATE OF job_order_id, project_ids ON public.receipt_vouchers
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.check_job_order_link('project_ids');
CREATE TRIGGER trg_job_order_link BEFORE INSERT OR UPDATE OF job_order_id, project_ids ON public.sub_claims
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.check_job_order_link('project_ids');

-- Material issue lines follow the issue's work order. A line that brings a work order to an issue
-- without one sets it on the issue (the dispense-from-invoice screen works that way).
CREATE FUNCTION rawasi_private.sync_material_issue_line_job_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_issue_job uuid;
BEGIN
  SELECT i.job_order_id INTO v_issue_job FROM public.material_issues i WHERE i.id = NEW.issue_id;
  IF v_issue_job IS NOT NULL THEN
    IF NEW.job_order_id IS NULL THEN
      NEW.job_order_id := v_issue_job;
    ELSIF NEW.job_order_id <> v_issue_job THEN
      RAISE EXCEPTION 'كل سطور إذن الصرف لازم تكون على نفس أمر الشغل بتاع الإذن' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.job_order_id IS NOT NULL THEN
    UPDATE public.material_issues SET job_order_id = NEW.job_order_id WHERE id = NEW.issue_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Runs before the old contractor auto-link, so a line never gets a different work order than its issue.
CREATE TRIGGER trg_aa_job_order_link BEFORE INSERT OR UPDATE OF job_order_id, issue_id ON public.material_issue_lines
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.sync_material_issue_line_job_order();

CREATE FUNCTION rawasi_private.sync_material_issue_job_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.job_order_id IS NOT NULL THEN
    UPDATE public.material_issue_lines SET job_order_id = NEW.job_order_id
    WHERE issue_id = NEW.id AND job_order_id IS DISTINCT FROM NEW.job_order_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_job_order_lines AFTER UPDATE OF job_order_id ON public.material_issues
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.sync_material_issue_job_order();

-- Invoice lines: each work order must be in the company; its villa and BOQ line are written on the line,
-- and its villa is added to the invoice's villas.
CREATE FUNCTION rawasi_private.check_invoice_job_orders()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_line jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_projects uuid[] := COALESCE(NEW.project_ids, '{}');
  jo record;
BEGIN
  IF jsonb_typeof(NEW.lines_data) IS DISTINCT FROM 'array' THEN
    RETURN NEW;
  END IF;
  FOR v_line IN SELECT value FROM jsonb_array_elements(NEW.lines_data) LOOP
    IF jsonb_typeof(v_line) = 'object' AND NULLIF(v_line->>'job_order_id', '') IS NOT NULL THEN
      SELECT j.project_id, j.company_id, j.boq_budget_id INTO jo
      FROM public.job_orders j WHERE j.id = (v_line->>'job_order_id')::uuid;
      IF NOT FOUND OR jo.company_id IS DISTINCT FROM NEW.company_id THEN
        RAISE EXCEPTION 'أمر شغل في سطور الفاتورة مش موجود في الشركة المفتوحة' USING ERRCODE = '23503';
      END IF;
      v_line := v_line || jsonb_build_object('project_id', jo.project_id, 'boq_budget_id', jo.boq_budget_id);
      IF NOT (jo.project_id = ANY (v_projects)) THEN
        v_projects := v_projects || jo.project_id;
      END IF;
    END IF;
    v_lines := v_lines || jsonb_build_array(v_line);
  END LOOP;
  NEW.lines_data := v_lines;
  IF cardinality(v_projects) > 0 THEN
    NEW.project_ids := v_projects;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_job_order_link BEFORE INSERT OR UPDATE OF lines_data, project_ids ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.check_invoice_job_orders();

-- 3. A work order with documents or journal lines cannot be deleted or moved to another villa.
CREATE FUNCTION rawasi_private.guard_job_order_links()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_id uuid := OLD.id;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.project_id IS NOT DISTINCT FROM OLD.project_id THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.labor_daily_logs WHERE job_order_id = v_id)
     OR EXISTS (SELECT 1 FROM public.expenses WHERE job_order_id = v_id)
     OR EXISTS (SELECT 1 FROM public.contractor_assignments WHERE job_order_id = v_id AND claim_id IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.material_issue_lines WHERE job_order_id = v_id)
     OR EXISTS (SELECT 1 FROM public.material_issues WHERE job_order_id = v_id)
     OR EXISTS (SELECT 1 FROM public.payment_vouchers WHERE job_order_id = v_id)
     OR EXISTS (SELECT 1 FROM public.receipt_vouchers WHERE job_order_id = v_id)
     OR EXISTS (SELECT 1 FROM public.violations WHERE job_order_id = v_id)
     OR EXISTS (SELECT 1 FROM public.sub_claims WHERE job_order_id = v_id)
     OR EXISTS (SELECT 1 FROM public.manual_journals WHERE job_order_id = v_id)
     OR EXISTS (SELECT 1 FROM public.journal_headers WHERE job_order_id = v_id)
     OR EXISTS (SELECT 1 FROM public.journal_lines WHERE job_order_id = v_id)
     OR EXISTS (SELECT 1 FROM public.invoices
                WHERE lines_data @> jsonb_build_array(jsonb_build_object('job_order_id', v_id::text)))
  THEN
    RAISE EXCEPTION 'أمر الشغل % عليه حركات (يوميات أو مصروفات أو فواتير أو قيود)، فمينفعش يتمسح أو يتنقل لفيلا تانية', OLD.order_number
      USING ERRCODE = '23503';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_job_order_guard BEFORE DELETE OR UPDATE OF project_id ON public.job_orders
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.guard_job_order_links();

-- 4. Journal entries take the work order of the document they were made from.
CREATE FUNCTION rawasi_private.single_job_order(p_ids uuid[])
RETURNS uuid LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN count(DISTINCT x) = 1 THEN (array_agg(x))[1] END
  FROM unnest(p_ids) AS t(x) WHERE x IS NOT NULL
$$;

CREATE FUNCTION rawasi_private.entry_job_order(p_type text, p_ref uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v uuid;
BEGIN
  IF p_ref IS NULL THEN
    RETURN NULL;
  END IF;
  CASE p_type
    WHEN 'labor_daily_logs' THEN
      SELECT job_order_id INTO v FROM public.labor_daily_logs WHERE id = p_ref;
    WHEN 'expense' THEN
      SELECT job_order_id INTO v FROM public.expenses WHERE id = p_ref;
    WHEN 'مخالفة' THEN
      SELECT job_order_id INTO v FROM public.violations WHERE id = p_ref;
    WHEN 'manual_journals' THEN
      SELECT job_order_id INTO v FROM public.manual_journals WHERE id = p_ref;
    WHEN 'إذن صرف' THEN
      SELECT COALESCE(i.job_order_id,
               rawasi_private.single_job_order(ARRAY(SELECT l.job_order_id FROM public.material_issue_lines l WHERE l.issue_id = i.id)))
      INTO v FROM public.material_issues i WHERE i.id = p_ref;
    WHEN 'فاتورة مبيعات' THEN
      SELECT rawasi_private.single_job_order(ARRAY(
               SELECT NULLIF(l->>'job_order_id', '')::uuid
               FROM jsonb_array_elements(rawasi_private.json_array_or_empty(inv.lines_data)) l))
      INTO v FROM public.invoices inv WHERE inv.id = p_ref;
    WHEN 'مستخلص' THEN
      SELECT COALESCE(rawasi_private.single_job_order(ARRAY(
               SELECT a.job_order_id FROM public.contractor_assignments a WHERE a.claim_id = c.id)),
             c.job_order_id)
      INTO v FROM public.sub_claims c WHERE c.id = p_ref;
    WHEN 'سند قبض' THEN
      SELECT COALESCE(r.job_order_id, (
               SELECT rawasi_private.single_job_order(ARRAY(
                        SELECT NULLIF(l->>'job_order_id', '')::uuid
                        FROM jsonb_array_elements(rawasi_private.json_array_or_empty(inv.lines_data)) l))
               FROM public.invoices inv WHERE inv.id = r.invoice_id))
      INTO v FROM public.receipt_vouchers r WHERE r.id = p_ref;
    WHEN 'payment_vouchers' THEN
      SELECT COALESCE(pv.job_order_id,
               (SELECT e.job_order_id FROM public.expenses e WHERE e.id = pv.related_expense_id),
               rawasi_private.single_job_order(ARRAY(
                 SELECT a.job_order_id FROM public.contractor_assignments a
                 WHERE pv.sub_claim_id IS NOT NULL AND a.claim_id = pv.sub_claim_id)))
      INTO v FROM public.payment_vouchers pv WHERE pv.id = p_ref;
    ELSE
      v := NULL;
  END CASE;
  RETURN v;
END;
$$;

CREATE FUNCTION rawasi_private.tag_journal_header_job_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.job_order_id IS NULL THEN
    NEW.job_order_id := rawasi_private.entry_job_order(NEW.v_type, NEW.reference_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION rawasi_private.tag_journal_line_job_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.job_order_id IS NULL THEN
    SELECT h.job_order_id INTO NEW.job_order_id FROM public.journal_headers h WHERE h.id = NEW.header_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_job_order_tag BEFORE INSERT ON public.journal_headers
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.tag_journal_header_job_order();
CREATE TRIGGER trg_job_order_tag BEFORE INSERT ON public.journal_lines
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.tag_journal_line_job_order();

REVOKE ALL ON FUNCTION rawasi_private.check_job_order_link(), rawasi_private.sync_material_issue_line_job_order(),
  rawasi_private.sync_material_issue_job_order(), rawasi_private.check_invoice_job_orders(),
  rawasi_private.guard_job_order_links(), rawasi_private.tag_journal_header_job_order(),
  rawasi_private.tag_journal_line_job_order(), rawasi_private.entry_job_order(text, uuid),
  rawasi_private.single_job_order(uuid[]) FROM PUBLIC, anon, authenticated;

-- Invoices: one revenue line per work order of the invoice lines.
CREATE OR REPLACE FUNCTION public.post_invoices_bulk(p_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
    v_record RECORD;
    v_header_id UUID;
    v_group RECORD;
    v_lines jsonb;
    v_lines_total numeric;
    v_allocated numeric;
    v_part numeric;
    v_split boolean;
BEGIN
    FOR v_record IN
        SELECT * FROM invoices WHERE id = ANY(p_ids) AND status != 'معتمد'
    LOOP
        INSERT INTO journal_headers (entry_date, description, reference_id, v_type, status)
        VALUES (v_record.date, 'ترحيل فاتورة مبيعات رقم: ' || v_record.invoice_number, v_record.id, 'فاتورة مبيعات', 'posted')
        RETURNING id INTO v_header_id;

        -- مديونية العميل (الصافي): الـ partner_id على سطر العميل
        INSERT INTO journal_lines (header_id, account_id, debit, credit, partner_id, notes)
        VALUES (v_header_id, v_record.debit_account_id, v_record.total_amount, 0, v_record.partner_id, 'استحقاق الفاتورة (صافي القيمة)');

        -- محتجز ضمان الأعمال: على حساب العميل
        IF COALESCE(v_record.guarantee_amount, 0) > 0 THEN
            INSERT INTO journal_lines (header_id, account_id, debit, credit, partner_id, notes)
            VALUES (v_header_id, v_record.guarantee_acc_id, v_record.guarantee_amount, 0, v_record.partner_id, 'محتجز ضمان أعمال مسترد');
        END IF;

        -- الإيرادات (من غير partner_id): سطر لكل أمر شغل بنسبة سطوره من الفاتورة
        v_lines := rawasi_private.json_array_or_empty(v_record.lines_data);
        SELECT COALESCE(sum(rawasi_private.invoice_line_total(l)), 0),
               bool_or(NULLIF(l->>'job_order_id', '') IS NOT NULL)
               AND bool_and(rawasi_private.invoice_line_total(l) > 0)
        INTO v_lines_total, v_split
        FROM jsonb_array_elements(v_lines) l;

        IF COALESCE(v_split, false) AND v_lines_total > 0 AND COALESCE(v_record.taxable_amount, 0) > 0 THEN
            v_allocated := 0;
            FOR v_group IN
                SELECT g.job_order_id, j.project_id, g.amount,
                       row_number() OVER (ORDER BY g.job_order_id IS NULL, g.amount DESC, g.job_order_id) AS rn,
                       count(*) OVER () AS cnt
                FROM (SELECT NULLIF(l->>'job_order_id', '')::uuid AS job_order_id,
                             sum(rawasi_private.invoice_line_total(l)) AS amount
                      FROM jsonb_array_elements(v_lines) l
                      GROUP BY 1) g
                LEFT JOIN job_orders j ON j.id = g.job_order_id
            LOOP
                IF v_group.rn = v_group.cnt THEN
                    v_part := v_record.taxable_amount - v_allocated;
                ELSE
                    v_part := round(v_record.taxable_amount * v_group.amount / v_lines_total, 2);
                END IF;
                v_allocated := v_allocated + v_part;
                IF v_part > 0 THEN
                    INSERT INTO journal_lines (header_id, account_id, debit, credit, partner_id, project_id, job_order_id, notes)
                    VALUES (v_header_id, v_record.credit_account_id, 0, v_part, NULL, v_group.project_id, v_group.job_order_id, 'إيرادات مبيعات/مستخلصات');
                END IF;
            END LOOP;
        ELSE
            INSERT INTO journal_lines (header_id, account_id, debit, credit, partner_id, notes)
            VALUES (v_header_id, v_record.credit_account_id, 0, v_record.taxable_amount, NULL, 'إيرادات مبيعات/مستخلصات');
        END IF;

        -- الضريبة (من غير partner_id)
        IF COALESCE(v_record.tax_amount, 0) > 0 THEN
            INSERT INTO journal_lines (header_id, account_id, debit, credit, partner_id, notes)
            VALUES (v_header_id, v_record.tax_acc_id, 0, v_record.tax_amount, NULL, 'ضريبة قيمة مضافة مبيعات');
        END IF;

        UPDATE invoices SET status = 'معتمد' WHERE id = v_record.id;
    END LOOP;
END;
$function$;

-- Contractor claims: one cost line per work order of the claimed assignments.
CREATE OR REPLACE FUNCTION public.post_sub_claim(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
    v_rec RECORD;
    v_jv_id UUID;
    v_contractor_earnings NUMERIC;
    v_project_account UUID;
    v_contractor_account UUID;
    v_retention_account UUID;
    v_group RECORD;
    v_base NUMERIC;
    v_split_ok BOOLEAN;
    v_allocated NUMERIC;
    v_part NUMERIC;
BEGIN
    SELECT sc.*, p.name as contractor_name
    FROM public.sub_claims sc
    JOIN public.partners p ON sc.contractor_id = p.id
    WHERE sc.id = p_id INTO v_rec;

    IF v_rec.id IS NULL THEN RAISE EXCEPTION 'خطأ: المستخلص غير موجود في النظام!'; END IF;
    IF v_rec.is_posted THEN RAISE EXCEPTION 'تنبيه: هذا المستخلص مرحل مسبقاً!'; END IF;

    SELECT id INTO v_project_account FROM public.accounts WHERE code = '513' LIMIT 1;
    SELECT id INTO v_contractor_account FROM public.accounts WHERE code = '212' LIMIT 1;
    SELECT id INTO v_retention_account FROM public.accounts WHERE code = '213' LIMIT 1;

    IF v_project_account IS NULL THEN RAISE EXCEPTION 'حساب تكاليف مقاولين (513) غير موجود'; END IF;
    IF v_contractor_account IS NULL THEN RAISE EXCEPTION 'حساب مقاولي باطن (212) غير موجود'; END IF;

    v_contractor_earnings := COALESCE(v_rec.total_amount, 0) - COALESCE(v_rec.retention_amount, 0);

    INSERT INTO public.journal_headers (entry_date, description, status, v_type, reference_id)
    VALUES (
        v_rec.date,
        'مستخلص أعمال رقم: ' || COALESCE(v_rec.claim_number, '') || ' - المقاول: ' || v_rec.contractor_name,
        'posted', 'مستخلص', v_rec.id
    ) RETURNING id INTO v_jv_id;

    IF COALESCE(v_rec.total_amount, 0) > 0 THEN
        SELECT COALESCE(sum(COALESCE(a.assigned_qty, 0) * COALESCE(a.unit_price, 0)), 0),
               bool_and(COALESCE(a.assigned_qty, 0) * COALESCE(a.unit_price, 0) > 0)
        INTO v_base, v_split_ok
        FROM public.contractor_assignments a WHERE a.claim_id = p_id;

        IF v_base > 0 AND COALESCE(v_split_ok, false) THEN
            v_allocated := 0;
            FOR v_group IN
                SELECT g.job_order_id, j.project_id, g.amount,
                       row_number() OVER (ORDER BY g.job_order_id IS NULL, g.amount DESC, g.job_order_id) AS rn,
                       count(*) OVER () AS cnt
                FROM (SELECT a.job_order_id, sum(a.assigned_qty * a.unit_price) AS amount
                      FROM public.contractor_assignments a WHERE a.claim_id = p_id
                      GROUP BY a.job_order_id) g
                LEFT JOIN public.job_orders j ON j.id = g.job_order_id
            LOOP
                IF v_group.rn = v_group.cnt THEN
                    v_part := v_rec.total_amount - v_allocated;
                ELSE
                    v_part := round(v_rec.total_amount * v_group.amount / v_base, 2);
                END IF;
                v_allocated := v_allocated + v_part;
                IF v_part > 0 THEN
                    INSERT INTO public.journal_lines (header_id, account_id, partner_id, project_id, job_order_id, debit, credit, notes)
                    VALUES (v_jv_id, v_project_account, NULL, COALESCE(v_group.project_id, v_rec.project_id), v_group.job_order_id,
                            v_part, 0, 'إجمالي تكلفة أعمال منفذة - مستخلص ' || v_rec.claim_number);
                END IF;
            END LOOP;
        ELSE
            INSERT INTO public.journal_lines (header_id, account_id, partner_id, project_id, debit, credit, notes)
            VALUES (v_jv_id, v_project_account, NULL, v_rec.project_id, v_rec.total_amount, 0, 'إجمالي تكلفة أعمال منفذة - مستخلص ' || v_rec.claim_number);
        END IF;
    END IF;

    IF COALESCE(v_rec.retention_amount, 0) > 0 THEN
        IF v_retention_account IS NULL THEN RAISE EXCEPTION 'حساب تأمينات محتجزة (213) غير موجود'; END IF;
        INSERT INTO public.journal_lines (header_id, account_id, partner_id, project_id, debit, credit, notes)
        VALUES (v_jv_id, v_retention_account, NULL, v_rec.project_id, 0, v_rec.retention_amount, 'حجز ضمان أعمال - مستخلص ' || v_rec.claim_number);
    END IF;

    IF v_contractor_earnings > 0 THEN
        INSERT INTO public.journal_lines (header_id, account_id, partner_id, project_id, debit, credit, notes)
        VALUES (v_jv_id, v_contractor_account, v_rec.contractor_id, v_rec.project_id, 0, v_contractor_earnings, 'استحقاق أعمال - مستخلص ' || v_rec.claim_number);
    ELSIF v_contractor_earnings < 0 THEN
        INSERT INTO public.journal_lines (header_id, account_id, partner_id, project_id, debit, credit, notes)
        VALUES (v_jv_id, v_contractor_account, v_rec.contractor_id, v_rec.project_id, ABS(v_contractor_earnings), 0, 'تسوية عكسية لأعمال سالبة - مستخلص ' || v_rec.claim_number);
    END IF;

    UPDATE public.sub_claims
    SET is_posted = true, status = 'معتمد', jv_header_id = v_jv_id, jv_id = v_jv_id
    WHERE id = p_id;
END;
$function$;

-- 5. Work order ledger: labor, materials, expenses (not deleted), penalties, invoice lines, receipts.
CREATE OR REPLACE VIEW public.job_order_ledger_view WITH (security_invoker = true) AS
 SELECT l.id AS source_id,
    l.job_order_id,
    l.work_date AS trans_date,
    'يوميات عمالة'::text AS trans_type,
    'العامل: ' || COALESCE(l.worker_name, 'غير محدد') || ' | إنتاجية: ' || COALESCE(bi.tareeha::text, '0')
      || ' | بند: ' || COALESCE(b.work_item, 'غير محدد') AS trans_desc,
    l.number_of_workers::numeric AS qty,
    l.daily_wage AS amount
   FROM public.labor_daily_logs l
     LEFT JOIN public.job_orders jo ON l.job_order_id = jo.id
     LEFT JOIN public.boq_budget b ON jo.boq_budget_id = b.id
     LEFT JOIN public.boq_items bi ON b.boq_item_id = bi.id
  WHERE l.job_order_id IS NOT NULL
UNION ALL
 SELECT mil.id,
    mil.job_order_id,
    mi.issue_date,
    'خامات مصروفة'::text,
    'صرف خامات: ' || COALESCE(mil.item_name, 'غير محدد')::text,
    mil.quantity,
    mil.total_price
   FROM public.material_issue_lines mil
     JOIN public.material_issues mi ON mil.issue_id = mi.id
  WHERE mil.job_order_id IS NOT NULL
UNION ALL
 SELECT e.id,
    e.job_order_id,
    e.exp_date,
    'مصروفات نثرية'::text,
    COALESCE(e.description, e.main_category),
    1::numeric,
    e.total_price
   FROM public.expenses e
  WHERE e.job_order_id IS NOT NULL AND NOT COALESCE(e.is_deleted, false)
UNION ALL
 SELECT v.id,
    v.job_order_id,
    v.date,
    'جزاءات'::text,
    COALESCE(v.violation_type, 'جزاء') || ': ' || COALESCE(v.emp_name, 'غير محدد') || COALESCE(' - ' || v.reason, ''),
    1::numeric,
    v.amount
   FROM public.violations v
  WHERE v.job_order_id IS NOT NULL AND NOT COALESCE(v.is_deleted, false)
UNION ALL
 SELECT inv.id,
    NULLIF(line->>'job_order_id', '')::uuid,
    inv.date,
    'فواتير'::text,
    'فاتورة ' || COALESCE(inv.invoice_number, '') || ': ' || COALESCE(line->>'description', ''),
    rawasi_private.safe_numeric(line->>'quantity'),
    rawasi_private.invoice_line_total(line)
   FROM public.invoices inv
     CROSS JOIN LATERAL jsonb_array_elements(rawasi_private.json_array_or_empty(inv.lines_data)) AS line
  WHERE NULLIF(line->>'job_order_id', '') IS NOT NULL
UNION ALL
 SELECT r.id,
    r.job_order_id,
    r.date,
    'سندات قبض'::text,
    'سند قبض ' || COALESCE(r.receipt_number, '') || COALESCE(' - ' || r.notes, ''),
    1::numeric,
    r.amount
   FROM public.receipt_vouchers r
  WHERE r.job_order_id IS NOT NULL;

-- Cost of a work order = labor + materials + expenses, less penalties (invoices and receipts are not costs).
CREATE OR REPLACE VIEW public.job_order_performance WITH (security_invoker = true) AS
 SELECT jo.id AS job_order_id,
    COALESCE(jo.assigned_qty * jo.unit_price, 0::numeric) AS boq_total_budget,
    COALESCE(c.cost, 0::numeric) AS effective_cost,
    COALESCE(jo.assigned_qty * jo.unit_price, 0::numeric) - COALESCE(c.cost, 0::numeric) AS total_profit_or_loss
   FROM public.job_orders jo
     LEFT JOIN LATERAL (
       SELECT sum(CASE WHEN l.trans_type = 'جزاءات' THEN -l.amount ELSE l.amount END) AS cost
       FROM public.job_order_ledger_view l
       WHERE l.job_order_id = jo.id
         AND l.trans_type IN ('يوميات عمالة', 'خامات مصروفة', 'مصروفات نثرية', 'جزاءات')
     ) c ON true;
