-- Phase 3: row amounts, transaction-wide balance and posted-entry protection.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $preflight$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.journal_lines
    WHERE debit < 0 OR credit < 0
      OR debit >= 'Infinity'::numeric OR credit >= 'Infinity'::numeric
      OR (debit > 0 AND credit > 0)
  ) THEN RAISE EXCEPTION 'Existing journal lines need reconciliation before phase 3'; END IF;
  IF EXISTS (
    SELECT h.id FROM public.journal_headers h
    LEFT JOIN public.journal_lines l ON l.header_id = h.id
    WHERE h.status IN ('posted', 'مرحل', 'معتمد')
    GROUP BY h.id
    HAVING COALESCE(SUM(l.debit),0) <> COALESCE(SUM(l.credit),0)
      OR COALESCE(SUM(l.debit),0) <= 0
      OR COUNT(l.id) FILTER (WHERE l.debit > 0 OR l.credit > 0) < 2
  ) THEN RAISE EXCEPTION 'Existing posted journals need reconciliation before phase 3'; END IF;
END;
$preflight$;

ALTER TABLE public.journal_lines
  ADD CONSTRAINT journal_lines_debit_nonnegative_finite
    CHECK (debit >= 0 AND debit < 'Infinity'::numeric) NOT VALID,
  ADD CONSTRAINT journal_lines_credit_nonnegative_finite
    CHECK (credit >= 0 AND credit < 'Infinity'::numeric) NOT VALID,
  ADD CONSTRAINT journal_lines_one_sided_amount
    CHECK (debit = 0 OR credit = 0) NOT VALID;
ALTER TABLE public.journal_lines VALIDATE CONSTRAINT journal_lines_debit_nonnegative_finite;
ALTER TABLE public.journal_lines VALIDATE CONSTRAINT journal_lines_credit_nonnegative_finite;
ALTER TABLE public.journal_lines VALIDATE CONSTRAINT journal_lines_one_sided_amount;

-- Internal transaction state avoids trusting client flags or system tuple xmin.
-- Revision tracking deduplicates deferred checks while supporting SET CONSTRAINTS.
CREATE TABLE rawasi_private.journal_write_state (
  header_id uuid PRIMARY KEY REFERENCES public.journal_headers(id) ON DELETE CASCADE,
  build_xid xid8,
  revision bigint NOT NULL DEFAULT 0,
  validated_xid xid8,
  validated_revision bigint
);
ALTER TABLE rawasi_private.journal_write_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON rawasi_private.journal_write_state FROM PUBLIC, anon, authenticated, service_role;
INSERT INTO rawasi_private.journal_write_state(header_id)
  SELECT id FROM public.journal_headers;

CREATE FUNCTION rawasi_private.track_journal_write_state()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE opens_build boolean;
BEGIN
  IF auth.uid() IS NULL AND current_setting('role',true) IN ('anon','authenticated') THEN
    RAISE EXCEPTION 'يلزم تسجيل الدخول لتعديل القيود' USING ERRCODE='42501';
  END IF;
  IF TG_OP = 'INSERT' THEN opens_build := true;
  ELSE
    opens_build := COALESCE(NEW.status IN ('posted','مرحل','معتمد'),false)
      AND NOT COALESCE(OLD.status IN ('posted','مرحل','معتمد'),false);
  END IF;
  IF opens_build THEN
    INSERT INTO rawasi_private.journal_write_state AS state(header_id,build_xid,revision)
      VALUES (NEW.id,pg_current_xact_id(),1)
    ON CONFLICT(header_id) DO UPDATE
      SET build_xid=EXCLUDED.build_xid, revision=state.revision+1,
          validated_xid=NULL, validated_revision=NULL;
  ELSE
    UPDATE rawasi_private.journal_write_state
      SET revision=revision+1,validated_xid=NULL,validated_revision=NULL
      WHERE header_id=NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION rawasi_private.protect_journal_headers()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE current_build boolean;
BEGIN
  IF auth.uid() IS NULL AND current_setting('role',true) IN ('anon','authenticated') THEN
    RAISE EXCEPTION 'يلزم تسجيل الدخول لتعديل القيود' USING ERRCODE='42501';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'لا يمكن تغيير معرّف القيد' USING ERRCODE='23514';
  END IF;
  IF COALESCE(OLD.status IN ('posted','مرحل','معتمد'),false) THEN
    SELECT EXISTS(SELECT 1 FROM rawasi_private.journal_write_state
      WHERE header_id=OLD.id AND build_xid=pg_current_xact_id()) INTO current_build;
    IF current_build THEN RETURN NEW; END IF;
    IF COALESCE(NEW.status IN ('posted','مرحل','معتمد'),false) THEN
      -- A no-op must not reopen an already committed journal for line edits.
      IF NEW IS NOT DISTINCT FROM OLD THEN RETURN NULL; END IF;
      RAISE EXCEPTION 'لا يمكن تعديل قيد مرحل؛ يجب فك الترحيل أولاً' USING ERRCODE='23514';
    END IF;
    IF (to_jsonb(NEW)-'status') IS DISTINCT FROM (to_jsonb(OLD)-'status') THEN
      RAISE EXCEPTION 'فك الترحيل يغيّر الحالة فقط؛ عدّل بيانات القيد بعده' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION rawasi_private.protect_journal_lines()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE ids uuid[]; header record; current_build boolean;
