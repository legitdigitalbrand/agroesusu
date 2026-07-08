import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import WithdrawForm from './withdraw-form';
import { ShieldCheckIcon } from '@/components/icons';

export default async function WithdrawPage() {
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
      .select('kyc_status')
      .eq('id', user.id)
      .single(),
  ]);

  const kycStatus = profile?.kyc_status || 'unverified';

  return (
    <div className="p-4 lg:p-8 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>Withdraw Money</h1>

      {/* KYC Gate */}
      {kycStatus !== 'verified' && (
        <div className="rounded-xl p-5 mb-6 border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--accent-subtle)" }}>
              <ShieldCheckIcon className="w-5 h-5" style={{ color: "var(--accent)" }} />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {kycStatus === 'pending_review' ? 'Identity Under Review' : 'Verify Your Identity'}
              </h2>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                {kycStatus === 'pending_review'
                  ? "We're reviewing your BVN. You'll be able to withdraw once it's approved."
                  : "You need to verify your BVN before you can withdraw your savings."}
              </p>
              <Link
                href="/profile/verify"
                className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 rounded-lg text-sm font-semibold transition"
                style={{ background: "var(--qa-primary-bg)", color: "var(--qa-primary-text)" }}
              >
                <ShieldCheckIcon className="w-4 h-4" />
                {kycStatus === 'pending_review' ? 'Check Status' : 'Verify Now'}
              </Link>
            </div>
          </div>
        </div>
      )}

      {kycStatus === 'verified' && (
        <>
          {!accounts || accounts.length === 0 ? (
            <div className="rounded-xl p-8 text-center border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No active savings pots to withdraw from.</p>
            </div>
          ) : (
            <WithdrawForm accounts={accounts} userId={user.id} />
          )}
        </>
      )}
    </div>
  );
}
