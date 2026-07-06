import { createAdminClient } from "@/lib/supabase/server";
import { verifyTransaction } from "@/lib/paystack";

/**
 * Idempotently verifies a Paystack transaction for a group contribution and
 * credits it — same pattern as verifyAndCreditDeposit (safe to call from
 * both the webhook and the browser redirect; the "verified" status check
 * prevents double-crediting).
 */
export async function verifyAndCreditGroupContribution(reference: string) {
  const verification = await verifyTransaction(reference);

  if (verification.data.status !== "success") {
    return { status: verification.data.status as string, credited: false };
  }

  const admin = createAdminClient();
  const amountInNaira = verification.data.amount / 100;

  const { data: contribution } = await admin
    .from("group_contributions")
    .select("*")
    .eq("payment_reference", reference)
    .single();

  if (!contribution) {
    console.error("Group contribution credit: no record for reference", reference);
    return { status: "success", credited: false, amount: amountInNaira, reference };
  }

  if (contribution.status === "verified") {
    return { status: "success", credited: false, amount: amountInNaira, reference, alreadyCompleted: true };
  }

  await admin
    .from("group_contributions")
    .update({ status: "verified", verified_date: new Date().toISOString() })
    .eq("id", contribution.id);

  const { data: group } = await admin
    .from("savings_groups")
    .select("total_pool, type, current_cycle, member_count")
    .eq("id", contribution.group_id)
    .single();

  if (group) {
    await admin
      .from("savings_groups")
      .update({ total_pool: Number(group.total_pool) + amountInNaira })
      .eq("id", contribution.group_id);
  }

  await admin.from("notifications").insert({
    user_id: contribution.user_id,
    type: "group_contribution",
    channel: "in_app",
    title: "Contribution Successful",
    content: `Your contribution of ₦${amountInNaira.toLocaleString()} was received.`,
    status: "unread",
    metadata: { reference, amount: amountInNaira, group_id: contribution.group_id },
  });

  // Esusu cycles: if every active member has now contributed for this
  // cycle, let the current recipient know their payout is ready to claim.
  if (group && group.type === "esusu") {
    const [{ count: activeMemberCount }, { data: cycleContribs }] = await Promise.all([
      admin
        .from("group_members")
        .select("id", { count: "exact", head: true })
        .eq("group_id", contribution.group_id)
        .eq("status", "active"),
      admin
        .from("group_contributions")
        .select("user_id")
        .eq("group_id", contribution.group_id)
        .eq("cycle_number", contribution.cycle_number)
        .eq("status", "verified"),
    ]);

    if (activeMemberCount && cycleContribs && cycleContribs.length >= activeMemberCount) {
      const { data: recipientMember } = await admin
        .from("group_members")
        .select("user_id")
        .eq("group_id", contribution.group_id)
        .eq("slot_position", contribution.cycle_number)
        .eq("has_received_payout", false)
        .single();

      if (recipientMember) {
        await admin.from("notifications").insert({
          user_id: recipientMember.user_id,
          type: "group_payout_ready",
          channel: "in_app",
          title: "Your Payout Is Ready",
          content: `Everyone has contributed for cycle ${contribution.cycle_number}. Claim your payout now.`,
          status: "unread",
          metadata: { group_id: contribution.group_id, cycle_number: contribution.cycle_number },
        });
      }
    }
  }

  return { status: "success", credited: true, amount: amountInNaira, reference };
}
