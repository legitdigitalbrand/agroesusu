import { NextRequest, NextResponse } from "next/server";
import { verifyAndCreditDeposit } from "@/lib/deposit-credit";
import { finalizeWithdrawal } from "@/lib/withdraw-credit";

/**
 * Paystack Webhook Handler
 * Receives payment events from Paystack and updates the database.
 *
 * Events we handle:
 * - charge.success: Deposit completed → credit user's savings account
 * - transfer.success: Withdrawal completed → mark transaction completed
 * - transfer.failed / transfer.reversed: Withdrawal failed → refund balance
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const event = body.event;
    const data = body.data;

    if (event === "charge.success") {
      const result = await verifyAndCreditDeposit(data.reference);
      if (result.credited) {
        console.log(`✅ Deposit confirmed via webhook: ${result.reference} — ₦${result.amount}`);
      }
    }

    if (event === "transfer.success") {
      await finalizeWithdrawal(data.reference, "success");
      console.log(`✅ Withdrawal confirmed via webhook: ${data.reference}`);
    }

    if (event === "transfer.failed") {
      await finalizeWithdrawal(data.reference, "failed");
      console.log(`⚠️ Withdrawal failed via webhook: ${data.reference}`);
    }

    if (event === "transfer.reversed") {
      await finalizeWithdrawal(data.reference, "reversed");
      console.log(`⚠️ Withdrawal reversed via webhook: ${data.reference}`);
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
