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
      <h1 className="text-2xl font-bold text-brand-green mb-6">Create a Savings Pot</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Pot Type */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">Pot Type</label>
          <div className="grid grid-cols-2 gap-3">
            {potTypes.map((pt) => (
              <button
                key={pt.value}
                type="button"
                onClick={() => setType(pt.value)}
                className={`p-4 rounded-xl border text-left transition ${
                  type === pt.value
                    ? 'border-brand-lime bg-brand-lime/5 ring-2 ring-brand-lime/20'
                    : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                <div className="text-2xl mb-1">{pt.icon}</div>
                <div className="font-semibold text-sm text-stone-800">{pt.label}</div>
                <div className="text-xs text-stone-500">{pt.desc}</div>
                <div className="text-xs text-brand-green font-medium mt-1">{pt.rate}% interest</div>
              </button>
            ))}
          </div>
        </div>

        {/* Pot Name */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Pot Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Tractor Fund"
            className="w-full px-4 py-3 rounded-lg border border-stone-200 focus:border-brand-lime focus:ring-2 focus:ring-brand-lime/20 outline-none transition"
          />
        </div>

        {/* Target Amount */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Target Amount (₦)</label>
          <input
            type="number"
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
            placeholder="50000"
            className="w-full px-4 py-3 rounded-lg border border-stone-200 focus:border-brand-lime focus:ring-2 focus:ring-brand-lime/20 outline-none transition"
          />
          <p className="text-xs text-stone-400 mt-1">You can change this later</p>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="What are you saving for?"
            className="w-full px-4 py-3 rounded-lg border border-stone-200 focus:border-brand-lime focus:ring-2 focus:ring-brand-lime/20 outline-none transition"
          />
        </div>

        {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{error}</div>}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-3 border border-stone-200 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-brand-green text-white py-3 rounded-lg font-semibold hover:bg-brand-green/90 transition disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Pot'}
          </button>
        </div>
      </form>
    </div>
  );
}
