-- Phase 6: monthly payroll and financial document workflows.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

ALTER TABLE public.payroll_slips
  ADD COLUMN previous_balance numeric NOT NULL DEFAULT 0,
  ADD COLUMN cutoff_date date,
  ADD COLUMN journal_header_id uuid REFERENCES public.journal_headers(id) ON DELETE RESTRICT,
  ADD CONSTRAINT payroll_slips_journal_header_unique UNIQUE(journal_header_id),
  ADD CONSTRAINT payroll_slips_previous_balance_finite CHECK(previous_balance>'-Infinity'::numeric AND previous_balance<'Infinity'::numeric);

CREATE OR REPLACE FUNCTION public.get_payroll_balances_with_cutoff(p_month integer,p_year integer,p_cutoff_date date DEFAULT CURRENT_DATE)
RETURNS TABLE(partner_id uuid,previous_unpaid_balance numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $$
  SELECT p.id,COALESCE(SUM(l.credit-l.debit),0)
  FROM public.partners p LEFT JOIN public.partner_statement_ledger l
    ON l.partner_id=p.id AND l.transaction_date<make_date(p_year,p_month,1)
  WHERE p.partner_type IN ('موظف','عامل','عامل يومية') GROUP BY p.id;
$$;

CREATE OR REPLACE FUNCTION public.pull_payroll_module_data(p_month integer,p_year integer,p_cutoff_date date DEFAULT CURRENT_DATE)
RETURNS TABLE(partner_id uuid,days_worked numeric,total_earned_wage numeric,total_violations numeric,total_payments numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $$
  WITH period AS (
    SELECT make_date(p_year,p_month,1) AS first_day,
      LEAST(p_cutoff_date,(make_date(p_year,p_month,1)+interval '1 month - 1 day')::date) AS last_day
  )
  SELECT p.id,
    COALESCE((SELECT SUM(l.attendance_value) FROM public.labor_daily_logs l,period t
      WHERE l.worker_partner_id=p.id AND l.work_date BETWEEN t.first_day AND t.last_day
        AND l.is_posted AND EXISTS(SELECT 1 FROM public.journal_headers h WHERE h.reference_id=l.id AND h.status IN ('posted','مرحل','معتمد'))),0),
    COALESCE((SELECT SUM(l.daily_wage) FROM public.labor_daily_logs l,period t
      WHERE l.worker_partner_id=p.id AND l.work_date BETWEEN t.first_day AND t.last_day
        AND l.is_posted AND EXISTS(SELECT 1 FROM public.journal_headers h WHERE h.reference_id=l.id AND h.status IN ('posted','مرحل','معتمد'))),0),
    COALESCE((SELECT SUM(v.amount) FROM public.violations v,period t
      WHERE v.partner_id=p.id AND v.date BETWEEN t.first_day AND t.last_day
        AND v.is_posted AND EXISTS(SELECT 1 FROM public.journal_headers h WHERE h.reference_id=v.id AND h.status IN ('posted','مرحل','معتمد'))),0),
    COALESCE((SELECT SUM(v.amount) FROM public.payment_vouchers v,period t
      WHERE v.partner_id=p.id AND v.date BETWEEN t.first_day AND t.last_day
        AND v.is_posted AND EXISTS(SELECT 1 FROM public.journal_headers h WHERE h.reference_id=v.id AND h.status IN ('posted','مرحل','معتمد'))),0)
  FROM public.partners p WHERE p.partner_type IN ('موظف','عامل','عامل يومية');
$$;

CREATE FUNCTION rawasi_private.protect_payroll_document()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE linked boolean;
BEGIN
  IF auth.uid() IS NULL AND current_setting('role',true) IN ('anon','authenticated') THEN
    RAISE EXCEPTION 'يلزم تسجيل الدخول لتعديل المسير' USING ERRCODE='42501'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.journal_headers WHERE reference_id=OLD.id OR id=OLD.journal_header_id) INTO linked;
  IF TG_OP='DELETE' THEN
    IF COALESCE(OLD.is_posted,false) OR linked THEN
      RAISE EXCEPTION 'يجب فك ترحيل الراتب قبل حذفه' USING ERRCODE='23514'; END IF;
    RETURN OLD;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id THEN RAISE EXCEPTION 'لا يمكن تغيير معرّف الراتب' USING ERRCODE='23514'; END IF;
  IF COALESCE(OLD.is_posted,false) OR linked THEN
    IF (to_jsonb(NEW)-ARRAY['is_posted','journal_header_id']) IS DISTINCT FROM
      (to_jsonb(OLD)-ARRAY['is_posted','journal_header_id']) THEN
      RAISE EXCEPTION 'يجب فك ترحيل الراتب قبل تعديله' USING ERRCODE='23514'; END IF;
    IF NOT COALESCE(NEW.is_posted,false) AND linked THEN
      RAISE EXCEPTION 'استخدم عملية فك ترحيل الراتب لإزالة قيده مع الحالة' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_protect_payroll_document BEFORE UPDATE OR DELETE ON public.payroll_slips
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.protect_payroll_document();

CREATE FUNCTION rawasi_private.lock_payroll_journal_source()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
  IF NEW.v_type IS DISTINCT FROM 'payroll_slips' THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL AND current_setting('role',true) IN ('anon','authenticated') THEN
    RAISE EXCEPTION 'يلزم تسجيل الدخول لترحيل الراتب' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.payroll_slips s JOIN public.partners p ON p.id=s.emp_id
    WHERE s.id=NEW.reference_id AND p.partner_type='موظف' FOR UPDATE OF s;
  IF NOT FOUND THEN RAISE EXCEPTION 'راتب الموظف الشهري غير موجود' USING ERRCODE='23503'; END IF;
  IF EXISTS(SELECT 1 FROM public.journal_headers WHERE reference_id=NEW.reference_id AND id<>NEW.id) THEN
    RAISE EXCEPTION 'الراتب له قيد بالفعل؛ يجب فك الترحيل أولاً' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_lock_payroll_journal_source BEFORE INSERT OR UPDATE OF reference_id,v_type ON public.journal_headers
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.lock_payroll_journal_source();
REVOKE ALL ON FUNCTION rawasi_private.protect_payroll_document(),rawasi_private.lock_payroll_journal_source()
  FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.save_payroll_drafts(p_month text,p_cutoff_date date,p_rows jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
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
$$;

CREATE FUNCTION public.save_and_post_payroll(p_month text,p_cutoff_date date,p_rows jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
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

CREATE FUNCTION public.unpost_payroll_slips(p_month text,p_employee_ids uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
DECLARE employee uuid; s public.payroll_slips%ROWTYPE; count_unposted integer:=0; headers uuid[];
BEGIN
  IF p_month IS NULL OR p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' OR COALESCE(cardinality(p_employee_ids),0)=0
    OR array_position(p_employee_ids,NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'حدد شهر المسير والموظفين لفك الترحيل' USING ERRCODE='23514'; END IF;
  IF NOT rawasi_private.can_access('payroll','view') OR NOT rawasi_private.can_access('payroll','edit')
    OR NOT rawasi_private.can_access('partners','view') OR NOT rawasi_private.can_access('journal','view')
    OR NOT rawasi_private.can_access('journal','delete') THEN
    RAISE EXCEPTION 'لا توجد صلاحية فك ترحيل الرواتب' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('rawasi:payroll:'||p_month,0));
  FOR employee IN SELECT DISTINCT id FROM unnest(p_employee_ids) AS ids(id) ORDER BY id LOOP
    SELECT p.* INTO s FROM public.payroll_slips p JOIN public.partners partner ON partner.id=p.emp_id
      WHERE p.month=p_month AND p.emp_id=employee AND partner.partner_type='موظف' FOR UPDATE OF p;
    IF NOT FOUND THEN RAISE EXCEPTION 'راتب الموظف غير موجود أو غير مسموح بعرضه' USING ERRCODE='42501'; END IF;
    SELECT array_agg(id) INTO headers FROM public.journal_headers
      WHERE v_type='payroll_slips' AND (reference_id=s.id OR id=s.journal_header_id);
    UPDATE public.payroll_slips SET journal_header_id=NULL WHERE id=s.id;
    DELETE FROM public.journal_headers WHERE id=ANY(headers);
    UPDATE public.payroll_slips SET is_posted=false WHERE id=s.id;
    IF NOT FOUND THEN RAISE EXCEPTION 'تعذر فك ترحيل الراتب' USING ERRCODE='42501'; END IF;
    count_unposted:=count_unposted+1;
  END LOOP;
  RETURN count_unposted;
END;
$$;
REVOKE ALL ON FUNCTION public.save_payroll_drafts(text,date,jsonb),public.save_and_post_payroll(text,date,jsonb),
  public.unpost_payroll_slips(text,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_payroll_drafts(text,date,jsonb),public.save_and_post_payroll(text,date,jsonb),
  public.unpost_payroll_slips(text,uuid[]) TO authenticated,service_role;
NOTIFY pgrst,'reload schema';
-- Financial document workflow repairs validated with the phase 6 local suite.
ALTER TABLE public.receipt_vouchers DROP CONSTRAINT receipt_vouchers_invoice_id_fkey;
ALTER TABLE public.receipt_vouchers ADD CONSTRAINT receipt_vouchers_invoice_id_fkey
  FOREIGN KEY(invoice_id) REFERENCES public.invoices(id) ON DELETE RESTRICT;
CREATE INDEX receipt_vouchers_invoice_id_idx ON public.receipt_vouchers(invoice_id);

CREATE FUNCTION rawasi_private.protect_invoice_receipt_document()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE linked boolean; old_data jsonb; new_data jsonb;
BEGIN
  IF auth.uid() IS NULL AND current_setting('role',true) IN ('anon','authenticated') THEN
    RAISE EXCEPTION 'يلزم تسجيل الدخول لتعديل المستند' USING ERRCODE='42501'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.journal_headers WHERE reference_id=OLD.id) INTO linked;
  IF TG_OP='DELETE' THEN
    IF OLD.status IN ('posted','مرحل','معتمد') OR linked THEN
      RAISE EXCEPTION 'يجب فك ترحيل المستند قبل حذفه' USING ERRCODE='23514'; END IF;
    IF TG_TABLE_NAME='invoices' AND EXISTS(SELECT 1 FROM public.receipt_vouchers WHERE invoice_id=OLD.id) THEN
      RAISE EXCEPTION 'الفاتورة مرتبطة بسندات قبض؛ لن يتم حذفها أو فك ارتباطها تلقائياً' USING ERRCODE='23503'; END IF;
    RETURN OLD;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id THEN RAISE EXCEPTION 'لا يمكن تغيير معرّف المستند' USING ERRCODE='23514'; END IF;
  IF OLD.status IN ('posted','مرحل','معتمد') OR linked THEN
    old_data:=to_jsonb(OLD)-ARRAY['status','updated_at'];new_data:=to_jsonb(NEW)-ARRAY['status','updated_at'];
    IF TG_TABLE_NAME='invoices' THEN old_data:=old_data-'paid_amount';new_data:=new_data-'paid_amount'; END IF;
    IF old_data IS DISTINCT FROM new_data THEN RAISE EXCEPTION 'يجب فك ترحيل المستند قبل تعديل بياناته' USING ERRCODE='23514'; END IF;
    IF NOT COALESCE(NEW.status IN ('posted','مرحل','معتمد'),false) AND linked THEN
      RAISE EXCEPTION 'استخدم عملية فك الترحيل لإزالة القيد والحالة معاً' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_protect_invoice_document BEFORE UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.protect_invoice_receipt_document();
CREATE TRIGGER trg_protect_receipt_document BEFORE UPDATE OR DELETE ON public.receipt_vouchers
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.protect_invoice_receipt_document();

CREATE FUNCTION rawasi_private.lock_invoice_receipt_source()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE receipt public.receipt_vouchers%ROWTYPE;
BEGIN
  IF NEW.v_type NOT IN ('invoices','فاتورة مبيعات','سند قبض','receipt_vouchers') OR NEW.reference_id IS NULL THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL AND current_setting('role',true) IN ('anon','authenticated') THEN
    RAISE EXCEPTION 'يلزم تسجيل الدخول لترحيل المستند' USING ERRCODE='42501'; END IF;
  IF NEW.v_type IN ('invoices','فاتورة مبيعات') THEN
    PERFORM 1 FROM public.invoices WHERE id=NEW.reference_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'الفاتورة غير موجودة' USING ERRCODE='23503'; END IF;
  ELSE
    SELECT * INTO receipt FROM public.receipt_vouchers WHERE id=NEW.reference_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'سند القبض غير موجود' USING ERRCODE='23503'; END IF;
    IF receipt.invoice_id IS NOT NULL THEN
      PERFORM 1 FROM public.invoices WHERE id=receipt.invoice_id AND status IN ('posted','مرحل','معتمد')
        AND partner_id IS NOT DISTINCT FROM receipt.partner_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'يجب ترحيل فاتورة العميل الصحيح قبل ترحيل سند قبضها' USING ERRCODE='23514'; END IF;
    END IF;
  END IF;
  IF EXISTS(SELECT 1 FROM public.journal_headers WHERE reference_id=NEW.reference_id AND id<>NEW.id) THEN
    RAISE EXCEPTION 'المستند له قيد بالفعل؛ فك ترحيله قبل إعادة الترحيل' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_lock_invoice_receipt_source BEFORE INSERT OR UPDATE OF reference_id,v_type ON public.journal_headers
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.lock_invoice_receipt_source();
REVOKE ALL ON FUNCTION rawasi_private.protect_invoice_receipt_document(),rawasi_private.lock_invoice_receipt_source()
  FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION rawasi_private.sync_invoice_payments()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE ids uuid[]; target uuid;
BEGIN
  IF auth.uid() IS NULL AND current_setting('role',true) IN ('anon','authenticated') THEN
    RAISE EXCEPTION 'يلزم تسجيل الدخول لتحديث التحصيل' USING ERRCODE='42501'; END IF;
  IF TG_OP='INSERT' THEN ids:=ARRAY[NEW.invoice_id];
  ELSIF TG_OP='DELETE' THEN ids:=ARRAY[OLD.invoice_id];
  ELSE ids:=ARRAY[OLD.invoice_id,NEW.invoice_id]; END IF;
  FOR target IN SELECT DISTINCT id FROM unnest(ids) AS i(id) WHERE id IS NOT NULL ORDER BY id LOOP
    PERFORM 1 FROM public.invoices WHERE id=target FOR UPDATE;
    UPDATE public.invoices SET paid_amount=(SELECT COALESCE(SUM(r.amount),0) FROM public.receipt_vouchers r
      WHERE r.invoice_id=target AND r.status IN ('posted','مرحل','معتمد') AND EXISTS(
        SELECT 1 FROM public.journal_headers h WHERE h.reference_id=r.id AND h.status IN ('posted','مرحل','معتمد')))
      WHERE id=target;
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.unpost_invoices_bulk(p_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
DECLARE target uuid;
BEGIN
  IF COALESCE(cardinality(p_ids),0)=0 OR array_position(p_ids,NULL) IS NOT NULL THEN RAISE EXCEPTION 'حدد فواتير صحيحة' USING ERRCODE='23514'; END IF;
  IF NOT rawasi_private.can_access('invoices','view') OR NOT rawasi_private.can_access('invoices','edit')
    OR NOT rawasi_private.can_access('receipts','view') OR NOT rawasi_private.can_access('journal','view')
    OR NOT rawasi_private.can_access('journal','delete') THEN RAISE EXCEPTION 'لا توجد صلاحية فك ترحيل الفواتير وقيودها' USING ERRCODE='42501'; END IF;
  FOR target IN SELECT DISTINCT id FROM unnest(p_ids) AS i(id) ORDER BY id LOOP
    PERFORM 1 FROM public.invoices WHERE id=target FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'الفاتورة غير موجودة أو غير مسموح بعرضها' USING ERRCODE='42501'; END IF;
    IF EXISTS(SELECT 1 FROM public.receipt_vouchers r WHERE invoice_id=target AND (status IN ('posted','مرحل','معتمد')
      OR EXISTS(SELECT 1 FROM public.journal_headers h WHERE h.reference_id=r.id))) THEN
      RAISE EXCEPTION 'فك ترحيل سندات قبض الفاتورة أولاً؛ ستبقى السندات محفوظة' USING ERRCODE='23514'; END IF;
    DELETE FROM public.journal_headers WHERE reference_id=target AND v_type IN ('invoices','فاتورة مبيعات');
    UPDATE public.invoices SET status='معلق' WHERE id=target;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.unpost_receipts_bulk(p_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
DECLARE target uuid;
BEGIN
  IF COALESCE(cardinality(p_ids),0)=0 OR array_position(p_ids,NULL) IS NOT NULL THEN RAISE EXCEPTION 'حدد سندات صحيحة' USING ERRCODE='23514'; END IF;
  IF NOT rawasi_private.can_access('receipts','view') OR NOT rawasi_private.can_access('receipts','edit')
    OR NOT rawasi_private.can_access('journal','view') OR NOT rawasi_private.can_access('journal','delete') THEN
    RAISE EXCEPTION 'لا توجد صلاحية فك ترحيل سندات القبض' USING ERRCODE='42501'; END IF;
  FOR target IN SELECT DISTINCT id FROM unnest(p_ids) AS i(id) ORDER BY id LOOP
    PERFORM 1 FROM public.receipt_vouchers WHERE id=target FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'سند القبض غير موجود أو غير مسموح بعرضه' USING ERRCODE='42501'; END IF;
    DELETE FROM public.journal_headers WHERE reference_id=target AND v_type IN ('سند قبض','receipt_vouchers');
    UPDATE public.receipt_vouchers SET status='مسودة' WHERE id=target;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_invoices_bulk(p_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
DECLARE target uuid;
BEGIN
  IF COALESCE(cardinality(p_ids),0)=0 OR array_position(p_ids,NULL) IS NOT NULL THEN RAISE EXCEPTION 'حدد الفواتير' USING ERRCODE='23514'; END IF;
  IF NOT rawasi_private.can_access('invoices','view') OR NOT rawasi_private.can_access('invoices','delete')
    THEN RAISE EXCEPTION 'لا توجد صلاحية حذف الفواتير' USING ERRCODE='42501'; END IF;
  FOR target IN SELECT DISTINCT id FROM unnest(p_ids) AS i(id) ORDER BY id LOOP
    DELETE FROM public.invoices WHERE id=target;
    IF NOT FOUND THEN RAISE EXCEPTION 'الفاتورة غير موجودة أو غير مسموح بحذفها' USING ERRCODE='42501'; END IF;
  END LOOP;
END;
$$;
CREATE OR REPLACE FUNCTION public.delete_receipts_bulk(p_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
DECLARE target uuid;
BEGIN
  IF COALESCE(cardinality(p_ids),0)=0 OR array_position(p_ids,NULL) IS NOT NULL THEN RAISE EXCEPTION 'حدد سندات القبض' USING ERRCODE='23514'; END IF;
  IF NOT rawasi_private.can_access('receipts','view') OR NOT rawasi_private.can_access('receipts','delete')
    THEN RAISE EXCEPTION 'لا توجد صلاحية حذف سندات القبض' USING ERRCODE='42501'; END IF;
  FOR target IN SELECT DISTINCT id FROM unnest(p_ids) AS i(id) ORDER BY id LOOP
    DELETE FROM public.receipt_vouchers WHERE id=target;
    IF NOT FOUND THEN RAISE EXCEPTION 'سند القبض غير موجود أو غير مسموح بحذفه' USING ERRCODE='42501'; END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.unpost_expenses_bulk(record_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
DECLARE target uuid;
BEGIN
  IF COALESCE(cardinality(record_ids),0)=0 OR array_position(record_ids,NULL) IS NOT NULL THEN RAISE EXCEPTION 'حدد المصروفات' USING ERRCODE='23514'; END IF;
  IF NOT rawasi_private.can_access('expenses','view') OR NOT rawasi_private.can_access('expenses','edit')
    OR NOT rawasi_private.can_access('payments','view') OR NOT rawasi_private.can_access('journal','view')
    OR NOT rawasi_private.can_access('journal','delete') THEN RAISE EXCEPTION 'لا توجد صلاحية فك ترحيل المصروفات' USING ERRCODE='42501'; END IF;
  FOR target IN SELECT DISTINCT id FROM unnest(record_ids) AS i(id) ORDER BY id LOOP
    PERFORM 1 FROM public.expenses WHERE id=target FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'المصروف غير موجود أو غير مسموح بعرضه' USING ERRCODE='42501'; END IF;
    IF EXISTS(SELECT 1 FROM public.payment_vouchers p WHERE related_expense_id=target AND (is_posted OR status IN ('posted','مرحل','معتمد')
      OR EXISTS(SELECT 1 FROM public.journal_headers h WHERE h.reference_id=p.id))) THEN
      RAISE EXCEPTION 'فك ترحيل سندات صرف المصروف أولاً؛ لن يتم حذفها' USING ERRCODE='23514'; END IF;
    DELETE FROM public.journal_headers WHERE reference_id=target AND v_type IN ('expense','expenses');
    UPDATE public.expenses SET is_posted=false WHERE id=target;
  END LOOP;
END;
$$;
CREATE FUNCTION public.create_and_post_sub_claim(p_request_id uuid,p_claim jsonb,p_assignment_ids uuid[],p_material_ids uuid[] DEFAULT '{}',p_expense_ids uuid[] DEFAULT '{}')
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
DECLARE c record; old public.sub_claims%ROWTYPE; target uuid; affected integer;
BEGIN
  IF NOT rawasi_private.can_access('subclaims','view') OR NOT rawasi_private.can_access('subclaims','create')
    OR NOT rawasi_private.can_access('subclaims','edit') OR NOT rawasi_private.can_access('journal','create') THEN
    RAISE EXCEPTION 'لا توجد صلاحية إنشاء وترحيل المستخلص' USING ERRCODE='42501'; END IF;
  IF p_request_id IS NULL OR COALESCE(cardinality(p_assignment_ids),0)=0 THEN RAISE EXCEPTION 'حدد الأعمال ورقم الطلب' USING ERRCODE='23514'; END IF;
  SELECT * INTO c FROM jsonb_to_record(p_claim) AS x(contractor_id uuid,project_ids uuid[],project_names_text text,date date,
    total_amount numeric,retention_amount numeric,advance_payment numeric,materials_deduction numeric,other_deductions numeric,net_amount numeric,payment_period_days integer);
  IF c.contractor_id IS NULL OR COALESCE(cardinality(c.project_ids),0)=0 OR c.date IS NULL OR c.total_amount IS NULL
    OR c.total_amount<=0 OR c.total_amount>='Infinity'::numeric OR c.retention_amount IS NULL OR c.retention_amount<0
    OR c.retention_amount>c.total_amount OR COALESCE(c.advance_payment,0)<0 OR COALESCE(c.materials_deduction,0)<0
    OR COALESCE(c.other_deductions,0)<0 OR c.net_amount IS NULL OR c.net_amount<'-Infinity'::numeric
    OR c.net_amount>='Infinity'::numeric OR abs(c.net_amount-(c.total_amount-c.retention_amount-COALESCE(c.advance_payment,0)
      -COALESCE(c.materials_deduction,0)-COALESCE(c.other_deductions,0)))>0.005 THEN
    RAISE EXCEPTION 'مبالغ المستخلص وخصوماته غير متوافقة' USING ERRCODE='23514'; END IF;
  -- Serialize retries of the same client request, including first insertion.
  PERFORM pg_advisory_xact_lock(hashtextextended('rawasi:claim:'||p_request_id::text,0));
  SELECT * INTO old FROM public.sub_claims WHERE id=p_request_id FOR UPDATE;
  IF FOUND THEN
    IF old.is_posted AND old.contractor_id=c.contractor_id AND old.date=c.date AND old.total_amount=round(c.total_amount,2)
      AND old.retention_amount=round(c.retention_amount,2) AND old.net_amount=round(c.net_amount,2)
      AND old.advance_payment=round(COALESCE(c.advance_payment,0),2) AND old.materials_deduction=round(COALESCE(c.materials_deduction,0),2)
      AND old.other_deductions=round(COALESCE(c.other_deductions,0),2)
      AND old.project_ids IS NOT DISTINCT FROM c.project_ids
      AND NOT EXISTS((SELECT id FROM public.contractor_assignments WHERE claim_id=old.id EXCEPT SELECT unnest(p_assignment_ids))
        UNION ALL (SELECT unnest(p_assignment_ids) EXCEPT SELECT id FROM public.contractor_assignments WHERE claim_id=old.id))
      THEN RETURN old.id; END IF;
    RAISE EXCEPTION 'رقم الطلب مستخدم؛ راجع المستخلص قبل إعادة الإرسال' USING ERRCODE='23514';
  END IF;
  IF array_position(p_assignment_ids,NULL) IS NOT NULL OR array_position(p_material_ids,NULL) IS NOT NULL
    OR array_position(p_expense_ids,NULL) IS NOT NULL THEN RAISE EXCEPTION 'معرّفات الأعمال والخصومات غير صحيحة' USING ERRCODE='23514'; END IF;
  FOR target IN SELECT DISTINCT id FROM unnest(p_assignment_ids) AS i(id) ORDER BY id LOOP
    PERFORM 1 FROM public.contractor_assignments WHERE id=target AND contractor_id=c.contractor_id
      AND project_id=ANY(c.project_ids) AND claim_id IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'أحد الأعمال غير متاح أو سبق إدخاله في مستخلص' USING ERRCODE='23514'; END IF;
  END LOOP;
  INSERT INTO public.sub_claims(id,claim_number,contractor_id,project_id,project_ids,project_names_text,date,total_amount,
    retention_amount,advance_payment,materials_deduction,other_deductions,net_amount,payment_period_days,is_posted,status,paid_amount)
  VALUES(p_request_id,'CLM-'||p_request_id::text,c.contractor_id,c.project_ids[1],c.project_ids,c.project_names_text,c.date,
    c.total_amount,c.retention_amount,COALESCE(c.advance_payment,0),COALESCE(c.materials_deduction,0),COALESCE(c.other_deductions,0),
    c.net_amount,COALESCE(c.payment_period_days,14),false,'مسودة',0);
  UPDATE public.contractor_assignments SET claim_id=p_request_id,status='مفوتر' WHERE id=ANY(p_assignment_ids) AND claim_id IS NULL;
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>(SELECT count(DISTINCT id) FROM unnest(p_assignment_ids) AS i(id)) THEN RAISE EXCEPTION 'تعذر ربط جميع الأعمال؛ راجع الصلاحيات' USING ERRCODE='42501'; END IF;
  FOR target IN SELECT DISTINCT id FROM unnest(COALESCE(p_material_ids,'{}')) AS i(id) ORDER BY id LOOP
    UPDATE public.material_issue_lines SET claim_id=p_request_id WHERE id=target AND claim_id IS NULL AND job_order_id IN(
      SELECT job_order_id FROM public.contractor_assignments WHERE claim_id=p_request_id);
    IF NOT FOUND THEN RAISE EXCEPTION 'تعذر ربط أحد بنود الخامات أو سبق خصمه' USING ERRCODE='23514'; END IF;
  END LOOP;
  FOR target IN SELECT DISTINCT id FROM unnest(COALESCE(p_expense_ids,'{}')) AS i(id) ORDER BY id LOOP
    UPDATE public.expenses SET claim_id=p_request_id,is_deducted_in_claim=true
      WHERE id=target AND claim_id IS NULL AND payee_id=c.contractor_id AND project_id=ANY(c.project_ids);
    IF NOT FOUND THEN RAISE EXCEPTION 'تعذر ربط أحد المصروفات أو سبق خصمه' USING ERRCODE='23514'; END IF;
  END LOOP;
  PERFORM public.post_sub_claim(p_request_id);
  RETURN p_request_id;
END;
$$;

CREATE FUNCTION public.pay_sub_claim(p_request_id uuid,p_claim_id uuid,p_payment jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
DECLARE claim public.sub_claims%ROWTYPE; old public.payment_vouchers%ROWTYPE; payment record;
  debit_account uuid; credit_account uuid; paid numeric; amount numeric;
BEGIN
  IF NOT rawasi_private.can_access('payments','view') OR NOT rawasi_private.can_access('payments','create')
    OR NOT rawasi_private.can_access('payments','edit') OR NOT rawasi_private.can_access('subclaims','view')
    OR NOT rawasi_private.can_access('subclaims','edit') OR NOT rawasi_private.can_access('journal','create') THEN
    RAISE EXCEPTION 'لا توجد صلاحية صرف المستخلص وترحيله' USING ERRCODE='42501'; END IF;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'رقم طلب الصرف مطلوب' USING ERRCODE='23514'; END IF;
  SELECT * INTO payment FROM jsonb_to_record(p_payment) AS x(date date,amount numeric,payment_method text,
    debit_account_id uuid,credit_account_id uuid,description text,notes text,site_ref text,partner_id uuid);
  IF payment.amount IS NULL OR payment.amount<=0 OR payment.amount>='Infinity'::numeric OR payment.date IS NULL THEN
    RAISE EXCEPTION 'أدخل تاريخًا ومبلغًا صحيحًا للصرف' USING ERRCODE='23514'; END IF;
  amount:=round(payment.amount,2);
  IF amount<=0 THEN RAISE EXCEPTION 'مبلغ الصرف أقل من أصغر وحدة مالية' USING ERRCODE='23514'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('rawasi:claim_payment:'||p_request_id::text,0));
  SELECT * INTO claim FROM public.sub_claims WHERE id=p_claim_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'المستخلص غير موجود أو غير مسموح بعرضه' USING ERRCODE='42501'; END IF;
  IF NOT COALESCE(claim.is_posted,false) THEN RAISE EXCEPTION 'رحّل المستخلص قبل الصرف' USING ERRCODE='23514'; END IF;
  IF payment.partner_id IS NOT NULL AND payment.partner_id<>claim.contractor_id THEN RAISE EXCEPTION 'المستفيد لا يطابق مقاول المستخلص' USING ERRCODE='23514'; END IF;
  SELECT * INTO old FROM public.payment_vouchers WHERE id=p_request_id FOR UPDATE;
  IF FOUND THEN
    IF old.is_posted AND old.sub_claim_id=p_claim_id AND old.partner_id=claim.contractor_id AND old.amount=amount
      AND old.date=payment.date AND old.payment_method IS NOT DISTINCT FROM payment.payment_method
      AND old.debit_account_id IS NOT DISTINCT FROM COALESCE(payment.debit_account_id,old.debit_account_id)
      AND old.credit_account_id IS NOT DISTINCT FROM COALESCE(payment.credit_account_id,old.credit_account_id) THEN RETURN old.id; END IF;
    RAISE EXCEPTION 'رقم طلب الصرف مستخدم؛ راجع السند قبل إعادة الإرسال' USING ERRCODE='23514';
  END IF;
  SELECT COALESCE(SUM(p.amount),0) INTO paid FROM public.payment_vouchers p
    WHERE p.sub_claim_id=p_claim_id AND p.is_posted;
  IF amount>GREATEST(claim.net_amount-paid,0) THEN RAISE EXCEPTION 'مبلغ الصرف أكبر من المتبقي في المستخلص' USING ERRCODE='23514'; END IF;
  debit_account:=payment.debit_account_id;credit_account:=payment.credit_account_id;
  IF debit_account IS NULL THEN SELECT id INTO STRICT debit_account FROM public.accounts WHERE code='212'; END IF;
  IF credit_account IS NULL THEN SELECT id INTO STRICT credit_account FROM public.accounts WHERE code='1291'; END IF;
  INSERT INTO public.payment_vouchers(id,voucher_number,date,amount,partner_id,debit_account_id,credit_account_id,payment_method,
    project_ids,site_ref,description,notes,sub_claim_id,is_posted,status,created_by)
  VALUES(p_request_id,'PV-'||p_request_id::text,payment.date,amount,claim.contractor_id,debit_account,credit_account,
    payment.payment_method,claim.project_ids,payment.site_ref,payment.description,payment.notes,p_claim_id,false,'مسودة',auth.uid());
  PERFORM public.post_payment_vouchers_bulk(ARRAY[p_request_id]);
  UPDATE public.sub_claims SET paid_amount=paid+amount,status=CASE WHEN paid+amount>=net_amount THEN 'مدفوع' ELSE 'مسدد جزئي' END WHERE id=p_claim_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'تعذر تحديث سداد المستخلص' USING ERRCODE='42501'; END IF;
  RETURN p_request_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_and_post_sub_claim(uuid,jsonb,uuid[],uuid[],uuid[]),public.pay_sub_claim(uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_and_post_sub_claim(uuid,jsonb,uuid[],uuid[],uuid[]),public.pay_sub_claim(uuid,uuid,jsonb) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION rawasi_private.handle_payment_voucher_cash_flow()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
    v_project_id uuid := NULL;
BEGIN
    IF auth.uid() IS NULL AND current_setting('role',true) IN ('anon','authenticated') THEN
      RAISE EXCEPTION 'يلزم تسجيل الدخول لتحديث التدفق النقدي' USING ERRCODE='42501'; END IF;
    IF TG_OP <> 'DELETE' THEN
      IF NOT (COALESCE(NEW.is_posted,false) OR COALESCE(NEW.status IN ('posted','مرحل','معتمد'),false)) THEN
        DELETE FROM public.cash_flows WHERE source_id=NEW.id AND source_type='payment_voucher';
        RETURN NEW;
      END IF;
    END IF;
    IF TG_OP = 'DELETE' THEN
        DELETE FROM public.cash_flows WHERE source_id = OLD.id AND source_type = 'payment_voucher';
        RETURN OLD;
    END IF;

    -- 🛡️ حماية: تجاهل السندات التي قيمتها صفر أو أقل
    IF NEW.amount <= 0 THEN
        RETURN NEW;
    END IF;

    IF NEW.sub_claim_id IS NOT NULL THEN
        SELECT project_id INTO v_project_id FROM public.sub_claims WHERE id = NEW.sub_claim_id;
    ELSIF NEW.related_expense_id IS NOT NULL THEN
        SELECT project_id INTO v_project_id FROM public.expenses WHERE id = NEW.related_expense_id;
    END IF;

    IF EXISTS (SELECT 1 FROM public.cash_flows WHERE source_id = NEW.id AND source_type = 'payment_voucher') THEN
        UPDATE public.cash_flows SET
            transaction_date = NEW.date, amount = NEW.amount, payment_method = NEW.payment_method,
            reference_number = COALESCE(NEW.reference_no, NEW.voucher_number), description = COALESCE(NEW.description, NEW.notes),
            account_id = NEW.credit_account_id, project_id = v_project_id, partner_id = NEW.partner_id
        WHERE source_id = NEW.id AND source_type = 'payment_voucher';
    ELSE
        INSERT INTO public.cash_flows (
            transaction_date, flow_type, amount, category, sub_category, payment_method,
            reference_number, description, account_id, project_id, partner_id, source_id, source_type
        ) VALUES (
            NEW.date, 'outflow', NEW.amount, 'أنشطة تشغيلية', 'صرف بموجب سند صرف رقم: ' || COALESCE(NEW.voucher_number, ''),
            NEW.payment_method, COALESCE(NEW.reference_no, NEW.voucher_number), COALESCE(NEW.description, NEW.notes),
            NEW.credit_account_id, v_project_id, NEW.partner_id, NEW.id, 'payment_voucher'
        );
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION rawasi_private.handle_receipt_voucher_cash_flow()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
    v_project_id uuid := NULL;
BEGIN
    IF auth.uid() IS NULL AND current_setting('role',true) IN ('anon','authenticated') THEN
      RAISE EXCEPTION 'يلزم تسجيل الدخول لتحديث التدفق النقدي' USING ERRCODE='42501'; END IF;
    IF TG_OP <> 'DELETE' THEN
      IF NOT (COALESCE(NEW.status IN ('posted','مرحل','معتمد'),false)) THEN
        DELETE FROM public.cash_flows WHERE source_id=NEW.id AND source_type='receipt_voucher';
        RETURN NEW;
      END IF;
    END IF;
    IF TG_OP = 'DELETE' THEN
        DELETE FROM public.cash_flows WHERE source_id = OLD.id AND source_type = 'receipt_voucher';
        RETURN OLD;
    END IF;

    -- 🛡️ حماية: تجاهل السندات التي قيمتها صفر أو أقل
    IF NEW.amount <= 0 THEN
        RETURN NEW;
    END IF;

    IF NEW.project_ids IS NOT NULL AND array_length(NEW.project_ids, 1) > 0 THEN
        v_project_id := NEW.project_ids[1];
    END IF;

    IF EXISTS (SELECT 1 FROM public.cash_flows WHERE source_id = NEW.id AND source_type = 'receipt_voucher') THEN
        UPDATE public.cash_flows SET
            transaction_date = NEW.date, amount = NEW.amount, payment_method = NEW.payment_method,
            reference_number = COALESCE(NEW.reference_number, NEW.receipt_number), description = NEW.notes,
            account_id = NEW.safe_bank_acc_id, project_id = v_project_id, partner_id = NEW.partner_id
        WHERE source_id = NEW.id AND source_type = 'receipt_voucher';
    ELSE
        INSERT INTO public.cash_flows (
            transaction_date, flow_type, amount, category, sub_category, payment_method,
            reference_number, description, account_id, project_id, partner_id, source_id, source_type
        ) VALUES (
            NEW.date, 'inflow', NEW.amount, 'أنشطة تشغيلية', 'تحصيل بموجب سند قبض رقم: ' || COALESCE(NEW.receipt_number, ''),
            NEW.payment_method, COALESCE(NEW.reference_number, NEW.receipt_number), NEW.notes,
            NEW.safe_bank_acc_id, v_project_id, NEW.partner_id, NEW.id, 'receipt_voucher'
        );
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.unpost_universal_bulk(p_table_name text, p_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
    v_voucher_ids uuid[];
BEGIN
    IF p_table_name='expenses' THEN PERFORM public.unpost_expenses_bulk(p_ids); RETURN; END IF;
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
REVOKE ALL ON FUNCTION public.unpost_invoices_bulk(uuid[]),public.unpost_receipts_bulk(uuid[]),public.delete_invoices_bulk(uuid[]),public.delete_receipts_bulk(uuid[]),public.unpost_expenses_bulk(uuid[]) FROM PUBLIC,anon;
