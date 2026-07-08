import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import DepositForm from './deposit-form';
import { CopyIcon, ShieldCheckIcon } from '@/components/icons';
import CreateDVAButton from './create-dva-button';

export default async function DepositPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  const [{ data: accounts }, { data: profile }] = await Promise.all([
    supabase
      .from('savings_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('paystack_dva_account_number, paystack_dva_bank_name, dva_status, full_name')
      .eq('id', user.id)
      .single(),
  ]);

  const dvaAccountNumber = profile?.paystack_dva_account_number || null;
  const dvaBankName = profile?.paystack_dva_bank_name || null;
  const dvaStatus = profile?.dva_status || 'pending';

  return (
    <div className="p-4 lg:p-8 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>Deposit Money</h1>

      {/* DVA Section — Bank Transfer */}
      <div className="rounded-2xl p-5 mb-6 border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
        <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Bank Transfer</h2>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          Get a dedicated account number in your name. Transfer from any bank to fund your savings.
        </p>

        {dvaAccountNumber && dvaStatus === 'assigned' ? (
          <div className="rounded-xl p-4" style={{ background: "var(--balance-card-bg)" }}>
            <p className="text-xs font-medium" style={{ color: "var(--balance-card-label)" }}>
              {profile?.full_name?.split(' ')[0] || 'Your'}'s Account
            </p>
            <div className="flex items-center justify-between mt-2">
              <div>
                <p className="text-xl font-bold tabular-nums" style={{ color: "var(--balance-card-value)" }}>
                  {dvaAccountNumber}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--balance-card-label)" }}>{dvaBankName}</p>
              </div>
              <CopyButton text={dvaAccountNumber} />
            </div>
            <div className="flex items-center gap-1.5 mt-3 pt-3 border-t" style={{ borderColor: "rgba(255,255,255,0.15)" }}>
              <ShieldCheckIcon className="w-3 h-3" style={{ color: "var(--balance-card-label)" }} />
              <p className="text-xs" style={{ color: "var(--balance-card-label)" }}>
                Transfers are credited automatically
              </p>
            </div>
          </div>
        ) : (
          <CreateDVAButton userId={user.id} initialStatus={dvaStatus} />
        )}
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-px" style={{ background: "var(--border-default)" }} />
        <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>OR PAY BY CARD</span>
        <div className="flex-1 h-px" style={{ background: "var(--border-default)" }} />
      </div>

      {/* Card / USSD Payment */}
      {!accounts || accounts.length === 0 ? (
        <div className="rounded-xl p-8 text-center border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
          <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
            You need a savings pot before making a card deposit.
          </p>
          <Link href="/save/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition"
            style={{ background: "var(--qa-primary-bg)", color: "var(--qa-primary-text)" }}>
            Create a pot first
          </Link>
        </div>
      ) : (
        <DepositForm accounts={accounts} userId={user.id} />
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  return (
    <button
      onClick={() => navigator.clipboard?.writeText(text)}
      className="px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
      style={{ background: "rgba(255,255,255,0.15)", color: "var(--balance-card-value)" }}
    >
      <CopyIcon className="w-3.5 h-3.5" />
      Copy
    </button>
  );
}
