-- ============================================================================
-- Migration: 20261112214500_custody_merge_settlement.sql
-- Description: Support merging a custody balance into another open custody
--              ('merge_custody'), updating disbursed/remaining amounts,
--              adding ledger transfer if partners differ, and refreshing totals.
-- ============================================================================

BEGIN;

-- 1. Update site_custodies settlement_type check constraint to include 'merge_custody'
ALTER TABLE public.site_custodies
  DROP CONSTRAINT IF EXISTS site_custodies_settlement_type_check;

ALTER TABLE public.site_custodies
  ADD CONSTRAINT site_custodies_settlement_type_check
  CHECK (settlement_type IS NULL OR settlement_type IN ('cash_return', 'salary_deduction', 'carry_forward', 'cleared', 'merge_custody'));

-- 2. Update settle_site_custody RPC function
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
  v_target_custody public.site_custodies%ROWTYPE;
  v_target_partner_name text;
BEGIN
  IF auth.uid() IS NULL AND current_setting('role', true) IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'يرجى تسجيل الدخول لمتابعة العملية' USING ERRCODE = '42501';
  END IF;

  IF NOT (rawasi_private.can_access('payments', 'edit') OR rawasi_private.can_access('expenses', 'edit') OR rawasi_private.can_access('journal', 'create')) THEN
    RAISE EXCEPTION 'لا تملك صلاحية تسوية العهد' USING ERRCODE = '42501';
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
    RAISE EXCEPTION 'العهدة ليست في حال التشغيل المفتوح' USING ERRCODE = '23514';
  END IF;

  IF p_settlement_type NOT IN ('cash_return', 'salary_deduction', 'carry_forward', 'cleared', 'merge_custody') THEN
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
        'رد متبقي عهدة رقم: ' || v_custody.custody_number || ' - صاحب العهدة: ' || coalesce(v_partner_name, ''), 'مسودة'
      ) RETURNING id, receipt_number INTO v_rv_id, v_rv_number;

      INSERT INTO public.journal_headers (
        company_id, entry_date, description, reference_id, v_type, status
      ) VALUES (
        v_company, coalesce(p_settlement_date, CURRENT_DATE),
        'رد متبقي عهدة رقم ' || v_custody.custody_number || ' بسند قبض ' || coalesce(v_rv_number, ''),
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
        'تسوية متبقي عهدة ' || v_custody.custody_number || ' بالخصم من راتب: ' || coalesce(v_partner_name, ''),
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

    ELSIF p_settlement_type = 'merge_custody' THEN
      IF p_destination_id IS NULL THEN
        RAISE EXCEPTION 'يلزم اختيار العهدة المراد ضم الرصيد إليها' USING ERRCODE = '23514';
      END IF;

      IF p_destination_id = v_custody.id THEN
        RAISE EXCEPTION 'لا يمكن ضم العهدة إلى نفسها' USING ERRCODE = '23514';
      END IF;

      SELECT * INTO v_target_custody
      FROM public.site_custodies
      WHERE id = p_destination_id AND company_id = v_company
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'العهدة المراد الضم إليها غير موجودة أو تابعة لشركة أخرى' USING ERRCODE = '23503';
      END IF;

      IF v_target_custody.status <> 'open' THEN
        RAISE EXCEPTION 'العهدة المراد الضم إليها (%): ليست مفتوحة/جارية (حالتها: %)',
          v_target_custody.custody_number, v_target_custody.status USING ERRCODE = '23514';
      END IF;

      SELECT name INTO v_target_partner_name
      FROM public.partners
      WHERE id = v_target_custody.partner_id AND company_id = v_company;

      -- If the custodies belong to different partners, adjust on account 125 between the two partners
      IF v_custody.partner_id IS DISTINCT FROM v_target_custody.partner_id THEN
        INSERT INTO public.journal_headers (
          company_id, entry_date, description, reference_id, v_type, status
        ) VALUES (
          v_company, coalesce(p_settlement_date, CURRENT_DATE),
          'تسوية ضم رصيد عهدة رقم ' || v_custody.custody_number || ' (' || coalesce(v_partner_name, '') || ') إلى عهدة رقم ' || v_target_custody.custody_number || ' (' || coalesce(v_target_partner_name, '') || ')',
          v_custody.id, 'manual_journals', 'posted'
        ) RETURNING id INTO v_jh_id;

        -- Debit target partner on 125
        INSERT INTO public.journal_lines (
          company_id, header_id, account_id, partner_id, project_id, debit, credit, notes
        ) VALUES (
          v_company, v_jh_id, v_acc_125, v_target_custody.partner_id, coalesce(v_target_custody.project_id, v_custody.project_id), v_remaining, 0,
          'استلام رصيد عهدة منقول من ' || coalesce(v_partner_name, '') || ' بموجب ضم عهدة ' || v_custody.custody_number
        );

        -- Credit source partner on 125 (closing their custody balance)
        INSERT INTO public.journal_lines (
          company_id, header_id, account_id, partner_id, project_id, debit, credit, notes
        ) VALUES (
          v_company, v_jh_id, v_acc_125, v_custody.partner_id, coalesce(v_custody.project_id, v_target_custody.project_id), 0, v_remaining,
          'إخلاء ونقل رصيد عهدة ' || v_custody.custody_number || ' وضمه على عهدة ' || v_target_custody.custody_number
        );
      END IF;

      -- Update target custody disbursed_amount and notes
      UPDATE public.site_custodies
      SET disbursed_amount = round(disbursed_amount + v_remaining, 2),
          notes = coalesce(notes || E'\n', '') || 'تم ضم متبقي (' || v_remaining || ' ج.م) من العهدة ' || v_custody.custody_number || ' بتاريخ ' || coalesce(p_settlement_date, CURRENT_DATE) || case when p_notes is not null and btrim(p_notes) <> '' then ' - بيان: ' || p_notes else '' end,
          updated_at = now()
      WHERE id = v_target_custody.id;

      -- Recalculate target custody's spent and remaining amounts
      PERFORM rawasi_private.recalculate_custody_spent(v_target_custody.id);
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
      settlement_reference_id = coalesce(
        case when p_settlement_type = 'merge_custody' then v_target_custody.id else null end,
        v_rv_id,
        v_jh_id,
        v_new_custody_id
      ),
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
    'new_custody_id', v_new_custody_id,
    'target_custody_id', case when p_settlement_type = 'merge_custody' then v_target_custody.id else null end,
    'target_custody_number', case when p_settlement_type = 'merge_custody' then v_target_custody.custody_number else null end
  );
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
