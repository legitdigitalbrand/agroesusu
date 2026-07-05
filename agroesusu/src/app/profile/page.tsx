import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import LogoutButton from './logout-button';
import { ThemeToggle } from '@/components/theme-toggle';
import { ShieldCheckIcon, CheckIcon, AlertTriangleIcon } from '@/components/icons';

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  const [{ data: profile }, { data: accounts }, { count: groupCount }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('savings_accounts').select('*').eq('user_id', user.id),
    supabase.from('group_members').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
  ]);

  const kycStatus = profile?.kyc_status || 'unverified';

  const kycBadge = {
    verified: { label: 'Verified', color: 'var(--accent)', bg: 'var(--accent-subtle)', Icon: CheckIcon },
    pending_review: { label: 'Under Review', color: 'var(--color-brand-gold)', bg: 'rgba(245,184,0,0.12)', Icon: AlertTriangleIcon },
    unverified: { label: 'Not Verified', color: 'var(--text-muted)', bg: 'var(--surface-elevated)', Icon: ShieldCheckIcon },
    pending: { label: 'Not Verified', color: 'var(--text-muted)', bg: 'var(--surface-elevated)', Icon: ShieldCheckIcon },
  }[kycStatus] || { label: 'Not Verified', color: 'var(--text-muted)', bg: 'var(--surface-elevated)', Icon: ShieldCheckIcon };

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Profile</h1>
      </div>

      {/* Appearance */}
      <div
        className="rounded-xl p-4 mb-6 border flex items-center justify-between"
        style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}
      >
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Appearance</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Switch between dark and light mode</p>
        </div>
        <ThemeToggle />
      </div>

      {/* Identity Verification Card */}
      <Link
        href="/profile/verify"
        className="block rounded-xl p-4 mb-6 border transition-colors"
        style={{ background: "var(--surface-card)", borderColor: kycStatus === 'verified' ? "var(--accent)" : "var(--border-default)" }}
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

      {/* Profile Card */}
      <div
        className="rounded-xl p-6 mb-6 border"
        style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}
      >
        <div className="flex items-center gap-4 mb-6">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: "var(--accent-subtle)" }}
          >
            <span className="font-bold text-xl" style={{ color: "var(--accent)" }}>
              {(profile?.full_name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>{profile?.full_name || 'User'}</h2>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>{profile?.email}</p>
            <span
              className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium capitalize"
              style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
            >
              {profile?.tier || 'basic'} tier
            </span>
          </div>
        </div>

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
            <p className="text-sm font-medium capitalize" style={{ color: "var(--accent)" }}>{profile?.account_status || 'active'}</p>
          </div>
          {profile?.bvn_last_4 && (
            <div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>BVN</p>
              <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>****{profile.bvn_last_4}</p>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl p-4 text-center border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
          <p className="text-2xl font-bold" style={{ color: "var(--accent)" }}>{accounts?.length || 0}</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Savings Pots</p>
        </div>
        <div className="rounded-xl p-4 text-center border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
          <p className="text-2xl font-bold" style={{ color: "var(--accent)" }}>{groupCount || 0}</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Groups</p>
        </div>
        <div className="rounded-xl p-4 text-center border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
          <p className="text-2xl font-bold" style={{ color: "var(--accent)" }}>₦{Number(profile?.total_saved || 0).toLocaleString()}</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Total Saved</p>
        </div>
      </div>

      <LogoutButton />
    </div>
  );
}
