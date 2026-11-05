-- Rollback: 20261105170010_inventory_stocktaking_and_job_orders_down.sql
-- Description: Clean rollback of Phase 5 (Batch 2: Stocktaking Sessions, Item Cards, Valuation & Job Order Links)

BEGIN;

-- 1. Drop RPCs
DROP FUNCTION IF EXISTS public.get_inventory_dashboard_summary(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_item_stock_card(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.post_stocktaking_session(uuid);
DROP FUNCTION IF EXISTS public.create_stocktaking_session(uuid, uuid, date, text, jsonb);

-- 2. Drop Stocktaking Tables
DROP TABLE IF EXISTS public.stocktaking_lines CASCADE;
DROP TABLE IF EXISTS public.stocktaking_sessions CASCADE;

DELETE FROM rawasi_private.company_scoped_tables
WHERE table_name IN ('stocktaking_sessions', 'stocktaking_lines');

-- 3. Drop columns from material_items
ALTER TABLE public.material_items
  DROP COLUMN IF EXISTS moving_avg_cost,
  DROP COLUMN IF EXISTS reorder_qty,
  DROP COLUMN IF EXISTS min_order_level;

-- 4. Drop job_order_id columns and triggers from Supplier Invoices
ALTER TABLE public.supplier_invoice_lines
  DROP CONSTRAINT IF EXISTS supplier_invoice_lines_job_order_fkey;
ALTER TABLE public.supplier_invoice_lines
  DROP COLUMN IF EXISTS job_order_id;

DROP TRIGGER IF EXISTS trg_job_order_link_supp_inv ON public.supplier_invoices;
ALTER TABLE public.supplier_invoices
  DROP CONSTRAINT IF EXISTS supplier_invoices_job_order_fkey;
ALTER TABLE public.supplier_invoices
  DROP COLUMN IF EXISTS job_order_id;

-- 5. Drop job_order_id from Material Receipt Lines
ALTER TABLE public.material_receipt_lines
  DROP CONSTRAINT IF EXISTS material_receipt_lines_job_order_fkey;
ALTER TABLE public.material_receipt_lines
  DROP COLUMN IF EXISTS job_order_id;

-- 6. Drop job_order_id from Purchase Orders & Lines
ALTER TABLE public.purchase_order_lines
  DROP CONSTRAINT IF EXISTS purchase_order_lines_job_order_fkey;
ALTER TABLE public.purchase_order_lines
  DROP COLUMN IF EXISTS job_order_id;

DROP TRIGGER IF EXISTS trg_job_order_link_po ON public.purchase_orders;
ALTER TABLE public.purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_job_order_fkey;
ALTER TABLE public.purchase_orders
  DROP COLUMN IF EXISTS job_order_id;

COMMIT;
