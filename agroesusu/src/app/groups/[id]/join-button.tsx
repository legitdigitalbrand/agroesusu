'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function JoinButton({ groupId }: { groupId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const supabase = createClient();

  const handleJoin = async () => {
    setLoading(true);
    setError('');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/auth/login');
      return;
    }

    const { data: group } = await supabase
      .from('savings_groups')
      .select('member_count, max_members')
      .eq('id', groupId)
      .single();

    if (!group) {
      setError('Group not found');
      setLoading(false);
      return;
    }

    if (group.member_count >= group.max_members) {
      setError('This group is full');
      setLoading(false);
      return;
    }

    const { error: memberError } = await supabase.from('group_members').insert({
      group_id: groupId,
      user_id: user.id,
      slot_position: group.member_count + 1,
      status: 'active',
      invited_by: user.id,
    });

    if (memberError) {
      setError(memberError.message);
      setLoading(false);
      return;
    }

    await supabase.from('savings_groups').update({
      member_count: group.member_count + 1,
      status: group.member_count + 1 >= group.max_members ? 'active' : 'recruiting',
    }).eq('id', groupId);

    router.refresh();
  };

  if (error) {
    return (
      <div>
        <p className="text-sm mb-2" style={{ color: "var(--danger)" }}>{error}</p>
        <button
          onClick={handleJoin}
          disabled={loading}
          className="px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50"
          style={{ background: "var(--accent)", color: "var(--nav-bg)" }}
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleJoin}
      disabled={loading}
      className="w-full py-3 rounded-lg font-semibold transition disabled:opacity-50"
      style={{ background: "var(--accent)", color: "var(--nav-bg)" }}
    >
      {loading ? 'Joining...' : 'Join Group'}
    </button>
  );
}
