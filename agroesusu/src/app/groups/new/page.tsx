'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function CreateGroupPage() {
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

    // Create group
    const { data: group, error: groupError } = await supabase.from('savings_groups').insert({
      name,
      admin_id: user.id,
      contribution_amount: Number(contributionAmount),
      frequency,
      max_members: Number(maxMembers),
      total_cycles: Number(maxMembers),
      status: 'recruiting',
      description,
    }).select().single();

    if (groupError) {
      setError(groupError.message);
      setLoading(false);
      return;
    }

    // Add creator as first member
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

    router.push('/groups');
    router.refresh();
  };

  return (
    <div className="p-4 lg:p-8 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-brand-green mb-6">Create an Esusu Group</h1>

      <div className="bg-brand-lime/5 border border-brand-lime/20 rounded-lg p-3 mb-6">
        <p className="text-xs text-stone-600">
          💡 <strong>How Esusu works:</strong> Members contribute a fixed amount each cycle. 
          One member receives the total pool each cycle, rotating until everyone gets paid.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Group Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Agro Farmers Cooperative"
            className="w-full px-4 py-3 rounded-lg border border-stone-200 focus:border-brand-lime focus:ring-2 focus:ring-brand-lime/20 outline-none transition"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Contribution Amount (₦)</label>
          <input
            type="number"
            value={contributionAmount}
            onChange={(e) => setContributionAmount(e.target.value)}
            required
            placeholder="5000"
            className="w-full px-4 py-3 rounded-lg border border-stone-200 focus:border-brand-lime focus:ring-2 focus:ring-brand-lime/20 outline-none transition"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Frequency</label>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-stone-200 focus:border-brand-lime focus:ring-2 focus:ring-brand-lime/20 outline-none transition bg-white"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Max Members</label>
          <input
            type="number"
            value={maxMembers}
            onChange={(e) => setMaxMembers(e.target.value)}
            required
            min="2"
            max="20"
            className="w-full px-4 py-3 rounded-lg border border-stone-200 focus:border-brand-lime focus:ring-2 focus:ring-brand-lime/20 outline-none transition"
          />
          <p className="text-xs text-stone-400 mt-1">Each member gets one payout cycle. 2-20 members.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="What is this group for?"
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
            {loading ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </form>
    </div>
  );
}
