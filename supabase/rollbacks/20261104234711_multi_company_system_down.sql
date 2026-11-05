-- Undo 20261104234711_multi_company_system.sql (multi-company step 1).
-- Kept outside supabase/migrations so the CLI never runs it by itself.
-- Safe only while no business table references public.companies (i.e. before step 2).
-- Run in the SQL editor, then delete the migration's row from supabase_migrations.schema_migrations
-- (version 20261104234711) if you also want the CLI to forget it.
BEGIN;
DROP FUNCTION IF EXISTS public.remove_company_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.set_company_member_role(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.add_company_member(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.set_my_default_company(uuid);
DROP FUNCTION IF EXISTS public.update_company(uuid, jsonb);
DROP FUNCTION IF EXISTS public.create_company(jsonb);
DROP FUNCTION IF EXISTS public.get_user_accessible_companies();
DROP TABLE IF EXISTS public.user_companies;
DROP TABLE IF EXISTS public.companies;
DROP FUNCTION IF EXISTS rawasi_private.assert_company_keeps_admin(uuid, uuid);
DROP FUNCTION IF EXISTS rawasi_private.clean_company_text(text);
DROP FUNCTION IF EXISTS rawasi_private.is_company_admin(uuid);
DROP FUNCTION IF EXISTS rawasi_private.user_in_company(uuid);
DROP FUNCTION IF EXISTS rawasi_private.touch_updated_at();
COMMIT;
