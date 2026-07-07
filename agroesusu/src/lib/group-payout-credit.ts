import { createAdminClient } from "@/lib/supabase/server";

/**
 * Finalizes an esusu cycle payout based on a Paystack transfer webhook
 * event. Idempotent — safe to call more than once for the same reference.
 *
 * The pool amount was already deducted (and the cycle advanced) optimistically
 * when the recipient claimed it, to prevent double-claim races. If the
 * transfer fails/reverses, we restore the pool and roll the cycle back so
 * the recipient can retry.
 */
export async function finalizeGroupPayout(
  reference: string,
  outcome: "success" | "failed" | "reversed"
) {
  const admin = createAdminClient();

  const { data: tx } = await admin
    .from("transactions")
    .select("*")
    .eq("payment_reference", reference)
    .eq("type", "group_payout")
    .single();

  if (!tx) {
    return { handled: false };
  }

  if (tx.status === "completed" || tx.status === "failed" || tx.status === "reversed") {
    return { handled: false, alreadyFinalized: true };
  }

  const metadata = tx.paystack_response ? JSON.parse(tx.paystack_response) : {};
  const groupId = metadata.group_id;

  if (outcome === "success") {
    await admin
      .from("transactions")
      .update({ status: "completed", completed_date: new Date().toISOString() })
      .eq("id", tx.id);

    await admin.from("notifications").insert({
      user_id: tx.user_id,
      type: "group_payout",
      channel: "in_app",
      title: "Payout Sent",
      content: `Your cycle payout of ₦${Number(tx.amount).toLocaleString()} has been sent to your bank account.`,
      status: "unread",
      metadata: { reference, amount: tx.amount, group_id: groupId },
    });

    return { handled: true, refunded: false };
  }

  // failed / reversed — restore the group pool and roll the cycle + payout flag back
  if (groupId) {
    const { data: group } = await admin
      .from("savings_groups")
      .select("total_pool, current_cycle")
      .eq("id", groupId)
      .single();

    if (group) {
      await admin
        .from("savings_groups")
        .update({
          total_pool: Number(group.total_pool) + Number(tx.amount) + Number(tx.fee_amount || 0),
          current_cycle: Math.max(1, group.current_cycle - 1),
          status: "active",
        })
        .eq("id", groupId);
    }

    await admin
      .from("group_members")
      .update({ has_received_payout: false })
      .eq("group_id", groupId)
      .eq("user_id", tx.user_id);
  }

  await admin
    .from("transactions")
    .update({ status: "reversed", completed_date: new Date().toISOString() })
    .eq("id", tx.id);

  await admin.from("notifications").insert({
    user_id: tx.user_id,
    type: "group_payout",
    channel: "in_app",
    title: "Payout Failed",
    content: `Your cycle payout of ₦${Number(tx.amount).toLocaleString()} could not be sent. The group pool has been restored — please try claiming again with correct bank details.`,
    status: "unread",
    metadata: { reference, amount: tx.amount, group_id: groupId },
  });

  return { handled: true, refunded: true };
}
