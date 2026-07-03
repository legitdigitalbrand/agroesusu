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

  // Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // Fetch savings accounts
  const { data: accounts } = await supabase
    .from('savings_accounts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  // Fetch recent transactions
  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5);

  // Fetch groups
  const { data: memberships } = await supabase
    .from('group_members')
    .select('group_id, savings_groups(*)')
    .eq('user_id', user.id)
    .limit(3);

  // Calculate totals
  const totalBalance = accounts?.reduce((sum, acc) => sum + Number(acc.current_amount || 0), 0) || 0;
  const activeGoals = accounts?.filter(a => a.status === 'active') || [];
  const totalSaved = profile?.total_saved || 0;
  const totalWithdrawn = profile?.total_withdrawn || 0;

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-green">
          Welcome back, {profile?.full_name?.split(' ')[0] || 'there'}
        </h1>
        <p className="text-sm text-stone-500 mt-1">Here's your savings overview</p>
      </div>

      {/* Balance Card */}
      <BalanceCard
        totalBalance={totalBalance}
        totalSaved={totalSaved}
        totalWithdrawn={totalWithdrawn}
        activeGoals={activeGoals.length}
      />

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3 mt-6">
        <Link href="/save" className="flex flex-col items-center justify-center p-4 bg-white border border-brand-border rounded-xl hover:border-brand-lime transition">
          <Plus className="w-5 h-5 text-brand-green mb-1" />
          <span className="text-xs font-medium text-stone-600">New Goal</span>
        </Link>
        <Link href="/deposit" className="flex flex-col items-center justify-center p-4 bg-white border border-brand-border rounded-xl hover:border-brand-lime transition">
          <TrendingUp className="w-5 h-5 text-brand-lime mb-1" />
          <span className="text-xs font-medium text-stone-600">Deposit</span>
        </Link>
        <Link href="/groups" className="flex flex-col items-center justify-center p-4 bg-white border border-brand-border rounded-xl hover:border-brand-lime transition">
          <Users className="w-5 h-5 text-[#f5b800] mb-1" />
          <span className="text-xs font-medium text-stone-600">Groups</span>
        </Link>
      </div>

      {/* Savings Pots */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-stone-800">Your Pots</h2>
          <Link href="/save" className="text-sm text-brand-lime font-medium hover:underline">View all</Link>
        </div>

        {activeGoals.length === 0 ? (
          <div className="bg-white border border-brand-border rounded-xl p-8 text-center">
            <p className="text-stone-400 text-sm mb-4">No savings pots yet. Start by creating one!</p>
            <Link href="/save" className="inline-flex items-center gap-2 px-4 py-2 bg-brand-green text-white rounded-lg text-sm font-medium hover:bg-brand-green/90 transition">
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

      {/* Recent Activity */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-stone-800">Recent Activity</h2>
          <Link href="/transactions" className="text-sm text-brand-lime font-medium hover:underline">View all</Link>
        </div>

        {!transactions || transactions.length === 0 ? (
          <div className="bg-white border border-brand-border rounded-xl p-6 text-center">
            <p className="text-stone-400 text-sm">No transactions yet. Make your first deposit!</p>
          </div>
        ) : (
          <div className="bg-white border border-brand-border rounded-xl divide-y divide-stone-100">
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
