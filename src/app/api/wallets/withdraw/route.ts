import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { initiateWithdrawal, listWithdrawals } from '@/modules/withdrawal';
import { dispatchNotification } from '@/modules/communications';

export async function POST(request: NextRequest) {
  const limited = applyRateLimit(request, "/api/wallets/withdraw", RATE_LIMITS.WITHDRAW);
  if (limited) return limited;
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Get customer record
    const { data: customer } = await supabase
      .from('customers')
      .select('id, auth_id')
      .eq('auth_id', user.id)
      .maybeSingle();

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      wallet_id,
      amount,
      beneficiary_bank_code,
      beneficiary_account_number,
      beneficiary_account_name,
      name_enquiry_session_id,
      narration,
    } = body;

    // Validate required fields
    if (!wallet_id || !amount || !beneficiary_bank_code || !beneficiary_account_number || !beneficiary_account_name || !name_enquiry_session_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get client IP and device info for audit
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : null;
    const deviceId = request.cookies.get('device_id')?.value || null;

    const result = await initiateWithdrawal({
      wallet_id,
      amount: Number(amount),
      beneficiary_bank_code,
      beneficiary_account_number,
      beneficiary_account_name,
      name_enquiry_session_id,
      narration,
      customer_id: customer.id,
      auth_user_id: user.id,
      ip_address: ip || undefined,
      device_id: deviceId || undefined,
    });

    // Dispatch notification (async, non-blocking)
    if (result.status === 'completed') {
      dispatchNotification({
        event: 'withdrawal_completed',
        user_id: user.id,
        variables: {
          amount: Number(amount).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' }),
          bankName: beneficiary_bank_code,
          accountNumber: beneficiary_account_number,
        },
        metadata: { withdrawal_id: result.id, payment_reference: result.payment_reference },
        related_entity_type: 'withdrawal',
        related_entity_id: result.id,
      }).catch(() => {});
    } else if (result.status === 'pending') {
      dispatchNotification({
        event: 'withdrawal_initiated',
        user_id: user.id,
        variables: {
          amount: Number(amount).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' }),
          bankName: beneficiary_bank_code,
          accountNumber: beneficiary_account_number,
        },
        metadata: { withdrawal_id: result.id, payment_reference: result.payment_reference },
        related_entity_type: 'withdrawal',
        related_entity_id: result.id,
      }).catch(() => {});
    } else if (result.status === 'failed') {
      dispatchNotification({
        event: 'withdrawal_failed',
        user_id: user.id,
        variables: {
          amount: Number(amount).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' }),
          reason: result.message || 'Unknown error',
        },
        metadata: { withdrawal_id: result.id, payment_reference: result.payment_reference },
        related_entity_type: 'withdrawal',
        related_entity_id: result.id,
      }).catch(() => {});
    }

    const status = result.status === 'failed' ? 400 : 200;
    return NextResponse.json(result, { status });
  } catch (error) {
    console.error('[API] Withdrawal error:', error);
    return NextResponse.json({ error: 'Withdrawal failed' }, { status: 500 });
  }
}

// GET /api/wallets/withdraw — list customer's withdrawals
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle();

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const { withdrawals, total } = await listWithdrawals(customer.id, limit, offset);

    return NextResponse.json({ withdrawals, total, limit, offset });
  } catch (error) {
    console.error('[API] List withdrawals error:', error);
    return NextResponse.json({ error: 'Failed to load withdrawals' }, { status: 500 });
  }
}
