import { createClient, createAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PageHero, PageBody } from '@/components/ui/page-hero';
import { formatNaira, formatDate } from '@/lib/utils';
import { LOANS_LIVE_MODE } from '@/lib/loans/config';
import { ArrowLeftIcon, AlertTriangleIcon, CheckIcon, InfoIcon } from '@/components/icons';
import { AdminLoanActions } from './admin-actions';

export default async function LoanAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('tier').eq('id', user.id).single();

  if (profile?.tier !== 'admin') {
    redirect('/loans');
  }

  const [
    { data: activeLoans },
    { data: overdueLoans },
    { data: pendingLoans },
    { data: completedLoans },
    { data: allLoans },
  ] = await Promise.all([
    admin.from('loans').select('*').eq('status', 'active').order('created_at', { ascending: false }),
    admin.from('loans').select('*').eq('status', 'overdue').order('overdue_days', { ascending: false }),
    admin.from('loans').select('*').eq('status', 'pending_review').order('created_at', { ascending: false }),
    admin.from('loans').select('*').eq('status', 'completed').order('completed_date', { ascending: false }),
    admin.from('loans').select('principal, outstanding_balance, status'),
  ]);

  const totalDisbursed = [...(activeLoans || []), ...(overdueLoans || [])].reduce((sum, l) => sum + Number(l.principal), 0);
  const totalOutstanding = [...(activeLoans || []), ...(overdueLoans || [])].reduce((sum, l) => sum + Number(l.outstanding_balance), 0);
  const totalCompleted = (completedLoans || []).reduce((sum, l) => sum + Number(l.principal), 0);

  // Overdue buckets
  const overdueBuckets = {
    grace: (overdueLoans || []).filter(l => l.overdue_days <= 3),
    restricted: (overdueLoans || []).filter(l => l.overdue_days > 3 && l.overdue_days < 14),
    manualReview: (overdueLoans || []).filter(l => l.overdue_days >= 14),
  };

  return (
    <div>
      <PageHero maxWidth="max-w-5xl">
        <Link href="/loans" className="inline-flex items-center gap-2 text-sm mb-4" style={{ color: "var(--hero-text-muted)" }}>
          <ArrowLeftIcon className="w-4 h-4" /> Back to Loans
        </Link>
        <h1 className="text-2xl font-bold" style={{ color: "var(--hero-text)" }}>Loan Admin Dashboard</h1>
        <p className="text-sm mt-1" style={{ color: "var(--hero-text-muted)" }}>
          Monitor capital exposure, review applications, and track overdue loans.
        </p>
      </PageHero>

      <PageBody maxWidth="max-w-5xl">
        {/* Sandbox banner */}
        {!LOANS_LIVE_MODE && (
          <div className="rounded-xl p-4 mb-6 border flex items-start gap-3" style={{ background: "rgba(201,137,31,0.08)", borderColor: "rgba(201,137,31,0.3)" }}>
            <AlertTriangleIcon className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "var(--warning)" }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--warning)" }}>Sandbox Mode — LOANS_LIVE_MODE is OFF</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                All disbursements are simulated. Enable live mode only after Money Lender's Licence and FCCPC registration are confirmed.
              </p>
            </div>
          </div>
        )}

        {/* Capital exposure stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="rounded-xl p-4 border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>TOTAL DISBURSED</p>
            <p className="text-xl font-bold mt-1" style={{ color: "var(--text-primary)" }}>{formatNaira(totalDisbursed)}</p>
          </div>
          <div className="rounded-xl p-4 border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>OUTSTANDING</p>
            <p className="text-xl font-bold mt-1" style={{ color: "var(--danger)" }}>{formatNaira(totalOutstanding)}</p>
          </div>
          <div className="rounded-xl p-4 border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>ACTIVE LOANS</p>
            <p className="text-xl font-bold mt-1" style={{ color: "var(--success)" }}>{(activeLoans || []).length}</p>
          </div>
          <div className="rounded-xl p-4 border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>OVERDUE</p>
            <p className="text-xl font-bold mt-1" style={{ color: "var(--danger)" }}>{(overdueLoans || []).length}</p>
          </div>
        </div>

        {/* Overdue breakdown */}
        {(overdueLoans || []).length > 0 && (
          <div className="rounded-xl p-5 mb-6 border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Overdue Breakdown</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-lg" style={{ background: "rgba(201,137,31,0.08)" }}>
                <p className="text-lg font-bold" style={{ color: "var(--warning)" }}>{overdueBuckets.grace.length}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Grace (1-3 days)</p>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ background: "rgba(193,57,43,0.08)" }}>
                <p className="text-lg font-bold" style={{ color: "var(--danger)" }}>{overdueBuckets.restricted.length}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Restricted (4-13 days)</p>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ background: "rgba(193,57,43,0.12)" }}>
                <p className="text-lg font-bold" style={{ color: "var(--danger)" }}>{overdueBuckets.manualReview.length}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Manual Review (14+)</p>
              </div>
            </div>

            {/* Manual review list */}
            {overdueBuckets.manualReview.length > 0 && (
              <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--border-subtle)" }}>
                <p className="text-xs font-semibold mb-2" style={{ color: "var(--danger)" }}>Needs Human Outreach:</p>
                <div className="space-y-2">
                  {overdueBuckets.manualReview.map((loan: any) => (
                    <Link key={loan.id} href={`/loans/${loan.id}`}>
                      <div className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: "var(--surface-card-hover)" }}>
                        <span className="text-sm" style={{ color: "var(--text-primary)" }}>{formatNaira(Number(loan.principal))} loan</span>
                        <span className="text-xs font-medium" style={{ color: "var(--danger)" }}>{loan.overdue_days} days overdue</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pending applications */}
        {(pendingLoans || []).length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
              Pending Applications ({(pendingLoans || []).length})
            </h3>
            <div className="space-y-3">
              {(pendingLoans || []).map((loan: any) => (
                <div key={loan.id} className="rounded-xl p-4 border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        {formatNaira(Number(loan.principal))} · {loan.tier} tier
                      </p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {loan.num_installments} weekly installments · {formatNaira(Number(loan.installment_amount))}/week
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        Applied {formatDate(loan.created_at)} · Interest: {formatNaira(Number(loan.interest_amount))}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{formatNaira(Number(loan.total_repayable))}</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>total repayable</p>
                    </div>
                  </div>
                  <AdminLoanActions loanId={loan.id} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active loans list */}
        {(activeLoans || []).length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Active Loans</h3>
            <div className="space-y-2">
              {(activeLoans || []).map((loan: any) => {
                const progress = Math.round(((Number(loan.total_repayable) - Number(loan.outstanding_balance)) / Number(loan.total_repayable)) * 100);
                return (
                  <Link key={loan.id} href={`/loans/${loan.id}`}>
                    <div className="rounded-xl p-4 border transition-colors hover:bg-[var(--surface-card-hover)]" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{formatNaira(Number(loan.principal))}</p>
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>{progress}% repaid</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-card-hover)" }}>
                        <div className="h-full rounded-full" style={{ width: `${progress}%`, background: "var(--success)" }} />
                      </div>
                      <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                        {formatNaira(Number(loan.outstanding_balance))} outstanding
                        {loan.next_due_date && ` · Next: ${formatDate(loan.next_due_date)}`}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {(!activeLoans || activeLoans.length === 0) && (!pendingLoans || pendingLoans.length === 0) && (!overdueLoans || overdueLoans.length === 0) && (
          <div className="rounded-xl p-8 border text-center" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
            <InfoIcon className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>No active loans</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Loan applications will appear here for review.</p>
          </div>
        )}
      </PageBody>
    </div>
  );
}
