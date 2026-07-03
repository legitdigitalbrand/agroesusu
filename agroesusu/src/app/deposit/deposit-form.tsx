'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function DepositForm({ accounts, userId }: { accounts: any[]; userId: string }) {
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const depositAmount = Number(amount);
    if (!depositAmount || depositAmount < 100) {
      setError('Minimum deposit is ₦100');
      setLoading(false);
      return;
    }

    // Create transaction record
    const { error: txError } = await supabase.from('transactions').insert({
      user_id: userId,
      account_id: accountId,
      type: 'deposit',
      amount: depositAmount,
      payment_method: 'card',
      status: 'pending',
      description: 'Card deposit',
      payment_reference: `DEP_${Date.now()}`,
    });

    if (txError) {
      setError(txError.message);
      setLoading(false);
      return;
    }

    // For MVP: directly credit the account (no payment gateway yet)
    // TODO: Replace with Paystack integration
    const account = accounts.find(a => a.id === accountId);
    const newBalance = Number(account.current_amount) + depositAmount;

    await supabase.from('savings_accounts')
      .update({ current_amount: newBalance })
      .eq('id', accountId);

    // Update transaction status
    await supabase.from('transactions')
      .update({ status: 'completed', completed_date: new Date().toISOString() })
      .eq('account_id', accountId)
      .eq('type', 'deposit')
      .order('created_at', { ascending: false })
      .limit(1);

    // Update profile total_saved
    const { data: profile } = await supabase
      .from('profiles')
      .select('total_saved')
      .eq('id', userId)
      .single();

    if (profile) {
      await supabase.from('profiles')
        .update({ total_saved: Number(profile.total_saved) + depositAmount })
        .eq('id', userId);
    }

    setSuccess(true);
    setLoading(false);
    setTimeout(() => router.push('/'), 2000);
  };

  if (success) {
    return (
      <div className="bg-white border border-brand-border rounded-xl p-8 text-center">
        <div className="text-4xl mb-3">✅</div>
        <h2 className="text-lg font-semibold text-brand-green">Deposit Successful!</h2>
        <p className="text-sm text-stone-500 mt-1">₦{Number(amount).toLocaleString()} added to your pot.</p>
        <p className="text-xs text-stone-400 mt-3">Redirecting to dashboard...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">Select Pot</label>
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="w-full px-4 py-3 rounded-lg border border-stone-200 focus:border-brand-lime focus:ring-2 focus:ring-brand-lime/20 outline-none transition bg-white"
        >
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.icon} {acc.name} — ₦{Number(acc.current_amount).toLocaleString()}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">Amount (₦)</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          min="100"
          placeholder="5000"
          className="w-full px-4 py-3 rounded-lg border border-stone-200 focus:border-brand-lime focus:ring-2 focus:ring-brand-lime/20 outline-none transition text-lg"
        />
        <div className="flex gap-2 mt-2">
          {[1000, 5000, 10000, 50000].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setAmount(String(preset))}
              className="px-3 py-1.5 text-xs bg-stone-100 text-stone-600 rounded-lg hover:bg-stone-200 transition"
            >
              ₦{preset.toLocaleString()}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-brand-lime/5 border border-brand-lime/20 rounded-lg p-3">
        <p className="text-xs text-stone-600">
          💡 Deposits are credited instantly. Paystack integration coming soon for card payments.
        </p>
      </div>

      {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{error}</div>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-brand-green text-white py-3 rounded-lg font-semibold hover:bg-brand-green/90 transition disabled:opacity-50"
      >
        {loading ? 'Processing...' : `Deposit ₦${amount ? Number(amount).toLocaleString() : '0'}`}
      </button>
    </form>
  );
}
