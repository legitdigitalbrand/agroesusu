import { createAdminClient } from "@/lib/supabase/server";
import { verifyTransaction } from "@/lib/paystack";

/**
 * Idempotently verifies a Paystack transaction and credits the user's
 * savings account. Safe to call multiple times for the same reference
 * (from the webhook AND from the browser redirect) — the completed-status
 * check prevents double-crediting.
 *
 * Uses the ADMIN (service-role) Supabase client because this runs outside
 * a user session (Paystack webhooks have no cookies, and even the browser
 * redirect path treats the server as the source of truth) — RLS would
 * otherwise silently block these writes, which is what caused deposits to
 * get stuck on "pending".
 */
export async function verifyAndCreditDeposit(reference: string) {
  const verification = await verifyTransaction(reference);

  if (verification.data.status !== "success") {
    return { status: verification.data.status as string, credited: false };
  }

  const admin = createAdminClient();
  const metadata = verification.data.metadata || {};
  const amountInNaira = verification.data.amount / 100;
  const feesInNaira = (verification.data.fees || 0) / 100;
  const userId = metadata.user_id;
  const accountId = metadata.account_id;

  if (!userId || !accountId) {
    console.error("Deposit credit: missing metadata for reference", reference);
    return { status: "success", credited: false, amount: amountInNaira, reference };
  }

  // Idempotency guard — skip if already completed
  const { data: existingTx } = await admin
    .from("transactions")
    .select("status")
    .eq("payment_reference", reference)
    .single();

  if (existingTx?.status === "completed") {
    return { status: "success", credited: false, amount: amountInNaira, reference, alreadyCompleted: true };
  }

  await admin
    .from("transactions")
    .update({
      status: "completed",
      fee_amount: feesInNaira,
      paystack_response: JSON.stringify(verification.data),
      completed_date: new Date().toISOString(),
    })
    .eq("payment_reference", reference);

  const { data: account } = await admin
    .from("savings_accounts")
    .select("current_amount")
    .eq("id", accountId)
    .single();

  if (account) {
    const newBalance = Number(account.current_amount) + amountInNaira;
    await admin
      .from("savings_accounts")
      .update({ current_amount: newBalance })
      .eq("id", accountId);
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("total_saved")
    .eq("id", userId)
    .single();

  if (profile) {
    await admin
      .from("profiles")
      .update({ total_saved: Number(profile.total_saved) + amountInNaira })
      .eq("id", userId);
  }

  await admin.from("notifications").insert({
    user_id: userId,
    type: "deposit",
    channel: "in_app",
    title: "Deposit Successful",
    content: `Your deposit of ₦${amountInNaira.toLocaleString()} was successful.`,
    status: "unread",
    metadata: { reference, amount: amountInNaira },
  });

  return { status: "success", credited: true, amount: amountInNaira, reference };
}
