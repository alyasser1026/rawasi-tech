# Fresh Rawasi database

`initial_schema.sql` creates a fresh database structure for Rawasi. It includes
36 business and system tables, reporting views, accounting functions, relations,
triggers, module permissions, and login audit logging. It contains no old
customers, projects, accounts, accounting entries, or other business rows.

Run the complete file only against a new Supabase project's empty `public`
schema. The preflight check refuses to run when application relations already
exist. Supabase-managed Auth and extension schemas must already be present.
Use a transaction or the Supabase migration tool so a failed setup rolls back.

The initial deployment used the remote migration name `initialize_empty_rawasi`.
Do not run this initial setup again on a database where it has been applied.
Use a separate migration for later schema changes.

The script creates a safe default profile for each newly registered Auth user.
Existing users need their profiles initialized separately. Administrator access
must be assigned explicitly to an approved account; signup metadata cannot grant
administrative privileges. No user-specific administrator email is stored here.

All public tables have RLS enabled, reporting views use invoker permissions,
and internal privileged trigger functions live in a non-exposed schema. Signed
in users receive module or ownership access; anonymous clients have no business
data access. Business setup, including the chart of accounts, starts empty.

The bootstrap was validated on an isolated PostgreSQL instance and on the target
Supabase project. Verification covered login audit insertion, administrator
access, profile privilege protection, denied anonymous access, dashboard queries,
inventory queries, and basic ledger reads. Test rows were rolled back.
