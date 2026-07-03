import { NextRequest, NextResponse } from "next/server";
import { initializeTransaction, generateReference } from "@/lib/paystack";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, account_id, account_name, email, user_id } = body;

    // Validate
    if (!amount || amount < 100) {
      return NextResponse.json(
        { error: "Minimum deposit is ₦100" },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const reference = generateReference("AGC_DEP");
    const origin = request.nextUrl.origin;

    const response = await initializeTransaction({
      email,
      amount,
      reference,
      callback_url: `${origin}/deposit/success?reference=${reference}`,
      metadata: {
        user_id,
        account_id,
        account_name,
      },
    });

    if (!response.status) {
      return NextResponse.json(
        { error: "Failed to initialize payment" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      authorization_url: response.data.authorization_url,
      reference: response.data.reference,
      access_code: response.data.access_code,
    });
  } catch (error) {
    console.error("Deposit init error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
