import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { chargeAuthorization, generateReference } from "@/lib/paystack";

/**
 * GET /api/cron/group-dd-charge
 *
 * Vercel Cron fires daily at 05:05 UTC (06:05 Lagos).
 * Finds all active group_direct_debit_plans whose next_charge_at <= now,
 * charges each member's saved card, and credits their group contribution.
 *
 * Key invariants:
 * - Idempotent: if a member already has a verified contribution for this
 *   cycle, we skip them and advance next_charge_at without charging
 * - Per-plan try/catch: one failed card never blocks other members
 * - Esusu payout-ready notification fires when all members have contributed
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const runId = `gdd_${Date.now()}`;

  // Fetch all active plans due for charging, with group context
  const { data: duePlans, error: fetchErr } = await admin
    .from("group_direct_debit_plans")
    .select(`
      id, user_id, group_id, amount:groups!inner(contribution_amount),
      authorization_code, email, next_charge_at, total_charged, charge_count,
      groups!inner(id, name, type, current_cycle, contribution_amount, contribution_frequency, status, member_count)
    `)
    .eq("status", "active")
    .lte("next_charge_at", now);

  if (fetchErr) {
    console.error(`[group-dd-cron][${runId}] fetch error:`, fetchErr.message);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  // Simpler flat query to avoid join complexity
  const { data: flatPlans } = await admin
    .from("group_direct_debit_plans")
    .select("id, user_id, group_id, authorization_code, email, next_charge_at, total_charged, charge_count")
    .eq("status", "active")
    .lte("next_charge_at", now);

  const plans = flatPlans || [];
  console.log(`[group-dd-cron][${runId}] Found ${plans.length} due plans`);

  const results: { plan_id: string; status: string; amount?: number; reason?: string }[] = [];

  for (const plan of plans) {
    try {
      // Fetch group details for this plan
      const { data: group } = await admin
        .from("savings_groups")
        .select("id, name, type, current_cycle, contribution_amount, contribution_frequency, status")
        .eq("id", plan.group_id)
        .single();

      if (!group || !["active", "recruiting"].includes(group.status)) {
        // Group inactive/disbanded — cancel the DD plan
        await admin.from("group_direct_debit_plans")
          .update({ status: "cancelled" })
          .eq("id", plan.id);
        results.push({ plan_id: plan.id, status: "skipped_group_inactive" });
        continue;
      }

      const cycleNumber = group.type === "esusu" ? group.current_cycle : 0;
      const amount = Number(group.contribution_amount);

      // Idempotency: skip if already contributed this cycle
      const { data: existingContrib } = await admin
        .from("group_contributions")
        .select("id, status")
        .eq("group_id", plan.group_id)
        .eq("user_id", plan.user_id)
        .eq("cycle_number", cycleNumber)
        .eq("status", "verified")
        .maybeSingle();

      if (existingContrib) {
        // Already paid this cycle — just advance the schedule
        const next = computeNextChargeAt(group.contribution_frequency);
        await admin.from("group_direct_debit_plans")
          .update({ next_charge_at: next.toISOString() })
          .eq("id", plan.id);
        results.push({ plan_id: plan.id, status: "already_contributed_this_cycle" });
        continue;
      }

      const ref = generateReference("AGC_GDD");

      // Charge the card
      const charge = await chargeAuthorization({
        authorization_code: plan.authorization_code,
        email: plan.email,
        amount,
        reference: ref,
        metadata: {
          user_id: plan.user_id,
          group_id: plan.group_id,
          cycle_number: cycleNumber,
          is_group_direct_debit: true,
          auto: true,
        },
      });

      if (charge.data.status === "success") {
        // Insert verified contribution
        await admin.from("group_contributions").insert({
          group_id: plan.group_id,
          user_id: plan.user_id,
          cycle_number: cycleNumber,
          amount,
          payment_reference: ref,
          status: "verified",
          verified_date: new Date().toISOString(),
        });

        // Update group pool
        const { data: grp } = await admin
          .from("savings_groups")
          .select("total_pool")
          .eq("id", plan.group_id)
          .single();
        if (grp) {
          await admin.from("savings_groups")
            .update({ total_pool: Number(grp.total_pool) + amount })
            .eq("id", plan.group_id);
        }

        // Notify member
        await admin.from("notifications").insert({
          user_id: plan.user_id,
          type: "group_contribution",
          channel: "in_app",
          title: "Auto Contribution Successful",
          content: `₦${amount.toLocaleString()} was automatically contributed to ${group.name}.`,
          status: "unread",
          metadata: { reference: ref, amount, group_id: plan.group_id, auto: true },
        });

        // Advance schedule
        const next = computeNextChargeAt(group.contribution_frequency);
        await admin.from("group_direct_debit_plans").update({
          next_charge_at: next.toISOString(),
          last_charged_at: new Date().toISOString(),
          total_charged: Number(plan.total_charged || 0) + amount,
          charge_count: Number(plan.charge_count || 0) + 1,
        }).eq("id", plan.id);

        // Check if all members contributed this cycle (esusu payout trigger)
        if (group.type === "esusu") {
          const [{ count: activeCount }, { data: cycleContribs }] = await Promise.all([
            admin.from("group_members").select("id", { count: "exact", head: true })
              .eq("group_id", plan.group_id).eq("status", "active"),
            admin.from("group_contributions").select("user_id")
              .eq("group_id", plan.group_id).eq("cycle_number", cycleNumber).eq("status", "verified"),
          ]);

          if (activeCount && cycleContribs && cycleContribs.length >= activeCount) {
            const { data: recipient } = await admin
              .from("group_members")
              .select("user_id")
              .eq("group_id", plan.group_id)
              .eq("slot_position", cycleNumber)
              .eq("has_received_payout", false)
              .single();

            if (recipient) {
              await admin.from("notifications").insert({
                user_id: recipient.user_id,
                type: "group_payout_ready",
                channel: "in_app",
                title: "Your Payout Is Ready",
                content: `All members have contributed for cycle ${cycleNumber}. Claim your payout now.`,
                status: "unread",
                metadata: { group_id: plan.group_id, cycle_number: cycleNumber },
              });
            }
          }
        }

        results.push({ plan_id: plan.id, status: "charged", amount });
        console.log(`[group-dd-cron][${runId}] ✅ ${plan.user_id} → ${group.name} ₦${amount}`);
      } else {
        await admin.from("group_direct_debit_plans")
          .update({ status: "failed", failure_reason: `Paystack: ${charge.data.status}` })
          .eq("id", plan.id);

        // Notify member about failure
        await admin.from("notifications").insert({
          user_id: plan.user_id,
          type: "group_dd_failed",
          channel: "in_app",
          title: "Auto Contribution Failed",
          content: `Your automatic contribution to ${group.name} failed. Please contribute manually or update your card.`,
          status: "unread",
          metadata: { group_id: plan.group_id, reason: charge.data.status },
        });

        results.push({ plan_id: plan.id, status: "declined", reason: charge.data.status });
        console.warn(`[group-dd-cron][${runId}] ❌ ${plan.user_id} → ${group.name} declined: ${charge.data.status}`);
      }
    } catch (err: any) {
      await admin.from("group_direct_debit_plans")
        .update({ status: "failed", failure_reason: err.message })
        .eq("id", plan.id);
      results.push({ plan_id: plan.id, status: "error", reason: err.message });
      console.error(`[group-dd-cron][${runId}] ❌ Plan ${plan.id} error:`, err.message);
    }
  }

  const summary = {
    run_id: runId,
    timestamp: now,
    total: plans.length,
    charged: results.filter(r => r.status === "charged").length,
    skipped: results.filter(r => r.status.startsWith("skipped") || r.status === "already_contributed_this_cycle").length,
    failed: results.filter(r => ["declined", "error"].includes(r.status)).length,
    results,
  };

  console.log(`[group-dd-cron][${runId}] Done:`, JSON.stringify(summary));
  return NextResponse.json(summary);
}

function computeNextChargeAt(frequency: string | null): Date {
  const next = new Date();
  if (frequency === "daily") next.setDate(next.getDate() + 1);
  else if (frequency === "weekly") next.setDate(next.getDate() + 7);
  else next.setMonth(next.getMonth() + 1); // default monthly
  return next;
}
