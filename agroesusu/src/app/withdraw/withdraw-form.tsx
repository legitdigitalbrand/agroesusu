'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function WithdrawForm({ accounts, userId }: { accounts: any[]; userId: string }) {
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const selectedAccount = accounts.find(a => a.id === accountId);
  const availableBalance = Number(selectedAccount?.current_amount || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const withdrawAmount = Number(amount);
    if (!withdrawAmount || withdrawAmount < 100) {
      setError('Minimum withdrawal is ₦100');
      setLoading(false);
      return;
    }

    if (withdrawAmount > availableBalance) {
      setError('Insufficient balance in this pot');
      setLoading(false);
      return;
    }

    // Check if account is locked
    if (selectedAccount?.lock_type !== 'none' && selectedAccount?.unlock_date) {
      const unlockDate = new Date(selectedAccount.unlock_date);
      if (unlockDate > new Date()) {
        setError(`This pot is locked until ${unlockDate.toLocaleDateString()}`);
        setLoading(false);
        return;
      }
    }

    // Create transaction
    const { error: txError } = await supabase.from('transactions').insert({
      user_id: userId,
      account_id: accountId,
      type: 'withdrawal',
      amount: withdrawAmount,
      payment_method: 'bank_transfer',
      status: 'pending',
      description: 'Withdrawal request',
      payment_reference: `WDR_${Date.now()}`,
    });

    if (txError) {
      setError(txError.message);
      setLoading(false);
      return;
    }

    // Deduct from account
    const newBalance = availableBalance - withdrawAmount;
    await supabase.from('savings_accounts')
      .update({ current_amount: newBalance })
      .eq('id', accountId);

    // Mark transaction as completed
    await supabase.from('transactions')
      .update({ status: 'completed', completed_date: new Date().toISOString() })
      .eq('account_id', accountId)
      .eq('type', 'withdrawal')
      .order('created_at', { ascending: false })
      .limit(1);

    // Update profile total_withdrawn
    const { data: profile } = await supabase
      .from('profiles')
      .select('total_withdrawn')
      .eq('id', userId)
      .single();

    if (profile) {
      await supabase.from('profiles')
        .update({ total_withdrawn: Number(profile.total_withdrawn) + withdrawAmount })
        .eq('id', userId);
    }

    setSuccess(true);
    setLoading(false);
    setTimeout(() => router.push('/'), 2000);
  };

  if (success) {
    return (
      <div className="bg-brand-900 border border-brand-500/10 rounded-xl p-8 text-center">
        <div className="text-4xl mb-3">✅</div>
        <h2 className="text-lg font-semibold text-brand-400">Withdrawal Processing</h2>
        <p className="text-sm text-brand-300/60 mt-1">₦{Number(amount).toLocaleString()} will be sent to your bank.</p>
        <p className="text-xs text-brand-300/40 mt-3">Redirecting to dashboard...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-brand-200 mb-1">Withdraw From</label>
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="w-full px-4 py-3 rounded-lg border border-brand-500/15 bg-brand-900 text-brand-50 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition"
        >
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.icon} {acc.name} — ₦{Number(acc.current_amount).toLocaleString()}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-brand-200 mb-1">Amount (₦)</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          min="100"
          max={availableBalance}
          placeholder="5000"
          className="w-full px-4 py-3 rounded-lg border border-brand-500/15 bg-brand-900 text-brand-50 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition text-lg"
        />
        <p className="text-xs text-brand-300/40 mt-1">Available: ₦{availableBalance.toLocaleString()}</p>
        {availableBalance > 0 && (
          <button
            type="button"
            onClick={() => setAmount(String(availableBalance))}
            className="text-xs text-brand-400 font-medium mt-1 hover:underline"
          >
            Withdraw all
          </button>
        )}
      </div>

      {error && <div className="bg-red-500/10 text-red-400 text-sm p-3 rounded-lg border border-red-500/20">{error}</div>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-brand-500 text-brand-950 py-3 rounded-lg font-semibold hover:bg-brand-400 transition disabled:opacity-50"
      >
        {loading ? 'Processing...' : `Withdraw ₦${amount ? Number(amount).toLocaleString() : '0'}`}
      </button>
    </form>
  );
}
