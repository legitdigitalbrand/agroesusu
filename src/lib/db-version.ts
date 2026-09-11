// ─────────────────────────────────────────────────────────────────────────────
// REQUIRED_MIGRATION — launch guard against "code ahead of database"
//
// THE INCIDENT (2026-09-11): deposits arrived at Safe Haven but the journal
// posting trigger was broken (fixed in migration 00052) and the fix was never
// applied to the live database. Result: ledger-derived balances read ₦0,
// transaction history empty — money invisible, nothing failed loudly.
//
// THE RULE: every migration that new code REQUIRES must bump this constant in
// the same PR. /api/health compares it to the database's actual latest
// migration (via the db_migration_status view from migration 00057) and
// returns 503 when the database is behind — so a deploy that outruns its
// migrations is caught immediately by monitoring/CI instead of by users.
//
// Bump this ONLY for migrations the deployed code depends on (new columns it
// selects, fixes for live flows, views it reads). Pure data backfills that
// don't block the app can be allowed to lag.
// ─────────────────────────────────────────────────────────────────────────────

export const REQUIRED_MIGRATION = "00057";

// Zero-padded versions compare correctly as strings; when we hit 100000
// (never), revisit this comparison.
export function isDbUpToDate(latestApplied: string | null): boolean {
  if (!latestApplied) return false; // view missing or no migrations applied
  return latestApplied >= REQUIRED_MIGRATION;
}
