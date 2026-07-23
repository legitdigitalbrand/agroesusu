import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import EmptyState from '@/components/app/empty-state';
import { formatNaira, formatDate } from '@/lib/format';
import { Banknote } from 'lucide-react';

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

export default async function LoansPage() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data: loans } = await supabase
    .from('loans')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Loans</h1>
        <Link href="/loans/apply" className="px-5 py-2.5 bg-forest-green text-white rounded-lg font-medium hover:bg-forest-green-dark transition">
          Apply for Loan
        </Link>
      </div>

      {loans && loans.length > 0 ? (
        <div className="space-y-4">
          {loans.map((loan) => (
            <Link key={loan.id} href={`/loans/${loan.id}`} className="block bg-white rounded-2xl border p-5 hover:border-forest-green transition">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{formatNaira(loan.amount_approved || loan.amount_requested)}</p>
                  <p className="text-sm text-gray-500">{loan.purpose} • {loan.tenor_days} days</p>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${statusColors[loan.status] || 'bg-gray-100'}`}>
                  {loan.status.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-2">Applied {formatDate(loan.created_at)}</p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border p-8">
          <EmptyState
            title="No loans yet"
            description="Apply for your first farm loan and get an instant decision"
            actionLabel="Apply Now"
            actionHref="/loans/apply"
          />
        </div>
      )}
    </div>
  );
}
