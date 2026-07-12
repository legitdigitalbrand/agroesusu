import { createAdminClient } from "@/lib/supabase/server";

/**
 * Called by the webhook when a charge.success event arrives with an
 * AGC_GDD reference — meaning a member just completed the group direct
 * debit setup payment.
 *
 * This function:
 * 1. Marks the group_contributions row as "verified" (the first payment)
 * 2. Activates the group_direct_debit_plans row with the authorization_code
 * 3. Calculates and sets next_charge_at based on the group's frequency
 * 4. Updates the group's total_pool
 * 5. Sends an in-app notification
 * 6. Triggers esusu payout-ready notification if all members have now paid
 */
export async function activateGroupDirectDebit(
  reference: string,
  paystackData: any
): Promise<{ credited: boolean; amount?: number; reference?: string; alreadyCompleted?: boolean }> {
  const admin = createAdminClient();

  // Look up the pending contribution
  const { data: contribution } = await admin
    .from("group_contributions")
    .select("*, savings_groups!inner(id, name, type, current_cycle, contribution_amount, contribution_frequency)")
    .eq("payment_reference", reference)
    .single();

  if (!contribution) {
    console.error("[group-dd-credit] No contribution found for reference:", reference);
    return { credited: false, reference };
  }

  if (contribution.status === "verified") {
    return { credited: false, alreadyCompleted: true, reference };
  }

  const authCode = paystackData?.authorization?.authorization_code;
  const email = paystackData?.customer?.email;
  const amountNaira = (paystackData?.amount || 0) / 100;
  const group = contribution.savings_groups as any;

  // Mark contribution as verified
  await admin.from("group_contributions").update({
    status: "verified",
    verified_date: new Date().toISOString(),
  }).eq("payment_reference", reference);

  // Update group pool
  await admin.from("savings_groups")
    .update({ total_pool: Number(group.total_pool || 0) + amountNaira })
    .eq("id", contribution.group_id);

  // Activate the DD plan with authorization_code + next_charge_at
  if (authCode && email) {
    const next = computeNextChargeAt(group.contribution_frequency);
    await admin.from("group_direct_debit_plans").update({
      status: "active",
      authorization_code: authCode,
      email,
      next_charge_at: next.toISOString(),
      last_charged_at: new Date().toISOString(),
      total_charged: amountNaira,
      charge_count: 1,
    }).eq("group_id", contribution.group_id).eq("user_id", contribution.user_id);

    console.log(`[group-dd-credit] Plan activated for user ${contribution.user_id} in group ${group.name}`);
  }

  // Notify the member
  await admin.from("notifications").insert({
    user_id: contribution.user_id,
    type: "group_dd_activated",
    channel: "in_app",
    title: "Direct Debit Active",
    content: `Your contributions to ${group.name} will now be charged automatically.`,
    status: "unread",
    metadata: { reference, amount: amountNaira, group_id: contribution.group_id },
  });

  // Esusu: check if all members have contributed this cycle
  if (group.type === "esusu") {
    const cycleNumber = group.current_cycle;
    const [{ count: activeCount }, { data: cycleContribs }] = await Promise.all([
      admin.from("group_members").select("id", { count: "exact", head: true })
        .eq("group_id", contribution.group_id).eq("status", "active"),
      admin.from("group_contributions").select("user_id")
        .eq("group_id", contribution.group_id).eq("cycle_number", cycleNumber).eq("status", "verified"),
    ]);

    if (activeCount && cycleContribs && cycleContribs.length >= activeCount) {
      const { data: recipient } = await admin
        .from("group_members")
        .select("user_id")
        .eq("group_id", contribution.group_id)
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
          metadata: { group_id: contribution.group_id, cycle_number: cycleNumber },
        });
      }
    }
  }

  return { credited: true, amount: amountNaira, reference };
}

function computeNextChargeAt(frequency: string | null): Date {
  const next = new Date();
  if (frequency === "daily") next.setDate(next.getDate() + 1);
  else if (frequency === "weekly") next.setDate(next.getDate() + 7);
  else next.setMonth(next.getMonth() + 1);
  return next;
}
