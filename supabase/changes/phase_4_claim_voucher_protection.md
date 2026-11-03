# Phase 4: preserve claims and payment vouchers

Applied to Supabase project `tarhvoszqjfzmfgzuctu` as migration
`20261103200454_phase_4_claim_voucher_protection`. Local and remote versions match.
No commit, push or hosted application release was performed.

## Resulting behavior

- `payment_vouchers.sub_claim_id` now uses ON DELETE RESTRICT, with a supporting
  index. Deleting a claim never cascades into its payment vouchers.
- Database triggers reject deletion of posted claims/vouchers or sources still
  linked to journals, even when a client attempts direct table access. Financial
  source fields cannot be edited while posted or while journals remain. IDs are
  immutable; permitted posting/payment-summary metadata updates remain possible.
- Direct deletion of a linked draft voucher is rejected. Explicitly selecting a
  draft voucher in `delete_payment_vouchers_bulk` releases that voucher's claim
  link and deletes that selected draft atomically. A posted voucher must first be
  unposted. All selected deletes succeed together or all roll back, including a
  previously processed draft when a later selection fails.
- `rpc_delete_claim` and its `delete_sub_claim` alias require an unposted claim
  without linked vouchers or journals. They release assignment/material/expense
  references and reset assignment billing/deduction flags in the same transaction.
  Posted records are not automatically unposted by deletion. Missing permissions
  cannot silently leave half-cleaned dependencies: the private guard checks for
  remaining links before allowing the final deletion.
- `rpc_unpost_claim` requires its payment vouchers to be unposted first. It
  removes only the claim's own journals, clears both journal IDs, restores draft
  status, and retains the claim, vouchers, assignments and deductions. Work is
  released only when the draft claim is actually deleted, so reposting is possible.
- `unpost_payment_vouchers_bulk` preserves the vouchers and claim links, removes
  their payment journals and updates status/flags in one transaction. It recomputes
  each affected claim's recorded paid amount from its remaining posted vouchers.
  The payment branch of `unpost_universal_bulk` delegates to this same function.
  Expense paid-amount behavior remains governed by the existing voucher triggers;
  unposting no longer resets it independently of the preserved voucher.
- Journal insertion for the active claim/payment source types locks and verifies
  the source row. It rejects absent sources and duplicate journals. Payment posting
  additionally requires its linked claim to be posted. This serializes financial
  posting against source deletion; either ordering aborts the unsafe operation.

## Security and permissions

Public RPCs remain SECURITY INVOKER with existing table RLS. Both new private
trigger functions use a fixed empty search path, reject unauthenticated API calls,
and have execution revoked from API roles. Source integrity checks inspect hidden
links internally without granting clients access to those rows. RLS policies and
table grants were not widened.

The protected operations deliberately require enough module permissions to verify
their cross-table effects: claim unposting needs claim editing, payment viewing
and journal viewing/deletion; claim deletion needs claim deletion plus payment and
journal viewing and access to release any actual linked work/materials/expenses.
Payment unposting needs payment editing and journal viewing/deletion, plus claim
viewing/editing when a linked claim's paid amount must be updated. A selected
voucher deletion needs payment view/edit/delete and journal viewing.

## Local client changes

- Claim actions now make one checked RPC call. Removed description-based voucher
  matching, automatic voucher unposting/deletion, early paid-amount resets and
  separate dependency updates. Confirmation/success messages describe preservation.
- Voucher deletion now calls the atomic bulk RPC instead of deleting in chunks.
- Voucher unposting uses the dedicated atomic routine and invalidates claim history.
  Other modules keep their existing unposting RPC; errors in their follow-up status
  update are now reported instead of ignored.

These changes are local only. The hosted site's old claim action still issues its
old separate requests until a later release. The database rejects its unsafe direct
state reset/deletion rather than following the old automatic deletion flow. New
draft-voucher deletion must use the updated client/RPC. This phase does not include
a browser end-to-end test or fix the separate multi-request claim/payment creation
workflow; full application workflow checks remain phase 6.

## Verification

`../tests/phase_4_claim_voucher_protection.sql` passed locally and on Supabase as
the authenticated administrator. It tests real claim/payment posting, protected
source deletion and financial edits, source-state reset rejection, linked-voucher
restriction, correct payment unposting, preservation of similarly described but
unrelated vouchers, retained assignments/deductions on unpost, reposting, mixed
bulk deletion rollback, explicit draft-voucher deletion and final claim cleanup.
Deferred phase 3 checks are forced before the entire test transaction rolls back.

An isolated PostgreSQL 17 suite also passed actual commit-boundary tests, RPC/RLS
permission denial, rollback of partial dependency cleanup and both concurrency
orders: deletion waiting for posting rejects the newly posted voucher; posting
waiting for deletion cannot leave an orphan journal. Phase 3 integration SQL also
passes with phase 4 installed. Every disposable local test database was removed.

Final cloud counts: 61 accounts, 128 partners, 71 BOQ items; zero claims, payment
vouchers, journal headers/lines and cash flows. Test transactions and their audit
records were rolled back. Foreign-key action, supporting index, triggers, RLS,
invoker functions and denied anonymous/private-function execution were verified.

Focused web TypeScript comparison across the eight cumulative client files shows
120 preexisting diagnostics before phases 2–4 and 119 afterwards, with zero new
diagnostics. Existing repository errors remain outside this phase. Git diff
whitespace check passed.

Security advisors are unchanged: intentional
[RLS without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
on the inaccessible phase 3 internal table, and preexisting
[disabled leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
The supporting claim-link index reduces preexisting unindexed foreign keys from
82 to 81. No new security issue was reported.

## Rollback

`../rollbacks/phase_4_claim_voucher_protection.sql` restores the captured six RPC
definitions and original cascading FK, and removes phase 4 triggers/functions/index.
Run it transactionally and coordinate the client version. It was tested against
populated disposable fixtures with unchanged source-document counts. It does not
rewrite financial rows or restore any intentionally deleted draft documents.
Restoring the old migration reintroduces its unsafe deletion behavior.

Reference: PostgreSQL 17 documentation for
[foreign-key deletion actions](https://www.postgresql.org/docs/17/ddl-constraints.html#DDL-CONSTRAINTS-FK)
and [row locks](https://www.postgresql.org/docs/17/explicit-locking.html#LOCKING-ROWS).