BEGIN
  IF auth.uid() IS NULL AND current_setting('role',true) IN ('anon','authenticated') THEN
    RAISE EXCEPTION 'يلزم تسجيل الدخول لتعديل القيود' USING ERRCODE='42501';
  END IF;
  IF TG_OP <> 'DELETE' THEN
    IF NEW.debit IS NULL OR NEW.credit IS NULL THEN
      RAISE EXCEPTION 'يجب إدخال المدين والدائن، واستخدام صفر للطرف غير المستخدم' USING ERRCODE='23502';
    END IF;
    IF NEW.debit < 0 OR NEW.credit < 0
      OR NEW.debit >= 'Infinity'::numeric OR NEW.credit >= 'Infinity'::numeric THEN
      RAISE EXCEPTION 'مبالغ القيد يجب أن تكون أرقاماً غير سالبة ومحددة' USING ERRCODE='23514';
    END IF;
    IF NEW.debit > 0 AND NEW.credit > 0 THEN
      RAISE EXCEPTION 'سطر القيد يقبل مبلغاً في المدين أو الدائن فقط' USING ERRCODE='23514';
    END IF;
  END IF;
  IF TG_OP='INSERT' THEN ids:=ARRAY[NEW.header_id];
  ELSIF TG_OP='DELETE' THEN ids:=ARRAY[OLD.header_id];
  ELSE ids:=ARRAY[OLD.header_id,NEW.header_id]; END IF;

  -- Serialize writers to the same journal; ordered locks also cover line moves.
  FOR header IN SELECT h.id,h.status FROM public.journal_headers h
    WHERE h.id=ANY(ids) ORDER BY h.id FOR NO KEY UPDATE
  LOOP
    SELECT EXISTS(SELECT 1 FROM rawasi_private.journal_write_state
      WHERE header_id=header.id AND build_xid=pg_current_xact_id()) INTO current_build;
    IF TG_OP <> 'DELETE' AND COALESCE(header.status IN ('posted','مرحل','معتمد'),false)
      AND NOT current_build THEN
      RAISE EXCEPTION 'لا يمكن تعديل سطور قيد مرحل؛ يجب فك الترحيل أولاً' USING ERRCODE='23514';
    END IF;
    UPDATE rawasi_private.journal_write_state
      SET revision=revision+1,validated_xid=NULL,validated_revision=NULL
      WHERE header_id=header.id;
  END LOOP;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION rawasi_private.enforce_journal_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE ids uuid[]; target uuid; final_status text; state record;
  total_debit numeric; total_credit numeric; active_lines bigint;
BEGIN
  IF auth.uid() IS NULL AND current_setting('role',true) IN ('anon','authenticated') THEN
    RAISE EXCEPTION 'يلزم تسجيل الدخول لترحيل القيود' USING ERRCODE='42501';
  END IF;
  IF TG_TABLE_NAME='journal_headers' THEN ids:=ARRAY[NEW.id];
  ELSIF TG_OP='INSERT' THEN ids:=ARRAY[NEW.header_id];
  ELSIF TG_OP='DELETE' THEN ids:=ARRAY[OLD.header_id];
  ELSE ids:=ARRAY[OLD.header_id,NEW.header_id]; END IF;

  FOR target IN SELECT DISTINCT id FROM unnest(ids) AS targets(id) WHERE id IS NOT NULL ORDER BY id LOOP
    SELECT h.status INTO final_status FROM public.journal_headers h
      WHERE h.id=target FOR NO KEY UPDATE;
    IF NOT FOUND OR NOT COALESCE(final_status IN ('posted','مرحل','معتمد'),false) THEN CONTINUE; END IF;
    SELECT * INTO STRICT state FROM rawasi_private.journal_write_state
      WHERE header_id=target FOR UPDATE;
    -- Existing unposting RPCs may remove lines before removing their header.
    -- A committed posted header that remains must never lose individual lines.
    IF TG_TABLE_NAME='journal_lines' AND TG_OP='DELETE'
      AND state.build_xid IS DISTINCT FROM pg_current_xact_id() THEN
      RAISE EXCEPTION 'لا يمكن حذف سطر من قيد مرحل؛ يجب فك الترحيل أولاً' USING ERRCODE='23514';
    END IF;
    IF state.validated_xid=pg_current_xact_id() AND state.validated_revision=state.revision THEN CONTINUE; END IF;
    SELECT COALESCE(SUM(l.debit),0),COALESCE(SUM(l.credit),0),
      COUNT(*) FILTER(WHERE l.debit>0 OR l.credit>0)
      INTO total_debit,total_credit,active_lines
      FROM public.journal_lines l WHERE l.header_id=target;
    IF total_debit<>total_credit THEN
      RAISE EXCEPTION 'تعذر ترحيل القيد: المدين (%) لا يساوي الدائن (%)',total_debit,total_credit USING ERRCODE='23514';
    END IF;
    IF total_debit<=0 OR active_lines<2 THEN
      RAISE EXCEPTION 'تعذر ترحيل قيد فارغ أو بلا حركة مالية' USING ERRCODE='23514';
    END IF;
    UPDATE rawasi_private.journal_write_state
      SET validated_xid=pg_current_xact_id(),validated_revision=revision
      WHERE header_id=target;
  END LOOP;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION rawasi_private.track_journal_write_state(),
  rawasi_private.enforce_journal_balance(),rawasi_private.protect_journal_headers(),
  rawasi_private.protect_journal_lines() FROM PUBLIC,anon,authenticated,service_role;

