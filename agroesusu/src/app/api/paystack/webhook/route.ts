import { NextRequest, NextResponse } from "next/server";
import { verifyAndCreditDeposit } from "@/lib/deposit-credit";

/**
 * Paystack Webhook Handler
 * Receives payment events from Paystack and updates the database.
 *
 * Events we handle:
 * - charge.success: Deposit completed → credit user's savings account
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
