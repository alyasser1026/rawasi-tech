-- Rollback: 20261105170008_fixed_assets_and_depreciation_down.sql
-- Description: Clean rollback of Phase 4 (Fixed Assets, Depreciation Runs, and Asset Transfers)

BEGIN;

-- 1. Drop RPC functions
DROP FUNCTION IF EXISTS public.get_asset_operational_costs(uuid);
DROP FUNCTION IF EXISTS public.get_assets_summary(text, uuid, text);
DROP FUNCTION IF EXISTS public.transfer_asset_project(uuid, uuid, date, uuid, text);
DROP FUNCTION IF EXISTS public.dispose_fixed_asset(uuid, date, text, numeric, uuid, text);
DROP FUNCTION IF EXISTS public.post_monthly_depreciation(integer, integer, text);
DROP FUNCTION IF EXISTS public.calculate_monthly_depreciation_preview(integer, integer);
DROP FUNCTION IF EXISTS public.create_fixed_asset(text, text, numeric, integer, numeric, date, uuid, text, uuid, uuid, uuid, numeric, text);

-- 2. Drop foreign keys and columns from existing tables
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_asset_fkey;
ALTER TABLE public.expenses DROP COLUMN IF EXISTS asset_id;

-- 3. Drop Phase 4 tables
DROP TABLE IF EXISTS public.asset_depreciation_lines CASCADE;
DROP TABLE IF EXISTS public.asset_depreciation_runs CASCADE;
DROP TABLE IF EXISTS public.asset_transfers CASCADE;
DROP TABLE IF EXISTS public.fixed_assets CASCADE;

-- 4. Deregister from rawasi_private.company_scoped_tables
DELETE FROM rawasi_private.company_scoped_tables
WHERE table_name IN ('fixed_assets', 'asset_transfers', 'asset_depreciation_runs', 'asset_depreciation_lines');

-- 5. Delete newly seeded accounts (528, 529)
DELETE FROM public.accounts WHERE code IN ('528', '529');

COMMIT;
