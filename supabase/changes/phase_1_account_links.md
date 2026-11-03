# Phase 1: account references

Applied to the new Rawasi database as migration `20261103190405_phase_1_account_links`.
The initial schema migration `20261103181609_initialize_empty_rawasi` is mirrored
locally from the existing bootstrap file so the local and remote version lists match.

## Changes

- Verified that all eight fixed account defaults resolve to existing transactional accounts.
- Aligned three invoice defaults with the existing invoice form: VAT account `215`,
  client materials account `217`, and retention account `124`. The migration resolves
  accounts by chart code rather than embedding account UUIDs.
- Added and validated `labor_daily_logs_credit_account_id_fkey` referencing
  `accounts.id`, with `ON DELETE RESTRICT` and `ON UPDATE NO ACTION`.
- Added `labor_daily_logs_credit_account_id_idx` to support the new reference.
- Retained nullable draft accounts and the existing labor default account `216`.
- Kept all business records and existing RLS rules unchanged.

## Preconditions

The initial schema and imported chart of accounts must already exist. In particular,
chart codes `215`, `217`, and `124` must identify transactional accounts. Fresh schema
installations must load the approved reference accounts before this data-dependent
migration; the migration intentionally fails if required defaults cannot resolve.
Any pre-existing labor credit-account orphan must be reconciled before application.

## Verification

Local tests covered successful labor insertion, invalid account insertion and update,
deletion of a referenced account, nullable drafts, the three invoice defaults, refusal
of a pre-existing orphan, and the rollback script. All local fixtures were rolled back.

The same insert, update, delete-protection, nullable-draft and invoice-default cases
passed on Supabase under the authenticated administrator role. The delete test used
a temporary account; every cloud fixture was rolled back.

After application, all eight default references resolve, the new constraint is
validated, the index is valid, and labor RLS remains enabled. Reference data remains
61 accounts, 128 partners and 71 catalog items. Existing invoice and labor counts
remain zero. No new security advisories were introduced.

The rollback is in `../rollbacks/phase_1_account_links.sql`. It restores the original
three defaults by chart code and removes only the new foreign key and index. Run it
transactionally only when explicitly reverting this phase; it does not rewrite data.

Files were kept locally. Nothing from this phase was committed or pushed to GitHub.
