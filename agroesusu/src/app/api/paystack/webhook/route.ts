import { NextRequest, NextResponse } from "next/server";
import { verifyAndCreditDeposit } from "@/lib/deposit-credit";
import { verifyAndCreditGroupContribution } from "@/lib/group-contribution-credit";
import { finalizeWithdrawal } from "@/lib/withdraw-credit";
import { finalizeGroupPayout } from "@/lib/group-payout-credit";

/**
 * Paystack Webhook Handler
 * Receives payment events from Paystack and updates the database.
 *
 * Events we handle:
 * - charge.success: Deposit or group contribution completed — reference
 *   prefix (AGC_DEP vs AGC_GRP) tells us which crediting path to use.
 * - transfer.success / transfer.failed / transfer.reversed: Withdrawal
 *   (AGC_WDR) or group cycle payout (AGC_PAY) completed/failed.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const event = body.event;
    const data = body.data;
    const reference: string = data?.reference || "";

    if (event === "charge.success") {
      const result = reference.startsWith("AGC_GRP")
        ? await verifyAndCreditGroupContribution(reference)
        : await verifyAndCreditDeposit(reference);

      if (result.credited) {
        console.log(`✅ Payment confirmed via webhook: ${reference} — ₦${result.amount}`);
      }
    }

    if (event === "transfer.success" || event === "transfer.failed" || event === "transfer.reversed") {
      const outcome = event === "transfer.success" ? "success" : event === "transfer.failed" ? "failed" : "reversed";
      if (reference.startsWith("AGC_PAY")) {
        await finalizeGroupPayout(reference, outcome);
      } else {
        await finalizeWithdrawal(reference, outcome);
      }
      console.log(`Transfer ${outcome} via webhook: ${reference}`);
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
