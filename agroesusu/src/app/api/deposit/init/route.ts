import { NextRequest, NextResponse } from "next/server";
import { initializeTransaction, generateReference } from "@/lib/paystack";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // This route previously trusted a client-supplied `user_id` with no auth
  // check at all — anyone could call it with an arbitrary user_id/account_id
  // and create pending transaction rows attributed to someone else's
  // account. Every other money-movement route already re-derives the
  // acting user from the session; this brings deposit-init in line.
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

    // Validate
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

    // Confirm the pot actually belongs to the authenticated user before
    // creating any transaction record against it.
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

    const reference = generateReference("AGC_DEP");
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

    // Initialize Paystack transaction
    const response = await initializeTransaction({
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
