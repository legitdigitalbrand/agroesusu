import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { initializeTransaction, generateReference } from "@/lib/paystack";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/autosave/setup
 * 
 * Starts the auto-save setup flow:
 * 1. Creates a pending auto_save_plan row in the DB
 * 2. Initializes a Paystack transaction for ₦50 (refunded mentally — 
 *    it's just to tokenize the card; we use the authorization_code going forward)
 *    Actually: we charge the FIRST auto-save amount immediately so the user
 *    gets immediate confirmation the card works, then set up future recurring charges.
 * 3. Returns the Paystack checkout URL
 * 
 * The webhook/verify flow then saves the authorization_code from the
 * charge.success event and activates the plan.
 */
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rl = await checkRateLimit(ip, 'autosave', { maxAttempts: 5, windowSeconds: 60 });
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { account_id, amount, frequency } = body;

  if (!account_id || !amount || !frequency) {
    return NextResponse.json({ error: "account_id, amount, and frequency are required" }, { status: 400 });
  }
  if (amount < 100) {
    return NextResponse.json({ error: "Minimum auto-save amount is ₦100" }, { status: 400 });
  }
  if (!["daily", "weekly", "monthly"].includes(frequency)) {
    return NextResponse.json({ error: "frequency must be daily, weekly, or monthly" }, { status: 400 });
  }

  // Verify the pot belongs to this user
  const admin = createAdminClient();
  const { data: pot } = await admin
    .from("savings_accounts")
    .select("id, name, user_id")
    .eq("id", account_id)
    .eq("user_id", user.id)
    .single();

  if (!pot) return NextResponse.json({ error: "Savings pot not found" }, { status: 404 });

  // Deactivate any existing plan for this pot (only one active plan per pot)
  await admin
    .from("auto_save_plans")
    .update({ status: "cancelled" })
    .eq("user_id", user.id)
    .eq("account_id", account_id)
    .eq("status", "active");

  // Calculate next charge date based on frequency
  const nextCharge = new Date();
  if (frequency === "daily") nextCharge.setDate(nextCharge.getDate() + 1);
  else if (frequency === "weekly") nextCharge.setDate(nextCharge.getDate() + 7);
  else nextCharge.setMonth(nextCharge.getMonth() + 1);

  // Create pending plan row
  const { data: plan, error: planErr } = await admin
    .from("auto_save_plans")
    .insert({
      user_id: user.id,
      account_id,
      amount,
      frequency,
      status: "pending_auth", // will become "active" after card tokenization
      next_charge_at: nextCharge.toISOString(),
      total_charged: 0,
      charge_count: 0,
    })
    .select()
    .single();

  if (planErr || !plan) {
    return NextResponse.json({ error: "Failed to create auto-save plan" }, { status: 500 });
  }

  // Initialize Paystack — charge the FIRST instalment immediately so the
  // user sees real money move and the authorization is captured
  const reference = generateReference("AGC_AUT");
  const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "https://agroesusu.vercel.app";

  try {
    const tx = await initializeTransaction({
      email: user.email!,
      amount,
      reference,
      callback_url: `${origin}/save/autosave-success?plan_id=${plan.id}`,
      metadata: {
        user_id: user.id,
        account_id,
        account_name: pot.name,
        auto_save_plan_id: plan.id,
      } as any,
    });

    // Store the reference so we can match it in the webhook
    await admin
      .from("auto_save_plans")
      .update({ setup_reference: reference })
      .eq("id", plan.id);

    return NextResponse.json({ url: tx.data.authorization_url });
  } catch (err: any) {
    // Clean up the pending plan if Paystack fails
    await admin.from("auto_save_plans").delete().eq("id", plan.id);
    return NextResponse.json({ error: err.message || "Payment setup failed" }, { status: 502 });
  }
}
