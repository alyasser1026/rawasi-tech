-- Phase 4: preserve financial source documents and make destructive actions atomic.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

ALTER TABLE public.payment_vouchers DROP CONSTRAINT payment_vouchers_sub_claim_id_fkey;
ALTER TABLE public.payment_vouchers ADD CONSTRAINT payment_vouchers_sub_claim_id_fkey
  FOREIGN KEY(sub_claim_id) REFERENCES public.sub_claims(id) ON DELETE RESTRICT;
CREATE INDEX payment_vouchers_sub_claim_id_idx ON public.payment_vouchers(sub_claim_id);

CREATE FUNCTION rawasi_private.protect_claim_payment_documents()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE has_journal boolean; protected boolean; old_data jsonb; new_data jsonb;
BEGIN
  IF auth.uid() IS NULL AND current_setting('role',true) IN ('anon','authenticated') THEN
    RAISE EXCEPTION 'يلزم تسجيل الدخول لتعديل المستند' USING ERRCODE='42501';
  END IF;
  IF TG_OP='UPDATE' AND NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'لا يمكن تغيير معرّف المستند' USING ERRCODE='23514';
  END IF;
  SELECT EXISTS(SELECT 1 FROM public.journal_headers WHERE reference_id=OLD.id
    OR (TG_TABLE_NAME='sub_claims' AND id IN (
      (to_jsonb(OLD)->>'jv_header_id')::uuid,(to_jsonb(OLD)->>'jv_id')::uuid))) INTO has_journal;
  protected:=COALESCE(OLD.is_posted,false) OR COALESCE(OLD.status IN ('posted','مرحل','معتمد'),false) OR has_journal;
  IF TG_OP='DELETE' THEN
    IF protected THEN
      RAISE EXCEPTION 'لا يمكن حذف مستند مرحل أو مرتبط بقيد؛ يجب فك الترحيل أولاً' USING ERRCODE='23514';
    END IF;
    IF TG_TABLE_NAME='sub_claims' THEN
      IF EXISTS(SELECT 1 FROM public.payment_vouchers WHERE sub_claim_id=OLD.id) THEN
        RAISE EXCEPTION 'لا يمكن حذف مستخلص مرتبط بسندات صرف؛ احتفظ بالسندات وعالج ارتباطها أولاً' USING ERRCODE='23503';
      END IF;
      IF EXISTS(SELECT 1 FROM public.contractor_assignments WHERE claim_id=OLD.id)
        OR EXISTS(SELECT 1 FROM public.material_issue_lines WHERE claim_id=OLD.id)
        OR EXISTS(SELECT 1 FROM public.material_issues WHERE claim_id=OLD.id)
        OR EXISTS(SELECT 1 FROM public.expenses WHERE claim_id=OLD.id) THEN
        RAISE EXCEPTION 'يلزم حذف المستخلص بالعملية المخصصة مع صلاحية تحرير الأعمال والخامات والمصروفات' USING ERRCODE='42501';
      END IF;
    ELSIF OLD.sub_claim_id IS NOT NULL THEN
      -- Older clients must not silently erase claim-linked vouchers by description.
      RAISE EXCEPTION 'احذف سند المسودة من عملية حذف السندات المخصصة لحماية ارتباط المستخلص' USING ERRCODE='23514';
    END IF;
    RETURN OLD;
  END IF;
  IF protected THEN
    old_data:=to_jsonb(OLD)-ARRAY['status','is_posted','updated_at'];
    new_data:=to_jsonb(NEW)-ARRAY['status','is_posted','updated_at'];
    IF TG_TABLE_NAME='sub_claims' THEN
      old_data:=old_data-ARRAY['jv_header_id','jv_id','paid_amount'];
      new_data:=new_data-ARRAY['jv_header_id','jv_id','paid_amount'];
    END IF;
    IF new_data IS DISTINCT FROM old_data THEN
      RAISE EXCEPTION 'لا يمكن تعديل بيانات مستند مرحل؛ يجب فك الترحيل أولاً' USING ERRCODE='23514';
    END IF;
    IF NOT COALESCE(NEW.is_posted,false) AND NOT COALESCE(NEW.status IN ('posted','مرحل','معتمد'),false) AND has_journal THEN
      RAISE EXCEPTION 'استخدم عملية فك الترحيل لإزالة القيد وإعادة الحالة معاً' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION rawasi_private.protect_claim_payment_documents() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER trg_protect_claim_document BEFORE UPDATE OR DELETE ON public.sub_claims
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.protect_claim_payment_documents();
CREATE TRIGGER trg_protect_payment_document BEFORE UPDATE OR DELETE ON public.payment_vouchers
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.protect_claim_payment_documents();

