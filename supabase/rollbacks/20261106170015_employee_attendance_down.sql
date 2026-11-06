-- =============================================================================
-- Rollback Migration: 20261106170015_employee_attendance_down.sql
-- Description: Revert Phase 11 - Employee Attendance & Partner Salaries
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

-- 1. Remove from Realtime Publication
DO $rt$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime DROP TABLE public.employee_attendance;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime DROP TABLE public.partner_salaries;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
  END IF;
END;
$rt$;

-- 2. Drop functions & RPCs
DROP FUNCTION IF EXISTS public.mark_unrecorded_days(text, date, text);
DROP FUNCTION IF EXISTS public.get_company_monthly_attendance(text, date);
DROP FUNCTION IF EXISTS public.get_employee_absence_summary(uuid, text, date);
DROP FUNCTION IF EXISTS rawasi_private.trg_lock_attendance_on_posted_payroll() CASCADE;
DROP FUNCTION IF EXISTS rawasi_private.trg_validate_employee_partner() CASCADE;

-- 3. Restore save_payroll_drafts & save_and_post_payroll to exact pre-Phase-11 definitions
CREATE OR REPLACE FUNCTION public.save_payroll_drafts(p_month text, p_cutoff_date date, p_rows jsonb) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $_$
DECLARE r record; existing public.payroll_slips%ROWTYPE; first_day date; last_day date;
  opening numeric; deductions numeric; advances numeric; net numeric; saved integer:=0; found_existing boolean;
BEGIN
  IF p_month IS NULL OR p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'حدد شهر المسير بصيغة سنة-شهر' USING ERRCODE='23514'; END IF;
  first_day:=make_date(substring(p_month,1,4)::integer,substring(p_month,6,2)::integer,1);
  last_day:=(first_day+interval '1 month - 1 day')::date;
  IF p_cutoff_date IS NULL OR p_cutoff_date NOT BETWEEN first_day AND last_day THEN
    RAISE EXCEPTION 'تاريخ القطع يجب أن يكون داخل شهر المسير' USING ERRCODE='23514'; END IF;
  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'بيانات المسير يجب أن تكون قائمة' USING ERRCODE='23514'; END IF;
  IF jsonb_array_length(p_rows)=0 THEN RAISE EXCEPTION 'اختر رواتب للحفظ' USING ERRCODE='23514'; END IF;
  IF NOT rawasi_private.can_access('payroll','view') OR NOT rawasi_private.can_access('partners','view')
    OR NOT rawasi_private.can_access('journal','view') OR NOT rawasi_private.can_access('payments','view')
    OR NOT rawasi_private.can_access('violations','view') THEN
    RAISE EXCEPTION 'يلزم عرض الموظفين والمسير والحركات المرتبطة لحساب الرصيد' USING ERRCODE='42501'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_to_recordset(p_rows) AS x(emp_id uuid) GROUP BY emp_id HAVING count(*)>1) THEN
    RAISE EXCEPTION 'الموظف مكرر في الاختيار' USING ERRCODE='23514'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('rawasi:payroll:'||p_month,0));
  FOR r IN SELECT * FROM jsonb_to_recordset(p_rows) AS x(
    emp_id uuid,basic_salary numeric,allowances numeric,amount_to_pay numeric,status text
  ) ORDER BY emp_id LOOP
    IF r.emp_id IS NULL OR r.basic_salary IS NULL OR r.allowances IS NULL OR r.amount_to_pay IS NULL
      OR r.basic_salary<0 OR r.allowances<0 OR r.amount_to_pay<0
      OR r.basic_salary>='Infinity'::numeric OR r.allowances>='Infinity'::numeric OR r.amount_to_pay>='Infinity'::numeric THEN
      RAISE EXCEPTION 'بيانات الراتب والبدلات والصرف يجب أن تكون مبالغ صحيحة غير سالبة' USING ERRCODE='23514'; END IF;
    PERFORM 1 FROM public.partners WHERE id=r.emp_id AND partner_type='موظف';
    IF NOT FOUND THEN RAISE EXCEPTION 'الحفظ والترحيل هنا للموظفين الشهريين فقط' USING ERRCODE='23514'; END IF;
    SELECT * INTO existing FROM public.payroll_slips WHERE emp_id=r.emp_id AND month=p_month FOR UPDATE;
    found_existing:=FOUND;
    IF found_existing AND (existing.is_posted OR existing.journal_header_id IS NOT NULL OR
      EXISTS(SELECT 1 FROM public.journal_headers WHERE reference_id=existing.id)) THEN
      RAISE EXCEPTION 'أحد الرواتب مرحل؛ يجب فك ترحيله قبل الحفظ' USING ERRCODE='23514'; END IF;
    IF (found_existing AND NOT rawasi_private.can_access('payroll','edit')) OR
      (NOT found_existing AND NOT rawasi_private.can_access('payroll','create')) THEN
      RAISE EXCEPTION 'لا توجد صلاحية حفظ الراتب' USING ERRCODE='42501'; END IF;
    SELECT COALESCE(SUM(credit-debit),0) INTO opening FROM public.partner_statement_ledger
      WHERE partner_id=r.emp_id AND transaction_date<first_day;
    SELECT total_violations,total_payments INTO deductions,advances
      FROM public.pull_payroll_module_data(extract(month from first_day)::integer,extract(year from first_day)::integer,p_cutoff_date)
      WHERE partner_id=r.emp_id;
    net:=opening+r.basic_salary+r.allowances-COALESCE(deductions,0)-COALESCE(advances,0);
    IF r.amount_to_pay>GREATEST(net,0) THEN RAISE EXCEPTION 'مبلغ الصرف المخطط أكبر من الرصيد المتاح' USING ERRCODE='23514'; END IF;
    IF r.status IS NULL OR r.status NOT IN ('غير مدفوع','مدفوع') THEN
      RAISE EXCEPTION 'حالة المسير غير صحيحة' USING ERRCODE='23514'; END IF;
    IF found_existing THEN
      UPDATE public.payroll_slips SET basic_salary=r.basic_salary,allowances=r.allowances,total_advances=COALESCE(advances,0),
        total_deductions=COALESCE(deductions,0),previous_balance=opening,net_salary=net,amount_to_pay=r.amount_to_pay,
        status=r.status,cutoff_date=p_cutoff_date WHERE id=existing.id;
    ELSE
      INSERT INTO public.payroll_slips(emp_id,month,basic_salary,allowances,total_advances,total_deductions,previous_balance,
        net_salary,amount_to_pay,status,cutoff_date,is_posted)
      VALUES(r.emp_id,p_month,r.basic_salary,r.allowances,COALESCE(advances,0),COALESCE(deductions,0),opening,
        net,r.amount_to_pay,r.status,p_cutoff_date,false);
    END IF;
    IF NOT FOUND THEN RAISE EXCEPTION 'تعذر حفظ الراتب؛ راجع الصلاحيات' USING ERRCODE='42501'; END IF;
    saved:=saved+1;
  END LOOP;
  RETURN saved;
