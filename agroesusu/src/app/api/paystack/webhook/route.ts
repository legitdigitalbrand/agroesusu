import { NextRequest, NextResponse } from "next/server";
import { verifyTransaction } from "@/lib/paystack";

/**
 * Paystack Webhook Handler
 * Receives payment events from Paystack and updates the database
 *
 * Events we handle:
 * - charge.success: Deposit completed → credit user's savings account
 * - transfer.success: Withdrawal completed → update transaction status
 * - transfer.failed: Withdrawal failed → revert transaction
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const event = body.event;
    const data = body.data;

    // Verify the transaction
    if (event === "charge.success") {
      const reference = data.reference;
      const verification = await verifyTransaction(reference);

      if (verification.data.status === "success") {
        const { metadata, amount, fees } = verification.data;
        const amountInNaira = amount / 100;
        const feesInNaira = fees / 100;

        // TODO: Save transaction to Base44 database
        // await saveTransaction({
        //   user_id: metadata.user_id,
        //   account_id: metadata.account_id,
        //   type: "deposit",
        //   amount: amountInNaira,
        //   fee_amount: feesInNaira,
        //   payment_reference: reference,
        //   paystack_response: JSON.stringify(verification.data),
        //   status: "completed",
        //   description: `Deposit to ${metadata.account_name}`,
        // });

        // TODO: Update savings account balance
        // await updateAccountBalance(metadata.account_id, amountInNaira);

        console.log(`✅ Deposit confirmed: ${reference} — ₦${amountInNaira}`);
      }
    }

    if (event === "transfer.success") {
      const reference = data.reference;
      console.log(`✅ Withdrawal confirmed: ${reference}`);
      // TODO: Update withdrawal transaction status to "completed"
    }

    if (event === "transfer.failed") {
      const reference = data.reference;
      console.log(`❌ Withdrawal failed: ${reference}`);
      // TODO: Revert withdrawal — restore balance, mark transaction as failed
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ status: "success" });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
