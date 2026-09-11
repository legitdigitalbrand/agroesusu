import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { REQUIRED_MIGRATION, isDbUpToDate } from "@/lib/db-version";

// ============================================================================
// GET /api/health — PUBLIC launch guard + operational smoke check
//
// Returns 200 when the database is in step with the deployed code, 503 when
// the schema is behind (the 2026-09-11 incident: code shipped, migrations
// unapplied → deposits uncredited, balances read ₦0).
//
// Public by design: no PII, only aggregate counts and version strings. CI
// (see .github/workflows/health-guard.yml) hits this after every deploy to
// main and fails the check on 503.
//
// Checks:
//   migrations  — DB's latest applied migration vs REQUIRED_MIGRATION
//                 (missing db_migration_status view counts as behind:
//                 fail-closed — the view only exists once 00057 is applied)
//   stuck_events — inbound_events still received/processing after >1h
//                 (the "money arrived but was never credited" signature)
//   failed_tx    — financial_transactions that failed in the last 24h
// ============================================================================

export const dynamic = "force-dynamic";

export async function GET() {
  const service = createServiceClient();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // 1. Schema version (fail-closed: view missing → behind)
  let dbMigration: string | null = null;
  let migrationsOk = false;
  try {
    const { data, error } = await service.from("db_migration_status").select("latest").maybeSingle();
    if (!error && data) dbMigration = (data as { latest: string | null }).latest ?? null;
    migrationsOk = isDbUpToDate(dbMigration);
  } catch {
    // View missing → migrations definitely behind → migrationsOk stays false
  }

  // 2. Stuck inbound events (>1h old, not yet processed — deposits sitting
  //    uncredited). Informational: recent ones are normal; the count is what
  //    ops dashboards alert on.
  let stuckEvents = 0;
  try {
    const { count } = await service
      .from("inbound_events")
      .select("id", { count: "exact", head: true })
      .in("processing_status", ["received", "processing"])
      .lt("created_at", oneHourAgo);
    stuckEvents = count ?? 0;
  } catch {
    stuckEvents = -1; // query failed — surface it rather than hide behind 0
  }

  // 3. Failed transactions in the last 24h
  let failedTx = 0;
  try {
    const { count } = await service
      .from("financial_transactions")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("created_at", oneDayAgo);
    failedTx = count ?? 0;
  } catch {
    failedTx = -1;
  }

  const body = {
    status: migrationsOk ? "ok" : "degraded",
    checked_at: new Date().toISOString(),
    migrations: {
      ok: migrationsOk,
      db_migration: dbMigration,
      required_migration: REQUIRED_MIGRATION,
      pending: dbMigration && dbMigration < REQUIRED_MIGRATION,
    },
    money_movement: {
      stuck_events: stuckEvents, // >0 for more than a few minutes = investigate
      failed_transactions_24h: failedTx,
    },
  };

  return NextResponse.json(body, { status: migrationsOk ? 200 : 503 });
}
