'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getSafeHavenClient } from '@/lib/safe-haven';
import { Loader2 } from 'lucide-react';
import { formatNaira } from '@/lib/format';

const banks = ['Access Bank', 'GTBank', 'UBA', 'Zenith Bank', 'First Bank', 'FCMB', 'Union Bank', 'Sterling Bank', 'Fidelity Bank', 'Polaris Bank', 'Wema Bank', 'Stanbic IBTC', 'Unity Bank', 'Keystone Bank', 'Titan Trust', 'Agroesusu Savings Bank'];

export default function TransfersPage() {
  const [recipientAccount, setRecipientAccount] = useState('');
  const [recipientBank, setRecipientBank] = useState(banks[0]);
  const [recipientName, setRecipientName] = useState('');
  const [amount, setAmount] = useState('');
  const [narration, setNarration] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [wallet, setWallet] = useState<{ id: string; balance_cached: number; safe_haven_account_number: string } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('wallets').select('*').eq('user_id', user.id).single().then(({ data }) => setWallet(data));
    });
  }, []);

  async function handleTransfer() {
    if (!wallet) { setError('Wallet not found'); return; }
    const amt = parseFloat(amount);
    if (amt > wallet.balance_cached) { setError('Insufficient balance'); return; }

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const sh = getSafeHavenClient();
      const reference = `TRF-${Date.now()}`;
      const result = await sh.initiateTransfer({
        amount: amt,
        recipient_account: recipientAccount,
        recipient_bank: recipientBank,
        narration: narration || 'Transfer',
        reference,
      });

      // Update wallet balance
      const newBalance = wallet.balance_cached - amt;
      await supabase.from('wallets').update({ balance_cached: newBalance }).eq('id', wallet.id);

      // Record transaction
      await supabase.from('wallet_transactions').insert({
        wallet_id: wallet.id,
        user_id: user.id,
        type: 'transfer_out',
        amount: amt,
        status: 'success',
        safe_haven_reference: result.safe_haven_reference || reference,
        counterparty: { account: recipientAccount, bank: recipientBank, name: recipientName },
      });

      setSuccess(`Transfer of ${formatNaira(amt)} to ${recipientName || recipientAccount} (${recipientBank}) was successful.`);
      setRecipientAccount(''); setAmount(''); setNarration(''); setRecipientName('');
      setWallet({ ...wallet, balance_cached: newBalance });
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transfer failed. Please try again.');
    }
    setLoading(false);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Transfer Money</h1>

      {wallet && (
        <div className="p-4 bg-cream rounded-lg border text-sm text-gray-600">
          Available balance: <span className="font-semibold text-forest-green">{formatNaira(wallet.balance_cached)}</span>
        </div>
      )}

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      {success && <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{success}</div>}

      <div className="bg-white rounded-2xl border p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Account Number</label>
          <input type="text" value={recipientAccount} onChange={e => setRecipientAccount(e.target.value)} placeholder="0123456789" maxLength={10} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-forest-green outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Bank</label>
          <select value={recipientBank} onChange={e => setRecipientBank(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-forest-green outline-none">
            {banks.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Name (optional)</label>
          <input type="text" value={recipientName} onChange={e => setRecipientName(e.target.value)} placeholder="Account holder name" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-forest-green outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₦)</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 10000" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-forest-green outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Narration (optional)</label>
          <input type="text" value={narration} onChange={e => setNarration(e.target.value)} placeholder="What's this for?" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-forest-green outline-none" />
        </div>
        <button onClick={handleTransfer} disabled={loading || !recipientAccount || !amount} className="w-full py-3 bg-forest-green text-white rounded-lg font-semibold hover:bg-forest-green-dark transition disabled:opacity-50 flex items-center justify-center gap-2">
          {loading && <Loader2 size={18} className="animate-spin" />}{loading ? 'Processing...' : 'Send Money'}
        </button>
      </div>
    </div>
  );
}
