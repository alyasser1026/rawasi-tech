-- Two-way automatic synchronization between Payment Vouchers (حساب العهد 125) and Site Custodies.
-- Ensures:
-- 1. Any payment voucher debited to a custody account (125 / 125%) automatically mirrors to `site_custodies`
--    ('draft' while unposted, 'open' once posted, synced on edits, deleted/unlinked if switched away or deleted).
-- 2. Any custody created via `create_site_custody` stays cleanly linked 1:1 without duplicate creation.
-- 3. Posting, unposting, editing, and deleting protect settled custodies and posted expenses cleanly.
-- 4. Existing custody payment vouchers in `payment_vouchers` are backfilled into `site_custodies`.
-- 5. `get_site_custodies_summary` supports 'all', 'draft', 'open', 'settled', 'overdue' and returns linked voucher info & KPIs.

BEGIN;
SET LOCAL lock_timeout = '10s';

-- ============================================================================
-- 1. Schema updates: allow 'draft' status on site_custodies + 1:1 index
-- ============================================================================
ALTER TABLE public.site_custodies
  DROP CONSTRAINT IF EXISTS site_custodies_status_check;

ALTER TABLE public.site_custodies
  ADD CONSTRAINT site_custodies_status_check
  CHECK (status = ANY (ARRAY['draft'::text, 'open'::text, 'settled'::text, 'cancelled'::text]));

CREATE UNIQUE INDEX IF NOT EXISTS site_custodies_payment_voucher_uq
  ON public.site_custodies (payment_voucher_id)
  WHERE payment_voucher_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_vouchers_custody_id
  ON public.payment_vouchers (custody_id)
  WHERE custody_id IS NOT NULL;

-- ============================================================================
-- 2. Private helpers for custody account detection & 2-way sync
-- ============================================================================
CREATE OR REPLACE FUNCTION rawasi_private.is_custody_account(
  p_account_id uuid,
  p_company_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN p_account_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.accounts a
      WHERE a.id = p_account_id
        AND (p_company_id IS NULL OR a.company_id = p_company_id)
        AND a.code LIKE '125%'
    )
  END;
$function$;

