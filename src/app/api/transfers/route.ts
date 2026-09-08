import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { initiateWithdrawal } from '@/modules/withdrawal';
import { dispatchNotification } from '@/modules/communications';

// POST /api/transfers — initiate a bank transfer from wallet
//
// TWO-PHASE (Gate 4 P0 #2 — mirrors withdrawal/service.ts):
//   Phase 1 (Reservation): wallet hold placed (concurrency guard, P0 #3),
//     then D Customer Wallet, C Escrow (2004) via FTO. Available drops.
//   Phase 2a (Success):  D Escrow (2004), C Safe Haven Settlement (1000)
//   Phase 2b (Pending):  funds stay reserved; webhook/recon confirms later
//   Phase 2c (Failure):  reservation reversed — funds returned to wallet
//
// IDEMPOTENCY (Gate 4 P0 #1): deterministic server-derived keys. A retried
// request (double-click, network retry) hits the same key and returns the
// existing transfer instead of executing a second one.
//
// Body: {
//   nameEnquiryReference: string,
//   beneficiaryBankCode: string,
//   beneficiaryBankName: string,
//   beneficiaryAccountNumber: string,
//   beneficiaryAccountName: string,
//   amount: number,
//   narration?: string,
//   clientReference?: string  // optional client-supplied idempotency reference
// }
export async function POST(request: NextRequest) {
  const limited = applyRateLimit(request, "/api/transfers", RATE_LIMITS.TRANSFER);
  if (limited) return limited;
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      nameEnquiryReference,
      beneficiaryBankCode,
      beneficiaryBankName,
      beneficiaryAccountNumber,
      beneficiaryAccountName,
      amount,
      narration,
      clientReference,
    } = body;

    // Validate required fields
    if (!nameEnquiryReference || !beneficiaryBankCode || !beneficiaryAccountNumber ||
        !beneficiaryAccountName || !amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Missing required fields for transfer' },
        { status: 400 }
      );
    }

    const transferAmount = Number(amount);

    // Get customer and wallet
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle();

    if (!customer) {
      return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });
    }

    const { data: wallet } = await supabase
      .from('wallets')
      .select('id')
      .eq('customer_id', customer.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!wallet) {
      return NextResponse.json({ error: 'No active wallet found' }, { status: 400 });
    }

    // ── SINGLE PAYOUT ENGINE (consolidation, 2026-09-09) ─────────────────
    // /api/transfers and /api/wallets/withdraw previously ran two parallel
    // implementations of the same wallet→bank flow, each with its own escrow
    // code, name-enquiry endpoint and bank list — they drifted apart and both
    // broke independently. Both now funnel through the withdrawal module
    // (initiateWithdrawal), which already provides: tier/limit validation,
    // deterministic idempotency (Gate 4 P0 #1), atomic wallet holds (P0 #3),
    // two-phase escrow (reservation → provider transfer → settle/reverse),
    // webhook + cron + manual reconciliation, and full audit on
    // withdrawal_requests. "Transfer" and "Withdraw" are one operation with
    // two entry points.

    // Audit IP/device for the withdrawal record
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : undefined;
    const deviceId = request.cookies.get('device_id')?.value || undefined;

    const result = await initiateWithdrawal({
      wallet_id: wallet.id,
      amount: transferAmount,
      beneficiary_bank_code: beneficiaryBankCode,
      beneficiary_account_number: beneficiaryAccountNumber,
      beneficiary_account_name: beneficiaryAccountName,
      name_enquiry_session_id: nameEnquiryReference,
      narration: narration || `Transfer to ${beneficiaryAccountName}`,
      customer_id: customer.id,
      auth_user_id: user.id,
      ip_address: ip,
      device_id: deviceId,
    });

    // Map the WithdrawalResult to the transfer-page response contract
    // ({ status: success | pending | failed, message, reference }).
    const statusMap: Record<string, string> = {
      completed: 'success',
      pending: 'pending',
      failed: 'failed',
    };
    const status = statusMap[result.status] || 'failed';

    if (status === 'failed') {
      return NextResponse.json(
        { error: result.message || 'Transfer failed', reference: result.payment_reference, status },
        { status: 400 }
      );
    }

    // Dispatch notification (async, non-blocking) — mirrors the withdrawal flow
    dispatchNotification({
      event: status === 'success' ? 'withdrawal_completed' : 'withdrawal_initiated',
      user_id: user.id,
      variables: {
        amount: transferAmount.toLocaleString('en-NG', { style: 'currency', currency: 'NGN' }),
        bankName: beneficiaryBankName || beneficiaryBankCode,
        accountNumber: beneficiaryAccountNumber,
      },
      metadata: { withdrawal_id: result.id, payment_reference: result.payment_reference, client_reference: clientReference || undefined },
      related_entity_type: 'withdrawal',
      related_entity_id: result.id,
    }).catch(() => {});

    return NextResponse.json({
      status,
      message: result.message,
      reference: result.payment_reference,
      withdrawal_id: result.id,
    });
  } catch (error) {
    console.error('[API:transfers] Error:', error);
    return NextResponse.json(
      { error: 'Transfer failed. Please try again.', status: 'failed' },
      { status: 500 }
    );
  }
}

export async function GET(_request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle();

    if (!customer) {
      return NextResponse.json({ transfers: [] });
    }

    const { data: transfers } = await supabase
      .from('transfers')
      .select('*')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(50);

    return NextResponse.json({ transfers: transfers || [] });

  } catch (error) {
    console.error('[API:transfers GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
