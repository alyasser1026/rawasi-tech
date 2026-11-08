-- Migration: 20261105170013_offline_idempotency_and_realtime.sql
-- Description: Phase 8 - Offline Draft Queue Idempotency (client_request_id per company),
--              Telegram Company Attachments Registry, Draft-Only RPCs, and Realtime Publication

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $preflight$
BEGIN
  IF to_regclass('public.companies') IS NULL OR to_regprocedure('rawasi_private.current_company_id()') IS NULL THEN
    RAISE EXCEPTION 'Multi-company isolation must be applied before Phase 8';
  END IF;
END;
$preflight$;

BEGIN;

-- =============================================================================
-- 1. IDEMPOTENCY KEYS ON TARGET DRAFT TABLES (PER-COMPANY UNIQUE)
-- =============================================================================
ALTER TABLE public.labor_daily_logs
  ADD COLUMN IF NOT EXISTS client_request_id uuid;

ALTER TABLE public.labor_daily_logs
  DROP CONSTRAINT IF EXISTS labor_daily_logs_company_client_req_uq;
ALTER TABLE public.labor_daily_logs
  ADD CONSTRAINT labor_daily_logs_company_client_req_uq
  UNIQUE (company_id, client_request_id);

COMMENT ON COLUMN public.labor_daily_logs.client_request_id IS
  'معرّف العملية المولّد على جهاز المستخدم لمنع تكرار مسودات اليوميات عند إعادة إرسال طابور الأوفلاين';

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS client_request_id uuid;

ALTER TABLE public.expenses
  DROP CONSTRAINT IF EXISTS expenses_company_client_req_uq;
ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_company_client_req_uq
  UNIQUE (company_id, client_request_id);

COMMENT ON COLUMN public.expenses.client_request_id IS
  'معرّف العملية المولّد على جهاز المستخدم لمنع تكرار مسودات المصروفات ومصروفات العهد عند إعادة الإرسال';

-- =============================================================================
-- 2. COMPANY ATTACHMENTS REGISTRY (TELEGRAM BOT API METADATA PER COMPANY)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.company_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT rawasi_private.current_company_id() REFERENCES public.companies(id) ON DELETE RESTRICT,
  client_request_id uuid,
  module text NOT NULL DEFAULT 'general' CHECK (module IN (
    'expenses',
    'custodies',
    'company_documents',
    'receipt_vouchers',
    'payment_vouchers',
    'invoices',
    'general'
  )),
  file_name text NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  file_size integer NOT NULL DEFAULT 0 CHECK (file_size >= 0),
  telegram_file_id text NOT NULL,
  telegram_unique_id text,
  telegram_message_id bigint,
  telegram_chat_id text,
  caption text,
  uploaded_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_attachments_company_id_uq UNIQUE (id, company_id),
  CONSTRAINT company_attachments_company_client_req_uq UNIQUE (company_id, client_request_id)
);

COMMENT ON TABLE public.company_attachments IS
  'سجل مرفقات وصور النظام المرتبطة بـ Telegram Bot API مع عزل كامل لكل شركة ومنع تكرار الرفع';

INSERT INTO rawasi_private.company_scoped_tables(table_name)
VALUES ('company_attachments')
ON CONFLICT (table_name) DO NOTHING;

CREATE INDEX IF NOT EXISTS company_attachments_company_module_idx
  ON public.company_attachments(company_id, module, created_at DESC);

DROP TRIGGER IF EXISTS aa_stamp_company_id ON public.company_attachments;
CREATE TRIGGER aa_stamp_company_id
  BEFORE INSERT OR UPDATE OF company_id ON public.company_attachments
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.stamp_company_id();

ALTER TABLE public.company_attachments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.company_attachments FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, DELETE ON public.company_attachments TO authenticated;
GRANT ALL ON public.company_attachments TO service_role;

DROP POLICY IF EXISTS company_attachments_read ON public.company_attachments;
CREATE POLICY company_attachments_read ON public.company_attachments
  FOR SELECT TO authenticated
  USING (
    (
      rawasi_private.can_access('expenses', 'view')
      OR rawasi_private.can_access('receipts', 'view')
      OR rawasi_private.can_access('payments', 'view')
      OR rawasi_private.can_access('audit_logs', 'view')
      OR rawasi_private.can_access('accounting', 'view')
      OR rawasi_private.can_access('labor_logs', 'view')
      OR rawasi_private.is_admin()
    )
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

DROP POLICY IF EXISTS company_attachments_insert ON public.company_attachments;
CREATE POLICY company_attachments_insert ON public.company_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      rawasi_private.can_access('expenses', 'create')
      OR rawasi_private.can_access('receipts', 'create')
      OR rawasi_private.can_access('payments', 'create')
      OR rawasi_private.can_access('audit_logs', 'create')
      OR rawasi_private.can_access('labor_logs', 'create')
      OR rawasi_private.is_admin()
    )
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

DROP POLICY IF EXISTS company_attachments_delete ON public.company_attachments;
CREATE POLICY company_attachments_delete ON public.company_attachments
  FOR DELETE TO authenticated
  USING (
    (uploaded_by = (SELECT auth.uid()) OR rawasi_private.is_admin())
    AND company_id = (SELECT rawasi_private.current_company_id())
  );