CREATE OR REPLACE FUNCTION rawasi_private.derive_custody_title(
  p_voucher public.payment_vouchers,
  p_partner_name text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $function$
  SELECT COALESCE(
    NULLIF(btrim(p_voucher.description), ''),
    NULLIF(btrim(p_voucher.notes), ''),
    'عهدة ' || COALESCE(NULLIF(btrim(p_partner_name), ''), 'موقع')
      || COALESCE(' - ' || NULLIF(btrim(p_voucher.voucher_number), ''), '')
  );
$function$;

-- Update document protection trigger function so internal custody sync
-- (`rawasi.syncing_custody = '1'`) can safely maintain `payment_vouchers.custody_id`
-- without loosening posted-document immutability for any other column.
CREATE OR REPLACE FUNCTION rawasi_private.protect_claim_payment_documents()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  has_journal boolean;
  protected boolean;
  old_data jsonb;
  new_data jsonb;
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
    ELSIF TG_TABLE_NAME='payment_vouchers' AND current_setting('rawasi.syncing_custody', true) = '1' THEN
      old_data:=old_data-ARRAY['custody_id'];
      new_data:=new_data-ARRAY['custody_id'];
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
$function$;

CREATE OR REPLACE FUNCTION rawasi_private.sync_custody_for_voucher(
  p_voucher_id uuid,
  p_old_custody_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_voucher public.payment_vouchers%ROWTYPE;
  v_cust public.site_custodies%ROWTYPE;
  v_is_custody boolean;
  v_existing_custody_id uuid;
  v_custody_id uuid;
  v_partner_name text;
  v_project_id uuid;
  v_is_posted boolean;
  v_desired_status text;
  v_title text;
  v_has_expenses boolean;
  v_has_posted_expenses boolean;
  v_amount numeric;
  v_spent numeric;
  v_prev_sync text;
BEGIN
  IF p_voucher_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_voucher
  FROM public.payment_vouchers
  WHERE id = p_voucher_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_is_custody := rawasi_private.is_custody_account(v_voucher.debit_account_id, v_voucher.company_id);

  -- Locate existing linked custody either by payment_voucher_id, current custody_id, or prior custody_id
  SELECT id INTO v_existing_custody_id
  FROM public.site_custodies sc
  WHERE sc.payment_voucher_id = v_voucher.id
     OR sc.id = v_voucher.custody_id
     OR (p_old_custody_id IS NOT NULL AND sc.id = p_old_custody_id)
  ORDER BY (sc.payment_voucher_id = v_voucher.id) DESC, sc.created_at ASC
  LIMIT 1;

  v_prev_sync := current_setting('rawasi.syncing_custody', true);

  IF NOT v_is_custody THEN
    IF v_existing_custody_id IS NOT NULL THEN
      SELECT * INTO v_cust
      FROM public.site_custodies
      WHERE id = v_existing_custody_id
      FOR UPDATE;

      IF FOUND THEN
        SELECT EXISTS (
          SELECT 1 FROM public.expenses e
          WHERE e.custody_id = v_cust.id AND e.company_id = v_cust.company_id
        ) INTO v_has_expenses;

        IF v_cust.status = 'settled' OR v_has_expenses THEN
          RAISE EXCEPTION 'لا يمكن تغيير الحساب المدين عن العهدة (%) لوجود مصروفات أو تسوية مرتبطة بها', v_cust.custody_number
            USING ERRCODE = '23514';
        END IF;

        IF EXISTS (
          SELECT 1 FROM public.payment_vouchers pv
          WHERE pv.id <> v_voucher.id AND pv.custody_id = v_cust.id
        ) THEN
          RAISE EXCEPTION 'العهدة (%) مرتبطة بسند صرف آخر ولا يمكن إزالتها تلقائياً', v_cust.custody_number
            USING ERRCODE = '23514';
        END IF;

        PERFORM set_config('rawasi.syncing_custody', '1', true);
        UPDATE public.payment_vouchers
        SET custody_id = NULL
        WHERE id = v_voucher.id AND custody_id IS NOT NULL;

        DELETE FROM public.site_custodies
        WHERE id = v_cust.id;
        PERFORM set_config('rawasi.syncing_custody', COALESCE(v_prev_sync, ''), true);
      END IF;
    END IF;
    RETURN NULL;
  END IF;

  -- Debit account is a custody account (125%)
  IF v_voucher.partner_id IS NULL THEN
    RAISE EXCEPTION 'يلزم تحديد المستفيد (المهندس / الموظف صاحب العهدة) عند توجيه سند الصرف لحساب العُهد'
      USING ERRCODE = '23514';
  END IF;

  SELECT p.name INTO v_partner_name
  FROM public.partners p
  WHERE p.id = v_voucher.partner_id
    AND p.company_id = v_voucher.company_id;

  IF v_partner_name IS NULL THEN
    RAISE EXCEPTION 'الشريك المحدد كصاحب عهدة غير موجود في الشركة' USING ERRCODE = '23503';
  END IF;

  v_project_id := NULL;
  IF v_voucher.project_ids IS NOT NULL AND array_length(v_voucher.project_ids, 1) > 0 THEN
    v_project_id := v_voucher.project_ids[1];
  END IF;

  v_is_posted := COALESCE(v_voucher.is_posted, false)
                 OR COALESCE(v_voucher.status IN ('posted', 'مرحل', 'معتمد'), false);
  v_desired_status := CASE WHEN v_is_posted THEN 'open' ELSE 'draft' END;
  v_amount := round(COALESCE(v_voucher.amount, 0), 2);
  v_title := rawasi_private.derive_custody_title(v_voucher, v_partner_name);

  IF v_existing_custody_id IS NOT NULL THEN
    SELECT * INTO v_cust
    FROM public.site_custodies
    WHERE id = v_existing_custody_id
    FOR UPDATE;

    v_spent := COALESCE(v_cust.spent_amount, 0);

    IF v_cust.status = 'settled' THEN
      IF v_desired_status = 'draft' THEN
        RAISE EXCEPTION 'لا يمكن فك ترحيل سند الصرف لأن العهدة (%) تمت تسويتها؛ ألغِ التسوية أولاً', v_cust.custody_number
          USING ERRCODE = '23514';
      END IF;
      IF v_amount IS DISTINCT FROM v_cust.disbursed_amount
         OR v_voucher.partner_id IS DISTINCT FROM v_cust.partner_id THEN
        RAISE EXCEPTION 'لا يمكن تعديل مبلغ أو صاحب عهدة تمت تسويتها (%)', v_cust.custody_number
          USING ERRCODE = '23514';
      END IF;
    END IF;

    IF v_desired_status = 'draft' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.expenses e
        WHERE e.custody_id = v_cust.id
          AND e.company_id = v_cust.company_id
          AND COALESCE(e.is_posted, false) = true
      ) INTO v_has_posted_expenses;

      IF v_has_posted_expenses THEN
        RAISE EXCEPTION 'لا يمكن إرجاع العهدة (%) إلى مسودة لوجود مصروفات مرحلة عليها؛ فك ترحيل المصروفات أولاً', v_cust.custody_number
          USING ERRCODE = '23514';
      END IF;
    END IF;

    IF v_amount < v_spent THEN
      RAISE EXCEPTION 'مبلغ سند الصرف (%) أقل من إجمالي المصروفات المسجلة على العهدة (%)', v_amount, v_spent
        USING ERRCODE = '23514';
    END IF;

    PERFORM set_config('rawasi.syncing_custody', '1', true);
    UPDATE public.site_custodies
    SET partner_id = v_voucher.partner_id,
        project_id = v_project_id,
        title = CASE
          WHEN NULLIF(btrim(v_voucher.description), '') IS NOT NULL
            AND v_voucher.description NOT LIKE 'صرف عهدة للمهندس: %' THEN btrim(v_voucher.description)
          ELSE COALESCE(NULLIF(btrim(v_cust.title), ''), v_title)
        END,
        opened_date = COALESCE(v_voucher.date, v_cust.opened_date),
        disbursed_amount = v_amount,
        remaining_amount = CASE
          WHEN v_cust.status = 'settled' THEN 0
          ELSE GREATEST(0, round(v_amount - v_spent, 2))
        END,
        status = CASE
          WHEN v_cust.status IN ('settled', 'cancelled') THEN v_cust.status
          ELSE v_desired_status
        END,
        notes = COALESCE(v_voucher.notes, v_cust.notes),
        payment_voucher_id = v_voucher.id
    WHERE id = v_cust.id;

    v_custody_id := v_cust.id;
  ELSE
    PERFORM set_config('rawasi.syncing_custody', '1', true);
    INSERT INTO public.site_custodies (
      company_id, partner_id, project_id, title, opened_date,
      disbursed_amount, spent_amount, remaining_amount, max_days,
      status, notes, payment_voucher_id
    ) VALUES (
      v_voucher.company_id,
      v_voucher.partner_id,
      v_project_id,
      v_title,
      COALESCE(v_voucher.date, CURRENT_DATE),
      v_amount,
      0,
      v_amount,
      30,
      v_desired_status,
      v_voucher.notes,
      v_voucher.id
    ) RETURNING id INTO v_custody_id;
  END IF;

  IF v_voucher.custody_id IS DISTINCT FROM v_custody_id THEN
    UPDATE public.payment_vouchers
    SET custody_id = v_custody_id
    WHERE id = v_voucher.id;
  END IF;

  PERFORM set_config('rawasi.syncing_custody', COALESCE(v_prev_sync, ''), true);
  RETURN v_custody_id;
END;
$function$;

-- ============================================================================
-- 3. Triggers on public.payment_vouchers for automatic custody mirroring
-- ============================================================================
CREATE OR REPLACE FUNCTION rawasi_private.trg_pv_after_ins_upd_sync_custody()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_old_custody_id uuid;
BEGIN
  IF current_setting('rawasi.syncing_custody', true) = '1' THEN
    RETURN NEW;
  END IF;

  v_old_custody_id := CASE WHEN TG_OP = 'UPDATE' THEN OLD.custody_id ELSE NULL END;

  IF rawasi_private.is_custody_account(NEW.debit_account_id, NEW.company_id)
     OR NEW.custody_id IS NOT NULL
     OR v_old_custody_id IS NOT NULL THEN
    PERFORM rawasi_private.sync_custody_for_voucher(NEW.id, v_old_custody_id);
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION rawasi_private.trg_pv_before_delete_custody_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_cust public.site_custodies%ROWTYPE;
BEGIN
  IF current_setting('rawasi.syncing_custody', true) = '1' THEN
    RETURN OLD;
  END IF;

  FOR v_cust IN
    SELECT sc.*
    FROM public.site_custodies sc
    WHERE sc.id = OLD.custody_id OR sc.payment_voucher_id = OLD.id
    FOR UPDATE
  LOOP
    IF v_cust.status = 'settled' THEN
      RAISE EXCEPTION 'لا يمكن حذف سند الصرف لارتباطه بعهدة تمت تسويتها (%)', v_cust.custody_number
        USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.custody_id = v_cust.id AND e.company_id = v_cust.company_id
    ) THEN
      RAISE EXCEPTION 'لا يمكن حذف سند الصرف لوجود مصروفات مرتبطة بالعهدة (%)؛ احذف المصروفات أولاً', v_cust.custody_number
        USING ERRCODE = '23514';
    END IF;
  END LOOP;

  RETURN OLD;
