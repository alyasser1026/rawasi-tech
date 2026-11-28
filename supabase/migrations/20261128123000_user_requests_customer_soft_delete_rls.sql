-- Batch 6: Enforce customer self soft-delete RLS & column guard on public.user_requests.
-- Customers may ONLY update their own row (user_id = auth.uid()) from status IN ('جديد', 'new')
-- to 'محذوف بواسطة العميل', keeping admins & service_role fully intact.

DROP POLICY IF EXISTS own_records ON public.user_requests;
DROP POLICY IF EXISTS user_requests_select ON public.user_requests;
DROP POLICY IF EXISTS user_requests_insert ON public.user_requests;
DROP POLICY IF EXISTS user_requests_customer_soft_delete ON public.user_requests;
DROP POLICY IF EXISTS user_requests_delete ON public.user_requests;

CREATE POLICY user_requests_select
  ON public.user_requests
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR rawasi_private.is_admin()
  );

CREATE POLICY user_requests_insert
  ON public.user_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR rawasi_private.is_admin()
  );

CREATE POLICY user_requests_customer_soft_delete
  ON public.user_requests
  FOR UPDATE
  TO authenticated
  USING (
    rawasi_private.is_admin()
    OR (
      user_id = (SELECT auth.uid())
      AND status IN ('جديد', 'new')
    )
  )
  WITH CHECK (
    rawasi_private.is_admin()
    OR (
      user_id = (SELECT auth.uid())
      AND status = 'محذوف بواسطة العميل'
    )
  );

CREATE POLICY user_requests_delete
  ON public.user_requests
  FOR DELETE
  TO authenticated
  USING (rawasi_private.is_admin());

-- SECURITY INVOKER is critical so current_user reflects the actual caller role
-- ('authenticated' vs 'service_role'/'postgres') and never short-circuits for customers.
CREATE OR REPLACE FUNCTION public.enforce_user_requests_customer_soft_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  jwt_role text := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif((nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'), ''),
    ''
  );
  caller_uid uuid;
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role')
     OR jwt_role = 'service_role'
     OR rawasi_private.is_admin() THEN
    RETURN NEW;
  END IF;

  caller_uid := auth.uid();
  IF OLD.user_id IS NULL OR caller_uid IS NULL OR OLD.user_id <> caller_uid THEN
    RAISE EXCEPTION 'غير مصرح بتعديل طلب لا يخص حسابك' USING ERRCODE = '42501';
  END IF;

  IF OLD.status NOT IN ('جديد', 'new') THEN
    RAISE EXCEPTION 'لا يمكن حذف أو تعديل الطلب بعد تأكيده أو بدء متابعته' USING ERRCODE = '42501';
  END IF;

  IF NEW.status IS DISTINCT FROM 'محذوف بواسطة العميل' THEN
    RAISE EXCEPTION 'مسموح للعميل بتحويل حالة الطلب إلى محذوف بواسطة العميل فقط' USING ERRCODE = '42501';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.type IS DISTINCT FROM OLD.type
     OR NEW.category IS DISTINCT FROM OLD.category
     OR NEW.subject IS DISTINCT FROM OLD.subject
     OR NEW.details IS DISTINCT FROM OLD.details
     OR NEW.admin_note IS DISTINCT FROM OLD.admin_note
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'غير مصرح بتعديل بيانات الطلب أو ملاحظاته' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_user_requests_customer_soft_delete ON public.user_requests;
CREATE TRIGGER trg_enforce_user_requests_customer_soft_delete
  BEFORE UPDATE ON public.user_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_user_requests_customer_soft_delete();

NOTIFY pgrst, 'reload schema';
