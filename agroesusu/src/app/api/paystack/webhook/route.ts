import { NextRequest, NextResponse } from "next/server";
import { verifyTransaction } from "@/lib/paystack";
import { createClient } from "@/lib/supabase/server";

/**
 * Paystack Webhook Handler
 * Receives payment events from Paystack and updates the database
 *
 * Events we handle:
 * - charge.success: Deposit completed → credit user's savings account
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const event = body.event;
    const data = body.data;

    if (event === "charge.success") {
      const reference = data.reference;

      // Verify the transaction with Paystack
      const verification = await verifyTransaction(reference);

      if (verification.data.status === "success") {
        const metadata = verification.data.metadata || {};
        const amountInNaira = verification.data.amount / 100;
        const feesInNaira = verification.data.fees / 100;
        const userId = metadata.user_id;
        const accountId = metadata.account_id;

        if (!userId || !accountId) {
          console.error("Webhook: Missing metadata for reference:", reference);
          return NextResponse.json({ status: "ok" });
        }

        const supabase = await createClient();

        // Check if transaction already exists and is completed (idempotency)
        const { data: existingTx } = await supabase
          .from("transactions")
          .select("*")
          .eq("payment_reference", reference)
          .single();

        if (existingTx?.status === "completed") {
          console.log(`Transaction ${reference} already completed — skipping`);
          return NextResponse.json({ status: "ok" });
        }

        // Update transaction status
        const { error: txUpdateError } = await supabase
          .from("transactions")
          .update({
            status: "completed",
            fee_amount: feesInNaira,
            paystack_response: JSON.stringify(verification.data),
            completed_date: new Date().toISOString(),
          })
          .eq("payment_reference", reference);

        if (txUpdateError) {
          console.error("Webhook: Failed to update transaction:", txUpdateError);
        }

        // Credit the savings account
        const { data: account } = await supabase
          .from("savings_accounts")
          .select("current_amount")
          .eq("id", accountId)
          .single();

        if (account) {
          const newBalance = Number(account.current_amount) + amountInNaira;
          await supabase
            .from("savings_accounts")
            .update({ current_amount: newBalance })
            .eq("id", accountId);
        }

        // Update profile total_saved
        const { data: profile } = await supabase
          .from("profiles")
          .select("total_saved")
          .eq("id", userId)
          .single();

        if (profile) {
          await supabase
            .from("profiles")
            .update({ total_saved: Number(profile.total_saved) + amountInNaira })
            .eq("id", userId);
        }

        // Create in-app notification
        await supabase.from("notifications").insert({
          user_id: userId,
          type: "deposit",
          channel: "in_app",
          title: "Deposit Successful",
          content: `Your deposit of ₦${amountInNaira.toLocaleString()} was successful.`,
          status: "unread",
          metadata: { reference, amount: amountInNaira },
        });

        console.log(`✅ Deposit confirmed: ${reference} — ₦${amountInNaira}`);
      }
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
