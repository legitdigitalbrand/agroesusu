import { NextRequest, NextResponse } from "next/server";
import { getPaymentService, generatePaymentReference } from "@/lib/payment-provider";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "deposit_init", {
    maxAttempts: 10,
    windowSeconds: 600,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a few minutes and try again." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { amount, account_id, account_name, email } = body;

    if (!amount || amount < 100) {
      return NextResponse.json(
        { error: "Minimum deposit is ₦100" },
        { status: 400 }
      );
    }

    if (!email || !account_id) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Confirm the pot belongs to the authenticated user
    const admin = createAdminClient();
    const { data: account } = await admin
      .from("savings_accounts")
      .select("id")
      .eq("id", account_id)
      .eq("user_id", user.id)
      .single();

    if (!account) {
      return NextResponse.json({ error: "Savings pot not found" }, { status: 404 });
    }

    const reference = generatePaymentReference("AGC_DEP");
    const origin = request.nextUrl.origin;

    // Create pending transaction in Supabase
    const { error: txError } = await supabase.from("transactions").insert({
      user_id: user.id,
      account_id,
      type: "deposit",
      amount: Number(amount),
      payment_method: "card",
      payment_reference: reference,
      status: "pending",
      description: `Deposit to ${account_name || "savings pot"}`,
      fee_amount: 0,
    });

    if (txError) {
      console.error("Transaction insert error:", txError);
      return NextResponse.json(
        { error: "Failed to create transaction record" },
        { status: 500 }
      );
    }

    // Initialize transaction via the active payment provider
    const service = await getPaymentService();
    const result = await service.initializeTransaction({
      email,
      amount: Number(amount),
      reference,
      callback_url: `${origin}/deposit/success?reference=${reference}`,
      metadata: {
        user_id: user.id,
        account_id,
        account_name: account_name || "",
      },
    });

    return NextResponse.json({
      authorization_url: result.authorization_url,
      reference: result.reference,
    });
  } catch (error) {
    console.error("Deposit init error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
