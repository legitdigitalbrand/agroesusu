'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { DropletIcon, TargetIcon, LockIcon } from '@/components/icons';

const potTypes = [
  { value: 'agroflex', label: 'AgroFlex', Icon: DropletIcon, desc: 'Save and withdraw anytime' },
  { value: 'agrogoal', label: 'AgroGoal', Icon: TargetIcon, desc: 'Save towards a target amount' },
  { value: 'harvestlock', label: 'HarvestLock', Icon: LockIcon, desc: 'Lock funds for a harvest cycle (3/6/12 months)' },
];

const lockDurations = [
  { value: 3, label: '3 months', desc: 'Short planting cycle' },
  { value: 6, label: '6 months', desc: 'Mid-season lock' },
  { value: 12, label: '12 months', desc: 'Full harvest cycle' },
];

export default function CreatePotPage() {
  const [type, setType] = useState('agrogoal');
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [lockType, setLockType] = useState<'none' | 'soft' | 'hard'>('none');
  const [lockDuration, setLockDuration] = useState(3);
  const [description, setDescription] = useState('');
  const [roundUpEnabled, setRoundUpEnabled] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [autoSaveAmount, setAutoSaveAmount] = useState('');
  const [autoSaveFrequency, setAutoSaveFrequency] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
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

    const { data, error: insertError } = await supabase.from('savings_accounts').insert({
      user_id: user.id,
      type,
      name,
      target_amount: Number(targetAmount) || 0,
      current_amount: 0,
      interest_rate: 0, // No interest displayed until Safe Haven confirms interest-bearing products
      lock_type: type === 'agroflex' ? 'none' : lockType,
      unlock_date: type !== 'agroflex' && targetDate ? new Date(targetDate).toISOString() : null,
      lock_duration_months: type === 'harvestlock' ? lockDuration : null,
      status: 'active',
      icon: type,
      description,
      round_up_enabled: type === 'harvestlock' ? roundUpEnabled : false,
    }).select().single();

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    // If auto-save is enabled, kick off the card tokenization
    if (autoSaveEnabled && autoSaveAmount && data) {
      const res = await fetch('/api/autosave/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: data.id,
          amount: Number(autoSaveAmount),
          frequency: autoSaveFrequency,
        }),
      });
      const json = await res.json();
      if (json.url) {
        window.location.href = json.url;
        return;
      } else {
        setError(json.error || 'Auto-save setup failed — pot was created, you can set up auto-save later.');
        setLoading(false);
        return;
      }
    }

    router.push('/save');
    router.refresh();
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

        {type !== 'agroflex' && (
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Target Amount (₦)</label>
            <input type="number" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)}
              placeholder="50000"
              className="w-full px-4 py-3 rounded-lg border outline-none transition" style={inputStyle} />
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>You can change this later</p>
          </div>
        )}

        {type === 'harvestlock' && (
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Lock Duration</label>
            <div className="grid grid-cols-3 gap-2">
              {lockDurations.map((ld) => (
                <button key={ld.value} type="button" onClick={() => setLockDuration(ld.value)}
                  className="p-3 rounded-lg border text-left transition"
                  style={{
                    background: lockDuration === ld.value ? "var(--accent-subtle)" : "var(--surface-card)",
                    borderColor: lockDuration === ld.value ? "var(--accent)" : "var(--border-default)",
                  }}>
                  <div className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{ld.label}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{ld.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {type !== 'agroflex' && (
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { value: 'none', label: 'No lock', desc: 'Withdraw anytime' },
                    { value: 'soft', label: 'Soft lock', desc: 'Early withdrawal allowed but discouraged' },
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

        {type === 'harvestlock' && (
          <label className="flex items-center gap-3 p-4 rounded-xl border cursor-pointer" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
            <input type="checkbox" checked={roundUpEnabled} onChange={(e) => setRoundUpEnabled(e.target.checked)}
              className="w-4 h-4" />
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Round up my deposits</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Every deposit into any pot gets rounded up to the nearest ₦100 — the spare change lands here automatically.</p>
            </div>
          </label>
        )}

        {/* ── Auto-Save toggle ── */}
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border-default)" }}>
          <label className="flex items-center justify-between gap-3 p-4 cursor-pointer"
            style={{ background: "var(--surface-card)" }}>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Auto-Save</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                We charge your card automatically — daily, weekly, or monthly.
              </p>
            </div>
            <button type="button" role="switch" aria-checked={autoSaveEnabled}
              onClick={() => setAutoSaveEnabled(!autoSaveEnabled)}
              className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200"
              style={{ background: autoSaveEnabled ? "var(--qa-primary-bg)" : "var(--input-border)" }}>
              <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200"
                style={{ transform: autoSaveEnabled ? 'translateX(20px)' : 'translateX(0)' }} />
            </button>
          </label>

          {autoSaveEnabled && (
            <div className="p-4 pt-0 space-y-3" style={{ background: "var(--surface-card)" }}>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Amount (₦)</label>
                <input type="number" value={autoSaveAmount} onChange={(e) => setAutoSaveAmount(e.target.value)}
                  placeholder="5000" required={autoSaveEnabled}
                  className="w-full px-3 py-2.5 rounded-lg border outline-none text-sm" style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Frequency</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['daily', 'weekly', 'monthly'] as const).map((freq) => (
                    <button key={freq} type="button" onClick={() => setAutoSaveFrequency(freq)}
                      className="py-2 rounded-lg text-xs font-medium capitalize transition border"
                      style={{
                        background: autoSaveFrequency === freq ? "var(--accent-subtle)" : "transparent",
                        borderColor: autoSaveFrequency === freq ? "var(--accent)" : "var(--border-default)",
                        color: autoSaveFrequency === freq ? "var(--accent)" : "var(--text-muted)",
                      }}>
                      {freq}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-xl p-3 border" style={{ background: "rgba(220,53,69,0.08)", borderColor: "rgba(220,53,69,0.3)" }}>
            <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>
          </div>
        )}

        <button type="submit" disabled={loading}
          className="w-full py-3.5 rounded-xl font-semibold transition disabled:opacity-50"
          style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}>
          {loading ? 'Creating…' : 'Create Pot'}
        </button>
      </form>
    </div>
  );
}
