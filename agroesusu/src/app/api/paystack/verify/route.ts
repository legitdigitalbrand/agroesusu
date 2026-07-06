import { NextRequest, NextResponse } from "next/server";
import { verifyAndCreditDeposit } from "@/lib/deposit-credit";
import { verifyAndCreditGroupContribution } from "@/lib/group-contribution-credit";

/**
 * Verify a Paystack transaction after the user is redirected back from
 * checkout, AND credit the account server-side (admin client, bypasses RLS).
 *
 * This is intentionally the same crediting path as the webhook, guarded by
 * an idempotency check on transaction status — whichever fires first
 * (webhook or this redirect) credits the account; the other is a no-op.
 * This is what makes deposits confirm reliably instead of hanging on
 * "pending" when a webhook is slow or misses.
 *
 * References are prefixed (AGC_DEP for deposits, AGC_GRP for group
 * contributions) so we route to the right crediting function.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const reference = searchParams.get("reference");

  if (!reference) {
    return NextResponse.json(
      { error: "Reference is required" },
      { status: 400 }
    );
  }

  try {
    const result = reference.startsWith("AGC_GRP")
      ? await verifyAndCreditGroupContribution(reference)
      : await verifyAndCreditDeposit(reference);

    if (result.status === "success") {
      return NextResponse.json({
        status: "success",
        amount: result.amount,
        reference: result.reference,
      });
    }

    return NextResponse.json({
      status: result.status,
      reference,
    });
  } catch (error) {
    console.error("Verify error:", error);
    return NextResponse.json(
      { error: "Failed to verify transaction" },
      { status: 500 }
    );
  }
}
