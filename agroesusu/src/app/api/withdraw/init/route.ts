import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getPaymentService, generatePaymentReference } from "@/lib/payment-provider";
import { WITHDRAWAL_FEE_NGN } from "@/lib/fees";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "withdraw_init", {
    maxAttempts: 5,
    windowSeconds: 600,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many withdrawal attempts. Please wait a few minutes and try again." },
      { status: 429 }
    );
  }

  try {
    const { account_id, amount, bank_code, account_number, account_name } =
      await request.json();

    const withdrawAmount = Number(amount);

    if (!account_id || !withdrawAmount || !bank_code || !account_number || !account_name) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (withdrawAmount < 100) {
      return NextResponse.json(
        { error: "Minimum withdrawal is ₦100" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Server-side re-validation — never trust the client for balance/lock checks
    const { data: profile } = await admin
      .from("profiles")
      .select("kyc_status")
      .eq("id", user.id)
      .single();

    if (profile?.kyc_status !== "verified") {
      return NextResponse.json(
        { error: "Identity verification required before withdrawal" },
        { status: 403 }
      );
    }

    const { data: account } = await admin
      .from("savings_accounts")
      .select("*")
      .eq("id", account_id)
      .eq("user_id", user.id)
      .single();

    if (!account) {
      return NextResponse.json({ error: "Savings pot not found" }, { status: 404 });
    }

    const fee = WITHDRAWAL_FEE_NGN;
    const totalDebit = withdrawAmount + fee;

    if (totalDebit > Number(account.current_amount)) {
      return NextResponse.json(
        { error: `Insufficient balance — this withdrawal needs ₦${totalDebit.toLocaleString()} (₦${withdrawAmount.toLocaleString()} + ₦${fee} fee)` },
        { status: 400 }
      );
    }

    if (account.lock_type === "hard" || account.lock_type === "until_date") {
      if (account.unlock_date && new Date(account.unlock_date) > new Date()) {
        return NextResponse.json(
          {
            error: `This pot is locked until ${new Date(account.unlock_date).toLocaleDateString()}`,
          },
          { status: 403 }
        );
      }
    }

    const newBalance = Number(account.current_amount) - totalDebit;
    const reference = generatePaymentReference("AGC_WDR");

    // Use the payment provider abstraction
    const service = await getPaymentService();

    // Create the transfer recipient + initiate transfer BEFORE touching the
    // balance — if the provider rejects, nothing changes.
    let recipientCode: string;
    try {
      const recipient = await service.createTransferRecipient({
        name: account_name,
        account_number,
        bank_code,
      });
      recipientCode = recipient.recipient_code;
    } catch (err: any) {
      return NextResponse.json(
        { error: err.message || "Could not verify bank account" },
        { status: 400 }
      );
    }

    // Deduct balance now (optimistic — prevents double-withdraw races).
    // Refunded automatically by the webhook handler if the transfer fails.
    const { error: balanceError } = await admin
      .from("savings_accounts")
      .update({ current_amount: newBalance })
      .eq("id", account_id);

    if (balanceError) {
      console.error("Balance deduction error:", balanceError);
      return NextResponse.json(
        { error: "Failed to process withdrawal" },
        { status: 500 }
      );
    }

    await admin.from("transactions").insert({
      user_id: user.id,
      account_id,
      type: "withdrawal",
      amount: withdrawAmount,
      payment_method: "bank_transfer",
      payment_reference: reference,
      status: "processing",
      description: `Withdrawal to ${account_name} (${bank_code} ****${account_number.slice(-4)}) — ₦${fee} fee applied`,
      fee_amount: fee,
      paystack_response: JSON.stringify({ recipient_code: recipientCode, bank_code, account_number, provider: service.provider }),
    });

    try {
      const transferResult = await service.initiateTransfer({
        amount: withdrawAmount,
        recipient_code: recipientCode,
        reference,
        reason: `AgroEsusu withdrawal — ${account.name}`,
      });

      if (transferResult.status === 'failed') {
        // Transfer initiation failed — refund immediately
        await admin
          .from("savings_accounts")
          .update({ current_amount: Number(account.current_amount) })
          .eq("id", account_id);
        await admin
          .from("transactions")
          .update({ status: "reversed" })
          .eq("payment_reference", reference);

        return NextResponse.json(
          { error: "Transfer could not be initiated. Your balance has not been affected." },
          { status: 500 }
        );
      }
    } catch (err: any) {
      // Transfer initiation itself failed — refund immediately
      await admin
        .from("savings_accounts")
        .update({ current_amount: Number(account.current_amount) })
        .eq("id", account_id);
      await admin
        .from("transactions")
        .update({ status: "reversed" })
        .eq("payment_reference", reference);

      return NextResponse.json(
        { error: err.message || "Transfer could not be initiated. Your balance has not been affected." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "processing",
      reference,
      fee,
      provider: service.provider,
    });
  } catch (error: any) {
    console.error("Withdraw init error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