CREATE TRIGGER trg_journal_write_state
  AFTER INSERT OR UPDATE OF status ON public.journal_headers
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.track_journal_write_state();
DROP TRIGGER trg_protect_journal_lines ON public.journal_lines;
CREATE TRIGGER trg_protect_journal_lines
  BEFORE INSERT OR UPDATE OR DELETE ON public.journal_lines
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.protect_journal_lines();

CREATE CONSTRAINT TRIGGER journal_balance_headers
  AFTER INSERT OR UPDATE ON public.journal_headers
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.enforce_journal_balance();
CREATE CONSTRAINT TRIGGER journal_balance_lines
  AFTER INSERT OR UPDATE OR DELETE ON public.journal_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.enforce_journal_balance();

-- The journal editor must not delete lines in a separate HTTP transaction.
CREATE FUNCTION public.save_journal_draft(
  p_header_id uuid,p_entry_date date,p_description text,p_lines jsonb
)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE existing_status text;
BEGIN
  IF auth.uid() IS NULL AND current_setting('role',true) IN ('anon','authenticated') THEN
    RAISE EXCEPTION 'يلزم تسجيل الدخول لحفظ القيد' USING ERRCODE='42501';
  END IF;
  SELECT status INTO existing_status FROM public.journal_headers
    WHERE id=p_header_id FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'القيد غير موجود أو غير مسموح بتعديله' USING ERRCODE='42501';
  END IF;
  IF existing_status IN ('posted','مرحل','معتمد') THEN
    RAISE EXCEPTION 'يجب فك ترحيل القيد قبل تعديله' USING ERRCODE='23514';
  END IF;
  IF p_entry_date IS NULL OR p_description IS NULL OR btrim(p_description)='' THEN
    RAISE EXCEPTION 'تاريخ القيد وبيانه مطلوبان' USING ERRCODE='23514';
  END IF;
  IF p_lines IS NULL OR jsonb_typeof(p_lines)<>'array' THEN
    RAISE EXCEPTION 'سطور القيد يجب أن تكون قائمة صحيحة' USING ERRCODE='23514';
  END IF;
  UPDATE public.journal_headers SET entry_date=p_entry_date,description=p_description WHERE id=p_header_id;
  DELETE FROM public.journal_lines WHERE header_id=p_header_id;
  INSERT INTO public.journal_lines (
    id,header_id,account_id,partner_id,item_name,quantity,unit_price,debit,credit,
    notes,project_id,debit_account_id,tax_amount,tax_rate,created_at
  )
  SELECT COALESCE(r.id,gen_random_uuid()),p_header_id,r.account_id,r.partner_id,r.item_name,
    COALESCE(r.quantity,1),COALESCE(r.unit_price,0),COALESCE(r.debit,0),COALESCE(r.credit,0),
    r.notes,r.project_id,r.debit_account_id,COALESCE(r.tax_amount,0),COALESCE(r.tax_rate,0),
    COALESCE(r.created_at,now())
  FROM jsonb_to_recordset(p_lines) AS r(
    id uuid,account_id uuid,partner_id uuid,item_name varchar,quantity numeric,unit_price numeric,
    debit numeric,credit numeric,notes text,project_id uuid,debit_account_id uuid,
    tax_amount numeric,tax_rate numeric,created_at timestamptz
  );
  RETURN p_header_id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_journal_draft(uuid,date,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_journal_draft(uuid,date,text,jsonb) TO authenticated,service_role;
NOTIFY pgrst,'reload schema';
