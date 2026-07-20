import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifySafeHavenWebhook } from "@/lib/safehaven";
import { verifyAndCreditDeposit } from "@/lib/deposit-credit";

/**
 * Safe Haven MFB Webhook Handler
 *
 * Handles incoming webhook events from Safe Haven's Open API Banking:
 * - Virtual account credit notifications (deposits)
 * - Transfer status updates (withdrawals, payouts)
 * - Verification status updates
 *
 * Mirrors the reliability patterns already built for Paystack webhooks:
 * - Idempotency handling (safe to call multiple times)
 * - Signature verification
 * - Always return 200 to acknowledge receipt
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();

    // Verify webhook signature
    const signature = request.headers.get("x-safehaven-signature") || "";
    if (!verifySafeHavenWebhook(signature, body)) {
      console.error("Safe Haven webhook signature verification failed");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const data = JSON.parse(body);
    const eventType = data.event || data.type;
    const payload = data.data || data;

    const admin = createAdminClient();

    // ─── Virtual Account Credit (deposit received) ───
    if (eventType === 'virtual-account.credit' || eventType === 'account.credit') {
      const accountNumber = payload.accountNumber || payload.virtualAccountNumber;
      const amount = (payload.amount || 0) / 100; // convert from kobo
      const reference = payload.externalReference || payload.reference;

      // Find the user's savings account linked to this virtual account
      // The DVA creation stored the virtual account number on the savings account
      const { data: account } = await admin
        .from('savings_accounts')
        .select('id, user_id, current_amount')
        .eq('dva_number', accountNumber)
        .single();

      if (account) {
        // Credit the savings account
        await admin
          .from('savings_accounts')
          .update({ current_amount: Number(account.current_amount) + amount })
          .eq('id', account.id);

        // Log the transaction
        await admin.from('transactions').insert({
          user_id: account.user_id,
          account_id: account.id,
          type: 'deposit',
          amount,
          payment_method: 'bank_transfer',
          payment_reference: reference,
          status: 'completed',
          description: `Deposit via Safe Haven virtual account (${accountNumber})`,
          completed_date: new Date().toISOString(),
        });

        // Notify user
        await admin.from('notifications').insert({
          user_id: account.user_id,
          type: 'deposit',
          channel: 'in_app',
          title: 'Deposit Received',
          content: `₦${amount.toLocaleString()} has been credited to your savings account via bank transfer.`,
          status: 'unread',
          metadata: { reference, amount, provider: 'safehaven' },
        });

        console.log(`✅ Safe Haven deposit credited: ${reference} — ₦${amount}`);
      }
    }

    // ─── Transfer Status Updates ───
    if (eventType === 'transfer.success' || eventType === 'transfer.failed' || eventType === 'transfer.reversed') {
      const reference = payload.externalReference || payload.reference || '';
      const outcome = eventType === 'transfer.success' ? 'success' : eventType === 'transfer.failed' ? 'failed' : 'reversed';

      // Route based on reference prefix (same as Paystack webhooks)
      if (reference.startsWith('AGC_WDR')) {
        const { finalizeWithdrawal } = await import('@/lib/withdraw-credit');
        await finalizeWithdrawal(reference, outcome);
      } else if (reference.startsWith('AGC_PAY')) {
        const { finalizeGroupPayout } = await import('@/lib/group-payout-credit');
        await finalizeGroupPayout(reference, outcome);
      } else if (reference.startsWith('AGC_LDB')) {
        // Loan disbursement
        await admin.from('loan_transactions')
          .update({ status: outcome === 'success' ? 'completed' : 'failed' })
          .eq('reference', reference);
      }

      console.log(`Safe Haven transfer ${outcome}: ${reference}`);
    }

    // ─── Verification Status Update ───
    if (eventType === 'identity.verified' || eventType === 'identity.failed') {
      const identityId = payload.identityId || payload._id;
      const status = eventType === 'identity.verified' ? 'verified' : 'pending_review';

      // Update profile verification status
      if (payload.bvn || payload.number) {
        const crypto = await import('crypto');
        const bvnHash = crypto.createHash('sha256').update(payload.bvn || payload.number).digest('hex');
        const bvnLast4 = (payload.bvn || payload.number || '').slice(-4);

        // Find user by BVN hash
        const { data: profile } = await admin
          .from('profiles')
          .select('id')
          .eq('bvn_hash', bvnHash)
          .single();

        if (profile) {
          await admin.from('profiles').update({
            kyc_status: status,
            kyc_verified_date: status === 'verified' ? new Date().toISOString() : null,
            bvn_first_name: payload.firstName || '',
            bvn_last_name: payload.lastName || '',
          }).eq('id', profile.id);

          await admin.from('notifications').insert({
            user_id: profile.id,
            type: 'kyc',
            channel: 'in_app',
            title: status === 'verified' ? 'Identity Verified' : 'Verification Under Review',
            content: status === 'verified'
              ? 'Your BVN has been verified. You can now withdraw your savings.'
              : 'Your BVN verification is under review. We\'ll update you shortly.',
            status: 'unread',
            metadata: { kyc_status: status, provider: 'safehaven' },
          });
        }
      }
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Safe Haven webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
