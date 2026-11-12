-- Custody Credit Partner (السداد من حساب العُهد 125) + Full Mirror with Site Custodies
-- Ensures:
-- 1. `payment_vouchers.custody_partner_id` records the partner holding the custody when `credit_account_id` is a custody account (125%).
-- 2. Crediting a custody account (125%) posts `partner_id = custody_partner_id` to `journal_lines` credit line,
--    auto-links `payment_vouchers.custody_id` to the selected or matching open `site_custodies` record,
--    updates `site_custodies.spent_amount` and `remaining_amount` once posted (and on unpost/delete/edit),
--    and exposes `disbursement_vouchers` in `get_site_custodies_summary` & `settle_site_custody`.

BEGIN;
SET LOCAL lock_timeout = '10s';

-- ============================================================================
-- 1. Schema updates: add `custody_partner_id` on `public.payment_vouchers`
-- ============================================================================
ALTER TABLE public.payment_vouchers
  ADD COLUMN IF NOT EXISTS custody_partner_id uuid;

ALTER TABLE public.payment_vouchers
  DROP CONSTRAINT IF EXISTS payment_vouchers_custody_partner_fkey;

ALTER TABLE public.payment_vouchers
  ADD CONSTRAINT payment_vouchers_custody_partner_fkey
  FOREIGN KEY (custody_partner_id, company_id)
  REFERENCES public.partners(id, company_id)
  ON DELETE RESTRICT;

ALTER TABLE public.payment_vouchers
  DROP CONSTRAINT IF EXISTS payment_vouchers_custody_partner_id_fkey;

ALTER TABLE public.payment_vouchers
  ADD CONSTRAINT payment_vouchers_custody_partner_id_fkey
  FOREIGN KEY (custody_partner_id)
  REFERENCES public.partners(id)
  ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_payment_vouchers_custody_partner_id
  ON public.payment_vouchers (company_id, custody_partner_id)
  WHERE custody_partner_id IS NOT NULL;

