import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { TransactionRow } from '@/components/ui/transaction-row';
import { PageHero, PageBody } from '@/components/ui/page-hero';
import { formatNaira } from '@/lib/utils';

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

  const verified = (transactions || []).filter((t: any) => t.status === 'completed' || t.status === 'verified' || t.status === 'success');
  const totalIn = verified
    .filter((t: any) => ['deposit', 'group_payout'].includes(t.type))
    .reduce((sum: number, t: any) => sum + Number(t.amount), 0);
  const totalOut = verified
    .filter((t: any) => ['withdrawal', 'group_contribution'].includes(t.type))
    .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

  return (
    <div>
      <PageHero maxWidth="max-w-3xl">
        <p className="text-xs font-semibold tracking-wide mb-0.5" style={{ color: "var(--hero-pill-bg)" }}>ACTIVITY</p>
        <h1 className="text-xl font-bold mb-6" style={{ color: "var(--hero-text)" }}>Transaction History</h1>
        <div className="flex items-center gap-8">
          <div>
            <p className="text-xs" style={{ color: "var(--hero-text-muted)" }}>Money in</p>
            <p className="text-2xl font-extrabold mt-1" style={{ color: "var(--hero-text)" }}>{formatNaira(totalIn)}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: "var(--hero-text-muted)" }}>Money out</p>
            <p className="text-2xl font-extrabold mt-1" style={{ color: "var(--hero-text)" }}>{formatNaira(totalOut)}</p>
          </div>
        </div>
      </PageHero>

      <PageBody maxWidth="max-w-3xl">
        {!transactions || transactions.length === 0 ? (
          <div className="rounded-xl p-12 text-center border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
            <p style={{ color: "var(--text-muted)" }}>No transactions yet.</p>
          </div>
        ) : (
          <div className="rounded-xl border px-4" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
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
      </PageBody>
    </div>
  );
}
