import { createClient, createAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PageHero, PageBody } from '@/components/ui/page-hero';
import { formatNaira, formatDate } from '@/lib/utils';
import { LOANS_LIVE_MODE } from '@/lib/loans/config';
import { ArrowLeftIcon, CheckIcon, AlertTriangleIcon, InfoIcon } from '@/components/icons';
import { RepayButton } from './repay-button';

export default async function LoanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  const admin = createAdminClient();

  const [{ data: loan }, { data: installments }] = await Promise.all([
    admin.from('loans').select('*').eq('id', id).eq('user_id', user.id).single(),
    admin.from('loan_installments').select('*').eq('loan_id', id).order('installment_number', { ascending: true }),
  ]);

  if (!loan) redirect('/loans');

  const statusConfigs: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: 'rgba(59,143,59,0.10)', text: 'var(--success)', label: 'Active' },
    overdue: { bg: 'rgba(193,57,43,0.10)', text: 'var(--danger)', label: 'Overdue' },
    pending_review: { bg: 'rgba(201,137,31,0.10)', text: 'var(--warning)', label: 'Under Review' },
    completed: { bg: 'rgba(11,61,31,0.08)', text: 'var(--accent)', label: 'Completed' },
    defaulted: { bg: 'rgba(193,57,43,0.10)', text: 'var(--danger)', label: 'Defaulted' },
    rejected: { bg: 'rgba(138,138,126,0.10)', text: 'var(--text-muted)', label: 'Rejected' },
    approved: { bg: 'rgba(59,143,59,0.10)', text: 'var(--success)', label: 'Approved' },
  };

  const status = statusConfigs[loan.status] || statusConfigs.active;
  const progressPercent = Math.round(((Number(loan.total_repayable) - Number(loan.outstanding_balance)) / Number(loan.total_repayable)) * 100);
  const canRepay = ['active', 'overdue'].includes(loan.status);
  const nextDueInstallment = installments?.find(i => ['pending', 'partial', 'overdue'].includes(i.status));

  return (
    <div>
      <PageHero maxWidth="max-w-2xl">
        <Link href="/loans" className="inline-flex items-center gap-2 text-sm mb-4" style={{ color: "var(--hero-text-muted)" }}>
          <ArrowLeftIcon className="w-4 h-4" /> Back to Loans
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wide" style={{ color: "var(--hero-pill-bg)" }}>LOAN DETAILS</p>
            <h1 className="text-2xl font-bold mt-1" style={{ color: "var(--hero-text)" }}>{formatNaira(Number(loan.principal))}</h1>
            <p className="text-sm capitalize" style={{ color: "var(--hero-text-muted)" }}>{loan.tier} tier · {loan.num_installments} weekly installments</p>
          </div>
          <span className="text-xs px-3 py-1.5 rounded-full font-semibold" style={{ background: status.bg, color: status.text }}>
            {status.label}
          </span>
        </div>
      </PageHero>

      <PageBody maxWidth="max-w-2xl">
        {/* Sandbox notice */}
        {!LOANS_LIVE_MODE && loan.status !== 'pending_review' && loan.status !== 'rejected' && (
          <div className="rounded-xl p-3 mb-5 border flex items-start gap-2" style={{ background: "rgba(201,137,31,0.08)", borderColor: "rgba(201,137,31,0.3)" }}>
            <InfoIcon className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--warning)" }} />
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Sandbox mode — no real money was disbursed. Repayments are simulated.
            </p>
          </div>
        )}

        {/* Summary card */}
        <div className="rounded-xl p-5 mb-5 border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>Principal</span>
              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{formatNaira(Number(loan.principal))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>Interest ({Number(loan.interest_rate)}% flat)</span>
              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{formatNaira(Number(loan.interest_amount))}</span>
            </div>
            <div className="flex justify-between pt-2 border-t" style={{ borderColor: "var(--border-subtle)" }}>
              <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Total Repayable</span>
              <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{formatNaira(Number(loan.total_repayable))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>Outstanding Balance</span>
              <span className="text-sm font-bold" style={{ color: "var(--danger)" }}>{formatNaira(Number(loan.outstanding_balance))}</span>
            </div>
            {loan.late_fee_amount > 0 && Number(loan.late_fee_amount) > 0 && (
              <div className="flex justify-between">
                <span className="text-sm" style={{ color: "var(--warning)" }}>Late fee applied</span>
                <span className="text-sm font-medium" style={{ color: "var(--warning)" }}>{formatNaira(Number(loan.late_fee_amount))}</span>
              </div>
            )}
          </div>

          {/* Progress bar */}
          {canRepay && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--border-subtle)" }}>
              <div className="flex justify-between text-xs mb-1">
                <span style={{ color: "var(--text-muted)" }}>Repaid: {progressPercent}%</span>
                <span style={{ color: "var(--text-secondary)" }}>{formatNaira(Number(loan.outstanding_balance))} remaining</span>
              </div>
              <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--surface-card-hover)" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${progressPercent}%`, background: loan.status === 'overdue' ? "var(--danger)" : "var(--success)" }} />
              </div>
            </div>
          )}
        </div>

        {/* Overdue warning */}
        {loan.status === 'overdue' && (
          <div className="rounded-xl p-4 mb-5 border flex items-start gap-3" style={{ background: "rgba(193,57,43,0.08)", borderColor: "rgba(193,57,43,0.2)" }}>
            <AlertTriangleIcon className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "var(--danger)" }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--danger)" }}>Payment Overdue</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                Your payment is {loan.overdue_days} day(s) overdue. Please make a payment to avoid further fees.
                {' '}Your savings are never locked as punishment — you can still withdraw your own money.
              </p>
            </div>
          </div>
        )}

        {/* Installment schedule */}
        <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Repayment Schedule</h3>
        <div className="space-y-2 mb-6">
          {(installments || []).map((inst: any) => {
            const instStatus: Record<string, { color: string; label: string }> = {
              pending: { color: 'var(--text-muted)', label: 'Pending' },
              paid: { color: 'var(--success)', label: 'Paid' },
              partial: { color: 'var(--warning)', label: 'Partial' },
              overdue: { color: 'var(--danger)', label: 'Overdue' },
              defaulted: { color: 'var(--danger)', label: 'Defaulted' },
            };
            const instConfig = instStatus[inst.status] || instStatus.pending;
            const isUpcoming = inst.status === 'pending' && new Date(inst.due_date) > new Date();
            const amountPaid = Number(inst.amount_paid || 0);
            const amountDue = Number(inst.amount_due);
            const remaining = amountDue - amountPaid;

            return (
              <div
                key={inst.id}
                className="rounded-xl p-4 border flex items-center justify-between"
                style={{
                  background: "var(--surface-card)",
                  borderColor: inst.status === 'overdue' ? "var(--danger)" : "var(--border-default)",
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      background: inst.status === 'paid' ? "rgba(59,143,59,0.10)" : "var(--surface-card-hover)",
                    }}
                  >
                    {inst.status === 'paid' ? (
                      <CheckIcon className="w-4 h-4" style={{ color: "var(--success)" }} strokeWidth={2.5} />
                    ) : (
                      <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>{inst.installment_number}</span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {formatNaira(remaining > 0 ? remaining : amountDue)}
                      {inst.status === 'partial' && ` (of ${formatNaira(amountDue)})`}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Due {formatDate(inst.due_date)}
                      {inst.paid_date && ` · Paid ${formatDate(inst.paid_date)}`}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-medium" style={{ color: instConfig.color }}>
                  {instConfig.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Manual repayment */}
        {canRepay && nextDueInstallment && (
          <div className="rounded-xl p-5 border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Make a Payment</h3>
            <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
              Pay your installment of {formatNaira(Number(nextDueInstallment.amount_due) - Number(nextDueInstallment.amount_paid || 0))} manually.
              {LOANS_LIVE_MODE ? ' This will charge your linked card via Paystack.' : ' (Sandbox — no real charge)'}
            </p>
            <RepayButton loanId={loan.id} amount={Number(nextDueInstallment.amount_due) - Number(nextDueInstallment.amount_paid || 0)} />
          </div>
        )}

        {/* Pending review status */}
        {loan.status === 'pending_review' && (
          <div className="rounded-xl p-5 border text-center" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
            <InfoIcon className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--warning)" }} />
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Your application is under review</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Submitted on {formatDate(loan.created_at)}. You'll be notified when it's approved.
            </p>
          </div>
        )}

        {/* Completed */}
        {loan.status === 'completed' && (
          <div className="rounded-xl p-5 border text-center" style={{ background: "var(--accent-subtle)", borderColor: "var(--accent)" }}>
            <CheckIcon className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--success)" }} strokeWidth={2.5} />
            <p className="text-sm font-semibold" style={{ color: "var(--accent)" }}>Loan Fully Repaid</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
              Completed on {loan.completed_date ? formatDate(loan.completed_date) : 'N/A'}. Your credit score has improved!
            </p>
          </div>
        )}

        {/* Rejected */}
        {loan.status === 'rejected' && (
          <div className="rounded-xl p-5 border text-center" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
            <AlertTriangleIcon className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Application Rejected</p>
            {loan.admin_notes && (
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{loan.admin_notes}</p>
            )}
          </div>
        )}
      </PageBody>
    </div>
  );
}
