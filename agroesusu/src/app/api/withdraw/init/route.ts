import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  createTransferRecipient,
  initiateTransfer,
  generateReference,
} from "@/lib/paystack";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    if (withdrawAmount > Number(account.current_amount)) {
      return NextResponse.json(
        { error: "Insufficient balance in this pot" },
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

    let forfeitedInterest = 0;
    let newBalance = Number(account.current_amount) - withdrawAmount;

    // Soft lock: early withdrawal allowed, but forfeits accrued interest on
    // the whole pot as a discipline mechanism.
    if (account.lock_type === "soft" && account.unlock_date && new Date(account.unlock_date) > new Date()) {
      forfeitedInterest = Number(account.current_amount) * (Number(account.interest_rate) / 100) * 0.1;
    }

    const reference = generateReference("AGC_WDR");

    // Create the transfer recipient + initiate transfer BEFORE touching the
    // balance — if Paystack rejects the recipient/transfer, nothing changes.
    let recipientCode: string;
    try {
      const recipient = await createTransferRecipient({
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
      description: `Withdrawal to ${account_name} (${bank_code} ****${account_number.slice(-4)})${
        forfeitedInterest > 0 ? ` — forfeited ₦${forfeitedInterest.toFixed(2)} interest (early soft-lock withdrawal)` : ""
      }`,
      fee_amount: 0,
      paystack_response: JSON.stringify({ recipient_code: recipientCode, bank_code, account_number }),
    });

    try {
      await initiateTransfer({
        amount: withdrawAmount,
        recipient_code: recipientCode,
        reference,
        reason: `AgroEsusu withdrawal — ${account.name}`,
      });
    } catch (err: any) {
      // Transfer initiation itself failed — refund immediately, don't wait for a webhook that will never come
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
      forfeitedInterest,
    });
  } catch (error: any) {
    console.error("Withdraw init error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