END;
$function$;

CREATE OR REPLACE FUNCTION rawasi_private.trg_pv_after_delete_cleanup_custody()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF current_setting('rawasi.syncing_custody', true) = '1' THEN
    RETURN OLD;
  END IF;

  IF OLD.custody_id IS NOT NULL THEN
    DELETE FROM public.site_custodies sc
    WHERE sc.id = OLD.custody_id
      AND sc.status <> 'settled'
      AND NOT EXISTS (
        SELECT 1 FROM public.payment_vouchers pv WHERE pv.custody_id = sc.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.expenses e WHERE e.custody_id = sc.id AND e.company_id = sc.company_id
      );
  END IF;

  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS trg_zz_pv_sync_custody ON public.payment_vouchers;
CREATE TRIGGER trg_zz_pv_sync_custody
  AFTER INSERT OR UPDATE ON public.payment_vouchers
  FOR EACH ROW
  EXECUTE FUNCTION rawasi_private.trg_pv_after_ins_upd_sync_custody();

DROP TRIGGER IF EXISTS trg_aa_pv_before_delete_custody_guard ON public.payment_vouchers;
CREATE TRIGGER trg_aa_pv_before_delete_custody_guard
  BEFORE DELETE ON public.payment_vouchers
  FOR EACH ROW
  EXECUTE FUNCTION rawasi_private.trg_pv_before_delete_custody_guard();

