'use client';

import { useState } from 'react';
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
  const [success, setSuccess] = useState(false);

  async function handlePay() {
    setLoading(true);
    setSuccess(false);
    // Simulate payment processing
    await new Promise(r => setTimeout(r, 1500));
    setLoading(false);
    setSuccess(true);
    setAmount('');
    setCustomerId('');
    setTimeout(() => setSuccess(false), 3000);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Pay Bills</h1>

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm font-medium">
          ✓ Payment successful! Your transaction has been processed.
        </div>
      )}

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => { setSelectedCategory(cat); setSelectedVendor(cat.vendors[0]); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              selectedCategory.id === cat.id ? 'bg-forest-green text-white' : 'bg-white border text-gray-600 hover:border-forest-green'
            }`}
          >
            <cat.icon size={16} />
            {cat.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Vendor / Provider</label>
          <select
            value={selectedVendor}
            onChange={(e) => setSelectedVendor(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-forest-green outline-none"
          >
            {selectedCategory.vendors.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{selectedCategory.id === 'airtime' || selectedCategory.id === 'data' ? 'Phone Number' : 'Customer ID / Account'}</label>
          <input
            type="text"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            placeholder={selectedCategory.id === 'airtime' ? '0801 234 5678' : 'Enter account number'}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-forest-green outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₦)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 5000"
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-forest-green outline-none"
          />
          {amount && <p className="text-xs text-gray-400 mt-1">{formatNaira(Number(amount))}</p>}
        </div>
        <button
          onClick={handlePay}
          disabled={loading || !amount || !customerId}
          className="w-full py-3 bg-forest-green text-white rounded-lg font-semibold hover:bg-forest-green-dark transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 size={18} className="animate-spin" />}
          {loading ? 'Processing...' : `Pay ${amount ? formatNaira(Number(amount)) : ''}`}
        </button>
      </div>
    </div>
  );
}
