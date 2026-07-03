import { NextRequest, NextResponse } from "next/server";
import { verifyTransaction } from "@/lib/paystack";

/**
 * Verify a Paystack transaction after redirect
 * Called when user returns from Paystack checkout
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
    const verification = await verifyTransaction(reference);

    if (verification.data.status === "success") {
      return NextResponse.json({
        status: "success",
        amount: verification.data.amount / 100,
        reference: verification.data.reference,
        fees: verification.data.fees / 100,
        channel: verification.data.channel,
      });
    } else {
      return NextResponse.json({
        status: verification.data.status,
        reference: verification.data.reference,
      });
    }
  } catch (error) {
    console.error("Verify error:", error);
    return NextResponse.json(
      { error: "Failed to verify transaction" },
      { status: 500 }
    );
  }
}