DROP TRIGGER IF EXISTS trg_zz_pv_after_delete_cleanup_custody ON public.payment_vouchers;
CREATE TRIGGER trg_zz_pv_after_delete_cleanup_custody
  AFTER DELETE ON public.payment_vouchers
  FOR EACH ROW
  EXECUTE FUNCTION rawasi_private.trg_pv_after_delete_cleanup_custody();

-- ============================================================================
-- 4. Update bulk RPCs & create_site_custody to guarantee atomic custody sync
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_site_custody(
  p_partner_id uuid,
  p_project_id uuid,
  p_title text,
  p_amount numeric,
  p_safe_acc_id uuid,
  p_payment_method text DEFAULT 'نقدي'::text,
  p_notes text DEFAULT NULL::text,
  p_max_days integer DEFAULT 30
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_company uuid;
  v_custody_id uuid;
  v_acc_125 uuid;
  v_pv_id uuid;
  v_header_id uuid;
  v_partner_name text;
  v_voucher_number text;
  v_prev_sync text;
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

  SELECT name INTO v_partner_name FROM public.partners WHERE id = p_partner_id AND company_id = v_company;
  IF v_partner_name IS NULL THEN
    RAISE EXCEPTION 'الشريك المحدد غير موجود في الشركة' USING ERRCODE = '23503';
  END IF;

  v_acc_125 := rawasi_private.require_company_account('125');

  IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE id = p_safe_acc_id AND company_id = v_company) THEN
    RAISE EXCEPTION 'حساب الخزينة/البنك المحدد غير موجود في الشركة' USING ERRCODE = '23503';
  END IF;

  v_prev_sync := current_setting('rawasi.syncing_custody', true);
  PERFORM set_config('rawasi.syncing_custody', '1', true);

  INSERT INTO public.site_custodies (
    company_id, partner_id, project_id, title, opened_date,
    disbursed_amount, spent_amount, remaining_amount, max_days,
    status, notes
  ) VALUES (
    v_company, p_partner_id, p_project_id, btrim(p_title), CURRENT_DATE,
    round(p_amount, 2), 0, round(p_amount, 2), coalesce(p_max_days, 30),
    'open', p_notes
  ) RETURNING id INTO v_custody_id;

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

  INSERT INTO public.journal_headers (
    company_id, entry_date, description, reference_id, v_type, status
  ) VALUES (
    v_company, CURRENT_DATE, 'صرف عهدة رقم ' || v_voucher_number || ' - ' || v_partner_name,
    v_pv_id, 'payment_vouchers', 'posted'
  ) RETURNING id INTO v_header_id;

  INSERT INTO public.journal_lines (
    company_id, header_id, account_id, partner_id, project_id, debit, credit, notes
  ) VALUES (
    v_company, v_header_id, v_acc_125, p_partner_id, p_project_id, round(p_amount, 2), 0,
    'إثبات صرف عهدة: ' || btrim(p_title)
  );

  INSERT INTO public.journal_lines (
    company_id, header_id, account_id, partner_id, project_id, debit, credit, notes
  ) VALUES (
    v_company, v_header_id, p_safe_acc_id, NULL, p_project_id, 0, round(p_amount, 2),
    'صرف نقدية عهدة - سند صرف ' || v_voucher_number
  );

  UPDATE public.payment_vouchers
  SET is_posted = true, status = 'معتمد'
  WHERE id = v_pv_id;

  UPDATE public.site_custodies
  SET payment_voucher_id = v_pv_id
  WHERE id = v_custody_id;

  PERFORM set_config('rawasi.syncing_custody', COALESCE(v_prev_sync, ''), true);
  RETURN v_custody_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.post_payment_vouchers_bulk(p_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
    v_rec RECORD;
    v_header_id uuid;
    v_full_description TEXT;
    v_project_id uuid;
BEGIN
    FOR v_rec IN 
        SELECT * FROM public.payment_vouchers 
        WHERE id = ANY(p_ids) AND (is_posted = false OR is_posted IS NULL) 
        ORDER BY date ASC, created_at ASC
    LOOP
        IF rawasi_private.is_custody_account(v_rec.debit_account_id, v_rec.company_id) AND v_rec.partner_id IS NULL THEN
            RAISE EXCEPTION 'يلزم تحديد المستفيد (المهندس / الموظف صاحب العهدة) قبل ترحيل سند العهدة %', v_rec.voucher_number
              USING ERRCODE = '23514';
        END IF;

        v_full_description := 'سند صرف رقم: ' || v_rec.voucher_number;
        
        IF v_rec.reference_no IS NOT NULL AND TRIM(v_rec.reference_no) <> '' THEN
            v_full_description := v_full_description || ' - فاتورة/مرجع: ' || v_rec.reference_no;
        END IF;

        IF v_rec.description IS NOT NULL AND TRIM(v_rec.description) <> '' THEN
            v_full_description := v_full_description || ' - بيان: ' || v_rec.description;
        END IF;

        v_project_id := NULL;
        IF v_rec.project_ids IS NOT NULL AND array_length(v_rec.project_ids, 1) > 0 THEN
            v_project_id := v_rec.project_ids[1];
        END IF;

        INSERT INTO public.journal_headers (reference_id, entry_date, description, v_type, status, company_id)
        VALUES (v_rec.id, v_rec.date, v_full_description, 'payment_vouchers', 'posted', v_rec.company_id)
        RETURNING id INTO v_header_id;

        INSERT INTO public.journal_lines (header_id, account_id, partner_id, project_id, job_order_id, debit, credit, notes, company_id)
        VALUES (v_header_id, v_rec.debit_account_id, v_rec.partner_id, v_project_id, v_rec.job_order_id, v_rec.amount, 0, v_full_description, v_rec.company_id);

        INSERT INTO public.journal_lines (header_id, account_id, partner_id, project_id, job_order_id, debit, credit, notes, company_id)
        VALUES (v_header_id, v_rec.credit_account_id, NULL, v_project_id, v_rec.job_order_id, 0, v_rec.amount, v_full_description, v_rec.company_id);

        -- Update activates `trg_zz_pv_sync_custody`, promoting/creating the mirrored `site_custodies` row as 'open'
        UPDATE public.payment_vouchers SET is_posted = true, status = 'معتمد' WHERE id = v_rec.id;
    END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION rawasi_private.assert_custody_allows_unpost(
  p_voucher_id uuid,
  p_custody_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_cust public.site_custodies%ROWTYPE;
BEGIN
  FOR v_cust IN
    SELECT sc.* FROM public.site_custodies sc
    WHERE sc.id = p_custody_id OR sc.payment_voucher_id = p_voucher_id
    FOR UPDATE
  LOOP
    IF v_cust.status = 'settled' THEN
      RAISE EXCEPTION 'لا يمكن فك ترحيل سند الصرف لأن العهدة (%) تمت تسويتها؛ ألغِ التسوية أولاً', v_cust.custody_number
        USING ERRCODE='23514';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.custody_id = v_cust.id AND e.company_id = v_cust.company_id AND COALESCE(e.is_posted,false)=true
    ) THEN
      RAISE EXCEPTION 'لا يمكن فك ترحيل سند الصرف لوجود مصروفات مرحلة على العهدة (%)؛ فك ترحيل المصروفات أولاً', v_cust.custody_number
        USING ERRCODE='23514';
    END IF;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION rawasi_private.collect_and_guard_custodies_for_pv_delete(
  p_voucher_id uuid,
  p_custody_id uuid DEFAULT NULL
)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_cust public.site_custodies%ROWTYPE;
  v_cust_ids uuid[] := '{}'::uuid[];
BEGIN
  FOR v_cust IN
    SELECT sc.* FROM public.site_custodies sc
    WHERE sc.id = p_custody_id OR sc.payment_voucher_id = p_voucher_id
    FOR UPDATE
  LOOP
    IF v_cust.status = 'settled' THEN
      RAISE EXCEPTION 'لا يمكن حذف سند الصرف لارتباطه بعهدة تمت تسويتها (%)', v_cust.custody_number
        USING ERRCODE='23514';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.custody_id = v_cust.id AND e.company_id = v_cust.company_id
    ) THEN
      RAISE EXCEPTION 'لا يمكن حذف سند الصرف لوجود مصروفات مرتبطة بالعهدة (%)؛ احذف المصروفات أولاً', v_cust.custody_number
        USING ERRCODE='23514';
    END IF;
    v_cust_ids := array_append(v_cust_ids, v_cust.id);
  END LOOP;
  RETURN v_cust_ids;
