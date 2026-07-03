import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Users, ArrowLeft } from 'lucide-react';
import JoinButton from './join-button';

export default async function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  // Fetch group
  const { data: group } = await supabase
    .from('savings_groups')
    .select('*')
    .eq('id', id)
    .single();

  if (!group) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-center">
        <p className="text-stone-500">Group not found.</p>
        <Link href="/groups" className="text-brand-lime mt-4 inline-block">← Back to groups</Link>
      </div>
    );
  }

  // Fetch members with profiles
  const { data: members } = await supabase
    .from('group_members')
    .select(`
      *,
      profiles!group_members_user_id_fkey(full_name)
    `)
    .eq('group_id', id)
    .order('slot_position', { ascending: true });

  // Fetch contributions
  const { data: contributions } = await supabase
    .from('group_contributions')
    .select(`
      *,
      profiles!group_contributions_user_id_fkey(full_name)
    `)
    .eq('group_id', id)
    .order('created_at', { ascending: false });

  // Check if current user is a member
  const isMember = members?.some((m: any) => m.user_id === user.id);
  const isAdmin = group.admin_id === user.id;
  const isFull = group.member_count >= group.max_members;

  const totalContributed = contributions
    ?.filter((c: any) => c.status === 'verified')
    .reduce((sum: number, c: any) => sum + Number(c.amount), 0) || 0;

  const currentCycleContribs = contributions?.filter(
    (c: any) => c.cycle_number === group.current_cycle && c.status === 'verified'
  ) || [];

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto">
      <Link href="/groups" className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to groups
      </Link>

      {/* Group Header */}
      <div className="bg-white border border-brand-border rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-brand-green">{group.name}</h1>
            <p className="text-sm text-stone-500 mt-1">{group.description || 'No description'}</p>
          </div>
          <span className={`text-xs px-3 py-1 rounded-full font-medium ${
            group.status === 'active' ? 'bg-green-100 text-green-700' :
            group.status === 'recruiting' ? 'bg-yellow-100 text-yellow-700' :
            'bg-stone-100 text-stone-600'
          }`}>
            {group.status}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4">
          <div>
            <p className="text-xs text-stone-500">Contribution</p>
            <p className="font-semibold text-stone-800">₦{Number(group.contribution_amount).toLocaleString()}</p>
            <p className="text-xs text-stone-400">per {group.frequency}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Members</p>
            <p className="font-semibold text-stone-800">{group.member_count}/{group.max_members}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Cycle</p>
            <p className="font-semibold text-stone-800">{group.current_cycle}/{group.total_cycles}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-stone-500 mb-1">
            <span>Members joined</span>
            <span>{Math.round((group.member_count / group.max_members) * 100)}%</span>
          </div>
          <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-lime rounded-full"
              style={{ width: `${(group.member_count / group.max_members) * 100}%` }}
            />
          </div>
        </div>

        {/* Join button */}
        {!isMember && !isFull && group.status === 'recruiting' && (
          <div className="mt-4">
            <JoinButton groupId={group.id} />
          </div>
        )}
        {isMember && (
          <div className="mt-4 bg-brand-lime/10 border border-brand-lime/20 rounded-lg p-3">
            <p className="text-sm text-brand-green font-medium">✓ You're a member of this group</p>
          </div>
        )}
      </div>

      {/* Pool stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-brand-border rounded-xl p-5">
          <p className="text-xs text-stone-500">Total Pool</p>
          <p className="text-2xl font-bold text-brand-green mt-1">₦{totalContributed.toLocaleString()}</p>
        </div>
        <div className="bg-white border border-brand-border rounded-xl p-5">
          <p className="text-xs text-stone-500">This Cycle</p>
          <p className="text-2xl font-bold text-stone-800 mt-1">
            {currentCycleContribs.length}/{group.member_count}
          </p>
          <p className="text-xs text-stone-400">contributions</p>
        </div>
      </div>

      {/* Members */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-stone-800 mb-4">Members ({members?.length || 0})</h2>
        <div className="bg-white border border-brand-border rounded-xl divide-y divide-stone-100">
          {members?.map((m: any) => (
            <div key={m.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-brand-green/10 flex items-center justify-center">
                  <span className="text-brand-green font-medium text-sm">
                    {(m.profiles?.full_name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-800">
                    {m.profiles?.full_name || 'Unknown'}
                    {m.user_id === group.admin_id && <span className="text-xs text-brand-lime ml-2">Admin</span>}
                  </p>
                  <p className="text-xs text-stone-500">Slot #{m.slot_position}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {m.has_received_payout && (
                  <span className="text-xs text-[#f5b800] font-medium">✓ Paid out</span>
                )}
                {m.slot_position === group.current_cycle && !m.has_received_payout && (
                  <span className="text-xs bg-brand-lime/20 text-brand-green px-2 py-1 rounded-full font-medium">
                    Current recipient
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contributions */}
      <div>
        <h2 className="text-lg font-semibold text-stone-800 mb-4">Recent Contributions</h2>
        {!contributions || contributions.length === 0 ? (
          <div className="bg-white border border-brand-border rounded-xl p-8 text-center">
            <p className="text-stone-400 text-sm">No contributions yet. Group starts when full.</p>
          </div>
        ) : (
          <div className="bg-white border border-brand-border rounded-xl divide-y divide-stone-100">
            {contributions.slice(0, 10).map((c: any) => (
              <div key={c.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium text-stone-800">{c.profiles?.full_name || 'Unknown'}</p>
                  <p className="text-xs text-stone-500">Cycle {c.cycle_number}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-stone-800">₦{Number(c.amount).toLocaleString()}</p>
                  <span className={`text-xs ${
                    c.status === 'verified' ? 'text-green-600' :
                    c.status === 'pending' ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>{c.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
