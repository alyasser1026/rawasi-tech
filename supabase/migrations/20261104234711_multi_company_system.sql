-- Multi-company, step 1: company registry, memberships and their security.
--
-- What this migration does:
--   * companies and user_companies tables, both locked down with RLS.
--     Signed-in users can only READ (their own companies / memberships); every write goes through
--     the SECURITY DEFINER functions below, which check who is calling.
--   * rawasi_private.user_in_company() / is_company_admin(): helpers that the step-2 policies on
--     business tables will use to isolate each company's data.
--   * Functions for the app: get_user_accessible_companies, create_company, update_company,
--     set_my_default_company, add_company_member, set_company_member_role, remove_company_member.
--   * Seeds one company (the current data owner) with no tax / CR numbers: real values are entered
--     from Settings → Companies. Existing administrators become its admins, other staff its members.
--
-- What it does NOT do yet (step 2): add company_id to business tables or change their policies.
-- Until then every screen keeps showing the same data whichever company is selected.
--
-- Who can do what:
--   platform admin  = profiles.is_admin or role admin/super_admin (rawasi_private.is_admin()):
--                     sees and manages every company, creates companies, manages members anywhere.
--   company admin   = user_companies.role = 'admin': edits that company's details and its members.
--   company member  = user_companies.role = 'member': sees the company and can switch to it.
-- Module permissions (view/create/edit/delete per screen) stay in profiles.permissions as today.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  legal_name text,
  tax_number text,
  cr_number text,
  currency text NOT NULL DEFAULT 'SAR',
  country text NOT NULL DEFAULT 'SA',
  email text,
  phone text,
  address text,
  logo_url text,
  brand_color text NOT NULL DEFAULT '#F97316',
  fiscal_year_start date,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT companies_code_format CHECK (code ~ '^[A-Z0-9][A-Z0-9_-]{1,19}$'),
  CONSTRAINT companies_name_length CHECK (char_length(btrim(name)) BETWEEN 2 AND 200),
  CONSTRAINT companies_currency_format CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT companies_country_format CHECK (country ~ '^[A-Z]{2}$'),
  CONSTRAINT companies_brand_color_format CHECK (brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  -- Saudi VAT numbers are 15 digits starting and ending with 3; CR numbers are 10 digits.
  CONSTRAINT companies_sa_vat_format CHECK (country <> 'SA' OR tax_number IS NULL OR tax_number ~ '^3[0-9]{13}3$'),
  CONSTRAINT companies_sa_cr_format CHECK (country <> 'SA' OR cr_number IS NULL OR cr_number ~ '^[0-9]{10}$'),
  CONSTRAINT companies_settings_object CHECK (jsonb_typeof(settings) = 'object'),
  CONSTRAINT companies_default_is_active CHECK (NOT is_default OR is_active)
);

CREATE UNIQUE INDEX companies_code_key ON public.companies (code);
CREATE UNIQUE INDEX companies_tax_number_key ON public.companies (tax_number) WHERE tax_number IS NOT NULL;
CREATE UNIQUE INDEX companies_single_default ON public.companies ((true)) WHERE is_default;

COMMENT ON TABLE public.companies IS 'Companies (tenants) managed in the app. Read through RLS, written only through the company functions.';

CREATE TABLE public.user_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_companies_user_company_key UNIQUE (user_id, company_id),
  CONSTRAINT user_companies_role_check CHECK (role IN ('admin', 'member'))
);

CREATE INDEX user_companies_company_idx ON public.user_companies (company_id);
CREATE UNIQUE INDEX user_companies_single_default ON public.user_companies (user_id) WHERE is_default;

COMMENT ON TABLE public.user_companies IS 'Which users belong to which company, and whether they administer it.';

-- ---------------------------------------------------------------------------
-- Housekeeping triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rawasi_private.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION rawasi_private.touch_updated_at() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER companies_touch_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.touch_updated_at();
CREATE TRIGGER user_companies_touch_updated_at BEFORE UPDATE ON public.user_companies
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.touch_updated_at();

CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.log_audit_event();
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.user_companies
  FOR EACH ROW EXECUTE FUNCTION rawasi_private.log_audit_event();

-- ---------------------------------------------------------------------------
-- Access helpers (used by RLS here and by the step-2 policies on business tables)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rawasi_private.user_in_company(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_companies AS uc
    JOIN public.companies AS c ON c.id = uc.company_id
    JOIN public.profiles AS p ON p.id = uc.user_id
    WHERE uc.user_id = (SELECT auth.uid())
      AND uc.company_id = p_company_id
      AND uc.is_active
      AND c.is_active
      AND COALESCE(p.is_active, true)
  );
$$;

