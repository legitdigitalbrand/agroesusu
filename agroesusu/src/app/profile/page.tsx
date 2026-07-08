import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import LogoutButton from './logout-button';
import { ShieldCheckIcon, CheckIcon, AlertTriangleIcon } from '@/components/icons';
import { formatNaira } from '@/lib/utils';
import { PageHero, PageBody } from '@/components/ui/page-hero';

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  const [{ data: profile }, { data: accounts }, { count: groupCount }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('savings_accounts').select('*').eq('user_id', user.id),
    supabase.from('group_members').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
  ]);

  const kycStatus: string = (profile?.kyc_status as string) || 'unverified';

  const kycBadges: Record<string, { label: string; color: string; bg: string; Icon: typeof ShieldCheckIcon }> = {
    verified: { label: 'Verified', color: 'var(--success)', bg: 'rgba(59,143,59,0.10)', Icon: CheckIcon },
    pending_review: { label: 'Under Review', color: 'var(--action-gold)', bg: 'var(--action-gold-subtle)', Icon: AlertTriangleIcon },
    unverified: { label: 'Not Verified', color: 'var(--text-muted)', bg: 'var(--surface-elevated)', Icon: ShieldCheckIcon },
    pending: { label: 'Not Verified', color: 'var(--text-muted)', bg: 'var(--surface-elevated)', Icon: ShieldCheckIcon },
  };
  const kycBadge = kycBadges[kycStatus] || { label: 'Not Verified', color: 'var(--text-muted)', bg: 'var(--surface-elevated)', Icon: ShieldCheckIcon as typeof ShieldCheckIcon };

  const initials = (profile?.full_name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div>
      <PageHero maxWidth="max-w-2xl">
        <div className="mb-6">
          <p className="text-xs font-semibold tracking-wide" style={{ color: "var(--hero-pill-bg)" }}>PROFILE</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.14)" }}>
            <span className="font-bold text-xl" style={{ color: "var(--hero-text)" }}>{initials}</span>
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold truncate" style={{ color: "var(--hero-text)" }}>{profile?.full_name || 'User'}</h2>
            <p className="text-sm truncate" style={{ color: "var(--hero-text-muted)" }}>{profile?.email}</p>
            <span
              className="inline-block mt-1.5 text-xs px-2.5 py-0.5 rounded-full font-semibold capitalize"
              style={{ background: "var(--hero-pill-bg)", color: "var(--hero-pill-text)" }}
            >
              {profile?.tier || 'basic'} tier
            </span>
          </div>
        </div>
      </PageHero>

      <PageBody maxWidth="max-w-2xl">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl p-4 text-center border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
            <p className="text-xl font-bold" style={{ color: "var(--action-green)" }}>{accounts?.length || 0}</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Savings Pots</p>
          </div>
          <div className="rounded-xl p-4 text-center border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
            <p className="text-xl font-bold" style={{ color: "var(--action-blue)" }}>{groupCount || 0}</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Groups</p>
          </div>
          <div className="rounded-xl p-4 text-center border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
            <p className="text-xl font-bold" style={{ color: "var(--success)" }}>{formatNaira(Number(profile?.total_saved || 0))}</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Total Saved</p>
          </div>
        </div>

        {/* Identity Verification Card */}
        <Link
          href="/profile/verify"
          className="block rounded-xl p-4 mb-4 border transition-colors"
          style={{ background: "var(--surface-card)", borderColor: kycStatus === 'verified' ? "var(--success)" : "var(--border-default)" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: kycBadge.bg }}>
              <kycBadge.Icon className="w-5 h-5" style={{ color: kycBadge.color }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Identity Verification</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {kycStatus === 'verified' ? 'BVN verified — withdrawals enabled' :
                 kycStatus === 'pending_review' ? 'Your BVN is being reviewed' :
                 'Verify your BVN to unlock withdrawals'}
              </p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: kycBadge.bg, color: kycBadge.color }}>
              {kycBadge.label}
            </span>
          </div>
        </Link>

        {/* Details Card */}
        <div className="rounded-xl p-5 mb-6 border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Phone</p>
              <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{profile?.phone || 'Not set'}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Credit Score</p>
              <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{profile?.credit_score || 300}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Account Status</p>
              <p className="text-sm font-medium capitalize" style={{ color: "var(--action-green)" }}>{profile?.account_status || 'active'}</p>
            </div>
            {profile?.bvn_last_4 && (
              <div>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>BVN</p>
                <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>****{profile.bvn_last_4}</p>
              </div>
            )}
          </div>
        </div>

        <LogoutButton />
      </PageBody>
    </div>
  );
}