-- =============================================================================
-- 3. RPC: IDEMPOTENT COMPANY ATTACHMENT REGISTRATION
-- =============================================================================
CREATE OR REPLACE FUNCTION public.register_company_attachment(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company uuid;
  v_expected_company uuid;
  v_client_req_id uuid;
  v_module text;
  v_file_name text;
  v_mime_type text;
  v_file_size integer;
  v_tg_file_id text;
  v_tg_unique_id text;
  v_tg_msg_id bigint;
  v_tg_chat_id text;
  v_caption text;
  v_existing_id uuid;
  v_inserted_id uuid;
  v_row_json jsonb;
BEGIN
  IF auth.uid() IS NULL AND current_setting('role', true) IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'يلزم تسجيل الدخول لحفظ المرفق' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    rawasi_private.can_access('expenses', 'create')
    OR rawasi_private.can_access('receipts', 'create')
    OR rawasi_private.can_access('payments', 'create')
    OR rawasi_private.can_access('audit_logs', 'create')
    OR rawasi_private.can_access('labor_logs', 'create')
    OR rawasi_private.is_admin()
  ) THEN
    RAISE EXCEPTION 'لا توجد صلاحية رفع مرفقات في الشركة الحالية' USING ERRCODE = '42501';
  END IF;

  v_company := rawasi_private.current_company_id();
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'لم يتم تحديد الشركة الحالية أو لا تملك صلاحية الوصول إليها' USING ERRCODE = '42501';
  END IF;

  IF NULLIF(btrim(coalesce((NULLIF(current_setting('request.headers', true), '')::jsonb ->> 'x-company-id'), '')), '') IS NOT NULL THEN
    IF ((NULLIF(current_setting('request.headers', true), '')::jsonb ->> 'x-company-id')::uuid) IS DISTINCT FROM v_company THEN
      RAISE EXCEPTION 'ليست لديك صلاحية الوصول للشركة المحددة في الطلب' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NULLIF(btrim(coalesce(p_data->>'company_id', '')), '') IS NOT NULL THEN
    v_expected_company := (p_data->>'company_id')::uuid;
    IF v_expected_company IS DISTINCT FROM v_company THEN
      RAISE EXCEPTION 'عدم تطابق معرّف الشركة المرسلة مع الشركة المفتوحة للطلب' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NULLIF(btrim(coalesce(p_data->>'client_request_id', '')), '') IS NOT NULL THEN
    v_client_req_id := (p_data->>'client_request_id')::uuid;
  END IF;

  IF v_client_req_id IS NOT NULL THEN
    SELECT ca.id, to_jsonb(ca) INTO v_existing_id, v_row_json
    FROM public.company_attachments ca
    WHERE ca.company_id = v_company
      AND ca.client_request_id = v_client_req_id;

    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'id', v_existing_id,
        'company_id', v_company,
        'client_request_id', v_client_req_id,
        'url', '/api/attachments/' || v_existing_id::text,
        '_sync_replayed', true,
        'record', v_row_json
      );
    END IF;
  END IF;

  v_module := coalesce(NULLIF(btrim(p_data->>'module'), ''), 'general');
  v_file_name := coalesce(NULLIF(btrim(p_data->>'file_name'), ''), 'attachment');
  v_mime_type := coalesce(NULLIF(btrim(p_data->>'mime_type'), ''), 'application/octet-stream');
  v_file_size := greatest(coalesce((p_data->>'file_size')::integer, 0), 0);
  v_tg_file_id := NULLIF(btrim(coalesce(p_data->>'telegram_file_id', '')), '');
  v_tg_unique_id := NULLIF(btrim(coalesce(p_data->>'telegram_unique_id', '')), '');
  v_tg_msg_id := CASE
    WHEN NULLIF(btrim(coalesce(p_data->>'telegram_message_id', '')), '') IS NOT NULL
    THEN (p_data->>'telegram_message_id')::bigint
    ELSE NULL
  END;
  v_tg_chat_id := NULLIF(btrim(coalesce(p_data->>'telegram_chat_id', '')), '');
  v_caption := NULLIF(btrim(coalesce(p_data->>'caption', '')), '');

  IF v_tg_file_id IS NULL THEN
    RAISE EXCEPTION 'معرّف ملف تيليجرام (telegram_file_id) مطلوب' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.company_attachments (
    company_id, client_request_id, module, file_name, mime_type, file_size,
    telegram_file_id, telegram_unique_id, telegram_message_id, telegram_chat_id,
    caption, uploaded_by
  ) VALUES (
    v_company, v_client_req_id, v_module, v_file_name, v_mime_type, v_file_size,
    v_tg_file_id, v_tg_unique_id, v_tg_msg_id, v_tg_chat_id,
    v_caption, auth.uid()
  )
  ON CONFLICT ON CONSTRAINT company_attachments_company_client_req_uq DO NOTHING
  RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NULL AND v_client_req_id IS NOT NULL THEN
    SELECT ca.id, to_jsonb(ca) INTO v_existing_id, v_row_json
    FROM public.company_attachments ca
    WHERE ca.company_id = v_company
      AND ca.client_request_id = v_client_req_id;

    RETURN jsonb_build_object(
      'success', true,
      'id', v_existing_id,
      'company_id', v_company,
      'client_request_id', v_client_req_id,
      'url', '/api/attachments/' || v_existing_id::text,
      '_sync_replayed', true,
      'record', v_row_json
    );
  END IF;

  SELECT to_jsonb(ca) INTO v_row_json
  FROM public.company_attachments ca
  WHERE ca.id = v_inserted_id AND ca.company_id = v_company;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_inserted_id,
    'company_id', v_company,
    'client_request_id', v_client_req_id,
    'url', '/api/attachments/' || v_inserted_id::text,
    '_sync_replayed', false,
    'record', v_row_json
  );