-- ============================================================================
-- 2. Shared helper: recalculate `spent_amount` and `remaining_amount` from BOTH
--    posted `expenses` AND posted credit-125 `payment_vouchers`
-- ============================================================================
CREATE OR REPLACE FUNCTION rawasi_private.recalculate_custody_spent(
  p_custody_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_cust public.site_custodies%ROWTYPE;
  v_exp_spent numeric(15,2) := 0;
  v_pv_spent numeric(15,2) := 0;
  v_total_spent numeric(15,2) := 0;
BEGIN
  IF p_custody_id IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_cust
  FROM public.site_custodies
  WHERE id = p_custody_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT coalesce(sum(coalesce(e.total_price, 0) + coalesce(e.vat_amount, 0) - coalesce(e.discount_amount, 0)), 0)
  INTO v_exp_spent
  FROM public.expenses e
  WHERE e.custody_id = p_custody_id
    AND e.company_id = v_cust.company_id
    AND e.is_posted IS TRUE;

  SELECT coalesce(sum(coalesce(pv.amount, 0)), 0)
  INTO v_pv_spent
  FROM public.payment_vouchers pv
  WHERE pv.custody_id = p_custody_id
    AND pv.company_id = v_cust.company_id
    AND pv.id IS DISTINCT FROM v_cust.payment_voucher_id
    AND rawasi_private.is_custody_account(pv.credit_account_id, pv.company_id)
    AND pv.is_posted IS TRUE;

  v_total_spent := round(COALESCE(v_exp_spent, 0) + COALESCE(v_pv_spent, 0), 2);

  UPDATE public.site_custodies
  SET spent_amount = v_total_spent,
      remaining_amount = CASE
        WHEN status = 'settled' THEN 0
        ELSE round(disbursed_amount - v_total_spent, 2)
      END,
      updated_at = now()
  WHERE id = p_custody_id;
END;
$function$;

CREATE OR REPLACE FUNCTION rawasi_private.sync_custody_spent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_old_custody_id uuid;
  v_new_custody_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old_custody_id := OLD.custody_id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_custody_id := OLD.custody_id;
    v_new_custody_id := NEW.custody_id;
  ELSE
    v_new_custody_id := NEW.custody_id;
  END IF;

  IF v_new_custody_id IS NOT NULL THEN
    PERFORM rawasi_private.recalculate_custody_spent(v_new_custody_id);
  END IF;

  IF v_old_custody_id IS NOT NULL AND v_old_custody_id IS DISTINCT FROM v_new_custody_id THEN
    PERFORM rawasi_private.recalculate_custody_spent(v_old_custody_id);
  END IF;

  RETURN NULL;
END;
$function$;

-- ============================================================================
-- 3. Document protection trigger function: allow custody_id and custody_partner_id
--    to be safely maintained during internal custody sync (rawasi.syncing_custody = '1')
-- ============================================================================
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
      old_data:=old_data-ARRAY['custody_id','custody_partner_id'];
      new_data:=new_data-ARRAY['custody_id','custody_partner_id'];
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

-- ============================================================================
-- 3. Sync function & triggers supporting BOTH Debit (Issuance) & Credit (Spend)
-- ============================================================================
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
  v_is_debit_custody boolean;
  v_is_credit_custody boolean;
  v_existing_issuance_id uuid;
  v_custody_id uuid;
  v_partner_name text;
  v_project_id uuid;
  v_is_posted boolean;
  v_desired_status text;
  v_title text;
  v_has_expenses boolean;
  v_has_posted_expenses boolean;
  v_has_spend_vouchers boolean;
  v_has_posted_spend_vouchers boolean;
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

  v_is_debit_custody := rawasi_private.is_custody_account(v_voucher.debit_account_id, v_voucher.company_id);
  v_is_credit_custody := rawasi_private.is_custody_account(v_voucher.credit_account_id, v_voucher.company_id);

  IF v_is_debit_custody AND v_is_credit_custody THEN
    RAISE EXCEPTION 'لا يمكن اختيار حساب العُهد في الجانب المدين والدائن معاً في نفس السند'
      USING ERRCODE = '23514';
  END IF;

  v_is_posted := COALESCE(v_voucher.is_posted, false)
                 OR COALESCE(v_voucher.status IN ('posted', 'مرحل', 'معتمد'), false);

  v_project_id := NULL;
  IF v_voucher.project_ids IS NOT NULL AND array_length(v_voucher.project_ids, 1) > 0 THEN
    v_project_id := v_voucher.project_ids[1];
  END IF;

  v_prev_sync := current_setting('rawasi.syncing_custody', true);

  -- Locate any issuance custody owned 1:1 by this voucher (`sc.payment_voucher_id = v_voucher.id`)
  SELECT sc.id INTO v_existing_issuance_id
  FROM public.site_custodies sc
  WHERE sc.payment_voucher_id = v_voucher.id
  LIMIT 1;

  -- If this voucher is NO LONGER a Debit-125 issuance custody, remove any orphaned issuance custody
  IF NOT v_is_debit_custody AND v_existing_issuance_id IS NOT NULL THEN
    SELECT * INTO v_cust
    FROM public.site_custodies
    WHERE id = v_existing_issuance_id
    FOR UPDATE;

    IF FOUND THEN
      SELECT EXISTS (
        SELECT 1 FROM public.expenses e
        WHERE e.custody_id = v_cust.id AND e.company_id = v_cust.company_id
      ) INTO v_has_expenses;

      SELECT EXISTS (
        SELECT 1 FROM public.payment_vouchers pv
        WHERE pv.id <> v_voucher.id AND pv.custody_id = v_cust.id
      ) INTO v_has_spend_vouchers;

      IF v_cust.status = 'settled' OR v_has_expenses OR v_has_spend_vouchers THEN
        RAISE EXCEPTION 'لا يمكن تغيير الحساب المدين عن العهدة (%) لوجود حركات أو مصروفات أو تسوية مرتبطة بها', v_cust.custody_number
          USING ERRCODE = '23514';
      END IF;

      PERFORM set_config('rawasi.syncing_custody', '1', true);
      UPDATE public.payment_vouchers
      SET custody_id = NULL
      WHERE id = v_voucher.id AND custody_id = v_cust.id;

      DELETE FROM public.site_custodies WHERE id = v_cust.id;
      PERFORM set_config('rawasi.syncing_custody', COALESCE(v_prev_sync, ''), true);
    END IF;
  END IF;

  -- ==========================================================================
  -- CASE A: Debit account is Custody (125%) -> Issuing / Funding a Custody
  -- ==========================================================================
  IF v_is_debit_custody THEN
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

    -- Also check legacy link via current/old custody_id if it wasn't an issuance yet
    IF v_existing_issuance_id IS NULL AND (v_voucher.custody_id IS NOT NULL OR p_old_custody_id IS NOT NULL) THEN
      SELECT sc.id INTO v_existing_issuance_id
      FROM public.site_custodies sc
      WHERE (sc.id = v_voucher.custody_id OR (p_old_custody_id IS NOT NULL AND sc.id = p_old_custody_id))
        AND (sc.payment_voucher_id IS NULL OR sc.payment_voucher_id = v_voucher.id)
      LIMIT 1;
    END IF;

    v_desired_status := CASE WHEN v_is_posted THEN 'open' ELSE 'draft' END;
    v_amount := round(COALESCE(v_voucher.amount, 0), 2);
    v_title := rawasi_private.derive_custody_title(v_voucher, v_partner_name);

    IF v_existing_issuance_id IS NOT NULL THEN
      SELECT * INTO v_cust
      FROM public.site_custodies
      WHERE id = v_existing_issuance_id
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

        SELECT EXISTS (
          SELECT 1 FROM public.payment_vouchers pv
          WHERE pv.custody_id = v_cust.id
            AND pv.company_id = v_cust.company_id
            AND pv.id <> v_voucher.id
            AND COALESCE(pv.is_posted, false) = true
        ) INTO v_has_posted_spend_vouchers;

        IF v_has_posted_expenses OR v_has_posted_spend_vouchers THEN
          RAISE EXCEPTION 'لا يمكن إرجاع العهدة (%) إلى مسودة لوجود مصروفات أو سندات صرف مرحلة عليها؛ فك الترحيل أولاً', v_cust.custody_number
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

    PERFORM rawasi_private.recalculate_custody_spent(v_custody_id);

    IF v_voucher.custody_id IS DISTINCT FROM v_custody_id THEN
      UPDATE public.payment_vouchers
      SET custody_id = v_custody_id
      WHERE id = v_voucher.id;
    END IF;

    IF p_old_custody_id IS NOT NULL AND p_old_custody_id IS DISTINCT FROM v_custody_id THEN
      PERFORM rawasi_private.recalculate_custody_spent(p_old_custody_id);
    END IF;

    PERFORM set_config('rawasi.syncing_custody', COALESCE(v_prev_sync, ''), true);
    RETURN v_custody_id;
  END IF;

  -- ==========================================================================
  -- CASE B: Credit account is Custody (125%) -> Paying FROM Custody Holder
  -- ==========================================================================
  IF v_is_credit_custody THEN
    IF v_voucher.custody_partner_id IS NULL THEN
      -- When custody partner is unassigned (e.g. unposted/draft voucher), clear any custody link and exit cleanly
      IF v_voucher.custody_id IS NOT NULL THEN
        UPDATE public.payment_vouchers
        SET custody_id = NULL
        WHERE id = v_voucher.id;

        IF p_old_custody_id IS NOT NULL THEN
          PERFORM rawasi_private.recalculate_custody_spent(p_old_custody_id);
        END IF;
      END IF;
      PERFORM set_config('rawasi.syncing_custody', COALESCE(v_prev_sync, ''), true);
      RETURN NULL;
    END IF;

    SELECT p.name INTO v_partner_name
    FROM public.partners p
    WHERE p.id = v_voucher.custody_partner_id
      AND p.company_id = v_voucher.company_id;

    IF v_partner_name IS NULL THEN
      RAISE EXCEPTION 'الشخص المحدد كصاحب عهدة غير موجود في الشركة' USING ERRCODE = '23503';
    END IF;

    v_custody_id := NULL;

    -- Use explicitly picked custody_id if valid for this custody_partner_id
    IF v_voucher.custody_id IS NOT NULL AND v_voucher.custody_id IS DISTINCT FROM v_existing_issuance_id THEN
      SELECT * INTO v_cust
      FROM public.site_custodies
      WHERE id = v_voucher.custody_id
        AND company_id = v_voucher.company_id
        AND payment_voucher_id IS DISTINCT FROM v_voucher.id;

      IF FOUND THEN
        IF v_cust.partner_id IS DISTINCT FROM v_voucher.custody_partner_id THEN
          RAISE EXCEPTION 'العهدة المختارة (%) تخص شريكاً آخر غير الشخص المحدد في ذمته العهدة', v_cust.custody_number
            USING ERRCODE = '23514';
        END IF;
        IF v_cust.status IN ('settled', 'cancelled') THEN
          RAISE EXCEPTION 'العهدة (%) مغلقة أو تمت تسويتها ولا يمكن ربط سند صرف جديد بها', v_cust.custody_number
            USING ERRCODE = '23514';
        END IF;
        v_custody_id := v_cust.id;
      END IF;
    END IF;

    -- Auto-link to the holder's open custody when no explicit custody was picked
    IF v_custody_id IS NULL THEN
      SELECT sc.id INTO v_custody_id
      FROM public.site_custodies sc
      WHERE sc.company_id = v_voucher.company_id
        AND sc.partner_id = v_voucher.custody_partner_id
        AND sc.status = 'open'
        AND sc.payment_voucher_id IS DISTINCT FROM v_voucher.id
      ORDER BY
        (v_project_id IS NOT NULL AND sc.project_id = v_project_id) DESC,
        (sc.remaining_amount >= COALESCE(v_voucher.amount, 0)) DESC,
        (sc.remaining_amount > 0) DESC,
        sc.opened_date ASC,
        sc.created_at ASC
      LIMIT 1;
    END IF;

    PERFORM set_config('rawasi.syncing_custody', '1', true);
    IF v_voucher.custody_id IS DISTINCT FROM v_custody_id THEN
      UPDATE public.payment_vouchers
      SET custody_id = v_custody_id
      WHERE id = v_voucher.id;
    END IF;

    IF v_custody_id IS NOT NULL THEN
      PERFORM rawasi_private.recalculate_custody_spent(v_custody_id);
    END IF;

    IF p_old_custody_id IS NOT NULL AND p_old_custody_id IS DISTINCT FROM v_custody_id THEN
      PERFORM rawasi_private.recalculate_custody_spent(p_old_custody_id);
    END IF;

    PERFORM set_config('rawasi.syncing_custody', COALESCE(v_prev_sync, ''), true);
    RETURN v_custody_id;
  END IF;

  -- ==========================================================================
  -- CASE C: Neither debit nor credit is Custody (125%) -> unlink & recalculate
  -- ==========================================================================
  PERFORM set_config('rawasi.syncing_custody', '1', true);
  IF v_voucher.custody_id IS NOT NULL THEN
    UPDATE public.payment_vouchers
    SET custody_id = NULL
    WHERE id = v_voucher.id AND custody_id IS NOT NULL;
    PERFORM rawasi_private.recalculate_custody_spent(v_voucher.custody_id);
  END IF;

  IF p_old_custody_id IS NOT NULL AND p_old_custody_id IS DISTINCT FROM v_voucher.custody_id THEN
    PERFORM rawasi_private.recalculate_custody_spent(p_old_custody_id);
  END IF;

  PERFORM set_config('rawasi.syncing_custody', COALESCE(v_prev_sync, ''), true);
  RETURN NULL;
END;
$function$;

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
     OR rawasi_private.is_custody_account(NEW.credit_account_id, NEW.company_id)
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

    -- Issuance voucher (sc.payment_voucher_id = OLD.id) cannot be deleted while expenses or spend vouchers exist on it
    IF v_cust.payment_voucher_id = OLD.id THEN
      IF EXISTS (
        SELECT 1 FROM public.expenses e
        WHERE e.custody_id = v_cust.id AND e.company_id = v_cust.company_id
      ) OR EXISTS (
        SELECT 1 FROM public.payment_vouchers pv
        WHERE pv.custody_id = v_cust.id AND pv.id <> OLD.id
      ) THEN
        RAISE EXCEPTION 'لا يمكن حذف سند صرف العهدة لوجود مصروفات أو سندات صرف مرتبطة بالعهدة (%)؛ احذفها أولاً', v_cust.custody_number
          USING ERRCODE = '23514';
      END IF;
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
DECLARE
  v_cust public.site_custodies%ROWTYPE;
BEGIN
  IF current_setting('rawasi.syncing_custody', true) = '1' THEN
    RETURN OLD;
  END IF;

  IF OLD.custody_id IS NOT NULL THEN
    SELECT * INTO v_cust FROM public.site_custodies WHERE id = OLD.custody_id;
    IF FOUND THEN
      IF v_cust.payment_voucher_id = OLD.id THEN
        DELETE FROM public.site_custodies sc
        WHERE sc.id = v_cust.id
          AND sc.status <> 'settled'
          AND NOT EXISTS (SELECT 1 FROM public.payment_vouchers pv WHERE pv.custody_id = sc.id)
          AND NOT EXISTS (SELECT 1 FROM public.expenses e WHERE e.custody_id = sc.id AND e.company_id = sc.company_id);
      ELSE
        PERFORM rawasi_private.recalculate_custody_spent(v_cust.id);
      END IF;
    END IF;
  END IF;

  RETURN OLD;
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

    IF v_cust.payment_voucher_id = p_voucher_id THEN
      IF EXISTS (
        SELECT 1 FROM public.expenses e
        WHERE e.custody_id = v_cust.id AND e.company_id = v_cust.company_id AND COALESCE(e.is_posted,false)=true
      ) OR EXISTS (
        SELECT 1 FROM public.payment_vouchers pv
        WHERE pv.custody_id = v_cust.id AND pv.id <> p_voucher_id AND COALESCE(pv.is_posted,false)=true
      ) THEN
        RAISE EXCEPTION 'لا يمكن فك ترحيل سند العهدة لوجود مصروفات أو سندات صرف مرحلة على العهدة (%)؛ فك ترحيلها أولاً', v_cust.custody_number
          USING ERRCODE='23514';
      END IF;
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

    IF v_cust.payment_voucher_id = p_voucher_id THEN
      IF EXISTS (
        SELECT 1 FROM public.expenses e
        WHERE e.custody_id = v_cust.id AND e.company_id = v_cust.company_id
      ) OR EXISTS (
        SELECT 1 FROM public.payment_vouchers pv
        WHERE pv.custody_id = v_cust.id AND pv.id <> p_voucher_id
      ) THEN
        RAISE EXCEPTION 'لا يمكن حذف سند صرف العهدة لوجود مصروفات أو سندات صرف مرتبطة بالعهدة (%)؛ احذفها أولاً', v_cust.custody_number
          USING ERRCODE='23514';
      END IF;
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
DECLARE
  v_id uuid;
  v_cust public.site_custodies%ROWTYPE;
BEGIN
  IF COALESCE(cardinality(p_custody_ids), 0) = 0 THEN
    RETURN;
  END IF;
  FOREACH v_id IN ARRAY p_custody_ids LOOP
    SELECT * INTO v_cust FROM public.site_custodies WHERE id = v_id;
    IF FOUND THEN
      IF v_cust.payment_voucher_id IS NULL THEN
        DELETE FROM public.site_custodies sc
        WHERE sc.id = v_id
          AND sc.status <> 'settled'
          AND NOT EXISTS (SELECT 1 FROM public.payment_vouchers pv WHERE pv.custody_id = sc.id)
          AND NOT EXISTS (SELECT 1 FROM public.expenses e WHERE e.custody_id = sc.id AND e.company_id = sc.company_id);
      ELSE
        PERFORM rawasi_private.recalculate_custody_spent(v_id);
      END IF;
    END IF;
  END LOOP;
END;
$function$;

-- ============================================================================
-- 4. Update `post_payment_vouchers_bulk` to validate & post `custody_partner_id`
--    on the Credit `journal_lines` row when Credit account is Custody (125%)
-- ============================================================================
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
    v_is_credit_custody boolean;
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

        v_is_credit_custody := rawasi_private.is_custody_account(v_rec.credit_account_id, v_rec.company_id);

        IF v_is_credit_custody AND v_rec.custody_partner_id IS NULL THEN
            RAISE EXCEPTION 'يلزم تحديد الشخص اللي العهدة في ذمته قبل ترحيل السند % المسدد من حساب العُهد', v_rec.voucher_number
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

        -- Debit line: payee / contractor / expense / custody issuance
        INSERT INTO public.journal_lines (header_id, account_id, partner_id, project_id, job_order_id, debit, credit, notes, company_id)
        VALUES (v_header_id, v_rec.debit_account_id, v_rec.partner_id, v_project_id, v_rec.job_order_id, v_rec.amount, 0, v_full_description, v_rec.company_id);

        -- Credit line: Treasury / Bank (NULL partner) OR Custody (125%) with `custody_partner_id`
        INSERT INTO public.journal_lines (header_id, account_id, partner_id, project_id, job_order_id, debit, credit, notes, company_id)
        VALUES (
          v_header_id,
          v_rec.credit_account_id,
          CASE WHEN v_is_credit_custody THEN v_rec.custody_partner_id ELSE NULL END,
          v_project_id,
          v_rec.job_order_id,
          0,
          v_rec.amount,
          v_full_description,
          v_rec.company_id
        );

        -- Update triggers `trg_zz_pv_sync_custody`: updates custody status OR recalculates spent_amount/remaining_amount
        UPDATE public.payment_vouchers SET is_posted = true, status = 'معتمد' WHERE id = v_rec.id;
    END LOOP;
END;
$function$;

-- ============================================================================
-- 5. Update `settle_site_custody` so settlement exact spent includes BOTH
--    posted `expenses` AND posted credit-125 `payment_vouchers`
-- ============================================================================
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
  v_exp_spent numeric(15,2);
  v_pv_spent numeric(15,2);
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

  SELECT coalesce(sum(coalesce(total_price, 0) + coalesce(vat_amount, 0) - coalesce(discount_amount, 0)), 0)
  INTO v_exp_spent
  FROM public.expenses
  WHERE custody_id = v_custody.id
    AND company_id = v_company
    AND is_posted IS TRUE;

  SELECT coalesce(sum(coalesce(pv.amount, 0)), 0)
  INTO v_pv_spent
  FROM public.payment_vouchers pv
  WHERE pv.custody_id = v_custody.id
    AND pv.company_id = v_company
    AND pv.id IS DISTINCT FROM v_custody.payment_voucher_id
    AND rawasi_private.is_custody_account(pv.credit_account_id, v_company)
    AND pv.is_posted IS TRUE;

  v_spent := round(COALESCE(v_exp_spent, 0) + COALESCE(v_pv_spent, 0), 2);
  v_remaining := round(v_custody.disbursed_amount - v_spent, 2);

  IF v_remaining < 0 THEN
    RAISE EXCEPTION 'إجمالي المنصرف والمصروفات (%) يتجاوز المبلغ المنصرف للعهدة (%)', v_spent, v_custody.disbursed_amount USING ERRCODE = '23514';
  END IF;

  IF v_remaining > 0 THEN
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

      INSERT INTO public.journal_headers (
        company_id, entry_date, description, reference_id, v_type, status
      ) VALUES (
        v_company, coalesce(p_settlement_date, CURRENT_DATE),
        'رد متبقي عهدة رقم ' || v_custody.custody_number || ' بسند قبض ' || v_rv_number,
        v_rv_id, 'receipt_vouchers', 'posted'
      ) RETURNING id INTO v_jh_id;

      INSERT INTO public.journal_lines (
        company_id, header_id, account_id, partner_id, project_id, debit, credit, notes
      ) VALUES (
        v_company, v_jh_id, p_destination_id, NULL, v_custody.project_id, v_remaining, 0,
        'تحصيل متبقي عهدة ' || v_custody.custody_number
      );

      INSERT INTO public.journal_lines (
        company_id, header_id, account_id, partner_id, project_id, debit, credit, notes
      ) VALUES (
        v_company, v_jh_id, v_acc_125, v_custody.partner_id, v_custody.project_id, 0, v_remaining,
        'تسوية متبقي عهدة ' || v_custody.custody_number
      );

      UPDATE public.receipt_vouchers SET status = 'معتمد' WHERE id = v_rv_id;

    ELSIF p_settlement_type = 'salary_deduction' THEN
      v_acc_216 := rawasi_private.require_company_account('216');

      INSERT INTO public.journal_headers (
        company_id, entry_date, description, reference_id, v_type, status
      ) VALUES (
        v_company, coalesce(p_settlement_date, CURRENT_DATE),
        'تسوية متبقي عهدة ' || v_custody.custody_number || ' بالخصم من راتب: ' || v_partner_name,
        v_custody.id, 'manual_journals', 'posted'
      ) RETURNING id INTO v_jh_id;

      INSERT INTO public.journal_lines (
        company_id, header_id, account_id, partner_id, project_id, debit, credit, notes
      ) VALUES (
        v_company, v_jh_id, v_acc_216, v_custody.partner_id, v_custody.project_id, v_remaining, 0,
        'خصم متبقي عهدة من مستحقات الراتب'
      );

      INSERT INTO public.journal_lines (
        company_id, header_id, account_id, partner_id, project_id, debit, credit, notes
      ) VALUES (
        v_company, v_jh_id, v_acc_125, v_custody.partner_id, v_custody.project_id, 0, v_remaining,
        'تسوية وقفل عهدة ' || v_custody.custody_number
      );

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

-- ============================================================================
-- 6. Update `get_site_custodies_summary` to expose `disbursement_vouchers`
--    paid out of each custody alongside `expenses`
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
      ) AS expenses,
      (
        SELECT count(*)::int
        FROM public.payment_vouchers spv
        WHERE spv.custody_id = sc.id
          AND spv.company_id = sc.company_id
          AND spv.id IS DISTINCT FROM sc.payment_voucher_id
          AND rawasi_private.is_custody_account(spv.credit_account_id, sc.company_id)
      ) AS disbursement_vouchers_count,
      (
        SELECT coalesce(jsonb_agg(
          jsonb_build_object(
            'id', spv.id,
            'voucher_number', spv.voucher_number,
            'date', spv.date,
            'amount', spv.amount,
            'description', spv.description,
            'payment_method', spv.payment_method,
            'payee_name', spv_payee.name,
            'debit_account_name', spv_debit.name,
            'project_name', spv.site_ref,
            'is_posted', coalesce(spv.is_posted, false),
            'status', spv.status
          ) ORDER BY spv.date DESC, spv.created_at DESC
        ), '[]'::jsonb)
        FROM public.payment_vouchers spv
        LEFT JOIN public.partners spv_payee ON spv_payee.id = spv.partner_id AND spv_payee.company_id = spv.company_id
        LEFT JOIN public.accounts spv_debit ON spv_debit.id = spv.debit_account_id AND spv_debit.company_id = spv.company_id
        WHERE spv.custody_id = sc.id
          AND spv.company_id = sc.company_id
          AND spv.id IS DISTINCT FROM sc.payment_voucher_id
          AND rawasi_private.is_custody_account(spv.credit_account_id, sc.company_id)
      ) AS disbursement_vouchers
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
-- 10. Data backfill: link historical vouchers paid from custody to Ibrahim Shaddad
-- ============================================================================
DO $$
DECLARE
  v_ibrahim_id uuid := '207eade1-de0b-4b4f-8947-767f01e020c0';
  v_cust1_id uuid := '92523856-69fb-4633-bca1-86b7c4df55aa';
  v_cust3_id uuid := 'bae7d413-aa95-40fc-8e35-b05a3c19a7b3';
