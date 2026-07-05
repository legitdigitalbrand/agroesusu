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

  const inputStyle = {
    background: "var(--input-bg)",
    borderColor: "var(--input-border)",
    color: "var(--text-primary)",
  };

  return (
    <div className="p-4 lg:p-8 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>Create a Savings Pot</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Pot Type</label>
          <div className="grid grid-cols-2 gap-3">
            {potTypes.map((pt) => (
              <button
                key={pt.value}
                type="button"
                onClick={() => setType(pt.value)}
                className="p-4 rounded-xl border text-left transition"
                style={{
                  background: type === pt.value ? "var(--accent-subtle)" : "var(--surface-card)",
                  borderColor: type === pt.value ? "var(--accent)" : "var(--border-default)",
                  boxShadow: type === pt.value ? "0 0 0 2px var(--accent-subtle)" : "none",
                }}
              >
                <div className="text-2xl mb-1">{pt.icon}</div>
                <div className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{pt.label}</div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>{pt.desc}</div>
                <div className="text-xs font-medium mt-1" style={{ color: "var(--accent)" }}>{pt.rate}% interest</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Pot Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
            placeholder="e.g. Tractor Fund"
            className="w-full px-4 py-3 rounded-lg border outline-none transition" style={inputStyle} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Target Amount (₦)</label>
          <input type="number" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)}
            placeholder="50000"
            className="w-full px-4 py-3 rounded-lg border outline-none transition" style={inputStyle} />
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>You can change this later</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Description (optional)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
            placeholder="What are you saving for?"
            className="w-full px-4 py-3 rounded-lg border outline-none transition" style={inputStyle} />
        </div>

        {error && (
          <div className="text-sm p-3 rounded-lg border"
            style={{ background: "rgba(255,77,109,0.1)", color: "var(--danger)", borderColor: "rgba(255,77,109,0.2)" }}>
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()}
            className="px-4 py-3 border rounded-lg text-sm font-medium transition"
            style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}>
            Cancel
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 py-3 rounded-lg font-semibold transition disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--nav-bg)" }}>
            {loading ? 'Creating...' : 'Create Pot'}
          </button>
        </div>
      </form>
    </div>
  );
}
