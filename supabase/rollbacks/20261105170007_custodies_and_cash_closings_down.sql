-- Rollback: 20261105170007_custodies_and_cash_closings_down.sql
-- Description: Clean rollback of Phase 3 (Site Custodies, Daily Cash Closings, and GL 527 reconciliations)

BEGIN;

-- 1. Drop RPC and trigger functions
DROP FUNCTION IF EXISTS public.get_daily_cash_closings_history(uuid, integer);
DROP FUNCTION IF EXISTS public.approve_cash_closing(uuid, text);
DROP FUNCTION IF EXISTS public.create_daily_cash_closing(uuid, date, numeric, text);
DROP FUNCTION IF EXISTS public.get_cash_closing_preview(uuid, date);
DROP FUNCTION IF EXISTS public.get_site_custodies_summary(text);
DROP FUNCTION IF EXISTS public.settle_site_custody(uuid, text, uuid, date, text);
DROP FUNCTION IF EXISTS public.create_site_custody(uuid, uuid, text, numeric, uuid, text, text, integer);

DROP TRIGGER IF EXISTS trg_sync_custody_spent ON public.expenses;
DROP FUNCTION IF EXISTS rawasi_private.sync_custody_spent();

-- 2. Drop foreign keys and columns from existing tables
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_payment_method_check;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_payment_method_check
  CHECK ((payment_method = ANY (ARRAY['كاش'::text, 'تحويل بنكي'::text, 'شيك'::text, 'عُهدة'::text, 'آجل'::text, 'تسوية داخلية'::text])));

ALTER TABLE public.receipt_vouchers DROP CONSTRAINT IF EXISTS receipt_vouchers_payment_method_check;
ALTER TABLE public.receipt_vouchers ADD CONSTRAINT receipt_vouchers_payment_method_check
  CHECK ((payment_method = ANY (ARRAY['نقدي (كاش)'::text, 'تحويل بنكي'::text, 'شيك'::text])));

ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_custody_fkey;
ALTER TABLE public.expenses DROP COLUMN IF EXISTS custody_id;

ALTER TABLE public.payment_vouchers DROP CONSTRAINT IF EXISTS payment_vouchers_custody_fkey;
ALTER TABLE public.payment_vouchers DROP COLUMN IF EXISTS custody_id;

-- 3. Drop Phase 3 tables
DROP TABLE IF EXISTS public.daily_cash_closings CASCADE;
DROP TABLE IF EXISTS public.site_custodies CASCADE;

-- 4. Deregister from rawasi_private.company_scoped_tables
DELETE FROM rawasi_private.company_scoped_tables
WHERE table_name IN ('site_custodies', 'daily_cash_closings');

COMMIT;