BEGIN
  IF EXISTS (SELECT 1 FROM public.partners WHERE id = v_ibrahim_id) THEN
    PERFORM set_config('rawasi.syncing_custody', '1', true);

    UPDATE public.payment_vouchers
    SET custody_partner_id = v_ibrahim_id,
        custody_id = v_cust1_id
    WHERE voucher_number = 'PV-2026-0012' AND (custody_partner_id IS NULL OR custody_id IS NULL);

    UPDATE public.payment_vouchers
    SET custody_partner_id = v_ibrahim_id,
        custody_id = v_cust3_id
    WHERE voucher_number IN ('PV-2026-0013', 'PV-2026-0014') AND (custody_partner_id IS NULL OR custody_id IS NULL);

    UPDATE public.journal_lines jl
    SET partner_id = v_ibrahim_id
    FROM public.journal_headers jh, public.accounts a
    WHERE jl.header_id = jh.id
      AND jl.account_id = a.id
      AND a.code = '125'
      AND jl.partner_id IS NULL
      AND jh.reference_id IN (
        SELECT id FROM public.payment_vouchers
        WHERE voucher_number IN ('PV-2026-0012', 'PV-2026-0013', 'PV-2026-0014')
      );

    PERFORM rawasi_private.recalculate_custody_spent(v_cust1_id);
    PERFORM rawasi_private.recalculate_custody_spent(v_cust3_id);

    PERFORM set_config('rawasi.syncing_custody', '', true);
  END IF;
END $$;

COMMIT;
