# Phase 6: tested financial workflows

Applied to Supabase project `tarhvoszqjfzmfgzuctu` as migration
`20261103211141_phase_6_atomic_workflows`. The local migration version matches
the remote history. Client changes are local only; nothing was committed, pushed
or published to the hosted application.

## Approved accounting boundary

The user explicitly approved monthly employee salary accrual in payroll, with
daily wages, advances/payments and penalties posted by their own modules and
displayed in the sheet. `partner_type='موظف'` is eligible for monthly payroll
writes. `عامل` and `عامل يومية` rows are review-only.

## Payroll

- `save_payroll_drafts` saves the selected monthly employee drafts in one
  transaction, preserving existing row IDs. It recomputes opening balance,
  deductions, payments and net salary server-side; it does not trust a supplied
  client net/posted flag. Invalid rows roll back the entire selected batch.
- `save_and_post_payroll` saves and posts those salaries in the same transaction.
  Each salary gets a balanced journal and source reference. Salary plus allowances
  debit transactional chart code 512 and credit 216 with the employee partner ID.
  This fixes the old hardcoded mapping that treated the bank as salary expense and
  salary expense as a liability. No imported payment/penalty is posted twice.
- `unpost_payroll_slips` removes only the selected salary journals, preserving
  salary rows and independent payment, penalty and labor documents.
- Per-month transaction locks and source/journal guards prevent duplicate posting,
  orphan journals and modification/deletion of committed posted salary records.
- Opening balances now use the canonical posted partner ledger. They do not sum
  cumulative unposted salary snapshots. Module imports include posted sources
  with corresponding posted journals, within the selected month/cutoff.
- A monthly employee with posted daily wages in the same month must have the
  classification/entitlement corrected before monthly accrual, to prevent double
  wage expense. Planned payouts and the sheet's payment-status label remain report
  metadata; actual cash movement comes from a posted payment voucher.

The payroll client uses checked atomic RPCs, exact decimal preview arithmetic and
decimal string payloads, current displayed selection, protected posted fields and
selected unposting. It now preserves text payment status instead of converting
`مدفوع` to NaN. Loading errors fail visibly; a failed salary read no longer looks
like an empty successfully loaded sheet. Request versions and loaded month/date
keys protect against stale responses. Added an actual working search input and
sidebar dependencies so buttons use the current sheet and loading state.

## Contractor claims and payments

- `create_and_post_sub_claim` creates the claim, locks/checks selected unbilled
  assignments, links assignments/material/expense deductions and posts the claim
  atomically. A failure restores all source links and leaves no partial claim.
- `pay_sub_claim` creates/posts a voucher and updates claim paid amount in one
  transaction. It locks the claim and rejects payments above its remaining amount.
- Stable client request UUIDs make retrying the same creation/payment idempotent.
  Request IDs are generated when the modal opens and retained on retry. Financial
  mismatches or reuse after unposting require explicit review instead of silently
  creating/reposting a second document.
- Removed the local client's separate insert/post/paid-total requests. Default
  contractor/bank accounts are looked up by chart codes 212/1291, displaying the
  actual names instead of using an unrelated hardcoded bank ID.

The existing claim accrual algorithm (gross work less retention, with source
deductions linked to the claim) was preserved. This phase does not replace the
business valuation rules for completed quantities, materials or contractual taxes.

## Invoices, receipts, expenses and cash flow

- Invoice unposting now requires its receipts to be unposted first and preserves
  those receipts and their invoice links. Expense unposting similarly preserves
  its payment vouchers and requires posted related payments to be unposted first.
  The generic expense unposting branch delegates to this protected operation.
- Invoice/receipt guards prevent posted financial edits/deletion, orphan journals
  and duplicate posting. Receipt-to-invoice deletion is now RESTRICT with an index.
  Explicit draft deletion is atomic and never deletes a posted journal first to
  make an unsafe source deletion appear permissible.
- Receipt unposting updates its status with journal removal in one transaction.
  Invoice paid totals recompute from posted receipt sources and journals. The
  trigger handles all posted aliases, old/new/null invoice links and serializes
  invoice total recalculation.
