import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DepositForm from './deposit-form';

export default async function DepositPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  const { data: accounts } = await supabase
    .from('savings_accounts')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  return (
    <div className="p-4 lg:p-8 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>Deposit Money</h1>

      {!accounts || accounts.length === 0 ? (
        <div className="rounded-xl p-8 text-center border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
          <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>You need a savings pot first.</p>
          <a href="/save/new"
            className="inline-block px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "var(--accent)", color: "var(--nav-bg)" }}>
            Create a pot
          </a>
        </div>
      ) : (
        <DepositForm accounts={accounts} userId={user.id} />
      )}
    </div>
  );
}
