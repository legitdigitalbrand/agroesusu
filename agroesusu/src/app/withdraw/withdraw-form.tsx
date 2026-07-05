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

    if (selectedAccount?.lock_type !== 'none' && selectedAccount?.unlock_date) {
      const unlockDate = new Date(selectedAccount.unlock_date);
      if (unlockDate > new Date()) {
        setError(`This pot is locked until ${unlockDate.toLocaleDateString()}`);
        setLoading(false);
        return;
      }
    }

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

    const newBalance = availableBalance - withdrawAmount;
    await supabase.from('savings_accounts')
      .update({ current_amount: newBalance })
      .eq('id', accountId);

    await supabase.from('transactions')
      .update({ status: 'completed', completed_date: new Date().toISOString() })
      .eq('account_id', accountId)
      .eq('type', 'withdrawal')
      .order('created_at', { ascending: false })
      .limit(1);

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

  const inputStyle = {
    background: "var(--input-bg)",
    borderColor: "var(--input-border)",
    color: "var(--text-primary)",
  };

  if (success) {
    return (
      <div className="rounded-xl p-8 text-center border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
        <div className="text-4xl mb-3">✅</div>
        <h2 className="text-lg font-semibold" style={{ color: "var(--accent)" }}>Withdrawal Processing</h2>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>₦{Number(amount).toLocaleString()} will be sent to your bank.</p>
        <p className="text-xs mt-3" style={{ color: "var(--text-faint)" }}>Redirecting to dashboard...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Withdraw From</label>
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="w-full px-4 py-3 rounded-lg border outline-none transition"
          style={inputStyle}
        >
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.icon} {acc.name} — ₦{Number(acc.current_amount).toLocaleString()}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Amount (₦)</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          min="100"
          max={availableBalance}
          placeholder="5000"
          className="w-full px-4 py-3 rounded-lg border outline-none transition text-lg"
          style={inputStyle}
        />
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Available: ₦{availableBalance.toLocaleString()}</p>
        {availableBalance > 0 && (
          <button type="button" onClick={() => setAmount(String(availableBalance))}
            className="text-xs font-medium mt-1 hover:underline" style={{ color: "var(--accent)" }}>
            Withdraw all
          </button>
        )}
      </div>

      {error && (
        <div className="text-sm p-3 rounded-lg border"
          style={{ background: "rgba(255,77,109,0.1)", color: "var(--danger)", borderColor: "rgba(255,77,109,0.2)" }}>
          {error}
        </div>
      )}

      <button type="submit" disabled={loading}
        className="w-full py-3 rounded-lg font-semibold transition disabled:opacity-50"
        style={{ background: "var(--accent)", color: "var(--nav-bg)" }}>
        {loading ? 'Processing...' : `Withdraw ₦${amount ? Number(amount).toLocaleString() : '0'}`}
      </button>
    </form>
  );
}