END;
$_$;

CREATE OR REPLACE FUNCTION public.save_and_post_payroll(p_month text, p_cutoff_date date, p_rows jsonb) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE s public.payroll_slips%ROWTYPE; expense_account uuid; liability_account uuid; header uuid; posted integer:=0;
BEGIN
  IF NOT rawasi_private.can_access('payroll','edit') OR NOT rawasi_private.can_access('journal','create')
    OR NOT rawasi_private.can_access('accounts','view') THEN
    RAISE EXCEPTION 'لا توجد صلاحية ترحيل الرواتب' USING ERRCODE='42501'; END IF;
  PERFORM public.save_payroll_drafts(p_month,p_cutoff_date,p_rows);
  SELECT id INTO STRICT expense_account FROM public.accounts WHERE code='512' AND is_transactional;
  SELECT id INTO STRICT liability_account FROM public.accounts WHERE code='216' AND is_transactional;
  FOR s IN SELECT p.* FROM public.payroll_slips p
    WHERE p.month=p_month AND p.emp_id IN(SELECT x.emp_id FROM jsonb_to_recordset(p_rows) AS x(emp_id uuid))
    ORDER BY p.emp_id FOR UPDATE LOOP
    IF COALESCE(s.basic_salary,0)+COALESCE(s.allowances,0)<=0 THEN
      RAISE EXCEPTION 'لا يمكن ترحيل راتب بلا استحقاق موجب' USING ERRCODE='23514'; END IF;
    IF EXISTS(SELECT 1 FROM public.labor_daily_logs l WHERE l.worker_partner_id=s.emp_id AND l.is_posted
      AND to_char(l.work_date,'YYYY-MM')=p_month AND l.daily_wage>0) THEN
      RAISE EXCEPTION 'الموظف له يوميات مرحلة في الشهر؛ صحح التصنيف أو الاستحقاق لتجنب تكرار المصروف' USING ERRCODE='23514'; END IF;
    INSERT INTO public.journal_headers(entry_date,description,status,v_type,reference_id)
      VALUES(p_cutoff_date,'استحقاق راتب شهري '||p_month,'posted','payroll_slips',s.id) RETURNING id INTO header;
    INSERT INTO public.journal_lines(header_id,account_id,partner_id,debit,credit,notes)
      VALUES(header,expense_account,NULL,s.basic_salary+COALESCE(s.allowances,0),0,'مصروف الراتب والبدلات الشهرية'),
        (header,liability_account,s.emp_id,0,s.basic_salary+COALESCE(s.allowances,0),'استحقاق الموظف؛ السلف والجزاءات من شاشاتها');
    UPDATE public.payroll_slips SET is_posted=true,journal_header_id=header WHERE id=s.id;
    IF NOT FOUND THEN RAISE EXCEPTION 'تعذر تحديث حالة الراتب' USING ERRCODE='42501'; END IF;
    posted:=posted+1;
  END LOOP;
  IF posted=0 THEN RAISE EXCEPTION 'لم يتم ترحيل أي راتب' USING ERRCODE='23514'; END IF;
  RETURN posted;
END;
$$;

-- 4. Drop columns from payroll_slips
ALTER TABLE public.payroll_slips
  DROP COLUMN IF EXISTS absence_deduction,
  DROP COLUMN IF EXISTS absence_days;

-- 5. Drop tables
DROP TABLE IF EXISTS public.employee_attendance CASCADE;
DROP TABLE IF EXISTS public.partner_salaries CASCADE;

-- 6. Remove from scoped tables registry
DELETE FROM rawasi_private.company_scoped_tables
WHERE table_name IN ('partner_salaries', 'employee_attendance');

COMMIT;
