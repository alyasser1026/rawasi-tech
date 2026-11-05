-- Rollback 20261105170005_document_numbering_fix.sql to the original 20261105170000 function definition.
-- Blocked if any counter has reached 10000+, because the original 4-char lpad would truncate >= 10000.

BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM rawasi_private.document_counters WHERE last_number >= 9999) THEN
    RAISE EXCEPTION 'Cannot roll back document_numbering_fix while counters >= 9999 exist';
  END IF;
END;
$$;

-- TG_ARGV: [0] prefix, [1] number column, [2] date column
CREATE OR REPLACE FUNCTION rawasi_private.assign_document_number()
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

COMMIT;
