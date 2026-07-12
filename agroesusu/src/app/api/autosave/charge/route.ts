import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { chargeAuthorization, generateReference } from "@/lib/paystack";

/**
 * POST /api/autosave/charge
 * 
 * Called by the daily cron workflow (not by users).
 * Finds all active auto-save plans that are due, charges each one using
 * the stored Paystack authorization_code, and credits the savings account.
 * 
 * Protected by a shared secret header so only the workflow can call it.
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  // Fetch all active plans that are due
  const { data: duePlans, error } = await admin
    .from("auto_save_plans")
    .select(`
      id, user_id, account_id, amount, frequency,
      authorization_code, email, next_charge_at,
      total_charged, charge_count
    `)
    .eq("status", "active")
    .lte("next_charge_at", now);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = [];

  for (const plan of (duePlans || [])) {
    try {
      const reference = generateReference("AGC_AUT");

      const result = await chargeAuthorization({
        authorization_code: plan.authorization_code,
        email: plan.email,
        amount: plan.amount,
        reference,
        metadata: {
          user_id: plan.user_id,
          account_id: plan.account_id,
          auto_save_plan_id: plan.id,
          is_recurring: true,
        },
      });

      if (result.data.status === "success") {
        // Credit the savings account
        const { data: acct } = await admin
          .from("savings_accounts")
          .select("current_amount")
          .eq("id", plan.account_id)
          .single();

        if (acct) {
          await admin
            .from("savings_accounts")
            .update({ current_amount: (acct.current_amount || 0) + plan.amount })
            .eq("id", plan.account_id);
        }

        // Record the transaction
        await admin.from("transactions").insert({
          user_id: plan.user_id,
          account_id: plan.account_id,
          type: "deposit",
          amount: plan.amount,
          reference,
          status: "completed",
          description: `Auto-save (${plan.frequency})`,
          paystack_fee: 0,
        });

        // Calculate next charge date
        const next = new Date();
        if (plan.frequency === "daily") next.setDate(next.getDate() + 1);
        else if (plan.frequency === "weekly") next.setDate(next.getDate() + 7);
        else next.setMonth(next.getMonth() + 1);

        // Update plan stats + next charge date
        await admin
          .from("auto_save_plans")
          .update({
            next_charge_at: next.toISOString(),
            last_charged_at: now,
            total_charged: (plan.total_charged || 0) + plan.amount,
            charge_count: (plan.charge_count || 0) + 1,
          })
          .eq("id", plan.id);

        results.push({ plan_id: plan.id, status: "charged", amount: plan.amount });
      } else {
        results.push({ plan_id: plan.id, status: "failed", reason: result.data.status });
      }
    } catch (err: any) {
      // Mark plan as failed after charge error — don't retry automatically
      await admin
        .from("auto_save_plans")
        .update({ status: "failed", failure_reason: err.message })
        .eq("id", plan.id);

      results.push({ plan_id: plan.id, status: "error", reason: err.message });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
