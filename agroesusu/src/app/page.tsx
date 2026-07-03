import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { BalanceCard } from '@/components/ui/balance-card';
import { GoalCard } from '@/components/ui/goal-card';
import { TransactionRow } from '@/components/ui/transaction-row';
import Link from 'next/link';
import { Plus, Users, TrendingUp } from 'lucide-react';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  // Parallel queries — no waterfall
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-50">
          Welcome back, {profile?.full_name?.split(' ')[0] || 'there'}
        </h1>
        <p className="text-sm text-brand-300/60 mt-1">Here's your savings overview</p>
      </div>

      <BalanceCard
        totalBalance={totalBalance}
        totalSaved={totalSaved}
        totalWithdrawn={totalWithdrawn}
        activeGoals={activeGoals.length}
      />

      <div className="grid grid-cols-3 gap-3 mt-6">
        <Link href="/save" className="flex flex-col items-center justify-center p-4 bg-brand-900 border border-brand-500/10 rounded-xl hover:border-brand-500/30 transition">
          <Plus className="w-5 h-5 text-brand-400 mb-1" />
          <span className="text-xs font-medium text-brand-200">New Goal</span>
        </Link>
        <Link href="/deposit" className="flex flex-col items-center justify-center p-4 bg-brand-900 border border-brand-500/10 rounded-xl hover:border-brand-500/30 transition">
          <TrendingUp className="w-5 h-5 text-brand-400 mb-1" />
          <span className="text-xs font-medium text-brand-200">Deposit</span>
        </Link>
        <Link href="/groups" className="flex flex-col items-center justify-center p-4 bg-brand-900 border border-brand-500/10 rounded-xl hover:border-brand-500/30 transition">
          <Users className="w-5 h-5 text-brand-gold mb-1" />
          <span className="text-xs font-medium text-brand-200">Groups</span>
        </Link>
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-brand-50">Your Pots</h2>
          <Link href="/save" className="text-sm text-brand-400 font-medium hover:underline">View all</Link>
        </div>

        {activeGoals.length === 0 ? (
          <div className="bg-brand-900 border border-brand-500/10 rounded-xl p-8 text-center">
            <p className="text-brand-300/50 text-sm mb-4">No savings pots yet. Start by creating one!</p>
            <Link href="/save" className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 text-brand-950 rounded-lg text-sm font-semibold hover:bg-brand-400 transition">
              <Plus className="w-4 h-4" />
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
          <h2 className="text-lg font-semibold text-brand-50">Recent Activity</h2>
          <Link href="/transactions" className="text-sm text-brand-400 font-medium hover:underline">View all</Link>
        </div>

        {!transactions || transactions.length === 0 ? (
          <div className="bg-brand-900 border border-brand-500/10 rounded-xl p-6 text-center">
            <p className="text-brand-300/50 text-sm">No transactions yet. Make your first deposit!</p>
          </div>
        ) : (
          <div className="bg-brand-900 border border-brand-500/10 rounded-xl">
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
