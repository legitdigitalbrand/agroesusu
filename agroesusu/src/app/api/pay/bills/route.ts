import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { payUtilityBill, verifyVASAccount } from "@/lib/safehaven";
import { generatePaymentReference } from "@/lib/payment-provider";

// Verify meter number
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.PAYMENT_PROVIDER !== "safehaven") {
    return NextResponse.json({ error: "Utility bills require Safe Haven as payment provider" }, { status: 503 });
  }

  const body = await request.json();

  // If verify=true, just verify the meter number
  if (body.verify) {
    const { meterNumber, serviceCategoryId } = body;
    if (!meterNumber || !serviceCategoryId) {
      return NextResponse.json({ error: "meterNumber and serviceCategoryId are required" }, { status: 400 });
    }

    try {
      const result = await verifyVASAccount({
        type: 'electricity',
        accountNumber: meterNumber,
        serviceCategoryId,
      });
      return NextResponse.json(result);
    } catch (error: any) {
      console.error("Meter verification error:", error);
      return NextResponse.json({ error: error.message || "Verification failed" }, { status: 500 });
    }
  }

  // Otherwise pay the bill
  const { serviceCategoryId, amount, meterNumber, vendType } = body;

  if (!serviceCategoryId || !amount || !meterNumber || !vendType) {
    return NextResponse.json({ error: "serviceCategoryId, amount, meterNumber, and vendType are required" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();

    const { data: profile } = await admin
      .from("profiles")
      .select("id, safehaven_account_number")
      .eq("id", user.id)
      .single();

    const debitAccountNumber = profile?.safehaven_account_number || process.env.SAFEHAVEN_SETTLEMENT_ACCOUNT;

    if (!debitAccountNumber) {
      return NextResponse.json({ error: "No Safe Haven account found for debit" }, { status: 400 });
    }

    const reference = generatePaymentReference("AGC_VAS_BIL");

    const result = await payUtilityBill({
      serviceCategoryId,
      amount,
      debitAccountNumber,
      meterNumber,
      vendType,
      externalReference: reference,
    });

    await admin.from("transactions").insert({
      user_id: user.id,
      type: "withdrawal",
      amount,
      payment_reference: reference,
      status: result.status === "successful" ? "completed" : "pending",
      description: `Electricity bill — ₦${amount.toLocaleString()} (Meter: ${meterNumber})`,
    });

    return NextResponse.json({
      success: true,
      transaction: result,
      message: "Utility bill paid successfully",
    });
  } catch (error: any) {
    console.error("Utility bill error:", error);
    return NextResponse.json({ error: error.message || "Bill payment failed" }, { status: 500 });
  }
}
