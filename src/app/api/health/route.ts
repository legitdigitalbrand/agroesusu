import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { REQUIRED_MIGRATION, isDbUpToDate } from "@/lib/db-version";

// ============================================================================
// NO-STORE SERVICE CLIENT (2026-09-11 incident #2):
// Next.js 14 caches fetch() (GET) by default — and on Vercel that Data Cache
// is shared and persists ACROSS deployments. The original guard used the
// plain service client, so its `select('latest')` on db_migration_status was
// served from a frozen Data Cache entry from the first ever request: the
// endpoint kept reporting migration 00057 (stale snapshot) while the real
// database moved to 00058/00059 — the guard could never detect a lagging
// database because its only "signal" was itself frozen. Any DB change was
// invisible to it. pg_stat_statements proved the query stopped hitting
// Postgres at all.
//
// This client overrides fetch with cache:'no-store' so every health check
// reads live data. (The count queries below used HTTP HEAD, which Next
// does not cache — which is why those numbers were already live.)
// ============================================================================
function createNoStoreServiceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, cache: "no-store" }),
    },
  });
}

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
  const service = createNoStoreServiceClient();
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
