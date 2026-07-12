import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/autosave/retry
 * 
 * Reactivates a failed auto-save plan so the next cron run picks it up.
 * User-authenticated — users can retry their own failed plans.
 * Resets status to "active" and sets next_charge_at to now so it's
 * picked up on the very next cron invocation.
 */
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rl = await checkRateLimit(ip, 'autosave-retry', { maxAttempts: 5, windowSeconds: 60 });
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { plan_id } = await request.json();
  if (!plan_id) return NextResponse.json({ error: "plan_id is required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: plan } = await admin
    .from("auto_save_plans")
    .select("id, user_id, status")
    .eq("id", plan_id)
    .eq("user_id", user.id)
    .single();

  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  if (plan.status !== "failed") return NextResponse.json({ error: "Only failed plans can be retried" }, { status: 400 });

  await admin.from("auto_save_plans").update({
    status: "active",
    failure_reason: null,
    next_charge_at: new Date().toISOString(), // charge on next cron run
  }).eq("id", plan_id);

  return NextResponse.json({ success: true, message: "Plan reactivated. Will charge on next scheduled run." });
}
