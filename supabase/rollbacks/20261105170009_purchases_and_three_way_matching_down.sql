-- Rollback: 20261105170009_purchases_and_three_way_matching_down.sql
-- Description: Clean rollback of Phase 5 (Batch 1: Purchase Orders, Receipts link, Supplier Invoices, and 3-Way Matching)

BEGIN;

-- 1. Drop RPC functions
DROP FUNCTION IF EXISTS public.get_purchase_orders_summary(text, uuid, uuid);
DROP FUNCTION IF EXISTS public.get_purchase_order_matching(uuid);
DROP FUNCTION IF EXISTS public.post_supplier_invoice(uuid);
DROP FUNCTION IF EXISTS public.create_supplier_invoice(uuid, text, uuid, uuid, date, date, text, jsonb);
DROP FUNCTION IF EXISTS public.receive_materials_from_po(uuid, date, jsonb, text);
DROP FUNCTION IF EXISTS public.approve_purchase_order(uuid);
DROP FUNCTION IF EXISTS public.create_purchase_order(uuid, uuid, date, date, text, text, jsonb);

-- 2. Drop Phase 5 tables
DROP TABLE IF EXISTS public.supplier_invoice_lines CASCADE;
DROP TABLE IF EXISTS public.supplier_invoices CASCADE;
DROP TABLE IF EXISTS public.purchase_order_lines CASCADE;
DROP TABLE IF EXISTS public.purchase_orders CASCADE;

-- 3. Drop columns and foreign keys from material_receipts and material_receipt_lines
ALTER TABLE public.material_receipt_lines DROP CONSTRAINT IF EXISTS material_receipt_lines_po_line_fkey;
ALTER TABLE public.material_receipt_lines DROP CONSTRAINT IF EXISTS material_receipt_lines_id_company_key;
ALTER TABLE public.material_receipt_lines DROP COLUMN IF EXISTS po_line_id;

ALTER TABLE public.material_receipts DROP CONSTRAINT IF EXISTS material_receipts_po_fkey;
ALTER TABLE public.material_receipts DROP COLUMN IF EXISTS po_id;

-- 4. Deregister from rawasi_private.company_scoped_tables
DELETE FROM rawasi_private.company_scoped_tables
WHERE table_name IN ('purchase_orders', 'purchase_order_lines', 'supplier_invoices', 'supplier_invoice_lines');

COMMIT;
