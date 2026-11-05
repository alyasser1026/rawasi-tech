# Multi-company isolation and posting

Existing business records now belong to the default company. Requests select a company through
`x-company-id`, checked against the signed-in user's active membership; requests without a header
use the user's default company. Invalid or inaccessible company headers return no company data.
The 29 business tables retain their module permissions and add company isolation. Composite
foreign keys prevent relationships across companies, and document numbers are unique per company.

Posting resolves account codes within the selected company. Missing accounts stop posting with
a clear error. Claim retention uses account 213. Financial statements, trial balance, and account
reports count `posted`, `مرحل`, and `معتمد`; the detailed report also excludes draft and out-of-period
lines from both totals and transactions.

The app includes company administration, membership management, chart copying, company switching,
and company-specific query/recent-item caches. Network failures never retry a company request
without its header.

## Applied migration versions

Local filenames match the versions assigned by the connected Supabase migration tool:

- `20261104234711_multi_company_system.sql`
- `20261105010528_multi_company_isolation.sql`
- `20261105010612_multi_company_posting_accounts.sql`

Do not apply the same steps again under their earlier development timestamps.
Rollback scripts are in `supabase/rollbacks`; run them in reverse order and reconcile migration
history as documented in each file.

## Validation

Local suites: 74 company administration checks, 59 isolation checks, 34 posting/report checks,
and invoice workflow smoke tests in two companies. Schema comparisons verify rollback and reapply.
Live verification confirmed all 29 company columns are required, every existing business policy
is company-scoped, RLS stays enabled, and authenticated valid/invalid company-header checks pass.
Counts and content hashes of all 28 business tables excluding the derived report cache matched
before and after both migrations. Cached financial reports were rebuilt.

Frontend validation: `node tests/company-fetch.cjs`, TypeScript, and the production build pass.
`phi-verify` visited 51 screens at 390, 1440, and 1920 pixels with no page failures, runtime errors,
or horizontal page overflow. Shared-theme contrast notices remain; realtime connections are
intentionally blocked in the mock browser audit. Dedicated browser checks confirm the company
picker is clickable and stays inside all three viewport sizes, and switching persists through a
reload with the next account-report request carrying the newly selected company's header.
The browser can read the Supabase response to a request containing `x-company-id` from the production
origin (anonymous account reads correctly return a permissions error).

Security advisors identify the intentional authenticated SECURITY DEFINER company APIs. Their
authentication, membership, and administration checks are covered by the isolation suites; anonymous
execution is revoked. The private journal write-state table intentionally has no caller policies.
The project's separate leaked-password-protection advisory remains unchanged.
