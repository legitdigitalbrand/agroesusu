'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getSafeHavenClient } from '@/lib/safe-haven';
import { Loader2 } from 'lucide-react';
import { formatNaira } from '@/lib/format';

export default function RepayButton({
  loanId,
  walletId,
  userId,
  outstanding,
  walletBalance,
  nextDueAmount,
  nextDueId,
}: {
  loanId: string;
  walletId: string;
  userId: string;
  outstanding: number;
  walletBalance: number;
  nextDueAmount: number;
  nextDueId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  async function handleRepay(amount: number) {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      if (amount > walletBalance) {
        setError('Insufficient wallet balance. Please fund your wallet first.');
        setLoading(false);
        return;
      }

      const supabase = createClient();
      const sh = getSafeHavenClient();
      const reference = `REPAY-${Date.now()}`;

      await sh.initiateTransfer({
        amount,
        recipient_account: 'AGROESUSU_LOAN_POOL',
        recipient_bank: 'Agroesusu Savings Bank',
        narration: `Loan repayment ${loanId.slice(0, 8)}`,
        reference,
      });

      // Update wallet balance
      const newBalance = walletBalance - amount;
      await supabase.from('wallets').update({ balance_cached: newBalance }).eq('id', walletId);

      // Record transaction
      await supabase.from('wallet_transactions').insert({
        wallet_id: walletId,
        user_id: userId,
        type: 'repay',
        amount,
        status: 'success',
        safe_haven_reference: reference,
        counterparty: { type: 'loan_repayment', loan_id: loanId },
      });

      // Update repayment schedule
      if (nextDueId) {
        const { data: scheduleItem } = await supabase
          .from('loan_repayment_schedule')
          .select('*')
          .eq('id', nextDueId)
          .single();

        if (scheduleItem) {
          const newPaid = scheduleItem.amount_paid + amount;
          const newStatus = newPaid >= scheduleItem.amount_due ? 'paid' : 'partial';
          await supabase.from('loan_repayment_schedule').update({
            amount_paid: newPaid,
            status: newStatus,
          }).eq('id', nextDueId);
        }
      }

      // Log loan event
      await supabase.from('loan_events').insert({
        loan_id: loanId,
        event_type: 'repayment_received',
        payload_json: { amount, reference },
      });

      // Check if fully repaid
      const { data: schedule } = await supabase
        .from('loan_repayment_schedule')
        .select('status')
        .eq('loan_id', loanId);

      if (schedule && schedule.every((s: { status: string }) => s.status === 'paid')) {
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
        await supabase.from('loans').update({ status: 'repaying' }).eq('id', loanId);
      }

      setSuccess(`Repayment of ${formatNaira(amount)} was successful!`);
      setShowModal(false);
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Repayment failed. Please try again.');
    }
    setLoading(false);
  }

  return (
    <div>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      {success && <p className="text-sm text-green-600 mb-2">{success}</p>}
      <button
        onClick={() => setShowModal(true)}
        disabled={loading}
        className="w-full py-3 bg-forest-green text-white rounded-lg font-semibold hover:bg-forest-green-dark transition disabled:opacity-50"
      >
        Repay {formatNaira(outstanding)} in Full
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Loan Repayment</h2>
            <p className="text-sm text-gray-500 mb-4">Wallet balance: {formatNaira(walletBalance)}</p>

            <div className="space-y-3">
              <button
                onClick={() => handleRepay(nextDueAmount)}
                disabled={loading}
                className="w-full py-3 border border-forest-green text-forest-green rounded-lg font-medium hover:bg-forest-green/5 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                Pay next installment ({formatNaira(nextDueAmount)})
              </button>
              <button
                onClick={() => handleRepay(outstanding)}
                disabled={loading}
                className="w-full py-3 bg-forest-green text-white rounded-lg font-semibold hover:bg-forest-green-dark transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                Pay full outstanding ({formatNaira(outstanding)})
              </button>
              <button onClick={() => setShowModal(false)} className="w-full py-2 text-gray-500 text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
