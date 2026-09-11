-- ============================================================================
-- 00057 — DB migration status view (launch guard)
--
-- INCIDENT (2026-09-11): the deployed app ran against a database whose
-- migrations were behind the code (journal-posting fix 00052 unapplied →
-- deposits landed at Safe Haven but never posted to the ledger → every
-- balance read ₦0). Nothing failed loudly; users just saw zero balances.
--
-- GUARD: the code now carries REQUIRED_MIGRATION (src/lib/db-version.ts) and
-- /api/health compares it against the database's ACTUAL latest migration via
-- this view. If the view is missing (this migration not applied), the health
-- endpoint reports 503 degraded — fail-closed, since a missing view proves
-- the schema is behind the code.
--
-- The supabase_migrations schema is not exposed through PostgREST, so we
-- surface just the latest applied version here. Read-only, no sensitive data.
-- ============================================================================

BEGIN;

CREATE OR REPLACE VIEW public.db_migration_status AS
SELECT max(version)::text AS latest
FROM supabase_migrations.schema_migrations;

-- Server-side only (service role); anon stays out.
GRANT SELECT ON public.db_migration_status TO service_role;
REVOKE SELECT ON public.db_migration_status FROM anon, authenticated;

COMMIT;
