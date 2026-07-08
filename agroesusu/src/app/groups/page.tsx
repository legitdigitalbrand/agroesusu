import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { UsersIcon, PlusIcon, ChevronRightIcon, CheckIcon } from '@/components/icons';
import { PageHero, PageBody } from '@/components/ui/page-hero';
import { formatNaira } from '@/lib/utils';

export default async function GroupsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

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

  const myGroupTotalPool = (memberships || []).reduce((sum: number, m: any) => sum + Number(m.savings_groups?.total_pool || 0), 0);

  return (
    <div>
      <PageHero>
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs font-semibold tracking-wide" style={{ color: "var(--hero-pill-bg)" }}>ESUSU GROUPS</p>
            <h1 className="text-xl font-bold mt-0.5" style={{ color: "var(--hero-text)" }}>Save together, grow together</h1>
          </div>
          <Link
            href="/groups/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition shrink-0"
            style={{ background: "var(--hero-pill-bg)", color: "var(--hero-pill-text)" }}
          >
            <PlusIcon className="w-4 h-4" />
            New Group
          </Link>
        </div>
        <div className="flex items-center gap-8">
          <div>
            <p className="text-xs" style={{ color: "var(--hero-text-muted)" }}>Combined group pool</p>
            <p className="text-3xl font-extrabold mt-1" style={{ color: "var(--hero-text)" }}>{formatNaira(myGroupTotalPool)}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: "var(--hero-text-muted)" }}>Groups joined</p>
            <p className="text-3xl font-extrabold mt-1" style={{ color: "var(--hero-text)" }}>{memberships?.length || 0}</p>
          </div>
        </div>
      </PageHero>

      <PageBody>
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>My Groups</h2>

        {!memberships || memberships.length === 0 ? (
          <div className="rounded-xl p-8 text-center border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
            <UsersIcon className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--text-faint)" }} />
            <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>You&apos;re not in any savings group yet.</p>
            <Link
              href="/groups/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition"
              style={{ background: "var(--qa-primary-bg)", color: "var(--qa-primary-text)" }}
            >
              <PlusIcon className="w-4 h-4" />
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
                  className="rounded-xl p-5 border transition block"
                  style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate" style={{ color: "var(--text-primary)" }}>{group.name}</h3>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {formatNaira(Number(group.contribution_amount))}/{group.frequency}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full font-medium capitalize shrink-0"
                      style={{
                        background: group.status === 'active' ? "var(--accent-subtle)" : group.status === 'recruiting' ? "rgba(245,184,0,0.12)" : "var(--surface-elevated)",
                        color: group.status === 'active' ? "var(--accent)" : group.status === 'recruiting' ? "var(--color-brand-gold)" : "var(--text-muted)",
                      }}>
                      {group.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs mb-2" style={{ color: "var(--text-muted)" }}>
                    <UsersIcon className="w-3.5 h-3.5" />
                    {group.member_count}/{group.max_members} members
                  </div>

                  <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-elevated)" }}>
                    <div className="h-full rounded-full" style={{ width: `${progress}%`, background: "var(--progress-fill)" }} />
                  </div>

                  <div className="flex items-center justify-between mt-3 text-xs">
                    <span style={{ color: "var(--text-muted)" }}>Your slot: #{m.slot_position}</span>
                    {m.has_received_payout && (
                      <span className="font-medium flex items-center gap-1" style={{ color: "var(--color-brand-gold)" }}>
                        <CheckIcon className="w-3 h-3" strokeWidth={3} />
                        Payout received
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {availableGroups && availableGroups.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Open Groups</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {availableGroups.map((group) => {
              const progress = Math.round((group.member_count / group.max_members) * 100);
              return (
                <Link
                  key={group.id}
                  href={`/groups/${group.id}`}
                  className="rounded-xl p-5 border transition block"
                  style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate" style={{ color: "var(--text-primary)" }}>{group.name}</h3>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {formatNaira(Number(group.contribution_amount))}/{group.frequency}
                      </p>
                    </div>
                    <ChevronRightIcon className="w-4 h-4 shrink-0" style={{ color: "var(--text-faint)" }} />
                  </div>
                  <div className="flex items-center gap-2 text-xs mb-2" style={{ color: "var(--text-muted)" }}>
                    <UsersIcon className="w-3.5 h-3.5" />
                    {group.member_count}/{group.max_members} members
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-elevated)" }}>
                    <div className="h-full rounded-full" style={{ width: `${progress}%`, background: "var(--progress-fill)" }} />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
      </PageBody>
    </div>
  );
}
