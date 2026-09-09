import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { reconcileWithdrawal } from '@/modules/withdrawal';

// GET /api/transfers/[reference]/status — check transfer status
//
// The reference is the payment_reference (WDL-…) returned by POST /api/transfers.
// Sends are persisted in `withdrawal_requests` (single payout engine), so the
// old lookup against the retired `transfers` table always 404'd — this route
// now reads the actual record and reconciles it against Safe Haven live:
//   - pending / transfer_submitted → reconcileWithdrawal() checks the provider
//     and settles (success) or reverses (failure) with full ledger handling
//   - terminal states (completed/failed) → returned as stored
//
// Reconciliation and record writes use the service client (rows are created
// by the payout engine under the service role; the read is scoped to the
// authenticated customer).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
) {
  const limited = applyRateLimit(request, "/api/transfers/status", RATE_LIMITS.TRANSFER);
  if (limited) return limited;
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve the customer (service client — customers rows are service-managed)
    const serviceClient = createServiceClient();
    const { data: customer } = await serviceClient
      .from('customers')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle();

    if (!customer) {
      return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });
    }

    const { reference } = await params;

    // Find the withdrawal request by payment reference, owned by this customer
    const { data: withdrawal } = await serviceClient
      .from('withdrawal_requests')
      .select('id, status, payment_reference, amount, beneficiary_account_name, beneficiary_bank_code, failure_reason')
      .eq('payment_reference', reference)
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!withdrawal) {
      return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });
    }

    // Terminal states — return stored status without a provider round-trip
    if (withdrawal.status === 'completed' || withdrawal.status === 'failed' || withdrawal.status === 'reversed') {
      return NextResponse.json({
        reference,
        status: withdrawal.status === 'completed' ? 'success' : 'failed',
        message: withdrawal.status === 'completed'
          ? 'Transfer completed'
          : withdrawal.failure_reason || 'Transfer failed',
        amount: withdrawal.amount,
        beneficiary_account_name: withdrawal.beneficiary_account_name,
        beneficiary_bank_code: withdrawal.beneficiary_bank_code,
      });
    }

    // Still in flight — reconcile against Safe Haven (settle or reverse)
    const result = await reconcileWithdrawal(withdrawal.id);

    const statusMap: Record<string, string> = {
      completed: 'success',
      pending: 'pending',
      transfer_submitted: 'pending',
      failed: 'failed',
      requires_reconciliation: 'pending',
    };

    return NextResponse.json({
      reference,
      status: statusMap[result.status] || 'pending',
      message: result.message,
      amount: withdrawal.amount,
      beneficiary_account_name: withdrawal.beneficiary_account_name,
      beneficiary_bank_code: withdrawal.beneficiary_bank_code,
    });

  } catch (error) {
    console.error('[API:transfer-status] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check status' },
      { status: 500 }
    );
  }
}
