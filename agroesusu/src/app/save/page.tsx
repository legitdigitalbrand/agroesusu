import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PlusIcon, DropletIcon, TargetIcon, WheatIcon, LockIcon } from '@/components/icons';
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

  const potTypes = [
    { Icon: DropletIcon, name: 'Flex', desc: 'Save anytime, withdraw anytime. 2% interest.' },
    { Icon: TargetIcon, name: 'Goal', desc: 'Target a specific amount. 5% interest.' },
    { Icon: WheatIcon, name: 'Seasonal', desc: 'Lock for planting season. 7% interest.' },
    { Icon: LockIcon, name: 'Stash', desc: 'Long-term lock. 3% interest.' },
  ];

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Savings Pots</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Total saved: ₦{totalSaved.toLocaleString()}</p>
        </div>
        <CreatePotButton />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {potTypes.map((pt) => (
          <div key={pt.name} className="rounded-xl p-4 border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2" style={{ background: "var(--pot-icon-bg)" }}>
              <pt.Icon className="w-4.5 h-4.5" style={{ width: 18, height: 18, color: "var(--qa-icon-color)" }} />
            </div>
            <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{pt.name}</h3>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{pt.desc}</p>
          </div>
        ))}
      </div>

      {!accounts || accounts.length === 0 ? (
        <div className="rounded-xl p-12 text-center border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
          <p className="mb-4" style={{ color: "var(--text-muted)" }}>You haven&apos;t created any savings pots yet.</p>
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
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition"
      style={{ background: "var(--accent)", color: "var(--qa-primary-text)" }}
    >
      <PlusIcon className="w-4 h-4" />
      New Pot
    </Link>
  );
}
