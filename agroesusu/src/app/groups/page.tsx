import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Users, Plus, ArrowRight } from 'lucide-react';

export default async function GroupsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  // Parallel queries
  const [
    { data: memberships },
    { data: availableGroups },
  ] = await Promise.all([
    supabase
      .from('group_members')
      .select('group_id, slot_position, status, has_received_payout, savings_groups(*)')
      .eq('user_id', user.id)
      .order('joined_date', { ascending: false }),
    supabase
      .from('savings_groups')
      .select('*')
      .eq('status', 'recruiting')
      .limit(5),
  ]);

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-50">Esusu Groups</h1>
          <p className="text-sm text-brand-300/60 mt-1">Save together, grow together</p>
        </div>
        <Link
          href="/groups/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-500 text-brand-950 rounded-lg text-sm font-semibold hover:bg-brand-400 transition"
        >
          <Plus className="w-4 h-4" />
          New Group
        </Link>
      </div>

      {/* My Groups */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-brand-50 mb-4">My Groups</h2>

        {!memberships || memberships.length === 0 ? (
          <div className="bg-brand-900 border border-brand-500/10 rounded-xl p-8 text-center">
            <Users className="w-8 h-8 text-brand-500/40 mx-auto mb-3" />
            <p className="text-brand-300/50 text-sm mb-4">You're not in any savings group yet.</p>
            <Link
              href="/groups/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 text-brand-950 rounded-lg text-sm font-semibold hover:bg-brand-400 transition"
            >
              <Plus className="w-4 h-4" />
              Create a group
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {memberships?.map((m: any) => {
              const group = m.savings_groups;
              if (!group) return null;
              const progress = Math.round((group.member_count / group.max_members) * 100);
              return (
                <Link
                  key={m.group_id}
                  href={`/groups/${group.id}`}
                  className="bg-brand-900 border border-brand-500/10 rounded-xl p-5 hover:border-brand-500/30 transition block"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-brand-50">{group.name}</h3>
                      <p className="text-xs text-brand-300/60 mt-0.5">
                        ₦{Number(group.contribution_amount).toLocaleString()}/{group.frequency}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      group.status === 'active' ? 'bg-brand-500/15 text-brand-400' :
                      group.status === 'recruiting' ? 'bg-brand-gold/15 text-brand-gold' :
                      'bg-brand-500/10 text-brand-300/60'
                    }`}>
                      {group.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-brand-300/60 mb-2">
                    <Users className="w-3.5 h-3.5" />
                    {group.member_count}/{group.max_members} members
                  </div>

                  <div className="w-full h-2 bg-brand-950 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between mt-3 text-xs">
                    <span className="text-brand-300/60">Your slot: #{m.slot_position}</span>
                    {m.has_received_payout && (
                      <span className="text-brand-gold font-medium">✓ Payout received</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Available Groups */}
      {availableGroups && availableGroups.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-brand-50 mb-4">Open Groups</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {availableGroups.map((group) => {
              const progress = Math.round((group.member_count / group.max_members) * 100);
              return (
                <Link
                  key={group.id}
                  href={`/groups/${group.id}`}
                  className="bg-brand-900 border border-brand-500/10 rounded-xl p-5 hover:border-brand-500/30 transition block"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-brand-50">{group.name}</h3>
                      <p className="text-xs text-brand-300/60 mt-0.5">
                        ₦{Number(group.contribution_amount).toLocaleString()}/{group.frequency}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-brand-500/40" />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-brand-300/60 mb-2">
                    <Users className="w-3.5 h-3.5" />
                    {group.member_count}/{group.max_members} members
                  </div>
                  <div className="w-full h-2 bg-brand-950 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
