import { createClient } from '@/lib/supabase/server';
import { formatNaira, formatDate } from '@/lib/format';
import { notFound } from 'next/navigation';
import RepayButton from '@/components/app/repay-button';

const statusColors: Record<string, string> = {
  pending_review: 'bg-yellow-50 text-yellow-700',
  scoring: 'bg-blue-50 text-blue-700',
  auto_approved: 'bg-green-50 text-green-700',
  auto_declined: 'bg-red-50 text-red-700',
  manual_review: 'bg-orange-50 text-orange-700',
  disbursed: 'bg-forest-green/10 text-forest-green',
  repaying: 'bg-blue-50 text-blue-700',
  closed: 'bg-gray-100 text-gray-600',
  defaulted: 'bg-red-50 text-red-700',
};

export default async function LoanDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data: loan } = await supabase
    .from('loans')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', session.user.id)
    .single();

  if (!loan) notFound();

  const { data: schedule } = await supabase
    .from('loan_repayment_schedule')
    .select('*')
    .eq('loan_id', loan.id)
    .order('due_date', { ascending: true });

  const { data: events } = await supabase
    .from('loan_events')
    .select('*')
    .eq('loan_id', loan.id)
    .order('created_at', { ascending: true });

  const { data: wallet } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', session.user.id)
    .single();

  const totalDue = schedule?.reduce((sum, s) => sum + s.amount_due, 0) || 0;
  const totalPaid = schedule?.reduce((sum, s) => sum + s.amount_paid, 0) || 0;
  const outstanding = totalDue - totalPaid;
  const nextDue = schedule?.find(s => s.status === 'upcoming' || s.status === 'overdue' || s.status === 'partial');

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl border p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{formatNaira(loan.amount_approved || loan.amount_requested)}</h1>
            <p className="text-sm text-gray-500">{loan.purpose} • {loan.tenor_days} days</p>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${statusColors[loan.status] || 'bg-gray-100'}`}>
            {loan.status.replace(/_/g, ' ')}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <p className="text-xs text-gray-400">Monthly Rate</p>
            <p className="font-medium">{(loan.monthly_rate * 100).toFixed(2)}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Applied</p>
            <p className="font-medium">{formatDate(loan.created_at)}</p>
          </div>
          {loan.disbursed_at && (
            <div>
              <p className="text-xs text-gray-400">Disbursed</p>
              <p className="font-medium">{formatDate(loan.disbursed_at)}</p>
            </div>
          )}
          {loan.closed_at && (
            <div>
              <p className="text-xs text-gray-400">Closed</p>
              <p className="font-medium">{formatDate(loan.closed_at)}</p>
            </div>
          )}
          {(loan.status === 'disbursed' || loan.status === 'repaying') && (
            <>
              <div>
                <p className="text-xs text-gray-400">Total Due</p>
                <p className="font-medium">{formatNaira(totalDue)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Outstanding</p>
                <p className="font-medium text-forest-green">{formatNaira(outstanding)}</p>
              </div>
            </>
          )}
        </div>

        {(loan.status === 'disbursed' || loan.status === 'repaying') && outstanding > 0 && (
          <div className="mt-6">
            {wallet && (
              <p className="text-sm text-gray-500 mb-2">Wallet balance: {formatNaira(wallet.balance_cached || 0)}</p>
            )}
            <RepayButton
              loanId={loan.id}
              walletId={wallet?.id || ''}
              userId={session.user.id}
              outstanding={outstanding}
              walletBalance={wallet?.balance_cached || 0}
              nextDueAmount={nextDue?.amount_due || 0}
              nextDueId={nextDue?.id || ''}
            />
          </div>
        )}
      </div>

      {/* Repayment Schedule */}
      {schedule && schedule.length > 0 && (
        <div className="bg-white rounded-2xl border p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Repayment Schedule</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b">
                  <th className="pb-2 font-medium">Due Date</th>
                  <th className="pb-2 font-medium">Amount</th>
                  <th className="pb-2 font-medium">Paid</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="py-3">{formatDate(s.due_date)}</td>
                    <td className="py-3 font-medium">{formatNaira(s.amount_due)}</td>
                    <td className="py-3">{formatNaira(s.amount_paid)}</td>
                    <td className="py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                        s.status === 'paid' ? 'bg-green-50 text-green-700' :
                        s.status === 'overdue' ? 'bg-red-50 text-red-700' :
                        s.status === 'partial' ? 'bg-orange-50 text-orange-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>{s.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Audit Trail */}
      {events && events.length > 0 && (
        <div className="bg-white rounded-2xl border p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Activity Log</h2>
          <div className="space-y-3">
            {events.map((event) => (
              <div key={event.id} className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-forest-green mt-1.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-700 capitalize">{event.event_type.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-gray-400">{formatDate(event.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
