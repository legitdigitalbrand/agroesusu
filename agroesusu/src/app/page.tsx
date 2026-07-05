import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { BalanceCard } from '@/components/ui/balance-card';
import { GoalCard } from '@/components/ui/goal-card';
import { TransactionRow } from '@/components/ui/transaction-row';
import Link from 'next/link';
import { DepositIcon, WithdrawIcon, PotIcon, GroupIcon, ShieldCheckIcon, CopyIcon } from '@/components/icons';

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
  const totalSaved = profile?.total_saved || 0;
  const totalWithdrawn = profile?.total_withdrawn || 0;
  const kycStatus = profile?.kyc_status || 'unverified';
  const dvaAccountNumber = profile?.paystack_dva_account_number || null;
  const dvaBankName = profile?.paystack_dva_bank_name || null;

  // Greeting based on time
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = profile?.full_name?.split(' ')[0] || 'there';
  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : '??';

  return (
    <div className="max-w-md mx-auto">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-5 pt-12 pb-4">
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>{greeting}</p>
          <p className="text-xl font-bold mt-0.5" style={{ color: "var(--text-primary)" }}>{firstName}</p>
        </div>
        <Link href="/profile" className="flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm"
          style={{ background: "var(--accent-subtle)", color: "var(--accent)", border: "1px solid var(--border-default)" }}>
          {initials}
        </Link>
      </div>

      {/* DVA Card — show if user has a dedicated account number */}
      {dvaAccountNumber && (
        <div className="px-5 mb-4">
          <div className="rounded-2xl p-4 border" style={{ background: "var(--balance-card-bg)", borderColor: "var(--border-default)" }}>
            <p className="text-xs font-medium" style={{ color: "var(--balance-card-label)" }}>Your Account Number</p>
            <div className="flex items-center justify-between mt-2">
              <div>
                <p className="text-lg font-bold tabular-nums" style={{ color: "var(--balance-card-value)" }}>{dvaAccountNumber}</p>
                <p className="text-xs" style={{ color: "var(--balance-card-label)" }}>{dvaBankName}</p>
              </div>
              <CopyButton text={dvaAccountNumber} />
            </div>
            <p className="text-xs mt-2" style={{ color: "var(--balance-card-label)" }}>
              Transfer to this account to fund your savings instantly
            </p>
          </div>
        </div>
      )}

      {/* KYC Banner — show if not verified */}
      {kycStatus !== 'verified' && (
        <div className="px-5 mb-4">
          <Link href="/profile/verify" className="block">
            <div className="rounded-xl p-4 border flex items-center gap-3 transition-colors"
              style={{ background: "var(--surface-card)", borderColor: kycStatus === 'pending_review' ? "rgba(245,184,0,0.3)" : "var(--border-default)" }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: kycStatus === 'pending_review' ? "rgba(245,184,0,0.12)" : "var(--accent-subtle)" }}>
                <ShieldCheckIcon className="w-4.5 h-4.5" style={{ width: 18, height: 18, color: kycStatus === 'pending_review' ? "var(--color-brand-gold)" : "var(--accent)" }} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {kycStatus === 'pending_review' ? 'Identity Under Review' : 'Verify Your Identity'}
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {kycStatus === 'pending_review' ? 'We\'re reviewing your BVN' : 'Unlock withdrawals with BVN'}
                </p>
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* Balance Card */}
      <BalanceCard
        totalBalance={totalBalance}
        totalSaved={totalSaved}
        totalWithdrawn={totalWithdrawn}
        activeGoals={activeGoals.length}
      />

      {/* Quick Actions — 4 column grid */}
      <div className="grid grid-cols-4 gap-2 px-5 mt-6 mb-6">
        <Link href="/deposit" className="flex flex-col items-center gap-2 p-4 rounded-2xl border transition-colors"
          style={{ background: "var(--qa-bg)", borderColor: "var(--qa-border)" }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "var(--qa-icon-bg)" }}>
            <DepositIcon className="w-5 h-5" style={{ color: "var(--qa-icon-color)" }} />
          </div>
          <span className="text-[11px] font-medium" style={{ color: "var(--qa-label)" }}>Deposit</span>
        </Link>
        <Link href="/withdraw" className="flex flex-col items-center gap-2 p-4 rounded-2xl border transition-colors"
          style={{ background: "var(--qa-bg)", borderColor: "var(--qa-border)" }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "var(--qa-icon-bg)" }}>
            <WithdrawIcon className="w-5 h-5" style={{ color: "var(--qa-icon-color)" }} />
          </div>
          <span className="text-[11px] font-medium" style={{ color: "var(--qa-label)" }}>Withdraw</span>
        </Link>
        <Link href="/save/new" className="flex flex-col items-center gap-2 p-4 rounded-2xl border transition-colors"
          style={{ background: "var(--qa-bg)", borderColor: "var(--qa-border)" }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "var(--qa-icon-bg)" }}>
            <PotIcon className="w-5 h-5" style={{ color: "var(--qa-icon-color)" }} />
          </div>
          <span className="text-[11px] font-medium" style={{ color: "var(--qa-label)" }}>New Pot</span>
        </Link>
        <Link href="/groups" className="flex flex-col items-center gap-2 p-4 rounded-2xl border transition-colors"
          style={{ background: "var(--qa-bg)", borderColor: "var(--qa-border)" }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "var(--qa-icon-bg)" }}>
            <GroupIcon className="w-5 h-5" style={{ color: "var(--qa-icon-color)" }} />
          </div>
          <span className="text-[11px] font-medium" style={{ color: "var(--qa-label)" }}>Groups</span>
        </Link>
      </div>

      {/* Savings Pots */}
      <div className="px-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Your Pots</h2>
          <Link href="/save" className="text-sm font-medium" style={{ color: "var(--section-link)" }}>
            See all
          </Link>
        </div>

        {activeGoals.length === 0 ? (
          <div className="rounded-2xl p-8 text-center border mb-6"
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
          <div className="flex flex-col gap-3 mb-6">
            {activeGoals.map((account) => (
              <GoalCard
                key={account.id}
                id={account.id}
                name={account.name}
                type={account.type}
                currentAmount={Number(account.current_amount || 0)}
                targetAmount={Number(account.target_amount || 0)}
                icon={account.icon}
                interestRate={Number(account.interest_rate || 0)}
                unlockDate={account.unlock_date}
              />
            ))}
          </div>
        )}

        {/* Recent Activity */}
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
          <div className="flex flex-col gap-0 mb-8">
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
      style={{ background: "rgba(255,255,255,0.15)", color: "var(--balance-card-value)" }}
    >
      <CopyIcon className="w-3.5 h-3.5" />
      Copy
    </button>
  );
}
