# Phase 2: partner balances

Applied to Supabase as migration `20261103192435_phase_2_partner_balances`.
The migration filename mirrors the version recorded by Supabase.

## Database behavior

- `partner_statement_ledger` now includes only journal header statuses `posted`,
  `مرحل`, and `معتمد`. Drafts, pending entries, cancellations and null statuses
  are excluded consistently.
- The original nine ledger columns are preserved. Appended columns provide stable
  line/header IDs, source type/reference, quantity, creation time and attendance.
- Running balances use entry date, line creation time and line ID with an explicit
  row window, so tied transactions do not jump to a combined balance.
- `all_partners_account_summary` aggregates the same ledger. Posted work days
  additionally require an actual posted labor header and a matching worker line.
- New `partner_balances_summary` exposes the compatibility fields expected by the
  existing hook. `total_earned` and `total_paid` alias all ledger credits/debits;
  they are not exclusively wages or cash payments.
- New `get_partner_balance(p_id uuid)` returns a scalar numeric from that ledger.
  Credit minus debit is the common sign convention: positive means owed to the
  partner, negative means owed by the partner. Empty, null or invisible partners
  return zero.
- Four supporting indexes cover partner/header lookups and labor references.
- All three views use invoker security; the RPC is also an invoker. Existing table
  RLS remains authoritative, and anonymous access to the new view/RPC is denied.
  Non-administrator roles retain their existing underlying table permissions.

## Local client improvements

Statement queries and exports use stable line IDs and matching chronological order.
Partner statement printing now paginates and imports its loading component correctly.
Voucher balances refetch when the modal opens and show the fetching state.

These four client files have been changed locally only. They have not been
published to the hosted site, committed or pushed to GitHub.

## Verification

Local financial fixtures covered supplier, customer and worker balances, partial
payments, negative balances after overpayment, inactive/no-activity partners,
posted attendance, every supported posted status, excluded draft/cancelled states,
tied rows, date cutoffs, unposting/reposting, compatibility fields and RLS. The
rollback restores the original two view definitions, shapes and ledger grants.
All local fixtures and schema changes were rolled back.

The SQL verification in `../tests/phase_2_partner_balances.sql` passed on Supabase
under the authenticated administrator role. Every cloud fixture was rolled back.
REST checks returned HTTP 200 for both new contracts and the appended ledger
columns; the balance RPC returned a scalar JSON number.

The original 128 partners appear exactly once, with no disagreement between the
ledger, either summary and the RPC. Their real balances remain zero because no
financial entries have been imported or committed. Reference data remains 61
accounts, 128 partners and 71 catalog items, with zero journal headers/lines or
labor logs left by tests.

TypeScript comparison found zero new diagnostics in the web project; the existing
diagnostic count fell from 120 to 119 after the print component import was fixed.
This is not a clean full-application build; unrelated diagnostics remain.

No new security advisory appeared. The pre-existing leaked-password protection
warning remains a separate Auth configuration item:
https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Reverting

`../rollbacks/phase_2_partner_balances.sql` restores the captured pre-phase-2 views
and their grants, and removes only this phase's new RPC, compatibility view and
indexes. Apply it transactionally only when explicitly reverting this phase and
before later changes introduce dependencies. It does not rewrite business rows.
