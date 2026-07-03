'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const potTypes = [
  { value: 'flex', label: 'Flex', icon: '💧', rate: 2, desc: 'Save and withdraw anytime' },
  { value: 'goal', label: 'Goal', icon: '🎯', rate: 5, desc: 'Save towards a target amount' },
  { value: 'seasonal', label: 'Seasonal', icon: '🌾', rate: 7, desc: 'Lock for planting season' },
  { value: 'stash', label: 'Stash', icon: '🔒', rate: 3, desc: 'Long-term savings' },
];

export default function CreatePotPage() {
  const [type, setType] = useState('goal');
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/auth/login');
      return;
    }

    const selectedType = potTypes.find(p => p.value === type)!;

    const { error: insertError } = await supabase.from('savings_accounts').insert({
      user_id: user.id,
      type,
      name,
      target_amount: Number(targetAmount) || 0,
      current_amount: 0,
      interest_rate: selectedType.rate,
      lock_type: type === 'flex' ? 'none' : 'until_date',
      status: 'active',
      icon: selectedType.icon,
      description,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
    } else {
      router.push('/save');
      router.refresh();
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-brand-50 mb-6">Create a Savings Pot</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Pot Type */}
        <div>
          <label className="block text-sm font-medium text-brand-200 mb-2">Pot Type</label>
          <div className="grid grid-cols-2 gap-3">
            {potTypes.map((pt) => (
              <button
                key={pt.value}
                type="button"
                onClick={() => setType(pt.value)}
                className={`p-4 rounded-xl border text-left transition ${
                  type === pt.value
                    ? 'border-brand-500 bg-brand-500/10 ring-2 ring-brand-500/20'
                    : 'border-brand-500/10 bg-brand-900 hover:border-brand-500/25'
                }`}
              >
                <div className="text-2xl mb-1">{pt.icon}</div>
                <div className="font-semibold text-sm text-brand-50">{pt.label}</div>
                <div className="text-xs text-brand-300/60">{pt.desc}</div>
                <div className="text-xs text-brand-400 font-medium mt-1">{pt.rate}% interest</div>
              </button>
            ))}
          </div>
        </div>

        {/* Pot Name */}
        <div>
          <label className="block text-sm font-medium text-brand-200 mb-1">Pot Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Tractor Fund"
            className="w-full px-4 py-3 rounded-lg border border-brand-500/15 bg-brand-900 text-brand-50 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition"
          />
        </div>

        {/* Target Amount */}
        <div>
          <label className="block text-sm font-medium text-brand-200 mb-1">Target Amount (₦)</label>
          <input
            type="number"
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
            placeholder="50000"
            className="w-full px-4 py-3 rounded-lg border border-brand-500/15 bg-brand-900 text-brand-50 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition"
          />
          <p className="text-xs text-brand-300/40 mt-1">You can change this later</p>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-brand-200 mb-1">Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="What are you saving for?"
            className="w-full px-4 py-3 rounded-lg border border-brand-500/15 bg-brand-900 text-brand-50 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition"
          />
        </div>

        {error && <div className="bg-red-500/10 text-red-400 text-sm p-3 rounded-lg border border-red-500/20">{error}</div>}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-3 border border-brand-500/15 rounded-lg text-sm font-medium text-brand-200 hover:bg-brand-900 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-brand-500 text-brand-950 py-3 rounded-lg font-semibold hover:bg-brand-400 transition disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Pot'}
          </button>
        </div>
      </form>
    </div>
  );
}
