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
