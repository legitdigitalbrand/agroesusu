import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/groups/direct-debit/cancel
 *
 * User cancels their group direct debit plan.
 * Marks the plan as "cancelled" — the cron will skip it.
 * The member can still contribute manually after cancelling.
 */
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rl = await checkRateLimit(ip, "group_dd_cancel", { maxAttempts: 10, windowSeconds: 60 });
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { plan_id } = await request.json();
  if (!plan_id) return NextResponse.json({ error: "plan_id is required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: plan } = await admin
    .from("group_direct_debit_plans")
    .select("id, user_id, status")
    .eq("id", plan_id)
    .eq("user_id", user.id)
    .single();

  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  if (plan.status === "cancelled") return NextResponse.json({ success: true, message: "Already cancelled" });

  await admin
    .from("group_direct_debit_plans")
    .update({ status: "cancelled" })
    .eq("id", plan_id);

  return NextResponse.json({ success: true, message: "Direct debit cancelled. You can still contribute manually." });
}
