import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { initiate } from '@/modules/orchestrator';
import { dispatchNotification } from '@/modules/communications';
import { candidateKeysFor, deriveIdempotencyKey, findExistingTransaction } from '@/lib/financial-idempotency';

// ── Self-healing: ensure wallet has a ledger account ──
// The trigger trg_wallet_create_ledger_account should fire on wallet creation,
// but it can miss if the wallet was created before the migration or if the
// parent account (2000) didn't exist yet. This ensures the ledger account exists.
async function ensureWalletLedgerAccount(walletId: string): Promise<void> {
  const serviceClient = createServiceClient();

  // Check if ledger account already exists
  const { data: existing } = await serviceClient
    .from('accounts')
    .select('id')
    .eq('owner_wallet_id', walletId)
    .eq('account_category', 'customer_wallet')
    .maybeSingle();

  if (existing) return; // Already has a ledger account

  // Look up the wallet to get wallet_number and customer_id
  const { data: wallet } = await serviceClient
    .from('wallets')
    .select('id, wallet_number, customer_id, status')
    .eq('id', walletId)
    .maybeSingle();

  if (!wallet) return; // Can't create without wallet info

  // Find parent account (2000 - Customer Wallet Accounts)
  const { data: parent } = await serviceClient
    .from('accounts')
    .select('id')
    .eq('account_code', '2000')
    .eq('account_category', 'customer_wallet')
    .maybeSingle();

  if (!parent) {
    console.error('[API:wallet-deposit] Parent ledger account 2000 not found — chart of accounts may not be seeded');
    return;
  }

  // Create the wallet ledger account
  const accountCode = `2000.${wallet.wallet_number}`;
  const { error } = await serviceClient
    .from('accounts')
    .insert({
      account_code: accountCode,
      account_type: 'liability',
      account_category: 'customer_wallet',
      name: `Wallet: ${wallet.wallet_number}`,
      description: `Customer wallet account for ${wallet.wallet_number}`,
      owner_wallet_id: wallet.id,
      parent_account_id: parent.id,
      is_system_account: false,
      is_active: true,
      metadata: { wallet_number: wallet.wallet_number, customer_id: wallet.customer_id },
    });

  if (error) {
    console.error('[API:wallet-deposit] Failed to create wallet ledger account:', error.message);
  } else {
    console.log('[API:wallet-deposit] Self-healed: created ledger account for wallet', wallet.wallet_number);
  }
}

// POST /api/wallets/[walletId]/deposit
// Manual wallet funding (sandbox/testing mode).
// In production, wallet funding happens via Safe Haven DVA bank transfer + webhook.
//
// This endpoint is for:
// 1. Sandbox testing — simulate a bank transfer credit
// 2. Admin manual credit (with proper authorization)
// 3. Internal transfers between wallets
//
// In production, this endpoint should be restricted to admin-only or disabled.
export async function POST(
  request: NextRequest,
  context: { params: { walletId: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { amount, description, source, clientReference } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });
    }

    // Verify wallet ownership
    const { data: isStaff } = await supabase.rpc('is_staff');
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle();

    if (!customer && !isStaff) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Verify wallet belongs to customer (or staff with permission)
    if (!isStaff && customer) {
      const { data: wallet } = await supabase
        .from('wallets')
        .select('id')
        .eq('id', context.params.walletId)
        .eq('customer_id', customer.id)
        .maybeSingle();

      if (!wallet) {
        return NextResponse.json({ error: 'Forbidden: not your wallet' }, { status: 403 });
      }
    }

    // Check if this is sandbox mode (allow self-funding for testing)
    const isSandbox =
      process.env.SAFE_HAVEN_ENV === 'mock' ||
      process.env.SAFEHAVEN_API_URL?.includes('sandbox') ||
      process.env.NODE_ENV !== 'production';

    if (!isSandbox && !isStaff) {
      return NextResponse.json({
        error: 'Manual wallet funding is not available in production. Use bank transfer to your DVA account.',
        hint: 'Visit /wallet/deposit to see your Safe Haven account details for bank transfer.',
      }, { status: 403 });
    }

    // Self-healing: ensure wallet has a ledger account before processing
    await ensureWalletLedgerAccount(context.params.walletId);

    // IDEMPOTENCY (Gate 4 P0 #1): deterministic server-derived key — a retried
    // request collapses into the existing deposit instead of executing twice.
    const idemParams = {
      customer_id: customer?.id || user.id,
      wallet_id: context.params.walletId,
      amount: Number(amount),
      client_reference: clientReference || undefined,
    };
    const idempotencyKey = deriveIdempotencyKey('wallet_deposit', idemParams);

    const existingFt = await findExistingTransaction(candidateKeysFor('wallet_deposit', idemParams));
    if (existingFt) {
      const inFlight = ['initiated', 'validated', 'posting', 'posted'].includes(existingFt.status);
      return NextResponse.json({
        success: existingFt.status === 'completed',
        duplicate: true,
        transaction_reference: existingFt.transaction_reference,
        message: inFlight
          ? 'This deposit is already being processed.'
          : 'This deposit was already completed.',
      }, { status: 200 });
    }

    // Process the deposit through the Orchestrator
    const result = await initiate({
      transaction_type: 'wallet_deposit',
      source_module: 'wallet',
      source_reference: context.params.walletId,
      amount: Number(amount),
      currency: 'NGN',
      description: description || `Wallet funding (${source || 'manual'})`,
      idempotency_key: idempotencyKey,
      wallet_id: context.params.walletId,
      metadata: {
        source: source || 'manual',
        sandbox: isSandbox,
      },
    });

    if (result.status === 'failed') {
      console.error('[API:wallet-deposit] Orchestrator failed:', result.error);
      return NextResponse.json({ error: result.error || 'Deposit failed' }, { status: 400 });
    }

    // Dispatch deposit notification (async, non-blocking)
    dispatchNotification({
      event: 'deposit_received',
      user_id: user.id,
      variables: {
        amount: Number(body.amount).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' }),
        accountNumber: context.params.walletId.slice(0, 8),
      },
      metadata: { ft_id: result.id, transaction_reference: result.transaction_reference },
      related_entity_type: 'wallet_transaction',
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      transaction_reference: result.transaction_reference,
      amount: Number(amount),
      status: result.status,
      message: 'Wallet funded successfully',
    });

  } catch (error) {
    console.error('[API:wallet-deposit] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
