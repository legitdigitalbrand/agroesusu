import { NextRequest, NextResponse } from "next/server";
import { verifyAndCreditDeposit } from "@/lib/deposit-credit";
import { activateGroupDirectDebit } from "@/lib/group-direct-debit-credit";
import { verifyAndCreditGroupContribution } from "@/lib/group-contribution-credit";
import { finalizeWithdrawal } from "@/lib/withdraw-credit";
import { finalizeGroupPayout } from "@/lib/group-payout-credit";
import { processRepayment } from "@/lib/loans/loan-operations";

/**
 * Paystack Webhook Handler
 * Receives payment events from Paystack and updates the database.
 *
 * Events we handle:
 * - charge.success: Deposit, group contribution, or loan repayment completed —
 *   reference prefix (AGC_DEP / AGC_GRP / AGC_LRP) tells us which path to use.
 * - transfer.success / transfer.failed / transfer.reversed: Withdrawal
 *   (AGC_WDR), group cycle payout (AGC_PAY), or loan disbursement (AGC_LDB)
 *   completed/failed.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const event = body.event;
    const data = body.data;
    const reference: string = data?.reference || "";

    if (event === "charge.success") {
      let result;
      if (reference.startsWith("AGC_GDD")) {
        // Group direct debit setup: activate plan + credit first contribution
        result = await activateGroupDirectDebit(reference, data);
      } else if (reference.startsWith("AGC_GRP")) {
        result = await verifyAndCreditGroupContribution(reference);
      } else if (reference.startsWith("AGC_LRP")) {
        // Loan repayment charge — process the repayment
        const admin = (await import("@/lib/supabase/server")).createAdminClient();
        const { data: loanTx } = await admin
          .from('loan_transactions')
          .select('loan_id, amount')
          .eq('reference', reference)
          .single();

        if (loanTx) {
          await processRepayment(loanTx.loan_id, Number(loanTx.amount), 'manual', reference);
          console.log(`✅ Loan repayment confirmed via webhook: ${reference}`);
        }
      } else {
        result = await verifyAndCreditDeposit(reference);
      }
      if (result?.credited) {
        console.log(`✅ Payment confirmed via webhook: ${reference} — ₦${result.amount}`);
      }
    }

    // Auto-save: capture card authorization from the setup charge
    if (event === "charge.success" && reference.startsWith("AGC_AUT")) {
      const authCode = data?.authorization?.authorization_code;
      const email = data?.customer?.email;
      const planId = data?.metadata?.auto_save_plan_id;

      if (authCode && email && planId) {
        const admin = (await import("@/lib/supabase/server")).createAdminClient();
        // Credit the first instalment to the savings pot
        const meta = data?.metadata || {};
        const accountId = meta.account_id;
        const userId = meta.user_id;
        const amountNaira = (data?.amount || 0) / 100;

        if (accountId && userId && amountNaira > 0) {
          const { data: acct } = await admin
            .from("savings_accounts")
            .select("current_amount")
            .eq("id", accountId)
            .single();

          if (acct) {
            await admin
              .from("savings_accounts")
              .update({ current_amount: (acct.current_amount || 0) + amountNaira })
              .eq("id", accountId);
          }

          await admin.from("transactions").insert({
            user_id: userId,
            account_id: accountId,
            type: "deposit",
            amount: amountNaira,
            reference,
            status: "completed",
            description: "Auto-save setup (first charge)",
            paystack_fee: (data?.fees || 0) / 100,
          });
        }

        // Activate the plan and store the authorization
        await admin
          .from("auto_save_plans")
          .update({
            status: "active",
            authorization_code: authCode,
            email,
            last_charged_at: new Date().toISOString(),
            total_charged: amountNaira,
            charge_count: 1,
          })
          .eq("id", planId);

        console.log(`✅ Auto-save plan ${planId} activated with authorization`);
      }
    }

    if (event === "transfer.success" || event === "transfer.failed" || event === "transfer.reversed") {
      const outcome = event === "transfer.success" ? "success" : event === "transfer.failed" ? "failed" : "reversed";
      if (reference.startsWith("AGC_PAY")) {
        await finalizeGroupPayout(reference, outcome);
      } else if (reference.startsWith("AGC_LDB")) {
        // Loan disbursement transfer — mark as completed
        const admin = (await import("@/lib/supabase/server")).createAdminClient();
        await admin.from('loan_transactions')
          .update({ status: outcome === 'success' ? 'completed' : 'failed' })
          .eq('reference', reference);
        console.log(`Loan disbursement ${outcome} via webhook: ${reference}`);
      } else {
        await finalizeWithdrawal(reference, outcome);
      }
      console.log(`Transfer ${outcome} via webhook: ${reference}`);
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