END;
$$;

REVOKE ALL ON FUNCTION public.register_company_attachment(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_company_attachment(jsonb) TO authenticated, service_role;

-- =============================================================================
-- 4. RPC: IDEMPOTENT DRAFT-ONLY LABOR DAILY LOG (NO POSTING ALLOWED)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.save_labor_log_draft(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company uuid;
  v_expected_company uuid;
  v_client_req_id uuid;
  v_edit_id uuid;
  v_existing_id uuid;
  v_inserted_id uuid;
  v_row_json jsonb;
  v_work_date date;
  v_worker_name text;
  v_project_id uuid;
  v_job_order_id uuid;
  v_worker_partner_id uuid;
  v_sub_contractor_id uuid;
  v_work_item_id uuid;
  v_debit_acc uuid;
  v_credit_acc uuid;
  v_existing_posted boolean;
BEGIN
  IF auth.uid() IS NULL AND current_setting('role', true) IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'يلزم تسجيل الدخول لحفظ مسودة اليومية' USING ERRCODE = '42501';
  END IF;

  IF p_data IS NULL OR jsonb_typeof(p_data) <> 'object' THEN
    RAISE EXCEPTION 'بيانات مسودة اليومية غير صالحة' USING ERRCODE = '22023';
  END IF;

  -- Strict Draft-Only enforcement: reject any attempt to post from draft/offline RPC
  IF coalesce((p_data->>'is_posted')::boolean, false) IS TRUE
     OR lower(btrim(coalesce(p_data->>'action', ''))) IN ('post', 'approve', 'اعتماد', 'ترحيل') THEN
    RAISE EXCEPTION 'حفظ اليوميات من الطابور متاح كمسودات فقط؛ الترحيل والاعتماد يتطلبان اتصالاً مباشراً بالإنترنت'
      USING ERRCODE = '23514';
  END IF;

  v_company := rawasi_private.current_company_id();
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'لم يتم تحديد الشركة الحالية أو لا تملك صلاحية الوصول إليها' USING ERRCODE = '42501';
  END IF;

  IF NULLIF(btrim(coalesce((NULLIF(current_setting('request.headers', true), '')::jsonb ->> 'x-company-id'), '')), '') IS NOT NULL THEN
    IF ((NULLIF(current_setting('request.headers', true), '')::jsonb ->> 'x-company-id')::uuid) IS DISTINCT FROM v_company THEN
      RAISE EXCEPTION 'ليست لديك صلاحية الوصول للشركة المحددة في الطلب' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NULLIF(btrim(coalesce(p_data->>'company_id', '')), '') IS NOT NULL THEN
    v_expected_company := (p_data->>'company_id')::uuid;
    IF v_expected_company IS DISTINCT FROM v_company THEN
      RAISE EXCEPTION 'عدم تطابق معرّف الشركة المرسلة مع الشركة المفتوحة للطلب' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NULLIF(btrim(coalesce(p_data->>'id', '')), '') IS NOT NULL THEN
    v_edit_id := (p_data->>'id')::uuid;
  END IF;

  IF v_edit_id IS NOT NULL THEN
    IF NOT rawasi_private.can_access('labor_logs', 'edit') THEN
      RAISE EXCEPTION 'لا توجد صلاحية تعديل يوميات العمالة' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF NOT rawasi_private.can_access('labor_logs', 'create') THEN
      RAISE EXCEPTION 'لا توجد صلاحية إضافة يوميات عمالة' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NULLIF(btrim(coalesce(p_data->>'client_request_id', '')), '') IS NOT NULL THEN
    v_client_req_id := (p_data->>'client_request_id')::uuid;
  END IF;

  -- Idempotency check before insert
  IF v_edit_id IS NULL AND v_client_req_id IS NOT NULL THEN
    SELECT l.id, to_jsonb(l) INTO v_existing_id, v_row_json
    FROM public.labor_daily_logs l
    WHERE l.company_id = v_company
      AND l.client_request_id = v_client_req_id;

    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'id', v_existing_id,
        'company_id', v_company,
        'client_request_id', v_client_req_id,
        '_sync_replayed', true,
        'record', v_row_json
      );
    END IF;
  END IF;

  v_work_date := coalesce(NULLIF(btrim(p_data->>'work_date'), '')::date, CURRENT_DATE);
  v_worker_name := NULLIF(btrim(coalesce(p_data->>'worker_name', '')), '');
  IF v_worker_name IS NULL THEN
    RAISE EXCEPTION 'اسم العامل مطلوب لحفظ مسودة اليومية' USING ERRCODE = '23514';
  END IF;

  v_project_id := NULLIF(btrim(coalesce(p_data->>'project_id', '')), '')::uuid;
  v_job_order_id := NULLIF(btrim(coalesce(p_data->>'job_order_id', '')), '')::uuid;
  v_worker_partner_id := NULLIF(btrim(coalesce(p_data->>'worker_partner_id', '')), '')::uuid;
  v_sub_contractor_id := NULLIF(btrim(coalesce(p_data->>'sub_contractor_id', '')), '')::uuid;
  v_work_item_id := NULLIF(btrim(coalesce(p_data->>'work_item_id', '')), '')::uuid;

  -- Resolve company-specific labor accounts by code (never fixed UUIDs from another company)
  v_debit_acc := rawasi_private.company_account_id('512');
  v_credit_acc := rawasi_private.company_account_id('216');

  IF NULLIF(btrim(coalesce(p_data->>'debit_account_id', '')), '') IS NOT NULL THEN
    SELECT a.id INTO v_debit_acc
    FROM public.accounts a
    WHERE a.id = (p_data->>'debit_account_id')::uuid AND a.company_id = v_company;
    IF v_debit_acc IS NULL THEN
      v_debit_acc := rawasi_private.company_account_id('512');
    END IF;
  END IF;

  IF NULLIF(btrim(coalesce(p_data->>'credit_account_id', '')), '') IS NOT NULL THEN
    SELECT a.id INTO v_credit_acc
    FROM public.accounts a
    WHERE a.id = (p_data->>'credit_account_id')::uuid AND a.company_id = v_company;
    IF v_credit_acc IS NULL THEN
      v_credit_acc := rawasi_private.company_account_id('216');
    END IF;
  END IF;

  IF v_edit_id IS NOT NULL THEN
    SELECT l.is_posted INTO v_existing_posted
    FROM public.labor_daily_logs l
    WHERE l.id = v_edit_id AND l.company_id = v_company
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'سجل اليومية غير موجود في الشركة الحالية' USING ERRCODE = 'P0002';
    END IF;
    IF v_existing_posted IS TRUE THEN
      RAISE EXCEPTION 'لا يمكن تعديل سجل عمالة مرحّل؛ يرجى فك الترحيل أولاً' USING ERRCODE = '23514';
    END IF;

    UPDATE public.labor_daily_logs
    SET work_date = v_work_date,
        worker_name = v_worker_name,
        site_ref = NULLIF(btrim(coalesce(p_data->>'site_ref', '')), ''),
        job_order_id = v_job_order_id,
        work_item = NULLIF(btrim(coalesce(p_data->>'work_item', '')), ''),
        unit = NULLIF(btrim(coalesce(p_data->>'unit', '')), ''),
        skill_level = NULLIF(btrim(coalesce(p_data->>'skill_level', '')), ''),
        production_desc = NULLIF(btrim(coalesce(p_data->>'production_desc', '')), ''),
        tareeha = rawasi_private.safe_numeric(p_data->>'tareeha'),
        productivity = rawasi_private.safe_numeric(p_data->>'productivity'),
        completion_percentage = rawasi_private.safe_numeric(p_data->>'completion_percentage'),
        daily_wage = coalesce(rawasi_private.safe_numeric(p_data->>'daily_wage'), 0),
        attendance_value = coalesce(rawasi_private.safe_numeric(p_data->>'attendance_value'), 1),
        notes = NULLIF(btrim(coalesce(p_data->>'notes', '')), ''),
        worker_partner_id = v_worker_partner_id,
        project_id = v_project_id,
        work_item_id = v_work_item_id,
        sub_contractor = NULLIF(btrim(coalesce(p_data->>'sub_contractor', '')), ''),
        sub_contractor_id = v_sub_contractor_id,
        debit_account_id = v_debit_acc,
        credit_account_id = v_credit_acc,
        completed_quantity = coalesce(rawasi_private.safe_numeric(p_data->>'completed_quantity'), 0),
        number_of_workers = coalesce((rawasi_private.safe_numeric(p_data->>'number_of_workers'))::integer, 1),
        is_posted = false
    WHERE id = v_edit_id AND company_id = v_company
    RETURNING id INTO v_inserted_id;
  ELSE
    INSERT INTO public.labor_daily_logs (
      company_id, client_request_id, work_date, worker_name, site_ref,
      job_order_id, work_item, unit, skill_level, production_desc,
      tareeha, productivity, completion_percentage, daily_wage, attendance_value,
      notes, worker_partner_id, project_id, work_item_id,
      sub_contractor, sub_contractor_id, debit_account_id, credit_account_id,
      completed_quantity, number_of_workers, is_posted
    ) VALUES (
      v_company, v_client_req_id, v_work_date, v_worker_name,
      NULLIF(btrim(coalesce(p_data->>'site_ref', '')), ''),
      v_job_order_id,
      NULLIF(btrim(coalesce(p_data->>'work_item', '')), ''),
      NULLIF(btrim(coalesce(p_data->>'unit', '')), ''),
      NULLIF(btrim(coalesce(p_data->>'skill_level', '')), ''),
      NULLIF(btrim(coalesce(p_data->>'production_desc', '')), ''),
      rawasi_private.safe_numeric(p_data->>'tareeha'),
      rawasi_private.safe_numeric(p_data->>'productivity'),
      rawasi_private.safe_numeric(p_data->>'completion_percentage'),
      coalesce(rawasi_private.safe_numeric(p_data->>'daily_wage'), 0),
      coalesce(rawasi_private.safe_numeric(p_data->>'attendance_value'), 1),
      NULLIF(btrim(coalesce(p_data->>'notes', '')), ''),
      v_worker_partner_id, v_project_id, v_work_item_id,
      NULLIF(btrim(coalesce(p_data->>'sub_contractor', '')), ''),
      v_sub_contractor_id, v_debit_acc, v_credit_acc,
      coalesce(rawasi_private.safe_numeric(p_data->>'completed_quantity'), 0),
      coalesce((rawasi_private.safe_numeric(p_data->>'number_of_workers'))::integer, 1),
      false
    )
    ON CONFLICT ON CONSTRAINT labor_daily_logs_company_client_req_uq DO NOTHING
    RETURNING id INTO v_inserted_id;

    IF v_inserted_id IS NULL AND v_client_req_id IS NOT NULL THEN
      SELECT l.id, to_jsonb(l) INTO v_existing_id, v_row_json
      FROM public.labor_daily_logs l
      WHERE l.company_id = v_company
        AND l.client_request_id = v_client_req_id;

      RETURN jsonb_build_object(
        'success', true,
        'id', v_existing_id,
        'company_id', v_company,
        'client_request_id', v_client_req_id,
        '_sync_replayed', true,
        'record', v_row_json
      );
    END IF;
  END IF;

  SELECT to_jsonb(l) INTO v_row_json
  FROM public.labor_daily_logs l
  WHERE l.id = v_inserted_id AND l.company_id = v_company;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_inserted_id,
    'company_id', v_company,
    'client_request_id', v_client_req_id,
    '_sync_replayed', false,
    'record', v_row_json
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_labor_log_draft(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_labor_log_draft(jsonb) TO authenticated, service_role;

-- =============================================================================
-- 5. RPC: IDEMPOTENT DRAFT-ONLY EXPENSE & CUSTODY EXPENSE (NO POSTING ALLOWED)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.save_expense_draft(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company uuid;
  v_expected_company uuid;
  v_client_req_id uuid;
  v_edit_id uuid;
  v_existing_id uuid;
  v_inserted_id uuid;
  v_row_json jsonb;
  v_exp_date date;
  v_description text;
  v_quantity numeric(10,2);
  v_unit_price numeric(15,2);
  v_vat_amount numeric(15,2);
  v_discount_amount numeric(15,2);
  v_payment_method text;
  v_payment_account text;
  v_creditor_account text;
  v_paid_amount numeric(15,2);
  v_project_id uuid;
  v_payee_id uuid;
  v_job_order_id uuid;
  v_custody_id uuid;
  v_asset_id uuid;
  v_lines_data jsonb;
  v_custody_status text;
  v_custody_project uuid;
  v_custody_partner_name text;
  v_acc_125_label text;
  v_existing_posted boolean;
BEGIN
  IF auth.uid() IS NULL AND current_setting('role', true) IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'يلزم تسجيل الدخول لحفظ مسودة المصروف' USING ERRCODE = '42501';
  END IF;

  IF p_data IS NULL OR jsonb_typeof(p_data) <> 'object' THEN
    RAISE EXCEPTION 'بيانات مسودة المصروف غير صالحة' USING ERRCODE = '22023';
  END IF;

  -- Strict Draft-Only enforcement: reject any attempt to post from draft/offline RPC
  IF coalesce((p_data->>'is_posted')::boolean, false) IS TRUE
     OR lower(btrim(coalesce(p_data->>'action', ''))) IN ('post', 'approve', 'settle', 'اعتماد', 'ترحيل', 'تسوية') THEN
    RAISE EXCEPTION 'حفظ المصروفات ومصروفات العهدة من الطابور متاح كمسودات فقط؛ الترحيل والاعتماد يتطلبان اتصالاً مباشراً بالإنترنت'
      USING ERRCODE = '23514';
  END IF;

  v_company := rawasi_private.current_company_id();
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'لم يتم تحديد الشركة الحالية أو لا تملك صلاحية الوصول إليها' USING ERRCODE = '42501';
  END IF;

  IF NULLIF(btrim(coalesce((NULLIF(current_setting('request.headers', true), '')::jsonb ->> 'x-company-id'), '')), '') IS NOT NULL THEN
    IF ((NULLIF(current_setting('request.headers', true), '')::jsonb ->> 'x-company-id')::uuid) IS DISTINCT FROM v_company THEN
      RAISE EXCEPTION 'ليست لديك صلاحية الوصول للشركة المحددة في الطلب' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NULLIF(btrim(coalesce(p_data->>'company_id', '')), '') IS NOT NULL THEN
    v_expected_company := (p_data->>'company_id')::uuid;
    IF v_expected_company IS DISTINCT FROM v_company THEN
      RAISE EXCEPTION 'عدم تطابق معرّف الشركة المرسلة مع الشركة المفتوحة للطلب' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NULLIF(btrim(coalesce(p_data->>'id', '')), '') IS NOT NULL THEN
    v_edit_id := (p_data->>'id')::uuid;
  END IF;

  IF v_edit_id IS NOT NULL THEN
    IF NOT rawasi_private.can_access('expenses', 'edit') THEN
      RAISE EXCEPTION 'لا توجد صلاحية تعديل المصروفات' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF NOT rawasi_private.can_access('expenses', 'create') THEN
      RAISE EXCEPTION 'لا توجد صلاحية إضافة مصروفات' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NULLIF(btrim(coalesce(p_data->>'client_request_id', '')), '') IS NOT NULL THEN
    v_client_req_id := (p_data->>'client_request_id')::uuid;
  END IF;

  -- Idempotency check before insert
  IF v_edit_id IS NULL AND v_client_req_id IS NOT NULL THEN
    SELECT e.id, to_jsonb(e) INTO v_existing_id, v_row_json
    FROM public.expenses e
    WHERE e.company_id = v_company
      AND e.client_request_id = v_client_req_id;

    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'id', v_existing_id,
        'company_id', v_company,
        'client_request_id', v_client_req_id,
        '_sync_replayed', true,
        'record', v_row_json
      );
    END IF;
  END IF;

  v_exp_date := coalesce(NULLIF(btrim(p_data->>'exp_date'), '')::date, CURRENT_DATE);
  v_lines_data := CASE
    WHEN jsonb_typeof(p_data->'lines_data') = 'array' THEN p_data->'lines_data'
    ELSE '[]'::jsonb
  END;

  v_description := NULLIF(btrim(coalesce(p_data->>'description', '')), '');
  IF v_description IS NULL AND jsonb_array_length(v_lines_data) > 0 THEN
    SELECT string_agg(coalesce(l->>'description', l->>'item_name', l->>'work_item'), ' + ')
    INTO v_description
    FROM jsonb_array_elements(v_lines_data) l
    WHERE coalesce(l->>'description', l->>'item_name', l->>'work_item') IS NOT NULL;
  END IF;
  v_description := coalesce(NULLIF(btrim(coalesce(v_description, '')), ''), 'مصروف عام');

  v_quantity := round(greatest(coalesce(rawasi_private.safe_numeric(p_data->>'quantity'), 1), 0.01), 2);
  v_unit_price := round(greatest(coalesce(rawasi_private.safe_numeric(p_data->>'unit_price'), 0), 0), 2);
  v_vat_amount := round(greatest(coalesce(rawasi_private.safe_numeric(p_data->>'vat_amount'), 0), 0), 2);
  v_discount_amount := round(greatest(coalesce(rawasi_private.safe_numeric(p_data->>'discount_amount'), 0), 0), 2);

  v_project_id := NULLIF(btrim(coalesce(p_data->>'project_id', '')), '')::uuid;
  v_payee_id := NULLIF(btrim(coalesce(p_data->>'payee_id', '')), '')::uuid;
  v_job_order_id := NULLIF(btrim(coalesce(p_data->>'job_order_id', '')), '')::uuid;
  v_custody_id := NULLIF(btrim(coalesce(p_data->>'custody_id', '')), '')::uuid;
  v_asset_id := NULLIF(btrim(coalesce(p_data->>'asset_id', '')), '')::uuid;

  v_payment_method := coalesce(NULLIF(btrim(p_data->>'payment_method'), ''), CASE WHEN v_custody_id IS NOT NULL THEN 'عهدة' ELSE 'آجل' END);
  v_payment_account := NULLIF(btrim(coalesce(p_data->>'payment_account', '')), '');
  v_creditor_account := NULLIF(btrim(coalesce(p_data->>'creditor_account', '')), '');

  -- Validate custody link if this is a site custody expense draft
  IF v_custody_id IS NOT NULL THEN
    SELECT sc.status, sc.project_id, p.name
    INTO v_custody_status, v_custody_project, v_custody_partner_name
    FROM public.site_custodies sc
    LEFT JOIN public.partners p ON p.id = sc.partner_id AND p.company_id = sc.company_id
    WHERE sc.id = v_custody_id AND sc.company_id = v_company;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'العهدة المحددة غير موجودة في الشركة الحالية' USING ERRCODE = '23503';
    END IF;
    IF v_custody_status <> 'open' THEN
      RAISE EXCEPTION 'لا يمكن تسجيل مصروف جديد على عهدة مغلقة أو مسواة' USING ERRCODE = '23514';
    END IF;

    IF v_project_id IS NULL AND v_custody_project IS NOT NULL THEN
      v_project_id := v_custody_project;
    END IF;

    IF v_payment_account IS NULL THEN
      SELECT a.code || ' - ' || a.name INTO v_acc_125_label
      FROM public.accounts a
      WHERE a.company_id = v_company AND a.code = '125'
      LIMIT 1;
      v_payment_account := coalesce(v_acc_125_label, '125 - عُهد الموظفين والمواقع');
    END IF;

    v_payment_method := 'عهدة';
  END IF;

  IF v_payment_method = 'تسوية داخلية' THEN
    v_paid_amount := round((v_quantity * v_unit_price) + v_vat_amount - v_discount_amount, 2);
  ELSE
    v_paid_amount := 0;
  END IF;

  IF v_edit_id IS NOT NULL THEN
    SELECT e.is_posted INTO v_existing_posted
    FROM public.expenses e
    WHERE e.id = v_edit_id AND e.company_id = v_company
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'سجل المصروف غير موجود في الشركة الحالية' USING ERRCODE = 'P0002';
    END IF;
    IF v_existing_posted IS TRUE THEN
      RAISE EXCEPTION 'لا يمكن تعديل مصروف مرحّل؛ يرجى فك الترحيل أولاً' USING ERRCODE = '23514';
    END IF;

    UPDATE public.expenses
    SET exp_date = v_exp_date,
        main_category = NULLIF(btrim(coalesce(p_data->>'main_category', '')), ''),
        sub_contractor = NULLIF(btrim(coalesce(p_data->>'sub_contractor', '')), ''),
        site_ref = NULLIF(btrim(coalesce(p_data->>'site_ref', '')), ''),
        creditor_account = v_creditor_account,
        description = v_description,
        payee_name = NULLIF(btrim(coalesce(p_data->>'payee_name', '')), ''),
        payment_method = v_payment_method,
        payment_account = v_payment_account,
        employee_name = coalesce(NULLIF(btrim(coalesce(p_data->>'employee_name', '')), ''), v_custody_partner_name),
        quantity = v_quantity,
        unit_price = v_unit_price,
        vat_amount = v_vat_amount,
        discount_amount = v_discount_amount,
        discount_account = NULLIF(btrim(coalesce(p_data->>'discount_account', '')), ''),
        notes = NULLIF(btrim(coalesce(p_data->>'notes', '')), ''),
        invoice_image = NULLIF(btrim(coalesce(p_data->>'invoice_image', '')), ''),
        lines_data = v_lines_data,
        is_auto_distributed = coalesce((p_data->>'is_auto_distributed')::boolean, false),
        paid_amount = v_paid_amount,
        is_posted = false,
        project_id = v_project_id,
        payee_id = v_payee_id,
        job_order_id = v_job_order_id,
        custody_id = v_custody_id,
        asset_id = v_asset_id,
        is_deducted_from_contractor = coalesce((p_data->>'is_deducted_from_contractor')::boolean, false)
    WHERE id = v_edit_id AND company_id = v_company
    RETURNING id INTO v_inserted_id;
  ELSE
    INSERT INTO public.expenses (
      company_id, client_request_id, exp_date, main_category, sub_contractor, site_ref,
      creditor_account, description, payee_name, payment_method, payment_account,
      employee_name, quantity, unit_price, vat_amount, discount_amount, discount_account,
      notes, invoice_image, lines_data, is_auto_distributed, paid_amount, is_posted,
      created_by, project_id, payee_id, job_order_id, custody_id, asset_id, is_deducted_from_contractor
    ) VALUES (
      v_company, v_client_req_id, v_exp_date,
      NULLIF(btrim(coalesce(p_data->>'main_category', '')), ''),
      NULLIF(btrim(coalesce(p_data->>'sub_contractor', '')), ''),
      NULLIF(btrim(coalesce(p_data->>'site_ref', '')), ''),
      v_creditor_account, v_description,
      NULLIF(btrim(coalesce(p_data->>'payee_name', '')), ''),
      v_payment_method, v_payment_account,
      coalesce(NULLIF(btrim(coalesce(p_data->>'employee_name', '')), ''), v_custody_partner_name),
      v_quantity, v_unit_price, v_vat_amount, v_discount_amount,
      NULLIF(btrim(coalesce(p_data->>'discount_account', '')), ''),
      NULLIF(btrim(coalesce(p_data->>'notes', '')), ''),
      NULLIF(btrim(coalesce(p_data->>'invoice_image', '')), ''),
      v_lines_data,
      coalesce((p_data->>'is_auto_distributed')::boolean, false),
      v_paid_amount,
      false,
      auth.uid(),
      v_project_id, v_payee_id, v_job_order_id, v_custody_id, v_asset_id,
      coalesce((p_data->>'is_deducted_from_contractor')::boolean, false)
    )
    ON CONFLICT ON CONSTRAINT expenses_company_client_req_uq DO NOTHING
    RETURNING id INTO v_inserted_id;

    IF v_inserted_id IS NULL AND v_client_req_id IS NOT NULL THEN
      SELECT e.id, to_jsonb(e) INTO v_existing_id, v_row_json
      FROM public.expenses e
      WHERE e.company_id = v_company
        AND e.client_request_id = v_client_req_id;

      RETURN jsonb_build_object(
        'success', true,
        'id', v_existing_id,
        'company_id', v_company,
        'client_request_id', v_client_req_id,
        '_sync_replayed', true,
        'record', v_row_json
      );
    END IF;
  END IF;

  SELECT to_jsonb(e) INTO v_row_json
  FROM public.expenses e
  WHERE e.id = v_inserted_id AND e.company_id = v_company;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_inserted_id,
    'company_id', v_company,
    'client_request_id', v_client_req_id,
    '_sync_replayed', false,
    'record', v_row_json
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_expense_draft(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_expense_draft(jsonb) TO authenticated, service_role;

-- =============================================================================
-- 6. SUPABASE REALTIME PUBLICATION FOR COMPANY-SCOPED LIVE UPDATES
-- =============================================================================
-- Uses REPLICA IDENTITY USING INDEX on (id, company_id) so WAL carries company_id
-- on INSERT/UPDATE/DELETE without putting STORED GENERATED columns (e.g. expenses.total_price,
-- labor_daily_logs.total_pay) into the replica identity.
CREATE TABLE rawasi_private.phase8_realtime_originals (
  table_name text PRIMARY KEY,
  was_in_publication boolean NOT NULL,
  prev_replident "char" NOT NULL,
  prev_replident_index text,
  created_index_name text
);

REVOKE ALL ON rawasi_private.phase8_realtime_originals FROM PUBLIC, anon, authenticated;

DO $realtime$
DECLARE
  v_tbl text;
  v_oid oid;
  v_has_pub boolean;
  v_in_pub boolean;
  v_repl "char";
  v_prev_idx text;
  v_idx_name text;
  v_created_idx text;
  v_tables text[] := ARRAY[
    'labor_daily_logs',
    'expenses',
    'site_custodies',
    'daily_cash_closings',
    'invoices',
    'invoice_adjustment_notes',
    'receipt_vouchers',
    'payment_vouchers',
    'sub_claims',
    'purchase_orders',
    'supplier_invoices',
    'material_receipts',
    'material_issues',
    'stocktaking_sessions',
    'fixed_assets',
    'journal_headers',
    'projects',
    'job_orders',
    'company_documents',
    'company_attachments'
  ];
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime' AND NOT puballtables
  ) INTO v_has_pub;

  FOREACH v_tbl IN ARRAY v_tables LOOP
    SELECT c.oid, c.relreplident INTO v_oid, v_repl
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = v_tbl;

    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'Expected table public.% to exist for Realtime registration', v_tbl;
    END IF;

    v_prev_idx := NULL;
    IF v_repl = 'i' THEN
      SELECT ic.relname INTO v_prev_idx
      FROM pg_index i
      JOIN pg_class ic ON ic.oid = i.indexrelid
      WHERE i.indrelid = v_oid AND i.indisreplident
      LIMIT 1;
    END IF;

    v_in_pub := EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = v_tbl
    );

    -- Find an existing valid unique non-partial index covering strictly (id, company_id)
    v_idx_name := NULL;
    v_created_idx := NULL;

    SELECT ic.relname INTO v_idx_name
    FROM pg_index i
    JOIN pg_class ic ON ic.oid = i.indexrelid
    WHERE i.indrelid = v_oid
      AND i.indisunique
      AND i.indisvalid
      AND i.indpred IS NULL
      AND i.indexprs IS NULL
      AND i.indnatts = 2
      AND (
        SELECT array_agg(a.attname::text ORDER BY a.attname)
        FROM unnest(i.indkey::smallint[]) AS k(attnum)
        JOIN pg_attribute a ON a.attrelid = v_oid AND a.attnum = k.attnum
      ) = ARRAY['company_id', 'id']
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(i.indkey::smallint[]) AS k(attnum)
        JOIN pg_attribute a ON a.attrelid = v_oid AND a.attnum = k.attnum
        WHERE NOT a.attnotnull OR a.attgenerated <> ''
      )
    ORDER BY i.indisprimary DESC, ic.relname
    LIMIT 1;

    IF v_idx_name IS NULL THEN
      v_created_idx := v_tbl || '_realtime_ident_idx';
      EXECUTE format('CREATE UNIQUE INDEX %I ON public.%I (id, company_id)', v_created_idx, v_tbl);
      v_idx_name := v_created_idx;
    END IF;

    INSERT INTO rawasi_private.phase8_realtime_originals(
      table_name, was_in_publication, prev_replident, prev_replident_index, created_index_name
    ) VALUES (
      v_tbl, v_in_pub, v_repl, v_prev_idx, v_created_idx
    );

    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY USING INDEX %I', v_tbl, v_idx_name);

    IF v_has_pub AND NOT v_in_pub THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.%I', v_tbl);
    END IF;
  END LOOP;
END;
$realtime$;

COMMIT;

NOTIFY pgrst, 'reload schema';
