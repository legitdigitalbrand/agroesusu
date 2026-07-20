import { createClient, createAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { checkEligibility } from '@/lib/loans/eligibility';
import { ApplyForm } from './apply-form';

export default async function LoanApplyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  const admin = createAdminClient();

  const [eligibility, { data: pots }] = await Promise.all([
    checkEligibility(user.id),
    admin.from('savings_accounts')
      .select('id, name, current_amount, type')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
  ]);

  if (!eligibility.eligible || !eligibility.tier) {
    return (
      <div className="pt-12 px-4 sm:px-5 lg:px-8 pb-8">
        <div className="max-w-2xl mx-auto">
          <a href="/loans" className="inline-flex items-center gap-2 text-sm mb-4" style={{ color: "var(--text-muted)" }}>
            ← Back to Loans
          </a>
          <div className="rounded-xl p-8 border text-center" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
            <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Not Eligible Yet</h2>
            <div className="mt-4 space-y-2 text-left max-w-sm mx-auto">
              {eligibility.blockingIssues.map((issue, i) => (
                <p key={i} className="text-sm" style={{ color: "var(--text-secondary)" }}>• {issue}</p>
              ))}
              {eligibility.reasons.map((reason, i) => (
                <p key={i} className="text-xs" style={{ color: "var(--text-muted)" }}>• {reason}</p>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <ApplyForm eligibility={eligibility} pots={pots || []} />;
}
