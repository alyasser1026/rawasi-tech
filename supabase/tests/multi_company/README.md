# Multi-company database checks

Run these only in disposable local PostgreSQL databases, never in the live project.
Start from the initialized application schema, seed its chart of accounts, and apply phases 1–6.
Then apply `00_supabase_stub.sql`, `10_multi_company_fixture.sql`, and
`20261104234711_multi_company_system.sql`.

Use a fresh copy of that database for each suite:

- `20_multi_company_step1_tests.sql`: company administration and access checks (74 assertions).
- Apply `20261105010528_multi_company_isolation.sql`, then run
  `30_multi_company_step2_isolation_tests.sql` (59 assertions) and
  `40_multi_company_workflow_smoke.sql` (invoice posting in two companies).
- Apply steps 2 and 3 (`20261105010612_multi_company_posting_accounts.sql`), then run
  `50_multi_company_step3_tests.sql` (34 assertions). It includes `50_step3_company.sql`.

Apply each migration with `psql -1`. A nonzero process exit, any `FAIL` notice, or any unexpected
`ERROR` is a failure. The tests exercise expected errors inside helper functions.
The chart fixture is the original 61-account chart: several checks use its account IDs and codes.

For rollback verification, compare schema-only dumps before and after the corresponding rollback
in a clean copy. Ignore dump comments and trailing whitespace. Both steps 2 and 3 must restore
the previous schema; reapplying step 3 must produce the same schema again.
