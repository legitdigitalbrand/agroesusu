import { createAdminClient } from "@/lib/supabase/server";

/**
 * Finalizes a withdrawal based on a Paystack transfer webhook event.
 * Idempotent — safe to call more than once for the same reference.
 *
 * - transfer.success  → mark transaction completed, notify user
 * - transfer.failed / transfer.reversed → refund the balance we already
 *   deducted at withdrawal time, mark transaction failed, notify user
 *
 * We never silently lose funds: the balance was deducted optimistically
 * when the withdrawal was initiated (to prevent double-withdraw races),
 * so any non-success outcome must credit it back.
 */
export async function finalizeWithdrawal(
  reference: string,
  outcome: "success" | "failed" | "reversed"
) {
  const admin = createAdminClient();

  const { data: tx } = await admin
    .from("transactions")
    .select("*")
    .eq("payment_reference", reference)
    .eq("type", "withdrawal")
    .single();

  if (!tx) {
    console.error("finalizeWithdrawal: no matching transaction for", reference);
    return { handled: false };
  }

  // Idempotency guard — already finalized
  if (tx.status === "completed" || tx.status === "failed" || tx.status === "reversed") {
    return { handled: false, alreadyFinalized: true };
  }

  if (outcome === "success") {
    await admin
      .from("transactions")
      .update({ status: "completed", completed_date: new Date().toISOString() })
      .eq("id", tx.id);

    await admin.from("notifications").insert({
      user_id: tx.user_id,
      type: "withdrawal",
      channel: "in_app",
      title: "Withdrawal Successful",
      content: `₦${Number(tx.amount).toLocaleString()} has been sent to your bank account.`,
      status: "unread",
      metadata: { reference, amount: tx.amount },
    });

    return { handled: true, credited: false, refunded: false };
  }

  // failed / reversed — refund the balance back to the account
  const { data: account } = await admin
    .from("savings_accounts")
    .select("current_amount")
    .eq("id", tx.account_id)
    .single();

  if (account) {
    await admin
      .from("savings_accounts")
      .update({ current_amount: Number(account.current_amount) + Number(tx.amount) })
      .eq("id", tx.account_id);
  }

  await admin
    .from("transactions")
    .update({ status: "reversed", completed_date: new Date().toISOString() })
    .eq("id", tx.id);

  await admin.from("notifications").insert({
    user_id: tx.user_id,
    type: "withdrawal",
    channel: "in_app",
    title: "Withdrawal Failed",
    content: `Your withdrawal of ₦${Number(tx.amount).toLocaleString()} could not be completed. The funds have been returned to your pot.`,
    status: "unread",
    metadata: { reference, amount: tx.amount },
  });

  return { handled: true, refunded: true };
}
