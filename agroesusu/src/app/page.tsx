import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { BalanceCard } from '@/components/ui/balance-card';
import { GoalCard } from '@/components/ui/goal-card';
import { TransactionRow } from '@/components/ui/transaction-row';
import Link from 'next/link';
import { PlusIcon, UsersIcon, TrendingUpIcon } from '@/components/icons';

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

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            Welcome back, {profile?.full_name?.split(' ')[0] || 'there'}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Here&apos;s your savings overview</p>
        </div>
      </div>

      <BalanceCard
        totalBalance={totalBalance}
        totalSaved={totalSaved}
        totalWithdrawn={totalWithdrawn}
        activeGoals={activeGoals.length}
      />

      <div className="grid grid-cols-3 gap-3 mt-6">
        <Link
          href="/save"
          className="flex flex-col items-center justify-center p-4 rounded-xl border transition-colors"
          style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}
        >
          <PlusIcon className="w-5 h-5 mb-1" style={{ color: "var(--accent)" }} />
          <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>New Goal</span>
        </Link>
        <Link
          href="/deposit"
          className="flex flex-col items-center justify-center p-4 rounded-xl border transition-colors"
          style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}
        >
          <TrendingUpIcon className="w-5 h-5 mb-1" style={{ color: "var(--accent)" }} />
          <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Deposit</span>
        </Link>
        <Link
          href="/groups"
          className="flex flex-col items-center justify-center p-4 rounded-xl border transition-colors"
          style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}
        >
          <UsersIcon className="w-5 h-5 mb-1" style={{ color: "var(--color-brand-gold)" }} />
          <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Groups</span>
        </Link>
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Your Pots</h2>
          <Link href="/save" className="text-sm font-medium hover:underline" style={{ color: "var(--accent)" }}>
            View all
          </Link>
        </div>

        {activeGoals.length === 0 ? (
          <div
            className="rounded-xl p-8 text-center border"
            style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}
          >
            <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>No savings pots yet. Start by creating one!</p>
            <Link
              href="/save"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              style={{ background: "var(--accent)", color: "var(--nav-bg)" }}
            >
              <PlusIcon className="w-4 h-4" />
              Create your first pot
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Recent Activity</h2>
          <Link href="/transactions" className="text-sm font-medium hover:underline" style={{ color: "var(--accent)" }}>
            View all
          </Link>
        </div>

        {!transactions || transactions.length === 0 ? (
          <div
            className="rounded-xl p-6 text-center border"
            style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}
          >
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>No transactions yet. Make your first deposit!</p>
          </div>
        ) : (
          <div
            className="rounded-xl border"
            style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}
          >
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
