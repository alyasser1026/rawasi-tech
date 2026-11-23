BEGIN;

-- ============================================================================
-- Fix SQLSTATE 21000 (cardinality_violation) on public.property_expenses_report
-- Root cause: WHERE l.account_id = (SELECT accounts.id FROM public.accounts WHERE accounts.code = '512')
-- returns more than one row in multi-company databases because each company has its own account '512'.
-- Fix: join public.accounts by (account_id, company_id) and filter WHERE a.code::text = '512'::text,
-- preserving security_invoker = true and exact output column names/types.
-- ============================================================================

CREATE OR REPLACE VIEW public.property_expenses_report
WITH (security_invoker = true) AS
SELECT
  COALESCE(p.client_name, 'بدون عميل'::character varying) AS "العميل",
  COALESCE(p."Property", 'غير محدد'::character varying) AS "العقار_أو_الجهة",
  p.project_name AS "اسم_المشروع",
  COALESCE(pt.name, 'إدارة الموقع / بدون مقاول'::character varying) AS "المقاول",
  l.item_name AS "البند",
  sum(l.debit) AS "إجمالي_التكاليف",
  COALESCE(p.contract_value, (0)::numeric) AS "قيمة_العقد",
  COALESCE(p.estimated_budget, (0)::numeric) AS "الميزانية_التقديرية"
FROM public.journal_lines l
JOIN public.accounts a
  ON a.id = l.account_id
 AND a.company_id = l.company_id
LEFT JOIN public.projects p ON l.project_id = p.id
LEFT JOIN public.partners pt ON l.partner_id = pt.id
WHERE a.code::text = '512'::text
GROUP BY
  l.company_id,
  p.client_name,
  p."Property",
  p.project_name,
  pt.name,
  l.item_name,
  p.contract_value,
  p.estimated_budget;

NOTIFY pgrst, 'reload schema';

COMMIT;
