import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getBankingProvider } from '@/modules/integrations';
import { initiate } from '@/modules/orchestrator';
import { getWalletAccountId } from '@/modules/ledger';

// POST /api/transfers — initiate a bank transfer from wallet
// Body: {
//   nameEnquiryReference: string,
//   beneficiaryBankCode: string,
//   beneficiaryBankName: string,
//   beneficiaryAccountNumber: string,
//   beneficiaryAccountName: string,
//   amount: number,
//   narration?: string
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
    } = body;

    // Validate required fields
    if (!nameEnquiryReference || !beneficiaryBankCode || !beneficiaryAccountNumber ||
        !beneficiaryAccountName || !amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Missing required fields for transfer' },
        { status: 400 }
      );
    }

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
      .select('id, account_number, available_balance')
      .eq('customer_id', customer.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!wallet) {
      return NextResponse.json({ error: 'No active wallet found' }, { status: 400 });
    }

    // Check sufficient balance
    if (wallet.available_balance < amount) {
      return NextResponse.json(
        { error: `Insufficient balance. Your wallet has ₦${wallet.available_balance.toLocaleString()}` },
        { status: 400 }
      );
    }

    const paymentReference = `TRF-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const serviceClient = createServiceClient();

    // Initiate the transfer with the banking provider
    const provider = getBankingProvider();
    const transferResult = await provider.transfer({
      nameEnquiryReference,
      debitAccountNumber: wallet.account_number,
      beneficiaryBankCode,
      beneficiaryAccountNumber,
      amount,
      narration: narration || `Transfer to ${beneficiaryAccountName}`,
      paymentReference,
      saveBeneficiary: false,
    });

    // Debit the wallet via the Orchestrator (wallet_withdrawal type)
    try {
      const walletAccountId = await getWalletAccountId(wallet.id);
      if (walletAccountId) {
        await initiate({
          transaction_type: 'wallet_withdrawal',
          source_module: 'wallet',
          source_reference: paymentReference,
          amount,
          currency: 'NGN',
          description: `Transfer to ${beneficiaryAccountName} (${beneficiaryBankName})`,
          idempotency_key: `bank_transfer:${paymentReference}`,
          wallet_id: wallet.id,
          metadata: {
            type: 'bank_transfer',
            beneficiary: beneficiaryAccountName,
            bank: beneficiaryBankName,
            provider_reference: transferResult.reference,
          },
        });
      }
    } catch (ledgerErr) {
      console.error('[API:transfers] Ledger debit failed:', ledgerErr);
      // Transfer was initiated but ledger failed — log for reconciliation
    }

    // Record the transfer in the transfers table
    await serviceClient.from('transfers').insert({
      customer_id: customer.id,
      wallet_id: wallet.id,
      reference: paymentReference,
      debit_account_number: wallet.account_number,
      beneficiary_bank_code: beneficiaryBankCode,
      beneficiary_bank_name: beneficiaryBankName,
      beneficiary_account_number: beneficiaryAccountNumber,
      beneficiary_account_name: beneficiaryAccountName,
      amount,
      narration: narration || `Transfer to ${beneficiaryAccountName}`,
      payment_reference: paymentReference,
      status: transferResult.status,
      name_enquiry_session_id: nameEnquiryReference,
      provider_response: transferResult,
    });

    return NextResponse.json({
      reference: paymentReference,
      status: transferResult.status,
      message: transferResult.message || (transferResult.status === 'success'
        ? 'Transfer completed successfully'
        : transferResult.status === 'pending'
        ? 'Transfer is being processed'
        : 'Transfer failed'),
    });

  } catch (error) {
    console.error('[API:transfers] Error:', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    const isNetworkError = errMsg.includes('ERR_NAME_NOT_RESOLVED') ||
      errMsg.includes('fetch failed') ||
      errMsg.includes('ECONNREFUSED');
    if (isNetworkError) {
      return NextResponse.json(
        { error: 'Unable to connect to banking service. Check your connection and try again.', code: 'network_error' },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Transfer failed' },
      { status: 500 }
    );
  }
}

// GET /api/transfers — list user's transfers
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
