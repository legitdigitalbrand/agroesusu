import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { purchaseAirtime } from "@/lib/safehaven";
import { generatePaymentReference } from "@/lib/payment-provider";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.PAYMENT_PROVIDER !== "safehaven") {
    return NextResponse.json({ error: "Airtime purchase requires Safe Haven as payment provider" }, { status: 503 });
  }

  const body = await request.json();
  const { serviceCategoryId, amount, phoneNumber } = body;

  if (!serviceCategoryId || !amount || !phoneNumber) {
    return NextResponse.json({ error: "serviceCategoryId, amount, and phoneNumber are required" }, { status: 400 });
  }

  if (amount < 50) {
    return NextResponse.json({ error: "Minimum airtime purchase is ₦50" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();

    // Get user's Safe Haven account number for debit
    const { data: profile } = await admin
      .from("profiles")
      .select("id, safehaven_account_number")
      .eq("id", user.id)
      .single();

    const debitAccountNumber = profile?.safehaven_account_number || process.env.SAFEHAVEN_SETTLEMENT_ACCOUNT;

    if (!debitAccountNumber) {
      return NextResponse.json({ error: "No Safe Haven account found for debit. Please set up your account first." }, { status: 400 });
    }

    const reference = generatePaymentReference("AGC_VAS_AIR");

    const result = await purchaseAirtime({
      serviceCategoryId,
      amount,
      debitAccountNumber,
      phoneNumber,
      externalReference: reference,
    });

    // Log transaction
    await admin.from("transactions").insert({
      user_id: user.id,
      type: "withdrawal",
      amount,
      payment_reference: reference,
      status: result.status === "successful" ? "completed" : "pending",
      description: `Airtime purchase — ₦${amount.toLocaleString()} to ${phoneNumber}`,
    });

    return NextResponse.json({
      success: true,
      transaction: result,
      message: "Airtime purchased successfully",
    });
  } catch (error: any) {
    console.error("Airtime purchase error:", error);
    return NextResponse.json({ error: error.message || "Airtime purchase failed" }, { status: 500 });
  }
}
