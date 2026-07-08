'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { InfoIcon } from '@/components/icons';

function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 8; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

export default function CreateGroupPage() {
  const [groupType, setGroupType] = useState<'esusu' | 'emergency'>('esusu');
  const [name, setName] = useState('');
  const [contributionAmount, setContributionAmount] = useState('');
  const [frequency, setFrequency] = useState('weekly');
  const [maxMembers, setMaxMembers] = useState('10');
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

    const inviteToken = generateToken();

    const { data: group, error: groupError } = await supabase.from('savings_groups').insert({
      name,
      admin_id: user.id,
      type: groupType,
      contribution_amount: Number(contributionAmount),
      frequency,
      max_members: Number(maxMembers),
      total_cycles: groupType === 'emergency' ? 0 : Number(maxMembers),
      status: 'recruiting',
      description,
      invite_token: inviteToken,
    }).select().single();

    if (groupError) {
      setError(groupError.message);
      setLoading(false);
      return;
    }

    const { error: memberError } = await supabase.from('group_members').insert({
      group_id: group.id,
      user_id: user.id,
      slot_position: 1,
      status: 'active',
      invited_by: user.id,
    });

    if (memberError) {
      setError(memberError.message);
      setLoading(false);
      return;
    }

    router.push(`/groups/${group.id}?invite=${inviteToken}`);
    router.refresh();
  };

  const inputStyle = {
    background: "var(--input-bg)",
    borderColor: "var(--input-border)",
    color: "var(--text-primary)",
  };

  return (
    <div className="p-4 lg:p-8 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>Create a Group</h1>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <button type="button" onClick={() => setGroupType('esusu')}
          className="p-4 rounded-xl border text-left transition"
          style={{
            background: groupType === 'esusu' ? "var(--accent-subtle)" : "var(--surface-card)",
            borderColor: groupType === 'esusu' ? "var(--accent)" : "var(--border-default)",
          }}>
          <div className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Esusu Cycle</div>
          <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Rotating payout — everyone contributes, one member gets the pool each cycle</div>
        </button>
        <button type="button" onClick={() => setGroupType('emergency')}
          className="p-4 rounded-xl border text-left transition"
          style={{
            background: groupType === 'emergency' ? "var(--accent-subtle)" : "var(--surface-card)",
            borderColor: groupType === 'emergency' ? "var(--accent)" : "var(--border-default)",
          }}>
          <div className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Emergency Fund</div>
          <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Shared safety-net pool — members request funds, group votes to approve</div>
        </button>
      </div>

      <div className="rounded-lg p-3 mb-6 border flex items-start gap-2" style={{ background: "var(--accent-subtle)", borderColor: "var(--border-default)" }}>
        <InfoIcon className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {groupType === 'esusu'
            ? <><strong>How Esusu works:</strong> Members contribute a fixed amount each cycle. One member receives the total pool each cycle, rotating until everyone gets paid.</>
            : <><strong>How Emergency Funds work:</strong> Members contribute regularly to a shared pool. Anyone can request funds for an emergency, and the group votes to approve or deny.</>}
          {' '}After creating, you&apos;ll get a shareable link to invite members.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Group Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
            placeholder="e.g. Agro Farmers Cooperative"
            className="w-full px-4 py-3 rounded-lg border outline-none transition" style={inputStyle} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Contribution Amount (₦)</label>
          <input type="number" value={contributionAmount} onChange={(e) => setContributionAmount(e.target.value)} required
            placeholder="5000"
            className="w-full px-4 py-3 rounded-lg border outline-none transition" style={inputStyle} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Frequency</label>
          <select value={frequency} onChange={(e) => setFrequency(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border outline-none transition" style={inputStyle}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Max Members</label>
          <input type="number" value={maxMembers} onChange={(e) => setMaxMembers(e.target.value)} required
            min="2" max="20"
            className="w-full px-4 py-3 rounded-lg border outline-none transition" style={inputStyle} />
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Each member gets one payout cycle. 2-20 members.</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Description (optional)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
            placeholder="What is this group for?"
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
            style={{ background: "var(--qa-primary-bg)", color: "var(--qa-primary-text)" }}>
            {loading ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </form>
    </div>
  );
}
