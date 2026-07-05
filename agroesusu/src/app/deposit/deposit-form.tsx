'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function DepositForm({ accounts, userId }: { accounts: any[]; userId: string }) {
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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

    const account = accounts.find(a => a.id === accountId);
    if (!account) {
      setError('Please select a savings pot');
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      setError('Unable to get user email. Please try again.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/deposit/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: depositAmount,
          account_id: accountId,
          account_name: account.name,
          email: user.email,
          user_id: userId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to initialize payment');
        setLoading(false);
        return;
      }

      window.location.href = data.authorization_url;
    } catch (err) {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const inputStyle = {
    background: "var(--input-bg)",
    borderColor: "var(--input-border)",
    color: "var(--text-primary)",
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Select Pot</label>
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
          placeholder="5000"
          className="w-full px-4 py-3 rounded-lg border outline-none transition text-lg"
          style={inputStyle}
        />
        <div className="flex gap-2 mt-2">
          {[1000, 5000, 10000, 50000].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setAmount(String(preset))}
              className="px-3 py-1.5 text-xs rounded-lg transition border"
              style={{ background: "var(--surface-card)", color: "var(--text-secondary)", borderColor: "var(--border-default)" }}
            >
              ₦{preset.toLocaleString()}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg p-3 border" style={{ background: "var(--accent-subtle)", borderColor: "var(--border-default)" }}>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          🔒 You&apos;ll be redirected to Paystack to complete your payment securely. Card, USSD, and bank transfer supported.
        </p>
      </div>

      {error && (
        <div className="text-sm p-3 rounded-lg border"
          style={{ background: "rgba(255,77,109,0.1)", color: "var(--danger)", borderColor: "rgba(255,77,109,0.2)" }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 rounded-lg font-semibold transition disabled:opacity-50"
        style={{ background: "var(--accent)", color: "var(--nav-bg)" }}
      >
        {loading ? 'Initializing payment...' : `Deposit ₦${amount ? Number(amount).toLocaleString() : '0'}`}
      </button>
    </form>
  );
}
