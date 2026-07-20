import { createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getPaymentService, PAYMENT_PROVIDER } from "@/lib/payment-provider";

/**
 * Create a virtual account for a user via the active payment provider.
 * Called once per user — subsequent calls return existing account if already created.
 *
 * With Paystack: creates a Paystack customer + dedicated virtual account (DVA)
 * With Safe Haven: creates a Safe Haven sub-account (permanent virtual account)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Check if user already has a virtual account
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
        provider: PAYMENT_PROVIDER,
      });
    }

    // Use the payment provider abstraction
    const service = await getPaymentService();

    try {
      const virtualAccount = await service.createVirtualAccount({
        email: profile.email,
        full_name: profile.full_name || '',
        user_id: userId,
      });

      // Save virtual account details to profile
      await admin
        .from("profiles")
        .update({
          paystack_dva_account_number: virtualAccount.account_number,
          paystack_dva_bank_name: virtualAccount.bank_name,
          dva_status: "assigned",
        })
        .eq("id", userId);

      return NextResponse.json({
        status: "assigned",
        account_number: virtualAccount.account_number,
        bank_name: virtualAccount.bank_name,
        provider: service.provider,
      });
    } catch (err: any) {
      console.error(`${service.provider} virtual account creation failed:`, err);

      // If Paystack DVA creation fails because business account isn't activated,
      // fall back to a pending state rather than dead-ending the user
      if (service.provider === 'paystack' && /not available|not activated|business/i.test(err.message || '')) {
        // Try the old Paystack flow as fallback — create customer first
        const customerRes = await fetch("https://api.paystack.co/customer", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
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

        if (customerRes.ok) {
          await admin
            .from("profiles")
            .update({
              paystack_customer_code: customerData.data.customer_code,
              dva_status: "pending",
            })
            .eq("id", userId);

          return NextResponse.json({
            status: "pending",
            message: "Your account number is being set up. We'll notify you when it's ready.",
          });
        }
      }

      return NextResponse.json({
        error: err.message || "Failed to create account number",
      }, { status: 400 });
    }
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
    provider: PAYMENT_PROVIDER,
  });
}
