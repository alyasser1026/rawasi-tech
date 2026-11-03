# Phase 5: exact financial storage

Applied to Supabase project `tarhvoszqjfzmfgzuctu` as migration
`20261103201140_phase_5_exact_financial_values`. The local filename matches the
recorded remote version. No commit, push or hosted application release occurred.

## Database changes

Six public columns changed from double precision to unconstrained numeric:

| Table | Columns |
| --- | --- |
| payroll_slips | basic_salary, total_advances, total_deductions, net_salary |
| inventory | current_stock, avg_price |

The existing numeric payroll fields `allowances` and `amount_to_pay` retain their
types and now share the finite-value protection. Two validated CHECK constraints
reject NaN and both infinities across all eight financial/quantity fields.

No fixed scale is imposed: fractional prices/quantities and current monetary
precision are retained without introducing an unapproved rounding policy. Existing
defaults, nullable fields, the required net salary, IDs, posted flags, negative
net salaries, negative stock, unique employee/month constraint and foreign keys
remain unchanged. No view depends on the altered columns; no view or RPC needed
to be dropped/recreated. All exposed tables retain their RLS and grants.

Conversion uses `value::text::numeric` with `extra_float_digits=3` to retain each
legacy float's shortest precise decimal representation, including digits beyond
the ordinary float-to-numeric cast's precision. Existing binary artifacts such as
`0.30000000000000004` are preserved instead of silently rewritten. Future decimal
SQL additions/subtractions/products operate on numeric values. Nonfinite legacy
data makes the migration fail before changing types rather than being discarded.

Stock quantity is converted together with price because multiplying an exact
price by an approximate quantity would reintroduce float arithmetic. The only
remaining public float column is the nonmonetary import-staging attendance field
`temp_labor_daily_logs.attendance_value`, outside this phase.

## Scope and application compatibility

`get_payroll_balances_with_cutoff` now sums numeric salary values and was tested
with exact fractional balances. Column names and JSON numeric types are unchanged.
Public legacy RPCs that explicitly declare float return types, existing payroll
balance business rules, browser Number arithmetic, backup/restore number parsing
and browser rounding behavior were not redesigned. Precision already lost by a
client before sending data cannot be recovered by a numeric database column.

No client source file was changed in phase 5. Earlier phase 2–4 local client edits
are still pending publication. A browser payroll save/post workflow was not tested
here. The existing payroll hook still creates a posted header and its lines in
separate HTTP requests; the phase 3 empty-posted-entry guard prevents that sequence.
It needs an atomic posting path during the phase 6 workflow review. The current
delete-then-insert payroll save path also needs review there. These are existing
workflow issues, separate from the verified type conversion.

The payroll save/post workflow issues described above were subsequently repaired
and tested in `phase_6_atomic_workflows.md`.

## Verification

The isolated PostgreSQL 17 suite passed:

- Migration rejection/transaction rollback for nonfinite legacy salary, price and
  existing numeric allowance values.
- Conversion of populated legacy fixtures without changing decimal values, IDs,
  defaults/null behavior, negative quantities or posted flags.
- Exact 0.1 + 0.2 payroll balances through the existing balance RPC; exact salary
  subtraction and preservation of values beyond double precision's decimal range.
- Fractional stock additions and weighted-price calculations, exact stock value,
  and preservation of an average price with 18 fractional digits.
- NaN, Infinity and -Infinity rejection for every protected column; JSON number
  compatibility, anonymous permission denial and authenticated RLS isolation.
- Phase 3 and phase 4 integration SQL with phase 5 installed.
- Safe rollback refusal when a new decimal value cannot round-trip through float;
  schema and data stay numeric after rejection. Lossless rollback and reapplication
  against legacy fixtures both preserve the records.

`../tests/phase_5_exact_financial_values.sql` passed locally and on Supabase using
the authenticated administrator. It explicitly forces phase 3 deferred checks
before rolling back the entire transaction. No cloud fixture or audit row remains.
Every disposable local test database was removed.

Final cloud counts remain 61 accounts, 128 partners and 71 BOQ items; zero payroll
slips, inventory records, journal headers and lines. All six converted columns are
numeric, both new checks are validated, and RLS/defaults/nullability were verified.

Security and performance advisors are unchanged: intentional
[RLS without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
on the inaccessible phase 3 internal table, preexisting
[disabled leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection),
and 81 preexisting unindexed foreign keys. No permissions or new security warnings
were introduced. Git diff whitespace verification passed; no repeated web type
check was needed because this phase changed only SQL and documentation/tests.

## Rollback

`../rollbacks/phase_5_exact_financial_values.sql` restores the six original float
types and removes the finite checks. Run it transactionally. Before any changes it
verifies that each converted value survives numeric → float → precise decimal
round-tripping. If precision would be lost, or the float range is exceeded, it
fails and preserves the current schema/data. Reconcile the value explicitly before
retrying; do not remove that guard to force a lossy rollback.

Reference: PostgreSQL 17
[numeric types and precise float output](https://www.postgresql.org/docs/17/datatype-numeric.html).
