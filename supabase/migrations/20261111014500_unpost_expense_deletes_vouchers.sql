-- When unposting an expense, automatically unpost and delete any payment vouchers
-- linked via related_expense_id (along with their journal entries and cash_flows),
-- unless a voucher is tied to a contractor sub-claim.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE OR REPLACE FUNCTION public.unpost_expenses_bulk(record_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  target uuid;
  v_voucher_ids uuid[];
  v_has_claim_voucher boolean;
BEGIN
  IF COALESCE(cardinality(record_ids), 0) = 0 OR array_position(record_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'حدد المصروفات' USING ERRCODE = '23514';
  END IF;

  IF NOT rawasi_private.can_access('expenses', 'view')
     OR NOT rawasi_private.can_access('expenses', 'edit')
     OR NOT rawasi_private.can_access('payments', 'view')
     OR NOT rawasi_private.can_access('journal', 'view')
     OR NOT rawasi_private.can_access('journal', 'delete') THEN
    RAISE EXCEPTION 'لا توجد صلاحية فك ترحيل المصروفات' USING ERRCODE = '42501';
  END IF;

  FOR target IN SELECT DISTINCT id FROM unnest(record_ids) AS i(id) ORDER BY id LOOP
    PERFORM 1 FROM public.expenses WHERE id = target FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'المصروف غير موجود أو غير مسموح بعرضه' USING ERRCODE = '42501';
    END IF;

    -- Lock any linked payment vouchers in deterministic order before removing them.
    SELECT array_agg(id ORDER BY id),
           bool_or(sub_claim_id IS NOT NULL)
    INTO v_voucher_ids, v_has_claim_voucher
    FROM (
      SELECT id, sub_claim_id
      FROM public.payment_vouchers
      WHERE related_expense_id = target
      ORDER BY id
      FOR UPDATE
    ) locked_vouchers;

    IF COALESCE(array_length(v_voucher_ids, 1), 0) > 0 THEN
      IF COALESCE(v_has_claim_voucher, false) THEN
        RAISE EXCEPTION 'أحد سندات الصرف مرتبط بمستخلص مقاول؛ فك ترحيله من شاشة سندات الصرف والمستخلصات أولاً' USING ERRCODE = '23514';
      END IF;

      IF NOT rawasi_private.can_access('payments', 'edit')
         OR NOT rawasi_private.can_access('payments', 'delete') THEN
        RAISE EXCEPTION 'لا توجد صلاحية تعديل وحذف سندات الصرف المرتبطة بالمصروف' USING ERRCODE = '42501';
      END IF;

      -- 1) Remove payment voucher journals first (ON DELETE CASCADE removes journal_lines).
      DELETE FROM public.journal_headers
      WHERE reference_id = ANY(v_voucher_ids);

      -- 2) Reset posted status on vouchers so trg_protect_payment_document allows deletion
      --    and trg_payment_cash_flow clears associated cash_flows.
      UPDATE public.payment_vouchers
      SET is_posted = false,
          status = 'مسودة'
      WHERE id = ANY(v_voucher_ids)
        AND (COALESCE(is_posted, false) OR COALESCE(status IN ('posted', 'مرحل', 'معتمد'), false));

      -- 3) Delete the linked payment vouchers permanently.
      DELETE FROM public.payment_vouchers
      WHERE id = ANY(v_voucher_ids);
    END IF;

    -- 4) Remove the expense's own journal entry.
    DELETE FROM public.journal_headers
    WHERE reference_id = target
      AND v_type IN ('expense', 'expenses', 'مصروف');

    -- 5) Return expense to draft and reset paid_amount.
    UPDATE public.expenses
    SET is_posted = false,
        paid_amount = 0
    WHERE id = target;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.unpost_expenses_bulk(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unpost_expenses_bulk(uuid[]) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
