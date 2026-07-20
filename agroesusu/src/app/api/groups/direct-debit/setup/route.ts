import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getPaymentService, generatePaymentReference } from "@/lib/payment-provider";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/groups/direct-debit/setup
 *
 * Initiates Paystack checkout for a group direct debit setup.
 * The setup charge IS the member's first group contribution — real money,
 * not a ₦50 dummy charge. This ensures we get a reusable authorization_code
 * and the member starts contributing immediately.
 *
 * Flow:
 *   1. Validate: user is an active member, no existing active DD plan
 *   2. Create a pending group_direct_debit_plans row
 *   3. Also create a pending group_contributions row for this first payment
 *   4. Open Paystack checkout → callback lands on /groups/[id]/dd-success
 *   5. Webhook (charge.success with AGC_GDD prefix) activates the plan
 *      and credits the group contribution in one atomic operation
 */
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rl = await checkRateLimit(ip, "group_dd_setup", { maxAttempts: 5, windowSeconds: 300 });
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { group_id, email } = await request.json();
  if (!group_id || !email) return NextResponse.json({ error: "group_id and email are required" }, { status: 400 });

  const admin = createAdminClient();

  // Validate group
  const { data: group } = await admin
    .from("savings_groups")
    .select("id, name, status, type, contribution_amount, current_cycle, admin_id")
    .eq("id", group_id)
    .single();

  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });
  if (!["active", "recruiting"].includes(group.status)) {
    return NextResponse.json({ error: "Group is not accepting contributions" }, { status: 400 });
  }

  // Validate membership
  const { data: membership } = await admin
    .from("group_members")
    .select("id")
    .eq("group_id", group_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership) return NextResponse.json({ error: "You are not an active member of this group" }, { status: 403 });

  // Check for existing active/pending plan (idempotency)
  const { data: existingPlan } = await admin
    .from("group_direct_debit_plans")
    .select("id, status")
    .eq("group_id", group_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingPlan && existingPlan.status === "active") {
    return NextResponse.json({ error: "You already have an active direct debit for this group" }, { status: 400 });
  }

  const reference = generatePaymentReference("AGC_GDD");
  const cycleNumber = group.type === "esusu" ? group.current_cycle : 0;
  const origin = request.nextUrl.origin;

  // Upsert the DD plan (handles re-setup after failure)
  await admin.from("group_direct_debit_plans").upsert({
    ...(existingPlan ? { id: existingPlan.id } : {}),
    user_id: user.id,
    group_id,
    email,
    setup_reference: reference,
    status: "pending_auth",
    failure_reason: null,
  }, { onConflict: "user_id,group_id" });

  // Create the first contribution record (pending) — same as manual contribute
  const { error: contribErr } = await admin.from("group_contributions").insert({
    group_id,
    user_id: user.id,
    cycle_number: cycleNumber,
    amount: Number(group.contribution_amount),
    payment_reference: reference,
    status: "pending",
  });

  if (contribErr) {
    return NextResponse.json({ error: contribErr.message }, { status: 500 });
  }

  // Paystack checkout
  const service = await getPaymentService();
  const txn = await service.initializeTransaction({
    email,
    amount: Number(group.contribution_amount),
    reference,
    callback_url: `${origin}/groups/${group_id}/dd-success?reference=${reference}`,
    metadata: {
      user_id: user.id,
      group_id,
      cycle_number: cycleNumber,
      is_group_direct_debit: true,
      group_name: group.name,
    } as any,
  });

  if (!txn.authorization_url) return NextResponse.json({ error: "Failed to initialize payment" }, { status: 500 });

  return NextResponse.json({ authorization_url: txn.authorization_url, reference: txn.reference });
}
