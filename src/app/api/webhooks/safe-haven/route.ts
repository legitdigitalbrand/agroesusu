import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getSafeHavenClient } from '@/lib/safe-haven';

/**
 * Safe Haven Webhook Handler
 * 
 * Receives transaction/settlement notifications from Safe Haven and updates
 * wallet balances, transaction records, and loan repayment status.
 * 
 * Expected event types:
 * - credit: Funds received into a DVA
 * - debit: Funds debited from a DVA (transfer/bill pay)
 * - loan_disbursement: Loan funds disbursed
 * - loan_repayment: Scheduled repayment collected
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-safe-haven-signature') || '';

    // Verify webhook signature
    const sh = getSafeHavenClient();
    if (!sh.verifyWebhookSignature(body, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(body);
    const supabase = createServiceClient();

    const eventType = payload.event_type || payload.event;
    const accountNumber = payload.account_number || payload.data?.account_number;
    const amount = parseFloat(payload.amount || payload.data?.amount || '0');
    const reference = payload.reference || payload.data?.reference;
    const status = payload.status || payload.data?.status || 'success';

    // Find the wallet by account number
    const { data: wallet } = await supabase
      .from('wallets')
      .select('*, profiles!inner(*)')
      .eq('safe_haven_account_number', accountNumber)
      .single();

    if (!wallet) {
      console.warn(`Webhook: No wallet found for account ${accountNumber}`);
      return NextResponse.json({ received: true, matched: false });
    }

    switch (eventType) {
      case 'credit':
      case 'transfer_in': {
        // Credit the wallet
        const newBalance = (wallet.balance_cached || 0) + amount;
        await supabase.from('wallets').update({ balance_cached: newBalance }).eq('id', wallet.id);

        await supabase.from('wallet_transactions').insert({
          wallet_id: wallet.id,
          user_id: wallet.user_id,
          type: 'fund',
          amount,
          status,
          safe_haven_reference: reference,
          counterparty: payload.counterparty || payload.data?.counterparty || null,
        });

        // Send notification
        await supabase.from('notifications').insert({
          user_id: wallet.user_id,
          title: 'Wallet Credited',
          body: `Your wallet has been credited with ₦${amount.toLocaleString()}.`,
          read: false,
        });
        break;
      }

      case 'debit':
      case 'transfer_out': {
        // Debit the wallet
        const newBalance = Math.max(0, (wallet.balance_cached || 0) - amount);
        await supabase.from('wallets').update({ balance_cached: newBalance }).eq('id', wallet.id);

        await supabase.from('wallet_transactions').insert({
          wallet_id: wallet.id,
          user_id: wallet.user_id,
          type: 'withdraw',
          amount,
          status,
          safe_haven_reference: reference,
          counterparty: payload.counterparty || payload.data?.counterparty || null,
        });
        break;
      }

      case 'loan_repayment': {
        // Find the loan by reference or user
        const loanId = payload.loan_id || payload.data?.loan_id;
        if (loanId) {
          // Update repayment schedule
          const { data: scheduleItem } = await supabase
            .from('loan_repayment_schedule')
            .select('*')
            .eq('loan_id', loanId)
            .eq('status', 'upcoming')
            .order('due_date', { ascending: true })
            .limit(1)
            .single();

          if (scheduleItem) {
            const newPaid = scheduleItem.amount_paid + amount;
            const newStatus = newPaid >= scheduleItem.amount_due ? 'paid' : 'partial';
            await supabase.from('loan_repayment_schedule').update({
              amount_paid: newPaid,
              status: newStatus,
            }).eq('id', scheduleItem.id);
          }

          // Log loan event
          await supabase.from('loan_events').insert({
            loan_id: loanId,
            event_type: 'repayment_received',
            payload_json: { amount, reference },
          });

          // Check if loan is fully repaid
          const { data: schedule } = await supabase
            .from('loan_repayment_schedule')
            .select('amount_due, amount_paid, status')
            .eq('loan_id', loanId);

          if (schedule && schedule.length > 0) {
            const allPaid = schedule.every(s => s.status === 'paid');
            if (allPaid) {
              await supabase.from('loans').update({
                status: 'closed',
                closed_at: new Date().toISOString(),
              }).eq('id', loanId);

              await supabase.from('loan_events').insert({
                loan_id: loanId,
                event_type: 'loan_closed',
                payload_json: { closed_at: new Date().toISOString() },
              });
            } else {
              // At least one payment made, move to repaying status
              await supabase.from('loans').update({ status: 'repaying' }).eq('id', loanId);
            }
          }
        }

        // Debit the wallet for repayment
        const repayBalance = Math.max(0, (wallet.balance_cached || 0) - amount);
        await supabase.from('wallets').update({ balance_cached: repayBalance }).eq('id', wallet.id);

        await supabase.from('wallet_transactions').insert({
          wallet_id: wallet.id,
          user_id: wallet.user_id,
          type: 'repay',
          amount,
          status,
          safe_haven_reference: reference,
          counterparty: { type: 'loan_repayment', loan_id: loanId },
        });
        break;
      }

      case 'bill_payment': {
        const newBalance = Math.max(0, (wallet.balance_cached || 0) - amount);
        await supabase.from('wallets').update({ balance_cached: newBalance }).eq('id', wallet.id);

        await supabase.from('wallet_transactions').insert({
          wallet_id: wallet.id,
          user_id: wallet.user_id,
          type: 'bill_pay',
          amount,
          status,
          safe_haven_reference: reference,
          counterparty: payload.counterparty || null,
        });

        // Update bill payment record if exists
        if (payload.bill_payment_id || payload.data?.bill_payment_id) {
          await supabase.from('bill_payments').update({
            status: status === 'success' ? 'success' : 'failed',
            reference,
          }).eq('id', payload.bill_payment_id || payload.data?.bill_payment_id);
        }
        break;
      }

      default:
        console.log(`Webhook: Unhandled event type ${eventType}`);
    }

    return NextResponse.json({ received: true, processed: true });
  } catch (error) {
    console.error('Safe Haven webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Health check
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'safe-haven-webhook' });
}
