import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { GoalCard } from '@/components/ui/goal-card';

export default async function SavePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  const { data: accounts } = await supabase
    .from('savings_accounts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const totalSaved = accounts?.reduce((sum, acc) => sum + Number(acc.current_amount || 0), 0) || 0;

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-50">Savings Pots</h1>
          <p className="text-sm text-brand-300/60 mt-1">Total saved: ₦{totalSaved.toLocaleString()}</p>
        </div>
        <CreatePotButton />
      </div>

      {/* Pot Types Info */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-brand-900 border border-brand-500/10 rounded-xl p-4">
          <div className="text-2xl mb-1">💧</div>
          <h3 className="font-semibold text-sm text-brand-50">Flex</h3>
          <p className="text-xs text-brand-300/60 mt-1">Save anytime, withdraw anytime. 2% interest.</p>
        </div>
        <div className="bg-brand-900 border border-brand-500/10 rounded-xl p-4">
          <div className="text-2xl mb-1">🎯</div>
          <h3 className="font-semibold text-sm text-brand-50">Goal</h3>
          <p className="text-xs text-brand-300/60 mt-1">Target a specific amount. 5% interest.</p>
        </div>
        <div className="bg-brand-900 border border-brand-500/10 rounded-xl p-4">
          <div className="text-2xl mb-1">🌾</div>
          <h3 className="font-semibold text-sm text-brand-50">Seasonal</h3>
          <p className="text-xs text-brand-300/60 mt-1">Lock for planting season. 7% interest.</p>
        </div>
        <div className="bg-brand-900 border border-brand-500/10 rounded-xl p-4">
          <div className="text-2xl mb-1">🔒</div>
          <h3 className="font-semibold text-sm text-brand-50">Stash</h3>
          <p className="text-xs text-brand-300/60 mt-1">Long-term lock. 3% interest.</p>
        </div>
      </div>

      {/* Pots */}
      {!accounts || accounts.length === 0 ? (
        <div className="bg-brand-900 border border-brand-500/10 rounded-xl p-12 text-center">
          <p className="text-brand-300/50 mb-4">You haven't created any savings pots yet.</p>
          <CreatePotButton />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {accounts.map((account) => (
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
  );
}

function CreatePotButton() {
  return (
    <Link
      href="/save/new"
      className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-500 text-brand-950 rounded-lg text-sm font-semibold hover:bg-brand-400 transition"
    >
      <Plus className="w-4 h-4" />
      New Pot
    </Link>
  );
}
