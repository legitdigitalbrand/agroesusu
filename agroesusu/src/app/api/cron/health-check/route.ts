import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/cron/health-check
 *
 * Vercel Cron pings this every 5 minutes.
 * - Keeps the Supabase connection pool warm (cold-start latency on first
 *   user request drops significantly with an active pool)
 * - Validates critical env vars are present
 * - Returns a simple JSON health report (visible in Vercel Function logs)
 *
 * Also useful as a public uptime-monitor endpoint — does not require auth
 * so external monitors (UptimeRobot, BetterUptime, etc.) can call it freely.
 */
export async function GET(request: NextRequest) {
  const checks: Record<string, boolean> = {};
  const errors: string[] = [];

  // 1. Env var presence
  checks.supabase_url = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  checks.supabase_anon_key = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  checks.supabase_service_key = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  checks.paystack_key = !!process.env.PAYSTACK_SECRET_KEY;
  checks.cron_secret = !!process.env.CRON_SECRET;

  // 2. Supabase DB connectivity — lightweight query
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("savings_accounts").select("id").limit(1);
    checks.db_reachable = !error;
    if (error) errors.push(`DB: ${error.message}`);
  } catch (e: any) {
    checks.db_reachable = false;
    errors.push(`DB exception: ${e.message}`);
  }

  const allGood = Object.values(checks).every(Boolean);
  const status = allGood ? 200 : 503;

  const report = {
    status: allGood ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    checks,
    ...(errors.length ? { errors } : {}),
  };

  if (!allGood) {
    console.error("[health-check] DEGRADED:", JSON.stringify(report));
  }

  return NextResponse.json(report, { status });
}
