'use client';

import { useState } from 'react';
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
  const [success, setSuccess] = useState(false);

  async function handleTransfer() {
    setLoading(true);
    setSuccess(false);
    await new Promise(r => setTimeout(r, 1500));
    setLoading(false);
    setSuccess(true);
    setRecipientAccount('');
    setAmount('');
    setNarration('');
    setTimeout(() => setSuccess(false), 4000);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Transfer Money</h1>

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm font-medium">
          ✓ Transfer of {formatNaira(Number(amount))} to {recipientName || recipientAccount} was successful.
        </div>
      )}

      <div className="bg-white rounded-2xl border p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Account Number</label>
          <input
            type="text"
            value={recipientAccount}
            onChange={(e) => setRecipientAccount(e.target.value)}
            placeholder="0123456789"
            maxLength={10}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-forest-green outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Bank</label>
          <select value={recipientBank} onChange={(e) => setRecipientBank(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-forest-green outline-none">
            {banks.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Name (optional)</label>
          <input
            type="text"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="Account holder name"
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-forest-green outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₦)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 10000"
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-forest-green outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Narration (optional)</label>
          <input
            type="text"
            value={narration}
            onChange={(e) => setNarration(e.target.value)}
            placeholder="What's this for?"
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-forest-green outline-none"
          />
        </div>
        <button
          onClick={handleTransfer}
          disabled={loading || !recipientAccount || !amount}
          className="w-full py-3 bg-forest-green text-white rounded-lg font-semibold hover:bg-forest-green-dark transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 size={18} className="animate-spin" />}
          {loading ? 'Processing...' : 'Send Money'}
        </button>
      </div>
    </div>
  );
}
