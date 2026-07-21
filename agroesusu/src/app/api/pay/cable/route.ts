import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { purchaseCableTV } from "@/lib/safehaven";
import { generatePaymentReference } from "@/lib/payment-provider";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.PAYMENT_PROVIDER !== "safehaven") {
    return NextResponse.json({ error: "Cable TV requires Safe Haven as payment provider" }, { status: 503 });
  }

  const body = await request.json();
  const { serviceCategoryId, bundleCode, amount, cardNumber } = body;

  if (!serviceCategoryId || !bundleCode || !amount || !cardNumber) {
    return NextResponse.json({ error: "serviceCategoryId, bundleCode, amount, and cardNumber are required" }, { status: 400 });
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

    const reference = generatePaymentReference("AGC_VAS_CBL");

    const result = await purchaseCableTV({
      serviceCategoryId,
      bundleCode,
      amount,
      debitAccountNumber,
      cardNumber,
      externalReference: reference,
    });

    await admin.from("transactions").insert({
      user_id: user.id,
      type: "withdrawal",
      amount,
      payment_reference: reference,
      status: result.status === "successful" ? "completed" : "pending",
      description: `Cable TV subscription — ₦${amount.toLocaleString()}`,
    });

    return NextResponse.json({
      success: true,
      transaction: result,
      message: "Cable TV subscription purchased successfully",
    });
  } catch (error: any) {
    console.error("Cable TV purchase error:", error);
    return NextResponse.json({ error: error.message || "Cable TV purchase failed" }, { status: 500 });
  }
}
