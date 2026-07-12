import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/autosave/cancel
 * Cancel an active auto-save plan. User-authenticated.
 */
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rl = await checkRateLimit(ip, 'autosave', { maxAttempts: 10, windowSeconds: 60 });
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { plan_id } = await request.json();
  if (!plan_id) return NextResponse.json({ error: "plan_id is required" }, { status: 400 });

  const admin = createAdminClient();

  // Verify ownership before cancelling
  const { data: plan } = await admin
    .from("auto_save_plans")
    .select("id, user_id")
    .eq("id", plan_id)
    .eq("user_id", user.id)
    .single();

  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  await admin
    .from("auto_save_plans")
    .update({ status: "cancelled" })
    .eq("id", plan_id);

  return NextResponse.json({ success: true });
}
