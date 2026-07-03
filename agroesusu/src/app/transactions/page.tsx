import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { TransactionRow } from '@/components/ui/transaction-row';

export default async function TransactionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-brand-50 mb-6">Transaction History</h1>

      {!transactions || transactions.length === 0 ? (
        <div className="bg-brand-900 border border-brand-500/10 rounded-xl p-12 text-center">
          <p className="text-brand-300/50">No transactions yet.</p>
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
  );
}
