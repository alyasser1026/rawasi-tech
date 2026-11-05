-- Rollback of 20261105170000_document_numbering.sql. Numbers already given stay on the documents;
-- new documents go back to the numbers the screens make up.
SET LOCAL lock_timeout = '10s';

DROP TRIGGER trg_doc_number ON public.invoices;
DROP TRIGGER trg_doc_number ON public.receipt_vouchers;
DROP TRIGGER trg_doc_number ON public.payment_vouchers;
DROP TRIGGER trg_doc_number ON public.sub_claims;
DROP TRIGGER trg_doc_number ON public.job_orders;
DROP TRIGGER trg_doc_number ON public.material_receipts;
DROP TRIGGER trg_doc_number ON public.material_issues;
DROP FUNCTION rawasi_private.assign_document_number();
DROP TABLE rawasi_private.document_counters;
