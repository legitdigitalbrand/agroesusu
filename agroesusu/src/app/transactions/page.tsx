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
      <h1 className="text-2xl font-bold text-brand-green mb-6">Transaction History</h1>

      {!transactions || transactions.length === 0 ? (
        <div className="bg-white border border-brand-border rounded-xl p-12 text-center">
          <p className="text-stone-400">No transactions yet.</p>
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
  );
}