-- Journal creation and deletion of its source serialize on the same source row.
CREATE FUNCTION rawasi_private.lock_claim_payment_journal_source()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE linked_claim uuid;
BEGIN
  IF auth.uid() IS NULL AND current_setting('role',true) IN ('anon','authenticated') THEN
    RAISE EXCEPTION 'يلزم تسجيل الدخول لترحيل المستند' USING ERRCODE='42501';
  END IF;
  IF NEW.reference_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.v_type='payment_vouchers' THEN
    SELECT sub_claim_id INTO linked_claim FROM public.payment_vouchers WHERE id=NEW.reference_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'سند الصرف غير موجود' USING ERRCODE='23503'; END IF;
    IF linked_claim IS NOT NULL THEN
      PERFORM 1 FROM public.sub_claims WHERE id=linked_claim
        AND (is_posted OR status IN ('posted','مرحل','معتمد')) FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'يجب ترحيل المستخلص قبل ترحيل سند صرفه' USING ERRCODE='23514'; END IF;
    END IF;
  ELSIF NEW.v_type IN ('مستخلص','sub_claims') THEN
    PERFORM 1 FROM public.sub_claims WHERE id=NEW.reference_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'المستخلص غير موجود' USING ERRCODE='23503'; END IF;
  END IF;
  IF NEW.v_type IN ('payment_vouchers','مستخلص','sub_claims') AND EXISTS(
    SELECT 1 FROM public.journal_headers WHERE reference_id=NEW.reference_id AND id<>NEW.id
  ) THEN RAISE EXCEPTION 'المستند له قيد بالفعل؛ فك الترحيل قبل إعادة ترحيله' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION rawasi_private.lock_claim_payment_journal_source() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER trg_lock_claim_payment_source BEFORE INSERT OR UPDATE OF reference_id,v_type ON public.journal_headers
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.lock_claim_payment_journal_source();

