-- Schema-only rollback for a feature that has never issued an adjustment.
BEGIN;
SET LOCAL lock_timeout = '10s';

LOCK TABLE public.invoice_adjustment_notes, public.invoice_adjustment_material_reversals IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT FROM public.invoice_adjustment_notes)
     OR EXISTS (SELECT FROM public.invoice_adjustment_material_reversals)
     OR EXISTS (SELECT FROM rawasi_private.document_counters WHERE doc_type IN ('CN', 'DN')) THEN
    RAISE EXCEPTION 'Cannot roll back issued credit/debit notes. Preserve the accounting history and use a forward correction.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION rawasi_private.customer_material_net_applied(p_company uuid, p_receipt uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT coalesce(sum(a.amount), 0)
  FROM public.invoice_customer_material_applications a
  WHERE a.company_id = p_company AND a.receipt_id = p_receipt;
$$;
REVOKE ALL ON FUNCTION rawasi_private.customer_material_net_applied(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rawasi_private.customer_material_net_applied(uuid, uuid) TO authenticated;

DROP TRIGGER zz_check_invoice_receipt_balance ON public.receipt_vouchers;
DROP FUNCTION rawasi_private.check_invoice_receipt_balance();

DROP FUNCTION public.issue_invoice_adjustment(uuid, uuid, uuid, text, date, numeric, text);
DROP FUNCTION public.get_invoice_adjustment_options(uuid);
DROP FUNCTION public.get_invoice_adjustment_balances(uuid[]);
DROP FUNCTION rawasi_private.issue_invoice_adjustment(uuid, uuid, uuid, text, date, numeric, text);
DROP FUNCTION rawasi_private.get_invoice_adjustment_options(uuid);
DROP FUNCTION rawasi_private.get_invoice_adjustment_balances(uuid[]);
DROP FUNCTION rawasi_private.invoice_adjustment_candidates(uuid, uuid, uuid);
DROP FUNCTION rawasi_private.invoice_adjustment_totals(uuid, uuid);
DROP FUNCTION rawasi_private.invoice_adjustment_header(uuid, uuid);

DROP TRIGGER zz_protect_invoice_adjustment_journal_line ON public.journal_lines;
DROP TRIGGER aa_protect_invoice_adjustment_journal ON public.journal_headers;
DROP TRIGGER trg_protect_invoice_adjustment_source ON public.invoices;
DROP TABLE public.invoice_adjustment_material_reversals;
DROP TABLE public.invoice_adjustment_notes;
DROP FUNCTION rawasi_private.protect_invoice_adjustment_journal_line();
DROP FUNCTION rawasi_private.protect_invoice_adjustment_journal();
DROP FUNCTION rawasi_private.protect_invoice_adjustment_source();
DROP FUNCTION rawasi_private.protect_issued_invoice_adjustment();

DELETE FROM rawasi_private.company_scoped_tables
WHERE table_name IN ('invoice_adjustment_notes', 'invoice_adjustment_material_reversals');
NOTIFY pgrst, 'reload schema';
COMMIT;
