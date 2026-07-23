'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getSafeHavenClient } from '@/lib/safe-haven';
import { Sprout, Smartphone, Zap, Droplet, Loader2 } from 'lucide-react';
import { formatNaira } from '@/lib/format';

const categories = [
  { id: 'farm_input', label: 'Farm Inputs', icon: Sprout, vendors: ['Seed Co.', 'Notore Fertilizer', 'Dizengoff Agro', 'Veterinary World'] },
  { id: 'airtime', label: 'Airtime', icon: Smartphone, vendors: ['MTN', 'Airtel', 'Glo', '9mobile'] },
  { id: 'data', label: 'Data', icon: Smartphone, vendors: ['MTN Data', 'Airtel Data', 'Glo Data', '9mobile Data'] },
  { id: 'electricity', label: 'Electricity', icon: Zap, vendors: ['IKEDC', 'EKEDC', 'AEDC', 'KEDCO'] },
  { id: 'water', label: 'Water', icon: Droplet, vendors: ['Water Board'] },
];

export default function PayPage() {
  const [selectedCategory, setSelectedCategory] = useState(categories[0]);
  const [selectedVendor, setSelectedVendor] = useState(categories[0].vendors[0]);
  const [amount, setAmount] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [wallet, setWallet] = useState<{ id: string; balance_cached: number; user_id: string } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('wallets').select('*').eq('user_id', user.id).single().then(({ data }) => setWallet(data));
    });
  }, []);

  async function handlePay() {
    if (!wallet) { setError('Wallet not found'); return; }
    const amt = parseFloat(amount);
    if (amt > wallet.balance_cached) { setError('Insufficient wallet balance'); return; }

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const supabase = createClient();
      const sh = getSafeHavenClient();
      const reference = `BILL-${Date.now()}`;

      const result = await sh.payBill({
        category: selectedCategory.id,
        vendor: selectedVendor,
        amount: amt,
        customer_id: customerId,
      });

      // Record bill payment
      const { data: bill } = await supabase.from('bill_payments').insert({
        user_id: wallet.user_id,
        category: selectedCategory.id,
        vendor: selectedVendor,
        amount: amt,
        status: 'success',
        reference: result.reference || reference,
      }).select().single();

      // Deduct from wallet
      const newBalance = wallet.balance_cached - amt;
      await supabase.from('wallets').update({ balance_cached: newBalance }).eq('id', wallet.id);

      await supabase.from('wallet_transactions').insert({
        wallet_id: wallet.id,
        user_id: wallet.user_id,
        type: 'bill_pay',
        amount: amt,
        status: 'success',
        safe_haven_reference: result.reference || reference,
        counterparty: { vendor: selectedVendor, category: selectedCategory.id, customer_id: customerId },
      });

      setSuccess(`Payment of ${formatNaira(amt)} to ${selectedVendor} was successful.`);
      setAmount(''); setCustomerId('');
      setWallet({ ...wallet, balance_cached: newBalance });
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed. Please try again.');
    }
    setLoading(false);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Pay Bills</h1>

      {wallet && (
        <div className="p-4 bg-cream rounded-lg border text-sm text-gray-600">
          Available balance: <span className="font-semibold text-forest-green">{formatNaira(wallet.balance_cached)}</span>
        </div>
      )}

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      {success && <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{success}</div>}

      <div className="flex gap-2 overflow-x-auto pb-2">
        {categories.map((cat) => (
          <button key={cat.id} onClick={() => { setSelectedCategory(cat); setSelectedVendor(cat.vendors[0]); }} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${selectedCategory.id === cat.id ? 'bg-forest-green text-white' : 'bg-white border text-gray-600 hover:border-forest-green'}`}>
            <cat.icon size={16} />{cat.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Vendor / Provider</label>
          <select value={selectedVendor} onChange={e => setSelectedVendor(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-forest-green outline-none">
            {selectedCategory.vendors.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{selectedCategory.id === 'airtime' || selectedCategory.id === 'data' ? 'Phone Number' : 'Customer ID / Account'}</label>
          <input type="text" value={customerId} onChange={e => setCustomerId(e.target.value)} placeholder={selectedCategory.id === 'airtime' ? '0801 234 5678' : 'Enter account number'} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-forest-green outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₦)</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 5000" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-forest-green outline-none" />
          {amount && <p className="text-xs text-gray-400 mt-1">{formatNaira(Number(amount))}</p>}
        </div>
        <button onClick={handlePay} disabled={loading || !amount || !customerId} className="w-full py-3 bg-forest-green text-white rounded-lg font-semibold hover:bg-forest-green-dark transition disabled:opacity-50 flex items-center justify-center gap-2">
          {loading && <Loader2 size={18} className="animate-spin" />}{loading ? 'Processing...' : `Pay ${amount ? formatNaira(Number(amount)) : ''}`}
        </button>
      </div>
    </div>
  );
}
