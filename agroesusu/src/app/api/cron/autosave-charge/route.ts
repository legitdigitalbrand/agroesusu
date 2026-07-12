import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { chargeAuthorization, generateReference } from "@/lib/paystack";

/**
 * GET /api/cron/autosave-charge
 *
 * Called exclusively by Vercel Cron (vercel.json) every day at 05:00 UTC
 * (06:00 Lagos / WAT). Vercel passes the CRON_SECRET automatically via the
 * Authorization header when invoking cron routes.
 *
 * Auth: Vercel Cron sets `Authorization: Bearer <CRON_SECRET>` on every
 * invocation. We also allow direct calls with the same header for manual
 * testing and the GitHub Actions backup cron.
 *
 * On failure of any individual plan the plan is marked "failed" and the
 * rest continue — a single bad card never blocks other users.
 */
export async function GET(request: NextRequest) {
  // Verify Vercel Cron secret (Authorization: Bearer <CRON_SECRET>)
  const authHeader = request.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const runId = `run_${Date.now()}`;

  // Fetch all active plans due for charging
  const { data: duePlans, error: fetchErr } = await admin
    .from("auto_save_plans")
    .select("id, user_id, account_id, amount, frequency, authorization_code, email, next_charge_at, total_charged, charge_count")
    .eq("status", "active")
    .lte("next_charge_at", now);

  if (fetchErr) {
    console.error(`[autosave-cron][${runId}] DB fetch error:`, fetchErr.message);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const plans = duePlans || [];
  console.log(`[autosave-cron][${runId}] Found ${plans.length} due plans`);

  const results: { plan_id: string; status: string; amount?: number; reason?: string }[] = [];

  for (const plan of plans) {
    const ref = generateReference("AGC_AUT");
    try {
      const charge = await chargeAuthorization({
        authorization_code: plan.authorization_code,
        email: plan.email,
        amount: plan.amount,
        reference: ref,
        metadata: { user_id: plan.user_id, account_id: plan.account_id, auto_save_plan_id: plan.id, is_recurring: true },
      });

      if (charge.data.status === "success") {
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

        // Record transaction
        await admin.from("transactions").insert({
          user_id: plan.user_id,
          account_id: plan.account_id,
          type: "deposit",
          amount: plan.amount,
          reference: ref,
          status: "completed",
          description: `Auto-save (${plan.frequency})`,
          paystack_fee: 0,
        });

        // Advance next_charge_at
        const next = new Date();
        if (plan.frequency === "daily") next.setDate(next.getDate() + 1);
        else if (plan.frequency === "weekly") next.setDate(next.getDate() + 7);
        else next.setMonth(next.getMonth() + 1);

        await admin.from("auto_save_plans").update({
          next_charge_at: next.toISOString(),
          last_charged_at: now,
          total_charged: (plan.total_charged || 0) + plan.amount,
          charge_count: (plan.charge_count || 0) + 1,
        }).eq("id", plan.id);

        results.push({ plan_id: plan.id, status: "charged", amount: plan.amount });
        console.log(`[autosave-cron][${runId}] ✅ Charged plan ${plan.id} — ₦${plan.amount}`);
      } else {
        // Paystack returned a non-success status (e.g. card declined)
        await admin.from("auto_save_plans")
          .update({ status: "failed", failure_reason: `Paystack: ${charge.data.status}` })
          .eq("id", plan.id);
        results.push({ plan_id: plan.id, status: "declined", reason: charge.data.status });
        console.warn(`[autosave-cron][${runId}] ❌ Plan ${plan.id} declined: ${charge.data.status}`);
      }
    } catch (err: any) {
      await admin.from("auto_save_plans")
        .update({ status: "failed", failure_reason: err.message })
        .eq("id", plan.id);
      results.push({ plan_id: plan.id, status: "error", reason: err.message });
      console.error(`[autosave-cron][${runId}] ❌ Plan ${plan.id} error:`, err.message);
    }
  }

  const summary = {
    run_id: runId,
    timestamp: now,
    total: plans.length,
    charged: results.filter(r => r.status === "charged").length,
    failed: results.filter(r => r.status !== "charged").length,
    results,
  };

  console.log(`[autosave-cron][${runId}] Done —`, JSON.stringify(summary));
  return NextResponse.json(summary);
}
