import { createClient, createAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import LogoutButton from './logout-button';
import { ShieldCheckIcon, CheckIcon, AlertTriangleIcon, ChevronRightIcon, BadgeIcon } from '@/components/icons';
import { formatNaira } from '@/lib/utils';
import { PageHero, PageBody } from '@/components/ui/page-hero';
import { getKYCTier, type KYCTierResult } from '@/lib/safehaven';

interface KYCTier {
  level: number;
  label: string;
  description: string;
  benefits: string[];
  nextTier?: { level: number; label: string; unlocks: string[] };
}

function getKYCTierFromStatus(kycStatus: string): KYCTier {
  const tiers: Record<string, KYCTier> = {
    verified: {
      level: 3,
      label: 'Verified',
      description: 'Full KYC verified — all features unlocked',
      benefits: ['Loan limits up to ₦500K', 'Longest HarvestLock terms (12 months)', 'Instant disbursements', 'Unlimited withdrawals'],
    },
    pending_review: {
      level: 2,
      label: 'Pending Verification',
      description: 'Your verification is being reviewed',
      benefits: ['Loan limits up to ₦150K', 'Standard HarvestLock terms (6 months)'],
      nextTier: {
        level: 3,
        label: 'Verified',
        unlocks: ['Loan limits up to ₦500K', '12-month HarvestLock', 'Instant disbursements'],
      },
    },
    unverified: {
      level: 1,
      label: 'Basic',
      description: 'BVN verified — basic features available',
      benefits: ['Starter loan limits up to ₦30K', 'AgroFlex & AgroGoal savings', 'Esusu groups'],
      nextTier: {
        level: 2,
        label: 'Pending Verification',
        unlocks: ['Loan limits up to ₦150K', '6-month HarvestLock', 'Higher withdrawal limits'],
      },
    },
    pending: {
      level: 1,
      label: 'Basic',
      description: 'BVN verified — basic features available',
      benefits: ['Starter loan limits up to ₦30K', 'AgroFlex & AgroGoal savings', 'Esusu groups'],
      nextTier: {
        level: 2,
        label: 'Pending Verification',
        unlocks: ['Loan limits up to ₦150K', '6-month HarvestLock', 'Higher withdrawal limits'],
      },
    },
  };
  return tiers[kycStatus] || tiers.unverified;
}

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
  const kycTier = getKYCTierFromStatus(kycStatus);

  // Try to fetch actual KYC tier from Safe Haven if connected
  let safeHavenTier: KYCTierResult | null = null;
  if (process.env.PAYMENT_PROVIDER === 'safehaven' && profile?.safehaven_account_id) {
    try {
      safeHavenTier = await getKYCTier(profile.safehaven_account_id);
    } catch {
      // Fall back to local status
    }
  }

  const tierColor = kycTier.level === 3 ? 'var(--success)' : kycTier.level === 2 ? 'var(--action-gold)' : 'var(--text-muted)';
  const tierBg = kycTier.level === 3 ? 'rgba(59,143,59,0.10)' : kycTier.level === 2 ? 'var(--action-gold-subtle)' : 'var(--surface-elevated)';

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
              className="inline-block mt-1.5 text-xs px-2.5 py-0.5 rounded-full font-semibold"
              style={{ background: "var(--hero-pill-bg)", color: "var(--hero-pill-text)" }}
            >
              KYC Level {kycTier.level} · {kycTier.label}
            </span>
          </div>
        </div>
      </PageHero>

      <PageBody maxWidth="max-w-2xl">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-6">
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

        {/* KYC Tier Card — tiered, not binary */}
        <div className="rounded-xl border mb-4 overflow-hidden" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
          <div className="p-4 flex items-center gap-3 border-b" style={{ borderColor: "var(--border-default)" }}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: tierBg }}>
              <BadgeIcon className="w-5 h-5" style={{ color: tierColor }} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Verification Tier</p>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: tierBg, color: tierColor }}>
                  Level {kycTier.level}
                </span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{kycTier.description}</p>
            </div>
          </div>

          {/* Current benefits */}
          <div className="p-4 border-b" style={{ borderColor: "var(--border-default)" }}>
            <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>What you can do now:</p>
            <div className="space-y-1.5">
              {kycTier.benefits.map((benefit, i) => (
                <div key={i} className="flex items-center gap-2">
                  <CheckIcon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--success)" }} />
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{benefit}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Next tier unlocks */}
          {kycTier.nextTier && (
            <Link href="/profile/verify" className="block p-4 transition-colors hover:opacity-80">
              <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>
                Unlock at Level {kycTier.nextTier.level} ({kycTier.nextTier.label}):
              </p>
              <div className="space-y-1.5">
                {kycTier.nextTier.unlocks.map((unlock, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <ChevronRightIcon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--accent)" }} />
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{unlock}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs mt-3 font-medium" style={{ color: "var(--accent)" }}>
                {kycStatus === 'verified' ? 'Fully verified ✓' : 'Verify now →'}
              </p>
            </Link>
          )}
        </div>

        {/* Trust badge */}
        <div className="rounded-xl p-3 mb-4 border flex items-center gap-2" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
          <ShieldCheckIcon className="w-4 h-4 shrink-0" style={{ color: "var(--action-green)" }} />
          <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
            Powered by Safe Haven MFB — a CBN-licensed &amp; NDIC-insured microfinance bank.
          </p>
        </div>

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
