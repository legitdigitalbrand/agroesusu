'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatNaira } from '@/lib/format';

export default function NewFixedDepositPage() {
  const [principal, setPrincipal] = useState('');
  const [term, setTerm] = useState(90);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const rate = 12;
  const interest = (Number(principal) * rate * term) / (365 * 100);
  const maturity = Number(principal) + interest;

  async function handleCreate() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('Not authenticated'); return; }
      const maturityDate = new Date();
      maturityDate.setDate(maturityDate.getDate() + term);
      const { error: insertError } = await supabase.from('fixed_deposits').insert({
        user_id: user.id,
        principal: parseFloat(principal),
        interest_rate: rate,
        term_days: term,
        maturity_date: maturityDate.toISOString().split('T')[0],
        status: 'active',
      });
      if (insertError) throw insertError;
      router.push('/savings');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create deposit');
    }
    setLoading(false);
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">New Fixed Deposit</h1>
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      <div className="bg-white rounded-2xl border p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Principal Amount (₦)</label>
          <input type="number" value={principal} onChange={(e) => setPrincipal(e.target.value)} placeholder="e.g. 100000" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-forest-green outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Term: {term} days</label>
          <input type="range" min={30} max={365} step={30} value={term} onChange={(e) => setTerm(Number(e.target.value))} className="w-full accent-forest-green" />
        </div>
        <div className="p-4 bg-cream rounded-lg border text-sm space-y-2">
          <div className="flex justify-between"><span className="text-gray-500">Interest rate</span><span className="font-medium">{rate}% p.a.</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Expected interest</span><span className="font-medium">{formatNaira(interest)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Maturity value</span><span className="font-semibold text-forest-green">{formatNaira(maturity)}</span></div>
        </div>
        <button onClick={handleCreate} disabled={loading || !principal} className="w-full py-3 bg-forest-green text-white rounded-lg font-semibold hover:bg-forest-green-dark transition disabled:opacity-50 flex items-center justify-center gap-2">
          {loading && <Loader2 size={18} className="animate-spin" />}
          Start Deposit
        </button>
      </div>
    </div>
  );
}
