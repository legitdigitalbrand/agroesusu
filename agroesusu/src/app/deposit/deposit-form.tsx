'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function DepositForm({ accounts, userId }: { accounts: any[]; userId: string }) {
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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

    const account = accounts.find(a => a.id === accountId);
    if (!account) {
      setError('Please select a savings pot');
      setLoading(false);
      return;
    }

    // Get user email
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      setError('Unable to get user email. Please try again.');
      setLoading(false);
      return;
    }

    try {
      // Initialize Paystack transaction
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

      // Redirect to Paystack checkout
      window.location.href = data.authorization_url;
    } catch (err) {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

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
          🔒 You'll be redirected to Paystack to complete your payment securely. Card, USSD, and bank transfer supported.
        </p>
      </div>

      {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{error}</div>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-brand-green text-white py-3 rounded-lg font-semibold hover:bg-brand-green/90 transition disabled:opacity-50"
      >
        {loading ? 'Initializing payment...' : `Deposit ₦${amount ? Number(amount).toLocaleString() : '0'}`}
      </button>
    </form>
  );
}
