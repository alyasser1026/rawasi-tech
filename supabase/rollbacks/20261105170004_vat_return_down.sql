-- Pre-use schema rollback. Existing VAT review decisions must be preserved once in use.
BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.vat_document_reviews)
       OR EXISTS (SELECT 1 FROM public.vat_period_adjustments) THEN
        RAISE EXCEPTION 'Preserve VAT review decisions before removing the VAT return schema';
    END IF;
END;
$$;

DROP FUNCTION public.get_vat_return(date, date);
DROP FUNCTION public.save_vat_period_adjustments(date, date, numeric, numeric, text);
DROP FUNCTION public.save_vat_document_review(text, uuid, text, date, numeric, text);
DROP FUNCTION rawasi_private.require_vat_report_access(text);
DROP VIEW rawasi_private.vat_document_review_state;
DROP VIEW rawasi_private.vat_document_sources;
DROP TABLE public.vat_period_adjustments;
DROP TABLE public.vat_document_reviews;
DELETE FROM rawasi_private.company_scoped_tables WHERE table_name IN ('vat_document_reviews', 'vat_period_adjustments');

COMMIT;