- Payment/receipt cash-flow triggers now exclude draft documents and remove the
  derived cash flow on unposting while preserving the source document. Posting
  creates/updates the corresponding cash flow.
- Local receipt posting/unposting/deletion invalidates invoice history so the
  invoice's paid amount is refreshed instead of remaining cached for five minutes.

## Verification actually completed

| Layer | Verification |
| --- | --- |
| Local PostgreSQL 17 | Isolated disposable database, phases 1–5 plus phase 6 migration |
| Payroll | Exact save, save/post/unpost/repost, partner balance equality, correct accounts, batch rollback, source protection, denied permissions |
| Concurrency | Simultaneous salary posting creates one journal; simultaneous claim payments cannot exceed remaining amount; request retries create no duplicate voucher |
| Contractor cycle | Create/post claim, invalid linked expense rollback, idempotent retry, partial payment, rejected overpayment, unpost payment/claim, preserved assignment and voucher links, explicit draft cleanup |
| Customer cycle | Invoice/post, draft receipt exclusion, receipt/post, matching paid amount and customer balance, blocked unsafe invoice unpost, receipt/invoice unpost, preserved links, repost and draft cleanup |
| Expenses | Posted linked payment blocks expense unposting; after payment unpost, expense unpost preserves the voucher and removes only the expense journal |
| Earlier guards | Phase 3 and phase 4 integration SQL still passes with phase 6 installed |
| Rollback | Restores captured functions/FK without losing salary rows; refuses rollback that would orphan a phase 6 salary journal |
| Client logic | Actual transpiled payroll and contractor hooks with test adapters: selection, decimal math, text status, current request IDs, one RPC, surfaced errors and posted locks |
| Actual browser | Next.js `/payroll` in headless Chrome with local test auth and all Supabase HTTP calls intercepted into local PostgreSQL: filtered save, exact 100.3 accrual, disabled posted inputs and selected unpost |
| TypeScript | 120 baseline diagnostics, 119 current diagnostics across eleven cumulative existing client files; zero new diagnostics, new payroll helper included |
| Whitespace | `git diff --check` passed |

The browser test used an isolated local database and synthetic administrator. No
real user password/session was changed, no authentication message was sent and no
production Supabase request was made by that browser test. Browser coverage is
specifically the payroll page; other financial cycles were tested through actual
database RPCs and client-hook checks, not every browser screen or print/export.

`../tests/phase_6_payroll.sql` and `../tests/phase_6_document_workflows.sql` also
passed on Supabase under the authenticated administrator role. Deferred balance
checks were forced before both entire transactions rolled back, including audit
and cash-flow fixtures. Local commit/concurrency tests used disposable databases
that were removed afterwards.

Final live counts: 61 accounts, 128 partners, 71 BOQ items; zero payroll slips,
claims, payments, invoices, receipts, expenses, labor logs, journal headers/lines
and cash flows. Zero disagreements between partner summaries and balance RPCs.

## Security, release and operational notes

All five new public RPCs are SECURITY INVOKER and deny anonymous execution. Existing
table RLS remains enabled. New private trigger functions have fixed empty search
paths, reject unauthenticated API calls and deny direct API-role execution. No
table policy or grant was widened. Supporting indexes cover the new foreign keys.

Security advisors are unchanged: intentional
[RLS without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
on the inaccessible phase 3 state table, and preexisting
[disabled leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
Unindexed foreign-key findings fell from 81 to 80. No new security warning appeared.
The earlier tool quota block was resolved; no approval check was bypassed.

This verifies the repaired workflows above, not every historical repository issue.
The 119 preexisting web type diagnostics and unrelated modules remain outside this
phase. The hosted website still uses its existing client until the local changes
are released. Backend safeguards are active now; the updated salary/claim screen
behavior needs that later client release. The user's instruction to defer GitHub
and site publishing was respected.

## Rollback

`../rollbacks/phase_6_atomic_workflows.sql` restores captured pre-phase-6 routines,
invoice FK behavior and removes the new payroll/source objects. Run transactionally
and coordinate the client version. It refuses rollback while any phase 6 salary
journal is present: unpost those salaries first. Existing salary amounts and other
financial source rows are preserved. Restoring the old routines reintroduces the
previous unsafe workflows. The rollback was tested only locally, not applied live.