CREATE OR REPLACE FUNCTION rawasi_private.is_company_admin(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT rawasi_private.is_admin() OR EXISTS (
    SELECT 1
    FROM public.user_companies AS uc
    JOIN public.profiles AS p ON p.id = uc.user_id
    WHERE uc.user_id = (SELECT auth.uid())
      AND uc.company_id = p_company_id
      AND uc.role = 'admin'
      AND uc.is_active
      AND COALESCE(p.is_active, true)
  );
$$;

REVOKE ALL ON FUNCTION rawasi_private.user_in_company(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rawasi_private.is_company_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION rawasi_private.user_in_company(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION rawasi_private.is_company_admin(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Row level security: read-only for signed-in users, nothing for anon
-- ---------------------------------------------------------------------------
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_companies ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.companies, public.user_companies FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.companies, public.user_companies TO authenticated;
GRANT ALL ON public.companies, public.user_companies TO service_role;

CREATE POLICY company_view ON public.companies
  FOR SELECT TO authenticated
  USING (rawasi_private.is_admin() OR rawasi_private.user_in_company(id));

CREATE POLICY membership_view ON public.user_companies
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR rawasi_private.is_company_admin(company_id));

-- No INSERT / UPDATE / DELETE policies on purpose: writes only through the functions below.

-- ---------------------------------------------------------------------------
-- Functions for the app
-- ---------------------------------------------------------------------------

-- Companies the signed-in user can switch to, with their role in each.
CREATE OR REPLACE FUNCTION public.get_user_accessible_companies()
RETURNS TABLE (
  id uuid,
  code text,
  name text,
  legal_name text,
  tax_number text,
  cr_number text,
  currency text,
  country text,
  email text,
  phone text,
  address text,
  logo_url text,
  brand_color text,
  fiscal_year_start date,
  is_active boolean,
  is_default boolean,
  role text,
  is_user_default boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT c.id, c.code, c.name, c.legal_name, c.tax_number, c.cr_number, c.currency, c.country,
         c.email, c.phone, c.address, c.logo_url, c.brand_color, c.fiscal_year_start,
         c.is_active, c.is_default, uc.role, uc.is_default
  FROM public.user_companies AS uc
  JOIN public.companies AS c ON c.id = uc.company_id
  JOIN public.profiles AS p ON p.id = uc.user_id
  WHERE uc.user_id = (SELECT auth.uid())
    AND uc.is_active
    AND c.is_active
    AND COALESCE(p.is_active, true)
  ORDER BY uc.is_default DESC, c.is_default DESC, c.name;
$$;

-- Shared validation for the editable company fields.
CREATE OR REPLACE FUNCTION rawasi_private.clean_company_text(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$ SELECT NULLIF(btrim(p_value), ''); $$;
REVOKE ALL ON FUNCTION rawasi_private.clean_company_text(text) FROM PUBLIC, anon, authenticated;

-- Create a company (platform admins only). The creator becomes its admin.
CREATE OR REPLACE FUNCTION public.create_company(p_company jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_id uuid;
BEGIN
  IF v_uid IS NULL OR NOT rawasi_private.is_admin() THEN
    RAISE EXCEPTION 'Only an administrator can create companies' USING ERRCODE = '42501';
  END IF;
  IF p_company IS NULL OR jsonb_typeof(p_company) <> 'object' THEN
    RAISE EXCEPTION 'Company data is required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.companies (code, name, legal_name, tax_number, cr_number, currency, country,
                                email, phone, address, logo_url, brand_color, fiscal_year_start, created_by)
  VALUES (
    upper(rawasi_private.clean_company_text(p_company ->> 'code')),
    rawasi_private.clean_company_text(p_company ->> 'name'),
    rawasi_private.clean_company_text(p_company ->> 'legal_name'),
    rawasi_private.clean_company_text(p_company ->> 'tax_number'),
    rawasi_private.clean_company_text(p_company ->> 'cr_number'),
    COALESCE(upper(rawasi_private.clean_company_text(p_company ->> 'currency')), 'SAR'),
    COALESCE(upper(rawasi_private.clean_company_text(p_company ->> 'country')), 'SA'),
    rawasi_private.clean_company_text(p_company ->> 'email'),
    rawasi_private.clean_company_text(p_company ->> 'phone'),
    rawasi_private.clean_company_text(p_company ->> 'address'),
    rawasi_private.clean_company_text(p_company ->> 'logo_url'),
    COALESCE(rawasi_private.clean_company_text(p_company ->> 'brand_color'), '#F97316'),
    NULLIF(p_company ->> 'fiscal_year_start', '')::date,
    v_uid
  )
  RETURNING id INTO v_id;

  INSERT INTO public.user_companies (user_id, company_id, role, created_by)
  VALUES (v_uid, v_id, 'admin', v_uid);

  RETURN v_id;
END;
$$;

-- Edit a company's details (company admins). Only platform admins can activate / deactivate it
-- or make it the system default. Keys that are absent from p_changes are left untouched.
CREATE OR REPLACE FUNCTION public.update_company(p_company_id uuid, p_changes jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.companies%ROWTYPE;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT rawasi_private.is_company_admin(p_company_id) THEN
    RAISE EXCEPTION 'You are not allowed to edit this company' USING ERRCODE = '42501';
  END IF;
  IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object' THEN
    RAISE EXCEPTION 'Company changes are required' USING ERRCODE = '22023';
  END IF;
  IF (p_changes ? 'is_active' OR p_changes ? 'is_default') AND NOT rawasi_private.is_admin() THEN
    RAISE EXCEPTION 'Only an administrator can activate a company or make it the default' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.companies WHERE id = p_company_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company not found' USING ERRCODE = 'P0002';
  END IF;

  IF p_changes ? 'code' THEN v_row.code := upper(rawasi_private.clean_company_text(p_changes ->> 'code')); END IF;
  IF p_changes ? 'name' THEN v_row.name := rawasi_private.clean_company_text(p_changes ->> 'name'); END IF;
  IF p_changes ? 'legal_name' THEN v_row.legal_name := rawasi_private.clean_company_text(p_changes ->> 'legal_name'); END IF;
  IF p_changes ? 'tax_number' THEN v_row.tax_number := rawasi_private.clean_company_text(p_changes ->> 'tax_number'); END IF;
  IF p_changes ? 'cr_number' THEN v_row.cr_number := rawasi_private.clean_company_text(p_changes ->> 'cr_number'); END IF;
  IF p_changes ? 'currency' THEN v_row.currency := COALESCE(upper(rawasi_private.clean_company_text(p_changes ->> 'currency')), 'SAR'); END IF;
  IF p_changes ? 'country' THEN v_row.country := COALESCE(upper(rawasi_private.clean_company_text(p_changes ->> 'country')), 'SA'); END IF;
  IF p_changes ? 'email' THEN v_row.email := rawasi_private.clean_company_text(p_changes ->> 'email'); END IF;
  IF p_changes ? 'phone' THEN v_row.phone := rawasi_private.clean_company_text(p_changes ->> 'phone'); END IF;
  IF p_changes ? 'address' THEN v_row.address := rawasi_private.clean_company_text(p_changes ->> 'address'); END IF;
  IF p_changes ? 'logo_url' THEN v_row.logo_url := rawasi_private.clean_company_text(p_changes ->> 'logo_url'); END IF;
  IF p_changes ? 'brand_color' THEN v_row.brand_color := COALESCE(rawasi_private.clean_company_text(p_changes ->> 'brand_color'), '#F97316'); END IF;
  IF p_changes ? 'fiscal_year_start' THEN v_row.fiscal_year_start := NULLIF(p_changes ->> 'fiscal_year_start', '')::date; END IF;
  IF p_changes ? 'is_active' THEN v_row.is_active := COALESCE((p_changes ->> 'is_active')::boolean, v_row.is_active); END IF;

  IF p_changes ? 'is_default' AND COALESCE((p_changes ->> 'is_default')::boolean, false) AND NOT v_row.is_default THEN
    UPDATE public.companies SET is_default = false WHERE is_default AND id <> p_company_id;
    v_row.is_default := true;
  END IF;
  IF NOT v_row.is_active AND v_row.is_default THEN
    RAISE EXCEPTION 'The default company cannot be deactivated; make another company the default first' USING ERRCODE = '22023';
  END IF;

  UPDATE public.companies SET
    code = v_row.code, name = v_row.name, legal_name = v_row.legal_name,
    tax_number = v_row.tax_number, cr_number = v_row.cr_number,
    currency = v_row.currency, country = v_row.country,
    email = v_row.email, phone = v_row.phone, address = v_row.address,
    logo_url = v_row.logo_url, brand_color = v_row.brand_color,
    fiscal_year_start = v_row.fiscal_year_start,
    is_active = v_row.is_active, is_default = v_row.is_default
  WHERE id = p_company_id;
END;
$$;

-- Remember which company the signed-in user opens by default (any member, for themselves only).
CREATE OR REPLACE FUNCTION public.set_my_default_company(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL OR NOT rawasi_private.user_in_company(p_company_id) THEN
    RAISE EXCEPTION 'You are not a member of this company' USING ERRCODE = '42501';
  END IF;
  UPDATE public.user_companies SET is_default = false
  WHERE user_id = v_uid AND is_default AND company_id <> p_company_id;
  UPDATE public.user_companies SET is_default = true
  WHERE user_id = v_uid AND company_id = p_company_id AND NOT is_default;
END;
$$;

-- Add a user to a company, or reactivate / change the role of an existing membership.
CREATE OR REPLACE FUNCTION public.add_company_member(p_company_id uuid, p_user_id uuid, p_role text DEFAULT 'member')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_id uuid;
BEGIN
  IF v_uid IS NULL OR NOT rawasi_private.is_company_admin(p_company_id) THEN
    RAISE EXCEPTION 'You are not allowed to manage members of this company' USING ERRCODE = '42501';
  END IF;
  IF p_role IS NULL OR p_role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION 'Unknown company role: %', p_role USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = p_company_id) THEN
    RAISE EXCEPTION 'Company not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND COALESCE(is_active, true)) THEN
    RAISE EXCEPTION 'User not found or inactive' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.user_companies (user_id, company_id, role, is_active, created_by)
  VALUES (p_user_id, p_company_id, p_role, true, v_uid)
  ON CONFLICT (user_id, company_id) DO UPDATE SET role = EXCLUDED.role, is_active = true
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION rawasi_private.assert_company_keeps_admin(p_company_id uuid, p_leaving_user uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_companies
    WHERE company_id = p_company_id AND role = 'admin' AND is_active AND user_id <> p_leaving_user
  ) THEN
    RAISE EXCEPTION 'A company must keep at least one admin' USING ERRCODE = '22023';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION rawasi_private.assert_company_keeps_admin(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_company_member_role(p_company_id uuid, p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current text;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT rawasi_private.is_company_admin(p_company_id) THEN
    RAISE EXCEPTION 'You are not allowed to manage members of this company' USING ERRCODE = '42501';
  END IF;
  IF p_role IS NULL OR p_role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION 'Unknown company role: %', p_role USING ERRCODE = '22023';
  END IF;

  SELECT role INTO v_current FROM public.user_companies
  WHERE company_id = p_company_id AND user_id = p_user_id AND is_active
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membership not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_current = 'admin' AND p_role <> 'admin' THEN
    PERFORM rawasi_private.assert_company_keeps_admin(p_company_id, p_user_id);
  END IF;

  UPDATE public.user_companies SET role = p_role
  WHERE company_id = p_company_id AND user_id = p_user_id;
END;
$$;

-- Memberships are deactivated rather than deleted so the audit trail keeps them.
CREATE OR REPLACE FUNCTION public.remove_company_member(p_company_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT rawasi_private.is_company_admin(p_company_id) THEN
    RAISE EXCEPTION 'You are not allowed to manage members of this company' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.user_companies
  WHERE company_id = p_company_id AND user_id = p_user_id AND is_active
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membership not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM rawasi_private.assert_company_keeps_admin(p_company_id, p_user_id);

  UPDATE public.user_companies SET is_active = false, is_default = false
  WHERE company_id = p_company_id AND user_id = p_user_id;
END;
$$;

DO $grants$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.get_user_accessible_companies()',
    'public.create_company(jsonb)',
    'public.update_company(uuid, jsonb)',
    'public.set_my_default_company(uuid)',
    'public.add_company_member(uuid, uuid, text)',
    'public.set_company_member_role(uuid, uuid, text)',
    'public.remove_company_member(uuid, uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn);
  END LOOP;
END;
$grants$;

-- ---------------------------------------------------------------------------
-- Seed: the company that owns the existing data
-- ---------------------------------------------------------------------------
INSERT INTO public.companies (code, name, currency, country, brand_color, is_default, is_active, created_by)
VALUES ('PHI', 'فاي تك للمقاولات العامة والتشطيبات الفاخرة', 'SAR', 'SA', '#F97316', true, true, NULL);

-- Active administrators become company admins; other active staff become members.
-- Accounts still waiting for approval (role 'client' with no permissions) are not added.
INSERT INTO public.user_companies (user_id, company_id, role, is_active, is_default, created_by)
SELECT p.id,
       c.id,
       CASE WHEN COALESCE(p.is_admin, false) OR p.role IN ('admin', 'super_admin') THEN 'admin' ELSE 'member' END,
       true,
       true,
       NULL
FROM public.profiles AS p
JOIN auth.users AS u ON u.id = p.id
CROSS JOIN public.companies AS c
WHERE c.code = 'PHI'
  AND COALESCE(p.is_active, true)
  AND (COALESCE(p.is_admin, false)
       OR COALESCE(p.role, 'client') <> 'client'
       OR COALESCE(p.permissions, '{}'::jsonb) <> '{}'::jsonb);
