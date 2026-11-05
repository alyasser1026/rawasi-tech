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
