'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Check, X } from 'lucide-react';
import { formatNaira } from '@/lib/format';

export default function AdminReviewActions({ loanId, userId }: { loanId: string; userId: string }) {
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<'approve' | 'decline' | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function handleApprove() {
    setLoading(true);
    setAction('approve');
    try {
      const supabase = createClient();

      // Get the loan details
      const { data: loan } = await supabase
        .from('loans')
        .select('*')
        .eq('id', loanId)
        .single();

      if (!loan) throw new Error('Loan not found');

      // Update loan to disbursed
      await supabase.from('loans').update({
        status: 'disbursed',
        amount_approved: loan.amount_requested,
        disbursed_at: new Date().toISOString(),
      }).eq('id', loanId);

      // Log event
      await supabase.from('loan_events').insert({
        loan_id: loanId,
        event_type: 'manually_approved',
        payload_json: { approved_by: userId, amount: loan.amount_requested },
      });

      // Credit the wallet
      const { data: wallet } = await supabase.from('wallets').select('*').eq('user_id', loan.user_id).single();
      if (wallet) {
        const newBalance = (wallet.balance_cached || 0) + loan.amount_requested;
        await supabase.from('wallets').update({ balance_cached: newBalance }).eq('id', wallet.id);
        await supabase.from('wallet_transactions').insert({
          wallet_id: wallet.id,
          user_id: loan.user_id,
          type: 'fund',
          amount: loan.amount_requested,
          status: 'success',
          safe_haven_reference: `LOAN-${loanId.slice(0, 8)}`,
          counterparty: { source: 'loan_disbursement', loan_id: loanId },
        });
      }

      // Send notification
      await supabase.from('notifications').insert({
        user_id: loan.user_id,
        title: 'Loan Approved! 🎉',
        body: `Your loan of ${formatNaira(loan.amount_requested)} has been approved and disbursed to your wallet.`,
        read: false,
      });

      setDone('Loan approved and disbursed!');
      setTimeout(() => window.location.reload(), 2000);
    } catch (err) {
      setDone(`Error: ${err instanceof Error ? err.message : 'Failed to approve'}`);
    }
    setLoading(false);
  }

  async function handleDecline() {
    setLoading(true);
    setAction('decline');
    try {
      const supabase = createClient();

      await supabase.from('loans').update({ status: 'auto_declined' }).eq('id', loanId);

      await supabase.from('loan_events').insert({
        loan_id: loanId,
        event_type: 'manually_declined',
        payload_json: { declined_by: userId },
      });

      const { data: loan } = await supabase.from('loans').select('user_id, amount_requested').eq('id', loanId).single();
      if (loan) {
        await supabase.from('notifications').insert({
          user_id: loan.user_id,
          title: 'Loan Application Update',
          body: `Your loan application of ${formatNaira(loan.amount_requested)} was not approved at this time.`,
          read: false,
        });
      }

      setDone('Loan declined.');
      setTimeout(() => window.location.reload(), 2000);
    } catch (err) {
      setDone(`Error: ${err instanceof Error ? err.message : 'Failed to decline'}`);
    }
    setLoading(false);
  }

  if (done) return <p className="text-sm text-gray-600 mt-2">{done}</p>;

  return (
    <div className="flex gap-3 mt-2">
      <button
        onClick={handleApprove}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-forest-green text-white rounded-lg text-sm font-medium hover:bg-forest-green-dark transition disabled:opacity-50"
      >
        {loading && action === 'approve' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
        Approve & Disburse
      </button>
      <button
        onClick={handleDecline}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 transition disabled:opacity-50"
      >
        {loading && action === 'decline' ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
        Decline
      </button>
    </div>
  );
}