CREATE OR REPLACE FUNCTION public.rpc_unpost_claim(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
DECLARE claim public.sub_claims%ROWTYPE; headers uuid[];
BEGIN
  SELECT * INTO claim FROM public.sub_claims WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'المستخلص غير موجود أو غير مسموح بعرضه' USING ERRCODE='42501'; END IF;
  IF NOT rawasi_private.can_access('subclaims','edit') THEN RAISE EXCEPTION 'لا توجد صلاحية فك ترحيل المستخلص' USING ERRCODE='42501'; END IF;
  IF EXISTS(SELECT 1 FROM public.payment_vouchers p WHERE p.sub_claim_id=p_id AND
    (p.is_posted OR p.status IN ('posted','مرحل','معتمد') OR EXISTS(SELECT 1 FROM public.journal_headers h WHERE h.reference_id=p.id))) THEN
    RAISE EXCEPTION 'فك ترحيل سندات صرف المستخلص أولاً؛ لن يتم حذف أي سند' USING ERRCODE='23514';
  END IF;
  -- Deny incomplete cleanup when the caller cannot see related vouchers/journals.
  IF NOT rawasi_private.can_access('payments','view') OR NOT rawasi_private.can_access('journal','view')
    OR NOT rawasi_private.can_access('journal','delete') THEN
    RAISE EXCEPTION 'يلزم عرض سندات الصرف وصلاحية عرض وحذف قيود اليومية لفك الترحيل' USING ERRCODE='42501';
  END IF;
  SELECT array_agg(id) INTO headers FROM public.journal_headers
    WHERE reference_id=p_id OR id IN (claim.jv_header_id,claim.jv_id);
  UPDATE public.sub_claims SET jv_header_id=NULL,jv_id=NULL WHERE id=p_id;
  DELETE FROM public.journal_headers WHERE id=ANY(headers);
  UPDATE public.sub_claims SET is_posted=false,status='مسودة' WHERE id=p_id;
  -- Assignments, deductions, voucher links and recorded paid_amount are retained.
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_delete_claim(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
DECLARE claim public.sub_claims%ROWTYPE;
BEGIN
  SELECT * INTO claim FROM public.sub_claims WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'المستخلص غير موجود أو غير مسموح بعرضه' USING ERRCODE='42501'; END IF;
  IF NOT rawasi_private.can_access('subclaims','delete') THEN RAISE EXCEPTION 'لا توجد صلاحية حذف المستخلص' USING ERRCODE='42501'; END IF;
  IF claim.is_posted OR claim.status IN ('posted','مرحل','معتمد') OR claim.jv_header_id IS NOT NULL OR claim.jv_id IS NOT NULL
    OR EXISTS(SELECT 1 FROM public.journal_headers WHERE reference_id=p_id) THEN
    RAISE EXCEPTION 'يجب فك ترحيل المستخلص قبل حذفه' USING ERRCODE='23514';
  END IF;
  IF NOT rawasi_private.can_access('payments','view') OR NOT rawasi_private.can_access('journal','view') THEN
    RAISE EXCEPTION 'يلزم عرض سندات الصرف وقيود اليومية للتحقق من الحذف' USING ERRCODE='42501';
  END IF;
  IF EXISTS(SELECT 1 FROM public.payment_vouchers WHERE sub_claim_id=p_id) THEN
    RAISE EXCEPTION 'المستخلص مرتبط بسندات صرف؛ لن يتم حذفها أو فك ارتباطها تلقائياً' USING ERRCODE='23503';
  END IF;
  UPDATE public.contractor_assignments SET status='جاري التنفيذ',claim_id=NULL WHERE claim_id=p_id;
  UPDATE public.material_issue_lines SET claim_id=NULL WHERE claim_id=p_id;
  UPDATE public.material_issues SET claim_id=NULL WHERE claim_id=p_id;
  UPDATE public.expenses SET is_deducted_in_claim=false,claim_id=NULL WHERE claim_id=p_id;
  DELETE FROM public.sub_claims WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'تعذر حذف المستخلص؛ راجع الصلاحيات' USING ERRCODE='42501'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_sub_claim(p_id uuid)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $$ SELECT public.rpc_delete_claim(p_id); $$;

CREATE OR REPLACE FUNCTION public.delete_payment_vouchers_bulk(p_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
DECLARE target uuid; voucher public.payment_vouchers%ROWTYPE;
BEGIN
  IF COALESCE(cardinality(p_ids),0)=0 OR array_position(p_ids,NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'حدد سندات صحيحة للحذف' USING ERRCODE='23514'; END IF;
  IF NOT rawasi_private.can_access('payments','view') OR NOT rawasi_private.can_access('payments','edit')
    OR NOT rawasi_private.can_access('payments','delete') OR NOT rawasi_private.can_access('journal','view') THEN
    RAISE EXCEPTION 'لا توجد صلاحية حذف السندات والتحقق من قيودها' USING ERRCODE='42501'; END IF;
  FOR target IN SELECT DISTINCT id FROM unnest(p_ids) AS ids(id) ORDER BY id LOOP
    SELECT * INTO voucher FROM public.payment_vouchers WHERE id=target FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'أحد السندات غير موجود أو غير مسموح بعرضه' USING ERRCODE='42501'; END IF;
    IF voucher.is_posted OR voucher.status IN ('posted','مرحل','معتمد')
      OR EXISTS(SELECT 1 FROM public.journal_headers WHERE reference_id=target) THEN
      RAISE EXCEPTION 'يجب فك ترحيل جميع السندات قبل حذفها' USING ERRCODE='23514'; END IF;
    -- Explicit, user-selected draft deletion; direct linked-voucher deletes fail.
    UPDATE public.payment_vouchers SET sub_claim_id=NULL WHERE id=target AND sub_claim_id IS NOT NULL;
    DELETE FROM public.payment_vouchers WHERE id=target;
    IF NOT FOUND THEN RAISE EXCEPTION 'تعذر حذف السند؛ راجع الصلاحيات' USING ERRCODE='42501'; END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.unpost_payment_vouchers_bulk(p_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
DECLARE target uuid; voucher public.payment_vouchers%ROWTYPE; claims uuid[];
BEGIN
  IF COALESCE(cardinality(p_ids),0)=0 OR array_position(p_ids,NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'حدد سندات صحيحة لفك الترحيل' USING ERRCODE='23514'; END IF;
  IF NOT rawasi_private.can_access('payments','view') OR NOT rawasi_private.can_access('payments','edit')
    OR NOT rawasi_private.can_access('journal','view') OR NOT rawasi_private.can_access('journal','delete') THEN
    RAISE EXCEPTION 'لا توجد صلاحية فك ترحيل السندات وقيودها' USING ERRCODE='42501'; END IF;
  FOR target IN SELECT DISTINCT id FROM unnest(p_ids) AS ids(id) ORDER BY id LOOP
    SELECT * INTO voucher FROM public.payment_vouchers WHERE id=target FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'أحد السندات غير موجود أو غير مسموح بعرضه' USING ERRCODE='42501'; END IF;
    IF voucher.sub_claim_id IS NOT NULL THEN
      IF NOT rawasi_private.can_access('subclaims','view') OR NOT rawasi_private.can_access('subclaims','edit') THEN
        RAISE EXCEPTION 'يلزم تحديث رصيد المستخلص المرتبط عند فك الترحيل' USING ERRCODE='42501'; END IF;
      claims:=array_append(claims,voucher.sub_claim_id);
      PERFORM 1 FROM public.sub_claims WHERE id=voucher.sub_claim_id FOR UPDATE;
    END IF;
    DELETE FROM public.journal_headers WHERE reference_id=target AND v_type='payment_vouchers';
    UPDATE public.payment_vouchers SET is_posted=false,status='مسودة' WHERE id=target;
    -- Do not reset expense paid_amount: existing payment triggers track the
    -- preserved voucher amount independently of posting status.
  END LOOP;
  WITH amounts AS (
    SELECT c.id,COALESCE(SUM(p.amount) FILTER(WHERE p.is_posted),0) AS total
    FROM public.sub_claims c LEFT JOIN public.payment_vouchers p ON p.sub_claim_id=c.id
    WHERE c.id=ANY(claims) GROUP BY c.id
  ) UPDATE public.sub_claims c SET paid_amount=a.total,status=CASE WHEN c.is_posted THEN
    CASE WHEN a.total>=c.net_amount AND c.net_amount>0 THEN 'مدفوع'
      WHEN a.total>0 THEN 'مسدد جزئي' ELSE 'معتمد' END ELSE c.status END
    FROM amounts a WHERE c.id=a.id;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_unpost_claim(uuid),public.rpc_delete_claim(uuid),public.delete_sub_claim(uuid),
  public.delete_payment_vouchers_bulk(uuid[]),public.unpost_payment_vouchers_bulk(uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rpc_unpost_claim(uuid),public.rpc_delete_claim(uuid),public.delete_sub_claim(uuid),
  public.delete_payment_vouchers_bulk(uuid[]),public.unpost_payment_vouchers_bulk(uuid[]) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.unpost_universal_bulk(p_table_name text, p_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
    v_voucher_ids uuid[];
BEGIN
    IF p_table_name = 'payment_vouchers' THEN
        PERFORM public.unpost_payment_vouchers_bulk(p_ids);
        RETURN;
    END IF;
    -- أ. إذا كان الجدول هو المصروفات (expenses)
    IF p_table_name = 'expenses' THEN
        -- 🔎 محاولة جلب السندات المرتبطة بالمصروفات المحددة
        -- سنبحث في جدول السندات عن أي سجل يشير إلى معرف المصروف
        SELECT array_agg(id) INTO v_voucher_ids
        FROM payment_vouchers
        WHERE reference_no = ANY(p_ids::text[]) -- البحث في المرجع (كـ نص)
           OR description LIKE '%' || (SELECT id::text FROM expenses WHERE id = ANY(p_ids) LIMIT 1) || '%';

        IF v_voucher_ids IS NOT NULL THEN
            -- 1. مسح قيود اليومية المرتبطة بسندات الصرف
            DELETE FROM journal_lines WHERE header_id IN (SELECT id FROM journal_headers WHERE reference_id = ANY(v_voucher_ids));
            DELETE FROM journal_headers WHERE reference_id = ANY(v_voucher_ids);

            -- 2. مسح سندات الصرف نفسها
            DELETE FROM payment_vouchers WHERE id = ANY(v_voucher_ids);
        END IF;

        -- 3. تصفير "المبلغ المدفوع" في جدول المصروفات ليعود السجل كأنه لم يصرف
        UPDATE expenses SET paid_amount = 0 WHERE id = ANY(p_ids);
    END IF;

    -- ب. مسح قيود اليومية المرتبطة بالمصروفات نفسها (Journal Entry)
    DELETE FROM journal_lines
    WHERE header_id IN (
        SELECT id FROM journal_headers WHERE reference_id = ANY(p_ids)
    );

    DELETE FROM journal_headers
    WHERE reference_id = ANY(p_ids);

    -- ج. تحديث حالة المصروفات إلى "غير مرحل" لتمكين التعديل عليها
    EXECUTE format('UPDATE %I SET is_posted = false WHERE id = ANY($1)', p_table_name)
    USING p_ids;
END;
$function$;
NOTIFY pgrst,'reload schema';
