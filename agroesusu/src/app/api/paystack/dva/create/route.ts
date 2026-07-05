import { createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const PAYSTACK_BASE_URL = "https://api.paystack.co";
const SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

/**
 * Create a Paystack customer + dedicated virtual account for a user.
 * Called once per user — subsequent calls return existing DVA if already created.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Check if user already has a DVA
    const { data: profile } = await admin
      .from("profiles")
      .select("paystack_customer_code, paystack_dva_account_number, paystack_dva_bank_name, dva_status, email, full_name, phone")
      .eq("id", userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // If DVA already assigned, return it
    if (profile.paystack_dva_account_number && profile.dva_status === "assigned") {
      return NextResponse.json({
        status: "assigned",
        account_number: profile.paystack_dva_account_number,
        bank_name: profile.paystack_dva_bank_name,
      });
    }

    let customerCode = profile.paystack_customer_code;

    // Step 1: Create Paystack customer if not exists
    if (!customerCode) {
      const customerRes = await fetch(`${PAYSTACK_BASE_URL}/customer`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: profile.email,
          first_name: profile.full_name?.split(" ")[0] || "",
          last_name: profile.full_name?.split(" ").slice(1).join(" ") || "",
          phone: profile.phone || "",
        }),
      });

      const customerData = await customerRes.json();

      if (!customerRes.ok) {
        console.error("Paystack customer creation failed:", customerData);
        return NextResponse.json({
          error: customerData.message || "Failed to create customer account",
        }, { status: 400 });
      }

      customerCode = customerData.data.customer_code;

      // Save customer code
      await admin
        .from("profiles")
        .update({ paystack_customer_code: customerCode })
        .eq("id", userId);
    }

    // Step 2: Create dedicated virtual account
    const dvaRes = await fetch(`${PAYSTACK_BASE_URL}/dedicated_account`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customer: customerCode,
        preferred_bank: process.env.PAYSTACK_DVA_BANK || "wema-bank",
      }),
    });

    const dvaData = await dvaRes.json();

    if (!dvaRes.ok) {
      console.error("Paystack DVA creation failed:", dvaData);
      // Some errors are OK — account might already exist
      if (dvaData.message?.includes("already")) {
        // Try to fetch existing DVA
        const existingRes = await fetch(
          `${PAYSTACK_BASE_URL}/dedicated_account?customer=${customerCode}`,
          { headers: { Authorization: `Bearer ${SECRET_KEY}` } }
        );
        const existingData = await existingRes.json();
        if (existingData.data?.length > 0) {
          const dva = existingData.data[0];
          await admin
            .from("profiles")
            .update({
              paystack_dva_account_number: dva.account_number,
              paystack_dva_bank_name: dva.bank?.name || "Wema Bank",
              dva_status: "assigned",
            })
            .eq("id", userId);

          return NextResponse.json({
            status: "assigned",
            account_number: dva.account_number,
            bank_name: dva.bank?.name || "Wema Bank",
          });
        }
      }
      return NextResponse.json({
        error: dvaData.message || "Failed to create account number",
      }, { status: 400 });
    }

    const dva = dvaData.data;

    // Save DVA details
    await admin
      .from("profiles")
      .update({
        paystack_dva_account_number: dva.account_number,
        paystack_dva_bank_name: dva.bank?.name || "Wema Bank",
        dva_status: "assigned",
      })
      .eq("id", userId);

    return NextResponse.json({
      status: "assigned",
      account_number: dva.account_number,
      bank_name: dva.bank?.name || "Wema Bank",
    });
  } catch (error) {
    console.error("DVA creation error:", error);
    return NextResponse.json({ error: "Failed to create account number" }, { status: 500 });
  }
}

/**
 * Get the current user's DVA status
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("paystack_dva_account_number, paystack_dva_bank_name, dva_status")
    .eq("id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({
    status: profile.dva_status || "pending",
    account_number: profile.paystack_dva_account_number || null,
    bank_name: profile.paystack_dva_bank_name || null,
  });
}
