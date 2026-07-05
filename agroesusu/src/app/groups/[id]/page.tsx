import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { UsersIcon, ArrowLeftIcon, CheckIcon } from '@/components/icons';
import JoinButton from './join-button';
import ShareGroupButton from './share-button';

export default async function GroupDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ invite?: string }> }) {
  const { id } = await params;
  const { invite } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // If they came via an invite link, redirect to register with the return path
    const redirectPath = invite
      ? `/auth/register?redirect=${encodeURIComponent(`/groups/${id}?invite=${invite}`)}`
      : `/auth/login?redirect=${encodeURIComponent(`/groups/${id}`)}`;
    redirect(redirectPath);
  }

  const [
    { data: group },
    { data: members },
    { data: contributions },
  ] = await Promise.all([
    supabase.from('savings_groups').select('*').eq('id', id).single(),
    supabase
      .from('group_members')
      .select(`*, profiles!group_members_user_id_fkey(full_name)`)
      .eq('group_id', id)
      .order('slot_position', { ascending: true }),
    supabase
      .from('group_contributions')
      .select(`*, profiles!group_contributions_user_id_fkey(full_name)`)
      .eq('group_id', id)
      .order('created_at', { ascending: false }),
  ]);

  if (!group) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-center">
        <p style={{ color: "var(--text-muted)" }}>Group not found.</p>
        <Link href="/groups" className="mt-4 inline-block" style={{ color: "var(--accent)" }}>← Back to groups</Link>
      </div>
    );
  }

  const isMember = members?.some((m: any) => m.user_id === user.id);
  const isAdmin = group.admin_id === user.id;
  const isFull = group.member_count >= group.max_members;
  const validInvite = invite && group.invite_token && invite === group.invite_token;

  const totalContributed = contributions
    ?.filter((c: any) => c.status === 'verified')
    .reduce((sum: number, c: any) => sum + Number(c.amount), 0) || 0;

  const currentCycleContribs = contributions?.filter(
    (c: any) => c.cycle_number === group.current_cycle && c.status === 'verified'
  ) || [];

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto">
      <Link href="/groups" className="inline-flex items-center gap-1 text-sm mb-4" style={{ color: "var(--text-muted)" }}>
        <ArrowLeftIcon className="w-4 h-4" /> Back to groups
      </Link>

      <div className="rounded-xl p-6 mb-6 border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{group.name}</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{group.description || 'No description'}</p>
          </div>
          <span className="text-xs px-3 py-1 rounded-full font-medium capitalize"
            style={{
              background: group.status === 'active' ? "var(--accent-subtle)" : group.status === 'recruiting' ? "rgba(245,184,0,0.12)" : "var(--surface-elevated)",
              color: group.status === 'active' ? "var(--accent)" : group.status === 'recruiting' ? "var(--color-brand-gold)" : "var(--text-muted)",
            }}>
            {group.status}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4">
          <div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Contribution</p>
            <p className="font-semibold" style={{ color: "var(--text-secondary)" }}>₦{Number(group.contribution_amount).toLocaleString()}</p>
            <p className="text-xs" style={{ color: "var(--text-faint)" }}>per {group.frequency}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Members</p>
            <p className="font-semibold" style={{ color: "var(--text-secondary)" }}>{group.member_count}/{group.max_members}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Cycle</p>
            <p className="font-semibold" style={{ color: "var(--text-secondary)" }}>{group.current_cycle}/{group.total_cycles}</p>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-xs mb-1" style={{ color: "var(--text-muted)" }}>
            <span>Members joined</span>
            <span>{Math.round((group.member_count / group.max_members) * 100)}%</span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-elevated)" }}>
            <div className="h-full rounded-full" style={{ width: `${(group.member_count / group.max_members) * 100}%`, background: "var(--accent)" }} />
          </div>
        </div>

        {/* Invite banner for invite link visitors */}
        {validInvite && !isMember && !isFull && group.status === 'recruiting' && (
          <div className="mt-4 rounded-lg p-3 border" style={{ background: "var(--accent-subtle)", borderColor: "var(--accent)" }}>
            <p className="text-sm font-medium" style={{ color: "var(--accent)" }}>
              You&apos;ve been invited to join this group!
            </p>
          </div>
        )}

        {/* Join button */}
        {!isMember && !isFull && group.status === 'recruiting' && (
          <div className="mt-4"><JoinButton groupId={group.id} /></div>
        )}

        {/* Member badge */}
        {isMember && (
          <div className="mt-4 rounded-lg p-3 border flex items-center gap-1.5" style={{ background: "var(--accent-subtle)", borderColor: "var(--border-default)" }}>
            <CheckIcon className="w-4 h-4" style={{ color: "var(--accent)" }} strokeWidth={2.5} />
            <p className="text-sm font-medium" style={{ color: "var(--accent)" }}>You&apos;re a member of this group</p>
          </div>
        )}

        {/* Admin share tools */}
        {isAdmin && group.status === 'recruiting' && group.invite_token && (
          <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--border-subtle)" }}>
            <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>Invite members</p>
            <ShareGroupButton
              groupName={group.name}
              contributionAmount={Number(group.contribution_amount)}
              frequency={group.frequency}
              inviteToken={group.invite_token}
              groupId={group.id}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl p-5 border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Total Pool</p>
          <p className="text-2xl font-bold mt-1" style={{ color: "var(--accent)" }}>₦{totalContributed.toLocaleString()}</p>
        </div>
        <div className="rounded-xl p-5 border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>This Cycle</p>
          <p className="text-2xl font-bold mt-1" style={{ color: "var(--text-secondary)" }}>
            {currentCycleContribs.length}/{group.member_count}
          </p>
          <p className="text-xs" style={{ color: "var(--text-faint)" }}>contributions</p>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Members ({members?.length || 0})</h2>
        <div className="rounded-xl border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
          {members?.map((m: any, i: number) => (
            <div key={m.id} className="flex items-center justify-between p-4" style={{ borderBottom: i < (members?.length || 0) - 1 ? "1px solid var(--border-subtle)" : "none" }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "var(--accent-subtle)" }}>
                  <span className="font-medium text-sm" style={{ color: "var(--accent)" }}>
                    {(m.profiles?.full_name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                    {m.profiles?.full_name || 'Unknown'}
                    {m.user_id === group.admin_id && <span className="text-xs ml-2" style={{ color: "var(--accent)" }}>Admin</span>}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>Slot #{m.slot_position}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {m.has_received_payout && (
                  <span className="text-xs font-medium flex items-center gap-1" style={{ color: "var(--color-brand-gold)" }}>
                    <CheckIcon className="w-3 h-3" strokeWidth={3} />
                    Paid out
                  </span>
                )}
                {m.slot_position === group.current_cycle && !m.has_received_payout && (
                  <span className="text-xs px-2 py-1 rounded-full font-medium"
                    style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}>
                    Current recipient
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Recent Contributions</h2>
        {!contributions || contributions.length === 0 ? (
          <div className="rounded-xl p-8 text-center border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>No contributions yet. Group starts when full.</p>
          </div>
        ) : (
          <div className="rounded-xl border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
            {contributions.slice(0, 10).map((c: any, i: number) => (
              <div key={c.id} className="flex items-center justify-between p-4" style={{ borderBottom: i < Math.min(contributions.length, 10) - 1 ? "1px solid var(--border-subtle)" : "none" }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{c.profiles?.full_name || 'Unknown'}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>Cycle {c.cycle_number}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>₦{Number(c.amount).toLocaleString()}</p>
                  <span className="text-xs" style={{
                    color: c.status === 'verified' ? "var(--accent)" : c.status === 'pending' ? "var(--color-brand-gold)" : "var(--danger)",
                  }}>{c.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
