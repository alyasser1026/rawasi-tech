# Phase 3: journal integrity

Applied to Supabase project `tarhvoszqjfzmfgzuctu` as migration
`20261103195159_phase_3_journal_integrity`. The local migration version matches
Supabase's migration history. Nothing was committed, pushed or deployed to the
hosted application during this phase.

## Database behavior

- Three validated checks prohibit negative or nonfinite amounts and simultaneous
  positive debit/credit amounts on a journal line. Existing NOT NULL constraints
  remain in force. Errors from the guard include Arabic explanations.
- Drafts may be empty or unbalanced while being prepared. A posted entry must
  have equal total debits and credits, a positive total, and at least two active
  lines. A zero/zero annotation line is allowed within an otherwise valid entry.
- Posted statuses are consistently `posted`, `مرحل` and `معتمد`.
- Deferred constraint triggers verify the final state at transaction completion.
  Existing posting routines can create a posted header before adding its lines;
  any failure rolls back the whole transaction, including source document status.
- Already committed posted entries cannot have their header or individual lines
  edited or extended. Change status first to unpost; edit and repost atomically.
  A no-op header update cannot reopen a posted entry for line edits.
- The internal `rawasi_private.journal_write_state` table tracks transaction IDs
  and revisions. Ordered parent locks serialize writers, and revision changes
  invalidate cached validation. Clients cannot read or write this table or invoke
  its private trigger functions. It has RLS enabled with intentionally no policies.
- Existing unposting routines that delete lines and then their header still work.
  Deleting lines while leaving an already posted header is rejected, even if the
  remaining lines happen to balance. Header deletion/cascade behavior is preserved;
  document deletion protections remain work for phase 4.
- Preflight checks refuse migration over invalid historical rows instead of
  silently changing financial amounts. No financial records were corrected here.

## Atomic draft editor

`public.save_journal_draft(uuid,date,text,jsonb)` updates a draft header and
replaces its lines in one transaction. It preserves supplied line IDs, partner,
project, quantity, price, notes and tax fields. Any invalid account or line restores
the original header and lines. Posted entries are refused. It is SECURITY INVOKER,
respects existing RLS, and is executable only by authenticated/service roles.

The local journal editor now uses this RPC and checks its result before displaying
success. Previously it sent separate update/delete/insert requests and ignored
individual errors. It also validates finite, nonnegative, one-sided amounts before
sending. This client change is local only; the hosted website needs a later release
to use it. Its existing routing and other unrelated UI behavior were not audited
as part of these financial constraint tests.

## Verification

The isolated local PostgreSQL 17 suite passed migration, rollback and:

- Negative debit/credit, two-sided amounts and NaN rejection.
- Empty, zero and unbalanced posting rejection at actual COMMIT, with drafts kept.
- All three posted statuses, decimal amounts, savepoints and zero annotation rows.
- Immutable committed headers/lines, blocked no-op bypass and partial deletion.
- Explicit unpost/edit/repost, cascade and existing unposting deletion order.
- Validation cache invalidation after SET CONSTRAINTS IMMEDIATE then DEFERRED.
- Atomic draft saving, metadata preservation, invalid-account rollback and grants.
- Actual manual/payment/receipt/invoice/labor/expense posting RPCs and universal
  unposting. An inconsistent invoice's posting and status changes rolled back.
- Concurrent writers: a waiting draft edit was rejected after the other session
  posted the entry. Disposable local databases were removed afterwards.

`../tests/phase_3_journal_integrity.sql` passed locally and on Supabase using the
authenticated administrator role. It explicitly forces deferred checks before
rolling back all fixtures, including audit rows. Local tests additionally exercise
real commit boundaries and concurrency without committing test data on Supabase.

Final cloud counts: 61 accounts, 128 partners, 71 BOQ items; zero journal headers,
lines, labor logs and private state rows. All three checks are validated; both
balance triggers are deferrable and initially deferred. Anonymous RPC execution
and authenticated access to internal state are denied.

Focused web TypeScript comparison: 120 existing diagnostics before these local
phase 2/3 client edits, 119 after, zero new diagnostics. The repository-wide
preexisting type errors are not resolved by this phase. Git diff whitespace check
passed.

Security advisor reports the expected informational
[RLS without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
for the intentionally inaccessible internal state table. The preexisting
[disabled leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
warning remains. Performance advisors still report 82 preexisting unindexed
foreign keys; the internal state FK is covered by its primary key.

## Rollback

`../rollbacks/phase_3_journal_integrity.sql` restores the captured original guard
functions and trigger, drops phase 3 checks/triggers/RPC and internal metadata,
and does not rewrite business rows. It was tested against populated disposable
fixtures with unchanged journal counts. Run it transactionally if needed.
Restore the previous local editor code at the same time: it calls the new RPC.
Rollback intentionally restores the old weaker financial validation.
