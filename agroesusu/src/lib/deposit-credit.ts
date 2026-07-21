import { createAdminClient } from "@/lib/supabase/server";
import { getPaymentService } from "@/lib/payment-provider";

/**
 * Idempotently verifies a payment transaction and credits the user's
 * savings account. Safe to call multiple times for the same reference
 * (from the webhook AND from the browser redirect) — the completed-status
 * check prevents double-crediting.
 *
 * Handles two deposit paths:
 * 1. Card/USSD checkout — metadata contains user_id + account_id
 * 2. DVA bank transfer — no metadata; we look up the user by
 *    customer code and credit their default Flex pot
 *
 * Uses the ADMIN (service-role) Supabase client because this runs outside
 * a user session (webhooks have no cookies) — RLS would otherwise silently
 * block these writes.
 */
export async function verifyAndCreditDeposit(reference: string) {
  const service = await getPaymentService();
  const verification = await service.verifyTransaction(reference);

  if (!verification.status) {
    return { status: "pending", credited: false };
  }

  const admin = createAdminClient();
  const metadata = verification.metadata || {};
  const amountInNaira = verification.amount / 100;
  const feesInNaira = (verification.fees || 0) / 100;
  let userId = metadata.user_id;
  let accountId = metadata.account_id;

  // DVA/bank transfer deposits: no metadata — find user by customer code
  if (!userId) {
    const customerCode = verification.raw?.customer?.customer_code;
    if (customerCode) {
      const { data: profile } = await admin
        .from("profiles")
        .select("id")
        .eq("paystack_customer_code", customerCode)
        .single();

      if (profile) {
        userId = profile.id;

        // Find or create a default Flex pot for DVA deposits
        const { data: flexPot } = await admin
          .from("savings_accounts")
          .select("id")
          .eq("user_id", userId)
          .eq("type", "agroflex")
          .order("created_at", { ascending: true })
          .limit(1)
          .single();

        if (flexPot) {
          accountId = flexPot.id;
        } else {
          // Create a default Flex pot if none exists
          const { data: newPot } = await admin
            .from("savings_accounts")
            .insert({
              user_id: userId,
              type: "agroflex",
              name: "Default Savings",
              target_amount: 0,
              current_amount: 0,
              interest_rate: 2,
              lock_type: "none",
              status: "active",
              icon: "agroflex",
              description: "Auto-created for bank transfer deposits",
            })
            .select()
            .single();

          if (newPot) {
            accountId = newPot.id;
          }
        }
      }
    }
  }

  if (!userId || !accountId) {
    console.error("Deposit credit: could not resolve user/account for reference", reference);
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

  // If no transaction record exists (DVA deposit without prior init), create one
  if (!existingTx) {
    await admin.from("transactions").insert({
      user_id: userId,
      account_id: accountId,
      type: "deposit",
      amount: amountInNaira,
      payment_method: "bank_transfer",
      payment_reference: reference,
      status: "pending",
      description: "Bank transfer deposit",
      fee_amount: 0,
    });
  }

  await admin
    .from("transactions")
    .update({
      status: "completed",
      fee_amount: feesInNaira,
      paystack_response: JSON.stringify(verification.raw),
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

  // Round-up automation: if the user has a Stash pot with round-up enabled,
  // credit it with the spare change from this deposit (rounded up to the
  // nearest ₦100).
  await applyRoundUp(admin, userId, accountId, amountInNaira, reference);

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

async function applyRoundUp(
  admin: ReturnType<typeof import("@/lib/supabase/server").createAdminClient>,
  userId: string,
  sourceAccountId: string,
  depositAmount: number,
  sourceReference: string
) {
  const roundUpAmount = Math.ceil(depositAmount / 100) * 100 - depositAmount;
  if (roundUpAmount <= 0) return;

  const { data: stashPot } = await admin
    .from("savings_accounts")
    .select("id, current_amount")
    .eq("user_id", userId)
    .eq("type", "harvestlock")
    .eq("round_up_enabled", true)
    .neq("id", sourceAccountId)
    .limit(1)
    .single();

  if (!stashPot) return;

  await admin
    .from("savings_accounts")
    .update({ current_amount: Number(stashPot.current_amount) + roundUpAmount })
    .eq("id", stashPot.id);

  await admin.from("transactions").insert({
    user_id: userId,
    account_id: stashPot.id,
    type: "round_up",
    amount: roundUpAmount,
    payment_method: "system",
    payment_reference: `${sourceReference}_ROUNDUP`,
    status: "completed",
    description: `Round-up from deposit ${sourceReference}`,
    fee_amount: 0,
    completed_date: new Date().toISOString(),
  });
}