END;
$function$;

CREATE OR REPLACE FUNCTION rawasi_private.delete_unreferenced_custodies(p_custody_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF COALESCE(cardinality(p_custody_ids), 0) = 0 THEN
    RETURN;
  END IF;
  DELETE FROM public.site_custodies sc
  WHERE sc.id = ANY(p_custody_ids)
    AND sc.status <> 'settled'
    AND NOT EXISTS (SELECT 1 FROM public.payment_vouchers pv WHERE pv.custody_id = sc.id)
    AND NOT EXISTS (SELECT 1 FROM public.expenses e WHERE e.custody_id = sc.id AND e.company_id = sc.company_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.unpost_payment_vouchers_bulk(p_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  target uuid;
  voucher public.payment_vouchers%ROWTYPE;
  claims uuid[];
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
    PERFORM rawasi_private.assert_custody_allows_unpost(voucher.id, voucher.custody_id);
    DELETE FROM public.journal_headers WHERE reference_id=target AND v_type='payment_vouchers';
    -- Trigger syncs linked custody back to 'draft'
    UPDATE public.payment_vouchers SET is_posted=false,status='مسودة' WHERE id=target;
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
$function$;

CREATE OR REPLACE FUNCTION public.delete_payment_vouchers_bulk(p_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  target uuid;
  voucher public.payment_vouchers%ROWTYPE;
  v_cust_ids uuid[];
  v_prev_sync text;
BEGIN
  IF COALESCE(cardinality(p_ids),0)=0 OR array_position(p_ids,NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'حدد سندات صحيحة للحذف' USING ERRCODE='23514'; END IF;
  IF NOT rawasi_private.can_access('payments','view') OR NOT rawasi_private.can_access('payments','edit')
    OR NOT rawasi_private.can_access('payments','delete') OR NOT rawasi_private.can_access('journal','view') THEN
    RAISE EXCEPTION 'لا توجد صلاحية حذف السندات والتحقق من قيودها' USING ERRCODE='42501'; END IF;
  v_prev_sync := current_setting('rawasi.syncing_custody', true);
  FOR target IN SELECT DISTINCT id FROM unnest(p_ids) AS ids(id) ORDER BY id LOOP
    SELECT * INTO voucher FROM public.payment_vouchers WHERE id=target FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'أحد السندات غير موجود أو غير مسموح بعرضه' USING ERRCODE='42501'; END IF;
    IF voucher.is_posted OR voucher.status IN ('posted','مرحل','معتمد')
      OR EXISTS(SELECT 1 FROM public.journal_headers WHERE reference_id=target) THEN
      RAISE EXCEPTION 'يجب فك ترحيل جميع السندات قبل حذفها' USING ERRCODE='23514'; END IF;

    v_cust_ids := rawasi_private.collect_and_guard_custodies_for_pv_delete(voucher.id, voucher.custody_id);

    PERFORM set_config('rawasi.syncing_custody', '1', true);
    -- Explicit, user-selected draft deletion; direct linked-voucher deletes fail.
    UPDATE public.payment_vouchers
    SET sub_claim_id = NULL,
        custody_id = NULL
    WHERE id = target
      AND (sub_claim_id IS NOT NULL OR custody_id IS NOT NULL);

    DELETE FROM public.payment_vouchers WHERE id=target;
    IF NOT FOUND THEN
      PERFORM set_config('rawasi.syncing_custody', COALESCE(v_prev_sync, ''), true);
      RAISE EXCEPTION 'تعذر حذف السند؛ راجع الصلاحيات' USING ERRCODE='42501';
    END IF;

    PERFORM rawasi_private.delete_unreferenced_custodies(v_cust_ids);
    PERFORM set_config('rawasi.syncing_custody', COALESCE(v_prev_sync, ''), true);
  END LOOP;
END;
$function$;

-- ============================================================================
-- 5. Update `get_site_custodies_summary` to fix 'all'/'overdue', add 'draft',
--    expose linked `payment_voucher_id`/`voucher_number`, and provide consistent KPIs.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_site_custodies_summary(p_status text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE
  v_company uuid;
  v_result jsonb;
BEGIN
  v_company := rawasi_private.current_company_id();
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'لم يتم تحديد الشركة الحالية' USING ERRCODE = '42501';
  END IF;

  WITH all_custodies AS (
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
      sc.settlement_reference_id,
      sc.settlement_notes,
      sc.payment_voucher_id,
      pv.voucher_number,
      pv.status AS voucher_status,
      coalesce(pv.is_posted, false) AS voucher_is_posted,
      sc.created_at,
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
            'vat_amount', coalesce(e.vat_amount, 0),
            'payment_method', coalesce(e.payment_method, 'عهدة'),
            'invoice_image', e.invoice_image,
            'is_posted', e.is_posted
          ) ORDER BY e.exp_date DESC
        ), '[]'::jsonb)
        FROM public.expenses e
        WHERE e.custody_id = sc.id AND e.company_id = sc.company_id
      ) AS expenses
    FROM public.site_custodies sc
    JOIN public.partners p ON p.id = sc.partner_id AND p.company_id = sc.company_id
    LEFT JOIN public.projects pr ON pr.id = sc.project_id AND pr.company_id = sc.company_id
    LEFT JOIN public.payment_vouchers pv ON pv.id = sc.payment_voucher_id AND pv.company_id = sc.company_id
    WHERE sc.company_id = v_company
  ),
  filtered_custodies AS (
    SELECT *
    FROM all_custodies ac
    WHERE p_status IS NULL
       OR p_status = ''
       OR p_status = 'all'
       OR (p_status = 'overdue' AND ac.is_overdue IS TRUE)
       OR (p_status <> 'overdue' AND ac.status = p_status)
    ORDER BY ac.opened_date DESC, ac.created_at DESC
  ),
  kpi_agg AS (
    SELECT
      count(*) FILTER (WHERE status <> 'cancelled')::int AS total_custodies,
      count(*) FILTER (WHERE status = 'open')::int AS open_custodies,
      count(*) FILTER (WHERE status = 'open')::int AS active_custodies,
      count(*) FILTER (WHERE status = 'settled')::int AS settled_custodies,
      count(*) FILTER (WHERE status = 'draft')::int AS draft_custodies,
      count(*) FILTER (WHERE is_overdue IS TRUE)::int AS overdue_custodies,
      coalesce(sum(disbursed_amount) FILTER (WHERE status IN ('open', 'settled')), 0) AS total_disbursed,
      coalesce(sum(spent_amount) FILTER (WHERE status IN ('open', 'settled')), 0) AS total_spent,
      coalesce(sum(remaining_amount) FILTER (WHERE status = 'open'), 0) AS total_remaining,
      coalesce(sum(disbursed_amount) FILTER (WHERE status = 'open'), 0) AS total_active_disbursed,
      coalesce(sum(spent_amount) FILTER (WHERE status = 'open'), 0) AS total_active_spent,
      coalesce(sum(remaining_amount) FILTER (WHERE status = 'open'), 0) AS total_active_remaining,
      coalesce(sum(remaining_amount) FILTER (WHERE is_overdue IS TRUE), 0) AS total_overdue_amount
    FROM all_custodies
  )
  SELECT jsonb_build_object(
    'kpis', to_jsonb(k),
    'custodies', coalesce((SELECT jsonb_agg(to_jsonb(c)) FROM filtered_custodies c), '[]'::jsonb)
  ) INTO v_result
  FROM kpi_agg k;

  RETURN v_result;
END;
$function$;

-- ============================================================================
-- 6. Backfill any existing custody payment vouchers (125%) not yet mirrored
-- ============================================================================
DO $$
DECLARE
  v_pv RECORD;
BEGIN
  FOR v_pv IN
    SELECT pv.id
    FROM public.payment_vouchers pv
    WHERE rawasi_private.is_custody_account(pv.debit_account_id, pv.company_id)
      AND pv.partner_id IS NOT NULL
      AND (
        pv.custody_id IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM public.site_custodies sc
          WHERE sc.id = pv.custody_id OR sc.payment_voucher_id = pv.id
        )
      )
    ORDER BY pv.date ASC, pv.created_at ASC
  LOOP
    PERFORM rawasi_private.sync_custody_for_voucher(v_pv.id, NULL);
  END LOOP;
END;
$$;

COMMIT;
