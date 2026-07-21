import { createClient, createAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PageHero, PageBody } from '@/components/ui/page-hero';
import { formatNaira, formatDate } from '@/lib/utils';
import { LOANS_LIVE_MODE, TIER_CONFIGS } from '@/lib/loans/config';
import { checkEligibility } from '@/lib/loans/eligibility';
import { LoanHandIcon, ArrowLeftIcon, CheckIcon, AlertTriangleIcon, InfoIcon, ShieldCheckIcon } from '@/components/icons';

export default async function LoansPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  const admin = createAdminClient();

  // Fetch eligibility and existing loans in parallel
  const [eligibility, { data: loans }] = await Promise.all([
    checkEligibility(user.id),
    admin.from('loans').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
  ]);

  const activeLoans = (loans || []).filter(l => ['active', 'overdue'].includes(l.status));
  const pendingLoans = (loans || []).filter(l => l.status === 'pending_review');
  const completedLoans = (loans || []).filter(l => ['completed', 'defaulted', 'rejected'].includes(l.status));
  const { data: profileData } = await admin.from('profiles').select('credit_score, tier').eq('id', user.id).single();
  const profile = profileData;
  const isAdmin = profile?.tier === 'admin';

  const statusColors: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: 'rgba(59,143,59,0.10)', text: 'var(--success)', label: 'Active' },
    overdue: { bg: 'rgba(193,57,43,0.10)', text: 'var(--danger)', label: 'Overdue' },
    pending_review: { bg: 'rgba(201,137,31,0.10)', text: 'var(--warning)', label: 'Under Review' },
    completed: { bg: 'rgba(11,61,31,0.08)', text: 'var(--accent)', label: 'Completed' },
    defaulted: { bg: 'rgba(193,57,43,0.10)', text: 'var(--danger)', label: 'Defaulted' },
    rejected: { bg: 'rgba(138,138,126,0.10)', text: 'var(--text-muted)', label: 'Rejected' },
  };

  return (
    <div>
      <PageHero maxWidth="max-w-5xl">
        <div className="mb-6">
          <p className="text-xs font-semibold tracking-wide" style={{ color: "var(--hero-pill-bg)" }}>LOANS</p>
        </div>
        <div className="flex items-center gap-3">
          <LoanHandIcon className="w-7 h-7" style={{ color: "var(--hero-text)" }} />
          <h1 className="text-2xl font-bold" style={{ color: "var(--hero-text)" }}>Borrow & Repay</h1>
        </div>
        <p className="text-sm mt-2" style={{ color: "var(--hero-text-muted)" }}>
          Access credit based on your savings history and group track record.
        </p>
      </PageHero>

      <PageBody maxWidth="max-w-5xl">

        {/* Trust badge */}
        <div className="rounded-xl p-3 mb-5 border flex items-center gap-2" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
          <ShieldCheckIcon className="w-4 h-4 shrink-0" style={{ color: "var(--action-green)" }} />
          <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
            Loans powered by Safe Haven MFB — a CBN-licensed &amp; NDIC-insured microfinance bank. APR shown is annual; actual cost depends on your tier and credit score.
          </p>
        </div>

        {/* Sandbox banner */}
        {!LOANS_LIVE_MODE && (
          <div className="rounded-xl p-4 mb-6 border flex items-start gap-3" style={{ background: "rgba(201,137,31,0.08)", borderColor: "rgba(201,137,31,0.3)" }}>
            <AlertTriangleIcon className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "var(--warning)" }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--warning)" }}>Sandbox Mode</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                Loans are running in test mode — no real money is disbursed. Full lending goes live after licensing is confirmed.
              </p>
            </div>
          </div>
        )}

        {/* Eligibility summary */}
        <div className="rounded-xl p-5 mb-6 border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>YOUR ELIGIBILITY</p>
              {eligibility.eligible && eligibility.tier ? (
                <div className="mt-1">
                  <span className="text-lg font-bold capitalize" style={{ color: "var(--accent)" }}>{eligibility.tier.label} Tier</span>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    Borrow {formatNaira(eligibility.tier.minAmount)} – {formatNaira(eligibility.tier.maxAmount)}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {eligibility.tier.aprRange.min}% – {eligibility.tier.aprRange.max}% APR · Weekly installments
                  </p>
                </div>
              ) : (
                <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                  {eligibility.blockingIssues[0] || 'Keep saving to unlock loan eligibility.'}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>CREDIT SCORE</p>
              <p className="text-2xl font-bold" style={{ color: "var(--accent)" }}>{profile?.credit_score || 300}</p>
            </div>
          </div>

          {eligibility.eligible && (
            <Link
              href="/loans/apply"
              className="block w-full text-center py-3 rounded-lg font-semibold transition"
              style={{ background: "var(--accent)", color: "var(--hero-text)" }}
            >
              Apply for a Loan
            </Link>
          )}

          {eligibility.reasons.length > 0 && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--border-subtle)" }}>
              <p className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>How to improve:</p>
              <ul className="space-y-1.5">
                {eligibility.reasons.map((reason, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                    <InfoIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Active loans */}
        {activeLoans.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Active Loans</h3>
            <div className="space-y-3">
              {activeLoans.map((loan: any) => {
                const status = statusColors[loan.status] || statusColors.active;
                const progressPercent = Math.round(((Number(loan.total_repayable) - Number(loan.outstanding_balance)) / Number(loan.total_repayable)) * 100);
                return (
                  <Link key={loan.id} href={`/loans/${loan.id}`}>
                    <div className="rounded-xl p-4 border transition-colors hover:bg-[var(--surface-card-hover)]" style={{ background: "var(--surface-card)", borderColor: loan.status === 'overdue' ? "var(--danger)" : "var(--border-default)" }}>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{formatNaira(Number(loan.principal))} loan</p>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{loan.num_installments} weekly installments · {loan.tier} tier</p>
                        </div>
                        <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: status.bg, color: status.text }}>
                          {status.label}
                        </span>
                      </div>
                      <div className="mb-2">
                        <div className="flex justify-between text-xs mb-1">
                          <span style={{ color: "var(--text-muted)" }}>Repaid: {progressPercent}%</span>
                          <span style={{ color: "var(--text-secondary)" }}>{formatNaira(Number(loan.outstanding_balance))} left</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-card-hover)" }}>
                          <div className="h-full rounded-full" style={{ width: `${progressPercent}%`, background: loan.status === 'overdue' ? "var(--danger)" : "var(--success)" }} />
                        </div>
                      </div>
                      {loan.next_due_date && loan.status === 'active' && (
                        <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                          Next payment: {formatNaira(Number(loan.installment_amount))} due {formatDate(loan.next_due_date)}
                        </p>
                      )}
                      {loan.status === 'overdue' && (
                        <p className="text-xs mt-2" style={{ color: "var(--danger)" }}>
                          {loan.overdue_days} day(s) overdue — please make a payment
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Pending applications */}
        {pendingLoans.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Pending Applications</h3>
            <div className="space-y-3">
              {pendingLoans.map((loan: any) => {
                const status = statusColors[loan.status];
                return (
                  <Link key={loan.id} href={`/loans/${loan.id}`}>
                    <div className="rounded-xl p-4 border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{formatNaira(Number(loan.principal))} loan application</p>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Submitted {formatDate(loan.created_at)}</p>
                        </div>
                        <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: status.bg, color: status.text }}>
                          {status.label}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Completed loans */}
        {completedLoans.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>History</h3>
            <div className="space-y-3">
              {completedLoans.map((loan: any) => {
                const status = statusColors[loan.status] || statusColors.completed;
                return (
                  <Link key={loan.id} href={`/loans/${loan.id}`}>
                    <div className="rounded-xl p-4 border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{formatNaira(Number(loan.principal))} loan</p>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {loan.status === 'completed' ? 'Fully repaid' : loan.status} · {formatDate(loan.created_at)}
                          </p>
                        </div>
                        <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: status.bg, color: status.text }}>
                          {status.label}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Admin link */}
        {isAdmin && (
          <Link
            href="/loans/admin"
            className="block rounded-xl p-4 border text-center transition-colors hover:bg-[var(--surface-card-hover)]"
            style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}
          >
            <p className="text-sm font-medium" style={{ color: "var(--accent)" }}>Admin Dashboard →</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Review applications, track overdue loans, monitor capital exposure</p>
          </Link>
        )}

        {/* No loans yet */}
        {(!loans || loans.length === 0) && (
          <div className="rounded-xl p-8 border text-center" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
            <LoanHandIcon className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>No loans yet</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              {eligibility.eligible
                ? 'Apply for your first loan to get started.'
                : 'Keep saving and participating in esusu groups to unlock loan eligibility.'}
            </p>
          </div>
        )}
      </PageBody>
    </div>
  );
}
