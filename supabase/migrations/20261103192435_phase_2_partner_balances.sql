-- Phase 2: one posted-journal ledger for statements, summaries and voucher balances.
-- Positive balance: owed to the partner. Negative balance: owed by the partner.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE INDEX journal_lines_partner_header_idx ON public.journal_lines (partner_id, header_id);
CREATE INDEX journal_lines_header_id_idx ON public.journal_lines (header_id);
CREATE INDEX journal_headers_reference_id_idx ON public.journal_headers (reference_id);
CREATE INDEX labor_daily_logs_worker_partner_id_idx ON public.labor_daily_logs (worker_partner_id);

-- Preserve the original nine columns; append identifiers used by client pagination.
CREATE OR REPLACE VIEW public.partner_statement_ledger
WITH (security_invoker = true)
AS
SELECT
  jl.partner_id,
  p.name AS partner_name,
  p.partner_type,
  jh.entry_date AS transaction_date,
  jh.description AS main_description,
  jl.notes AS line_details,
  COALESCE(jl.debit, 0::numeric) AS debit,
  COALESCE(jl.credit, 0::numeric) AS credit,
  SUM(COALESCE(jl.credit, 0::numeric) - COALESCE(jl.debit, 0::numeric)) OVER (
    PARTITION BY jl.partner_id
    ORDER BY jh.entry_date, jl.created_at, jl.id
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS running_balance,
  jl.id AS line_id,
  jh.id AS header_id,
  jh.v_type,
  jh.reference_id,
  jl.quantity,
  jl.created_at,
  CASE WHEN jh.v_type IN ('labor_daily_logs', 'يومية عمالة')
    THEN COALESCE(log.attendance_value, jl.quantity)
    ELSE NULL::numeric
  END AS attendance_value
FROM public.journal_lines jl
JOIN public.journal_headers jh ON jh.id = jl.header_id
JOIN public.partners p ON p.id = jl.partner_id
LEFT JOIN public.labor_daily_logs log
  ON log.id = jh.reference_id
  AND log.worker_partner_id = jl.partner_id
  AND jh.v_type IN ('labor_daily_logs', 'يومية عمالة')
WHERE jh.status IN ('posted', 'مرحل', 'معتمد');

CREATE OR REPLACE VIEW public.all_partners_account_summary
WITH (security_invoker = true)
AS
WITH financial_summary AS (
  SELECT partner_id, SUM(credit) AS total_credit, SUM(debit) AS total_debit
  FROM public.partner_statement_ledger
  GROUP BY partner_id
), labor_summary AS (
  SELECT log.worker_partner_id AS partner_id,
    SUM(COALESCE(log.attendance_value, 0::numeric)) AS total_work_days
  FROM public.labor_daily_logs log
  WHERE log.is_posted IS TRUE
    AND EXISTS (
      SELECT 1 FROM public.journal_headers h
      WHERE h.reference_id = log.id
        AND h.v_type IN ('labor_daily_logs', 'يومية عمالة')
        AND h.status IN ('posted', 'مرحل', 'معتمد')
        AND EXISTS (
          SELECT 1 FROM public.journal_lines l
          WHERE l.header_id = h.id AND l.partner_id = log.worker_partner_id
        )
    )
  GROUP BY log.worker_partner_id
)
SELECT
  p.id AS partner_id,
  p.code AS partner_code,
  p.name AS partner_name,
  p.partner_type,
  p.is_active,
  COALESCE(f.total_credit, 0::numeric) AS total_credit,
  COALESCE(f.total_debit, 0::numeric) AS total_debit,
  COALESCE(f.total_credit, 0::numeric) - COALESCE(f.total_debit, 0::numeric) AS net_balance,
  COALESCE(l.total_work_days, 0::numeric) AS total_work_days
FROM public.partners p
LEFT JOIN financial_summary f ON f.partner_id = p.id
LEFT JOIN labor_summary l ON l.partner_id = p.id;

-- Compatibility contract used by usePartnerBalancesLogic.
-- earned/paid aliases represent all ledger credits/debits, not just cash movements.
CREATE VIEW public.partner_balances_summary
WITH (security_invoker = true)
AS
SELECT partner_id, partner_code, partner_name, partner_type, is_active,
  total_credit AS total_earned,
  total_debit AS total_paid,
  net_balance AS current_balance,
  total_work_days,
  total_credit, total_debit, net_balance
FROM public.all_partners_account_summary;

CREATE FUNCTION public.get_partner_balance(p_id uuid)
RETURNS numeric
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT COALESCE(SUM(l.credit - l.debit), 0::numeric)
  FROM public.partner_statement_ledger l
  WHERE l.partner_id = p_id;
$$;

REVOKE ALL ON public.partner_balances_summary FROM PUBLIC, anon;
GRANT SELECT ON public.partner_balances_summary TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_partner_balance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_partner_balance(uuid) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
