import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { formatNaira, formatDate } from '@/lib/format';
import AdminReviewActions from '@/components/app/admin-review-actions';

export default async function AdminPage() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login');

  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
        <p className="text-gray-500">You need admin privileges to view this page.</p>
      </div>
    );
  }

  // Fetch pending review items
  const [{ data: reviewQueue }, { data: manualReviewLoans }] = await Promise.all([
    supabase.from('admin_review_queue').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
    supabase.from('loans').select('*, profiles!inner(*)').eq('status', 'manual_review').order('created_at', { ascending: false }),
  ]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Admin Review Queue</h1>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border p-4">
          <p className="text-sm text-gray-500">Pending Reviews</p>
          <p className="text-2xl font-bold text-forest-green">{reviewQueue?.length || 0}</p>
        </div>
        <div className="bg-white rounded-2xl border p-4">
          <p className="text-sm text-gray-500">Manual Review Loans</p>
          <p className="text-2xl font-bold text-forest-green">{manualReviewLoans?.length || 0}</p>
        </div>
        <div className="bg-white rounded-2xl border p-4">
          <p className="text-sm text-gray-500">Total Queue</p>
          <p className="text-2xl font-bold text-forest-green">{(reviewQueue?.length || 0) + (manualReviewLoans?.length || 0)}</p>
        </div>
      </div>

      {/* Manual Review Loans */}
      {manualReviewLoans && manualReviewLoans.length > 0 && (
        <div className="bg-white rounded-2xl border p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Loans Awaiting Manual Review</h2>
          <div className="space-y-4">
            {manualReviewLoans.map((loan: any) => (
              <div key={loan.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-gray-900">{loan.purpose}</p>
                    <p className="text-sm text-gray-500">{loan.profiles?.full_name} • {loan.profiles?.state}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">{formatNaira(loan.amount_requested)}</p>
                    <p className="text-xs text-gray-400">{loan.tenor_days} days • {(loan.monthly_rate * 100).toFixed(2)}%</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                  <div>
                    <p className="text-gray-400">Farm Type</p>
                    <p className="font-medium capitalize">{loan.profiles?.farm_type || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Monthly Income</p>
                    <p className="font-medium">{loan.profiles?.monthly_income_estimate ? formatNaira(loan.profiles.monthly_income_estimate) : 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Credit Score</p>
                    <p className="font-medium">{loan.profiles?.credit_score || 'Not scored'}</p>
                  </div>
                </div>
                <AdminReviewActions loanId={loan.id} userId={loan.user_id} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin Review Queue Items */}
      {reviewQueue && reviewQueue.length > 0 && (
        <div className="bg-white rounded-2xl border p-6">
          <h2 className="font-semibold text-gray-900 mb-4">General Review Queue</h2>
          <div className="space-y-3">
            {reviewQueue.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 capitalize">{item.related_type} Review</p>
                  <p className="text-sm text-gray-500">{item.reason} • {formatDate(item.created_at)}</p>
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-yellow-50 text-yellow-700 capitalize">{item.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(!manualReviewLoans || manualReviewLoans.length === 0) && (!reviewQueue || reviewQueue.length === 0) && (
        <div className="bg-white rounded-2xl border p-12 text-center">
          <p className="text-gray-500">No items in the review queue. 🎉</p>
        </div>
      )}
    </div>
  );
}
