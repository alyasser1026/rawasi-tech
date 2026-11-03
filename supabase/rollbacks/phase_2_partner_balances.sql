-- Restore the exact pre-phase-2 view shapes; run transactionally when reverting.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DROP FUNCTION public.get_partner_balance(uuid);
DROP VIEW public.partner_balances_summary;
CREATE OR REPLACE VIEW public.all_partners_account_summary WITH (security_invoker = true) AS
WITH financial_summary AS (
         SELECT jl.partner_id,
            sum(jl.credit) AS total_credit,
            sum(jl.debit) AS total_debit
           FROM (journal_lines jl
             JOIN journal_headers jh ON ((jl.header_id = jh.id)))
          WHERE (((jh.status)::text <> 'draft'::text) AND (jl.partner_id IS NOT NULL))
          GROUP BY jl.partner_id
        ), labor_summary AS (
         SELECT labor_daily_logs.worker_partner_id AS partner_id,
            sum(COALESCE(labor_daily_logs.attendance_value, (0)::numeric)) AS total_work_days
           FROM labor_daily_logs
          WHERE (labor_daily_logs.is_posted = true)
          GROUP BY labor_daily_logs.worker_partner_id
        )
 SELECT p.id AS partner_id,
    p.code AS partner_code,
    p.name AS partner_name,
    p.partner_type,
    p.is_active,
    COALESCE(f.total_credit, (0)::numeric) AS total_credit,
    COALESCE(f.total_debit, (0)::numeric) AS total_debit,
    (COALESCE(f.total_credit, (0)::numeric) - COALESCE(f.total_debit, (0)::numeric)) AS net_balance,
    COALESCE(l.total_work_days, (0)::numeric) AS total_work_days
   FROM ((partners p
     LEFT JOIN financial_summary f ON ((p.id = f.partner_id)))
     LEFT JOIN labor_summary l ON ((p.id = l.partner_id)));
DROP VIEW public.partner_statement_ledger;
CREATE VIEW public.partner_statement_ledger WITH (security_invoker = true) AS
SELECT jl.partner_id,
    p.name AS partner_name,
    p.partner_type,
    jh.entry_date AS transaction_date,
    jh.description AS main_description,
    jl.notes AS line_details,
    COALESCE(jl.debit, (0)::numeric) AS debit,
    COALESCE(jl.credit, (0)::numeric) AS credit,
    sum((COALESCE(jl.credit, (0)::numeric) - COALESCE(jl.debit, (0)::numeric))) OVER (PARTITION BY jl.partner_id ORDER BY jh.entry_date, jl.created_at) AS running_balance
   FROM ((journal_lines jl
     JOIN journal_headers jh ON ((jl.header_id = jh.id)))
     JOIN partners p ON ((p.id = jl.partner_id)))
  WHERE ((jh.status)::text <> 'draft'::text);
GRANT INSERT ON public.partner_statement_ledger TO service_role;
GRANT SELECT ON public.partner_statement_ledger TO service_role;
GRANT UPDATE ON public.partner_statement_ledger TO service_role;
GRANT DELETE ON public.partner_statement_ledger TO service_role;
GRANT TRUNCATE ON public.partner_statement_ledger TO service_role;
GRANT REFERENCES ON public.partner_statement_ledger TO service_role;
GRANT TRIGGER ON public.partner_statement_ledger TO service_role;
GRANT INSERT ON public.partner_statement_ledger TO authenticated;
GRANT SELECT ON public.partner_statement_ledger TO authenticated;
GRANT UPDATE ON public.partner_statement_ledger TO authenticated;
GRANT DELETE ON public.partner_statement_ledger TO authenticated;
DROP INDEX public.journal_lines_partner_header_idx;
DROP INDEX public.journal_lines_header_id_idx;
DROP INDEX public.journal_headers_reference_id_idx;
DROP INDEX public.labor_daily_logs_worker_partner_id_idx;
NOTIFY pgrst, 'reload schema';
