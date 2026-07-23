'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatNaira } from '@/lib/format';

export default function NewCirclePage() {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState('weekly');
  const [members, setMembers] = useState('5');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleCreate() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from('savings_circles').insert({
        name,
        owner_id: user.id,
        contribution_amount: parseFloat(amount),
        frequency,
        member_count: parseInt(members),
        payout_order_json: { order: [] },
        status: 'active',
      });

      if (!error) router.push('/savings');
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Create Esusu Circle</h1>
      <div className="bg-white rounded-2xl border p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Circle Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Harvest Savers" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-forest-green outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contribution Amount (₦)</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 5000" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-forest-green outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
          <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-forest-green outline-none">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Number of Members</label>
          <input type="number" value={members} onChange={(e) => setMembers(e.target.value)} min={2} max={20} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-forest-green outline-none" />
        </div>
        {amount && members && (
          <div className="p-4 bg-cream rounded-lg border text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Total pool per cycle</span><span className="font-medium">{formatNaira(Number(amount) * Number(members))}</span></div>
          </div>
        )}
        <button onClick={handleCreate} disabled={loading || !name || !amount} className="w-full py-3 bg-forest-green text-white rounded-lg font-semibold hover:bg-forest-green-dark transition disabled:opacity-50 flex items-center justify-center gap-2">
          {loading && <Loader2 size={18} className="animate-spin" />}
          Create Circle
        </button>
      </div>
    </div>
  );
}
