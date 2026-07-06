'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { DropletIcon, TargetIcon, WheatIcon, LockIcon } from '@/components/icons';

const potTypes = [
  { value: 'flex', label: 'Flex', Icon: DropletIcon, rate: 2, desc: 'Save and withdraw anytime' },
  { value: 'goal', label: 'Goal', Icon: TargetIcon, rate: 5, desc: 'Save towards a target amount' },
  { value: 'seasonal', label: 'Seasonal', Icon: WheatIcon, rate: 7, desc: 'Lock for planting season' },
  { value: 'stash', label: 'Stash', Icon: LockIcon, rate: 3, desc: 'Long-term savings' },
];

export default function CreatePotPage() {
  const [type, setType] = useState('goal');
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [lockType, setLockType] = useState<'none' | 'soft' | 'hard'>('none');
  const [description, setDescription] = useState('');
  const [roundUpEnabled, setRoundUpEnabled] = useState(false);
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
      lock_type: type === 'flex' ? 'none' : lockType,
      unlock_date: type !== 'flex' && targetDate ? new Date(targetDate).toISOString() : null,
      status: 'active',
      icon: selectedType.value, // store type key, not emoji — rendered as SVG
      description,
      round_up_enabled: type === 'stash' ? roundUpEnabled : false,
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
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2" style={{ background: "var(--pot-icon-bg)" }}>
                  <pt.Icon style={{ width: 18, height: 18, color: "var(--qa-icon-color)" }} />
                </div>
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

        {type !== 'flex' && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Target Date (optional)</label>
              <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 rounded-lg border outline-none transition" style={inputStyle} />
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Set a date to enable locking this pot.</p>
            </div>

            {targetDate && (
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Lock Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'none', label: 'No lock', desc: 'Withdraw anytime' },
                    { value: 'soft', label: 'Soft lock', desc: 'Early withdrawal forfeits interest' },
                    { value: 'hard', label: 'Hard lock', desc: 'Locked until target date' },
                  ].map((lt) => (
                    <button key={lt.value} type="button" onClick={() => setLockType(lt.value as any)}
                      className="p-3 rounded-lg border text-left transition"
                      style={{
                        background: lockType === lt.value ? "var(--accent-subtle)" : "var(--surface-card)",
                        borderColor: lockType === lt.value ? "var(--accent)" : "var(--border-default)",
                      }}>
                      <div className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{lt.label}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{lt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Description (optional)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
            placeholder="What are you saving for?"
            className="w-full px-4 py-3 rounded-lg border outline-none transition" style={inputStyle} />
        </div>

        {type === 'stash' && (
          <label className="flex items-center gap-3 p-4 rounded-xl border cursor-pointer" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
            <input type="checkbox" checked={roundUpEnabled} onChange={(e) => setRoundUpEnabled(e.target.checked)}
              className="w-4 h-4" />
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Round up my deposits</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Every deposit into any pot gets rounded up to the nearest ₦100 — the spare change lands here automatically.</p>
            </div>
          </label>
        )}

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
            style={{ background: "var(--accent)", color: "var(--qa-primary-text)" }}>
            {loading ? 'Creating...' : 'Create Pot'}
          </button>
        </div>
      </form>
    </div>
  );
}
