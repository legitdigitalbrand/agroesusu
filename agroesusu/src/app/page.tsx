import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { GoalCard } from '@/components/ui/goal-card';
import { TransactionRow } from '@/components/ui/transaction-row';
import Link from 'next/link';
import { DepositIcon, WithdrawIcon, PotIcon, GroupIcon, ShieldCheckIcon, CopyIcon, ChevronRightIcon, PlusIcon, DropletIcon, TargetIcon } from '@/components/icons';
import { formatNaira } from '@/lib/utils';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  const [
    { data: profile },
    { data: accounts },
    { data: transactions },
    { data: memberships },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('savings_accounts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('group_members').select('group_id, savings_groups(*)').eq('user_id', user.id).limit(3),
  ]);

  const totalBalance = accounts?.reduce((sum, acc) => sum + Number(acc.current_amount || 0), 0) || 0;
  const activeGoals = accounts?.filter(a => a.status === 'active') || [];
  const kycStatus = profile?.kyc_status || 'unverified';
  const dvaAccountNumber = profile?.paystack_dva_account_number || null;
  const dvaBankName = profile?.paystack_dva_bank_name || null;
  const groups = (memberships || []).map((m: any) => m.savings_groups).filter(Boolean);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = profile?.full_name?.split(' ')[0] || 'there';
  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : '??';

  // Pot type chips for the "Your Pots" strip inside the hero card
  const potTypes = [
    { key: 'flex', label: 'Flex', icon: DropletIcon },
    { key: 'goal', label: 'Goal', icon: TargetIcon },
    { key: 'stash', label: 'Stash', icon: PotIcon },
  ];
  const activePotType = accounts?.[0]?.type || 'flex';

  return (
    <div className="max-w-md lg:max-w-6xl mx-auto">
      {/* ===== HERO CARD — dark green, full-bleed on mobile, rounded on desktop ===== */}
      <div
        className="pt-12 lg:pt-10 lg:mt-6 pb-10 px-5 lg:px-8 lg:rounded-3xl lg:mx-8"
        style={{ background: "var(--hero-gradient)" }}
      >
        <div className="max-w-md lg:max-w-none mx-auto lg:mx-0">
          {/* header row */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                style={{ background: "rgba(255,255,255,0.14)", color: "#FFFFFF" }}>
                {initials}
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.85)" }}>{greeting}</p>
                <p className="text-base font-bold" style={{ color: "#FFFFFF" }}>{firstName}</p>
              </div>
            </div>
            <Link href="/profile" className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
              style={{ background: "var(--hero-pill-bg)", color: "var(--hero-pill-text)" }}
              aria-label="View profile">
              {initials}
            </Link>
          </div>

          {/* balance */}
          <div className="text-center mb-6">
            <p className="text-xs font-semibold tracking-wide" style={{ color: "var(--hero-pill-bg)" }}>YOUR SAVINGS BALANCE</p>
            <div className="flex items-center justify-center gap-2 mt-1.5">
              <p className="text-4xl font-extrabold tracking-tight" style={{ color: "#FFFFFF" }}>{formatNaira(totalBalance)}</p>
              <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 17, height: 17 }}>
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><circle cx="12" cy="12" r="3" />
              </svg>
            </div>
          </div>

          {/* pill actions */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <Link href="/deposit"
              className="px-8 py-2.5 rounded-xl text-sm font-bold text-center"
              style={{ background: "var(--hero-pill-bg)", color: "var(--hero-pill-text)" }}>
              Deposit
            </Link>
            <Link href="/withdraw"
              className="px-8 py-2.5 rounded-xl text-sm font-bold text-center"
              style={{ background: "var(--hero-pill-secondary-bg)", color: "var(--hero-pill-secondary-text)" }}>
              Withdraw
            </Link>
          </div>

          {/* nested "Your Pots" chip strip */}
          <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.06)" }}>
            <p className="text-xs font-semibold mb-3" style={{ color: "rgba(255,255,255,0.75)" }}>Your Pots</p>
            <div className="flex items-center gap-2 overflow-x-auto">
              {potTypes.map((pt) => {
                const isActive = pt.key === activePotType;
                const Icon = pt.icon;
                return (
                  <Link
                    key={pt.key}
                    href="/save"
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold shrink-0 border"
                    style={{
                      background: isActive ? "var(--hero-chip-active-bg)" : "var(--hero-chip-bg)",
                      color: isActive ? "var(--hero-chip-active-text)" : "var(--hero-chip-text)",
                      borderColor: isActive ? "transparent" : "var(--hero-chip-border)",
                    }}
                  >
                    <Icon style={{ width: 13, height: 13 }} />
                    {pt.label}
                  </Link>
                );
              })}
              <Link href="/save/new"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold shrink-0 border"
                style={{ color: "var(--hero-chip-text)", borderColor: "var(--hero-chip-border)" }}>
                <PlusIcon style={{ width: 13, height: 13 }} />
                New Pot
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ===== WHITE CONTENT AREA — overlaps the hero card slightly ===== */}
      <div className="relative -mt-8 lg:mt-0 rounded-t-[2.5rem] lg:rounded-none px-5 lg:px-8 pt-7"
        style={{ background: "var(--surface-base)" }}>

        {/* DVA Card */}
        {dvaAccountNumber && (
          <div className="mb-4 lg:max-w-md">
            <div className="rounded-2xl p-4 border" style={{ background: "var(--hero-bg)", borderColor: "var(--border-default)" }}>
              <p className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.85)" }}>Your Account Number</p>
              <div className="flex items-center justify-between mt-2">
                <div>
                  <p className="text-lg font-bold tabular-nums" style={{ color: "#FFFFFF" }}>{dvaAccountNumber}</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.85)" }}>{dvaBankName}</p>
                </div>
                <CopyButton text={dvaAccountNumber} />
              </div>
              <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.85)" }}>
                Transfer to this account to fund your savings instantly
              </p>
            </div>
          </div>
        )}

        {/* KYC Banner */}
        {kycStatus !== 'verified' && (
          <div className="mb-4 lg:max-w-md">
            <Link href="/profile/verify" className="block">
              <div className="rounded-xl p-4 border flex items-center gap-3 transition-colors"
                style={{ background: "var(--surface-card)", borderColor: kycStatus === 'pending_review' ? "rgba(245,184,0,0.3)" : "var(--border-default)" }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: kycStatus === 'pending_review' ? "var(--action-gold-subtle)" : "var(--action-green-subtle)" }}>
                  <ShieldCheckIcon className="w-4.5 h-4.5" style={{ width: 18, height: 18, color: kycStatus === 'pending_review' ? "var(--action-gold)" : "var(--action-green)" }} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    {kycStatus === 'pending_review' ? 'Identity Under Review' : 'Verify Your Identity'}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {kycStatus === 'pending_review' ? 'We\'re reviewing your BVN' : 'Unlock withdrawals with BVN'}
                  </p>
                </div>
                <ChevronRightIcon className="w-4 h-4 hidden lg:block shrink-0" style={{ color: "var(--text-faint)" }} />
              </div>
            </Link>
          </div>
        )}

        <div className="lg:grid lg:grid-cols-3 lg:gap-8 lg:items-start">
          <div className="lg:col-span-2">
            {/* Quick actions — outlined circles, distinct color per action */}
            <div className="grid grid-cols-4 gap-2 mb-6">
              <Link href="/deposit" className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full flex items-center justify-center border-2"
                  style={{ borderColor: "var(--action-green)" }}>
                  <DepositIcon className="w-5 h-5" style={{ color: "var(--action-green)" }} />
                </div>
                <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>Deposit</span>
              </Link>
              <Link href="/withdraw" className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full flex items-center justify-center border-2"
                  style={{ borderColor: "var(--action-red)" }}>
                  <WithdrawIcon className="w-5 h-5" style={{ color: "var(--action-red)" }} />
                </div>
                <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>Withdraw</span>
              </Link>
              <Link href="/save/new" className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full flex items-center justify-center border-2"
                  style={{ borderColor: "var(--action-gold)" }}>
                  <PotIcon className="w-5 h-5" style={{ color: "var(--action-gold)" }} />
                </div>
                <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>New Pot</span>
              </Link>
              <Link href="/groups" className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full flex items-center justify-center border-2"
                  style={{ borderColor: "var(--action-blue)" }}>
                  <GroupIcon className="w-5 h-5" style={{ color: "var(--action-blue)" }} />
                </div>
                <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>Groups</span>
              </Link>
            </div>

            {/* Savings Pots */}
            <div className="lg:grid lg:grid-cols-2 lg:gap-x-6">
              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Your Pots</h2>
                  <Link href="/save" className="text-sm font-medium" style={{ color: "var(--section-link)" }}>
                    See all
                  </Link>
                </div>
              </div>

              {activeGoals.length === 0 ? (
                <div className="lg:col-span-2 rounded-2xl p-8 text-center border mb-6"
                  style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
                  <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
                    No savings pots yet. Start by creating one!
                  </p>
                  <Link href="/save/new"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                    style={{ background: "var(--accent)", color: "var(--qa-primary-text)" }}>
                    Create your first pot
                  </Link>
                </div>
              ) : (
                <div className="lg:col-span-2 lg:grid lg:grid-cols-2 lg:gap-3 flex flex-col gap-3 mb-6">
                  {activeGoals.map((account) => (
                    <GoalCard
                      key={account.id}
                      id={account.id}
                      name={account.name}
                      type={account.type}
                      currentAmount={Number(account.current_amount || 0)}
                      targetAmount={Number(account.target_amount || 0)}
                      icon={account.icon}
                      unlockDate={account.unlock_date}
                    />
                  ))}
                </div>
              )}

              {/* Recent Activity */}
              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Recent Activity</h2>
                  <Link href="/transactions" className="text-sm font-medium" style={{ color: "var(--section-link)" }}>
                    See all
                  </Link>
                </div>

                {!transactions || transactions.length === 0 ? (
                  <div className="rounded-2xl p-6 text-center border mb-8"
                    style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>No transactions yet. Make your first deposit!</p>
                  </div>
                ) : (
                  <div className="rounded-2xl lg:border overflow-hidden mb-8" style={{ borderColor: "var(--border-default)" }}>
                    {transactions.map((tx) => (
                      <TransactionRow
                        key={tx.id}
                        type={tx.type}
                        amount={Number(tx.amount)}
                        description={tx.description || ''}
                        date={tx.created_at}
                        status={tx.status}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right rail — desktop only */}
          <div className="hidden lg:block lg:col-span-1 lg:sticky lg:top-8 space-y-4">
            <div className="rounded-2xl p-5 border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Your Groups</h3>
                <Link href="/groups" className="text-xs font-medium" style={{ color: "var(--section-link)" }}>
                  See all
                </Link>
              </div>

              {groups.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
                    Join or start a group to save together with others.
                  </p>
                  <Link href="/groups"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold"
                    style={{ background: "var(--action-blue-subtle)", color: "var(--action-blue)" }}>
                    Explore groups
                  </Link>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {groups.map((g: any) => (
                    <Link key={g.id} href={`/groups/${g.id}`}
                      className="flex items-center justify-between p-2.5 -mx-2.5 rounded-lg transition-colors hover:bg-card-hover">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{g.name}</p>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                          Cycle {g.current_cycle}/{g.total_cycles} · {formatNaira(Number(g.total_pool || 0))}
                        </p>
                      </div>
                      <ChevronRightIcon className="w-4 h-4 shrink-0" style={{ color: "var(--text-faint)" }} />
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl p-5 border" style={{ background: "var(--action-gold-subtle)", borderColor: "var(--border-default)" }}>
              <div className="flex items-center gap-2 mb-2">
                <PotIcon className="w-4 h-4" style={{ color: "var(--action-gold)" }} />
                <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Savings Tip</h3>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                Turn on round-up savings on a Stash pot — every deposit rounds up to the nearest ₦100, and the spare change
                is saved automatically. Small amounts add up fast.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        navigator.clipboard?.writeText(text);
      }}
      className="px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
      style={{ background: "rgba(255,255,255,0.15)", color: "#FFFFFF" }}
    >
      <CopyIcon className="w-3.5 h-3.5" />
      Copy
    </button>
  );
}
