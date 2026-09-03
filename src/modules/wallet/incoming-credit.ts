// ============================================================================
// Incoming Credit Processing
//
// Processes incoming bank transfer credits from Safe Haven webhooks.
// Matches credits to customers via their DVA account number, creates
// Financial Transactions through the Orchestrator, and handles
// unmatched credits safely.
//
// Flow:
//   Webhook → inbound_events → match by account number →
//   Orchestrator (incoming_deposit) → Ledger → Wallet → Notification
//
// Unmatched credits → unmatched_credits table → admin reconciliation
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { initiate } from '@/modules/orchestrator';
import { dispatchNotification } from '@/modules/communications';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export interface IncomingCreditPayload {
  safe_haven_reference: string;
  account_number: string;
  account_name?: string;
  amount: number;
  currency?: string;
  sender_name?: string;
  sender_account_number?: string;
  sender_bank_name?: string;
  narration?: string;
  payment_reference?: string;
  raw_payload?: Record<string, unknown>;
}

export interface IncomingCreditResult {
  status: 'matched' | 'unmatched' | 'duplicate' | 'failed';
  message: string;
  financial_transaction_id?: string;
  wallet_id?: string;
  customer_id?: string;
  unmatched_credit_id?: string;
  inbound_event_id?: string;
}

/**
 * Process an incoming credit from a Safe Haven webhook event.
 *
 * 1. Check idempotency — has this reference been processed?
 * 2. Match the credit to a customer by their DVA account number
 * 3. If matched — create FT via Orchestrator, update wallet, notify
 * 4. If unmatched — create unmatched_credit record for admin review
 * 5. Update inbound_event with linking info
 */
export async function processIncomingCredit(
  inboundEventId: string,
  credit: IncomingCreditPayload
): Promise<IncomingCreditResult> {
  const supabase = getServiceClient();

  try {
    // ── 0. AMOUNT VALIDATION (Gate 4 funding fix) ─────────────
    // A deposit must be a positive, finite amount. A zero/negative/NaN
    // amount can never produce a financial credit (and a negative
    // "deposit" must never post a debit through this path).
    if (!Number.isFinite(credit.amount) || credit.amount <= 0) {
      await supabase
        .from('inbound_events')
        .update({
          processing_status: 'failed',
          error_message: `Invalid deposit amount: ${credit.amount}`,
        })
        .eq('id', inboundEventId);
      return {
        status: 'failed',
        message: `Invalid deposit amount: ${credit.amount}`,
        inbound_event_id: inboundEventId,
      };
    }

    // ── 1. IDEMPOTENCY CHECK ──────────────────────────────────
    // Check if we've already processed this Safe Haven reference
    const { data: existingFT } = await supabase
      .from('financial_transactions')
      .select('id, status')
      .eq('idempotency_key', `incoming_deposit:${credit.safe_haven_reference}`)
      .maybeSingle();

    if (existingFT && (existingFT.status === 'completed' || existingFT.status === 'posted')) {
      return {
        status: 'duplicate',
        message: `Deposit ${credit.safe_haven_reference} already processed`,
        financial_transaction_id: existingFT.id,
      };
    }

    // Also check unmatched_credits for duplicates
    const { data: existingUnmatched } = await supabase
      .from('unmatched_credits')
      .select('id, status')
      .eq('safe_haven_reference', credit.safe_haven_reference)
      .in('status', ['requires_reconciliation', 'under_review', 'matched'])
      .maybeSingle();

    if (existingUnmatched) {
      return {
        status: 'duplicate',
        message: `Credit ${credit.safe_haven_reference} already recorded as unmatched`,
        unmatched_credit_id: existingUnmatched.id,
      };
    }

    // ── 2. MATCH TO CUSTOMER BY DVA ACCOUNT NUMBER ────────────
    const { data: safeHavenAccount } = await supabase
      .from('safe_haven_accounts')
      .select(`
        customer_id,
        account_number,
        account_name,
        bank_name,
        bank_code
      `)
      .eq('account_number', credit.account_number)
      .eq('status', 'active')
      .maybeSingle();

    if (!safeHavenAccount) {
      // ── UNMATCHED — route to reconciliation ─────────────────
      return await createUnmatchedCredit(supabase, inboundEventId, credit);
    }

    // ── 3. GET CUSTOMER'S WALLET ──────────────────────────────
    const { data: wallet } = await supabase
      .from('wallets')
      .select('id, customer_id')
      .eq('customer_id', safeHavenAccount.customer_id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (!wallet) {
      // Customer exists but no active wallet — unmatched
      return await createUnmatchedCredit(supabase, inboundEventId, credit, safeHavenAccount.customer_id);
    }

    // ── 4. CREATE FINANCIAL TRANSACTION VIA ORCHESTRATOR ──────
    const ftResult = await initiate({
      transaction_type: 'incoming_deposit',
      source_module: 'wallet',
      source_reference: credit.safe_haven_reference,
      amount: credit.amount,
      currency: credit.currency || 'NGN',
      description: `Bank transfer from ${credit.sender_name || 'external account'} to ${safeHavenAccount.account_name}`,
      idempotency_key: `incoming_deposit:${credit.safe_haven_reference}`,
      wallet_id: wallet.id,
      metadata: {
        safe_haven_reference: credit.safe_haven_reference,
        account_number: credit.account_number,
        sender_name: credit.sender_name,
        sender_account: credit.sender_account_number,
        sender_bank: credit.sender_bank_name,
        narration: credit.narration,
        inbound_event_id: inboundEventId,
      },
    });

    if (ftResult.status === 'failed') {
      // Update inbound event with error
      await supabase
        .from('inbound_events')
        .update({
          processing_status: 'failed',
          error_message: `Orchestrator failed: ${ftResult.error}`,
          wallet_id: wallet.id,
          customer_id: safeHavenAccount.customer_id,
        })
        .eq('id', inboundEventId);

      return {
        status: 'failed',
        message: `Orchestrator failed: ${ftResult.error}`,
        inbound_event_id: inboundEventId,
      };
    }

    // ── 5. UPDATE INBOUND EVENT WITH LINKING INFO ─────────────
    await supabase
      .from('inbound_events')
      .update({
        processing_status: 'processed' as const,
        processed_at: new Date().toISOString(),
        wallet_id: wallet.id,
        customer_id: safeHavenAccount.customer_id,
        financial_transaction_id: ftResult.id as any,
      })
      .eq('id', inboundEventId);

    // ── 6. UPDATE ANY PENDING INCOMING DEPOSIT REQUEST ────────
    await supabase
      .from('incoming_deposit_requests')
      .update({
        status: 'matched' as const,
        matched_at: new Date().toISOString(),
        inbound_event_id: inboundEventId as any,
        financial_transaction_id: ftResult.id as any,
      })
      .eq('customer_id', safeHavenAccount.customer_id)
      .eq('status', 'pending')
      .lte('created_at', new Date().toISOString());

    // ── 7. DISPATCH NOTIFICATION ──────────────────────────────
    // Get customer's auth_id for notification
    const { data: customer } = await supabase
      .from('customers')
      .select('auth_id')
      .eq('id', safeHavenAccount.customer_id)
      .maybeSingle();

    if (customer?.auth_id) {
      dispatchNotification({
        event: 'deposit_received',
        user_id: customer.auth_id,
        variables: {
          amount: credit.amount.toLocaleString('en-NG', { style: 'currency', currency: 'NGN' }),
          sender: credit.sender_name || 'External account',
          reference: credit.safe_haven_reference,
        },
        metadata: {
          ft_id: ftResult.id,
          transaction_reference: ftResult.transaction_reference,
          safe_haven_reference: credit.safe_haven_reference,
        },
        related_entity_type: 'wallet_transaction',
      }).catch(() => {});  // Non-blocking — never fail financial transaction
    }

    return {
      status: 'matched',
      message: `Deposit of ₦${credit.amount} credited to wallet`,
      financial_transaction_id: ftResult.id,
      wallet_id: wallet.id,
      customer_id: safeHavenAccount.customer_id,
      inbound_event_id: inboundEventId,
    };

  } catch (error) {
    console.error('[IncomingCredit] Error:', error);
    return {
      status: 'failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      inbound_event_id: inboundEventId,
    };
  }
}

/**
 * Create an unmatched credit record for admin reconciliation.
 * Money stays in Safe Haven settlement until an admin resolves it.
 */
async function createUnmatchedCredit(
  supabase: any,
  inboundEventId: string,
  credit: IncomingCreditPayload,
  knownCustomerId?: string
): Promise<IncomingCreditResult> {
  const { data, error } = await supabase
    .from('unmatched_credits')
    .insert({
      inbound_event_id: inboundEventId,
      safe_haven_reference: credit.safe_haven_reference,
      account_number: credit.account_number,
      account_name: credit.account_name,
      amount: credit.amount,
      currency: credit.currency || 'NGN',
      sender_name: credit.sender_name,
      sender_account_number: credit.sender_account_number,
      sender_bank_name: credit.sender_bank_name,
      narration: credit.narration,
      status: 'requires_reconciliation',
      matched_customer_id: knownCustomerId || null,
      metadata: credit.raw_payload || {},
    })
    .select('id')
    .single();

  if (error) {
    console.error('[IncomingCredit] Failed to create unmatched credit:', error);
    return {
      status: 'failed',
      message: `Failed to create unmatched credit: ${error.message}`,
      inbound_event_id: inboundEventId,
    };
  }

  // Update inbound event
  await supabase
    .from('inbound_events')
    .update({
      processing_status: 'processed',
      processed_at: new Date().toISOString(),
    })
    .eq('id', inboundEventId);

  console.warn(`[IncomingCredit] Unmatched credit ${credit.safe_haven_reference}: ₦${credit.amount} to account ${credit.account_number} — routed to reconciliation`);

  return {
    status: 'unmatched',
    message: `Credit could not be matched to a customer — routed to reconciliation`,
    unmatched_credit_id: data?.id,
    inbound_event_id: inboundEventId,
  };
}

/**
 * Resolve an unmatched credit by matching it to a customer/wallet.
 * Called by admin reconciliation API.
 *
 * Creates the Financial Transaction retroactively and links everything.
 */
export async function resolveUnmatchedCredit(
  unmatchedCreditId: string,
  customerId: string,
  walletId: string,
  resolvedBy: string,
  reason: string
): Promise<{ success: boolean; ft_id?: string; error?: string }> {
  const supabase = getServiceClient();

  try {
    // 1. Fetch the unmatched credit
    const { data: unmatched, error: fetchError } = await supabase
      .from('unmatched_credits')
      .select('*')
      .eq('id', unmatchedCreditId)
      .eq('status', 'requires_reconciliation')
      .maybeSingle();

    if (fetchError || !unmatched) {
      return { success: false, error: 'Unmatched credit not found or already resolved' };
    }

    // 2. Create the Financial Transaction via Orchestrator
    const ftResult = await initiate({
      transaction_type: 'incoming_deposit',
      source_module: 'wallet',
      source_reference: unmatched.safe_haven_reference,
      amount: Number(unmatched.amount),
      currency: unmatched.currency || 'NGN',
      description: `Manual match: ${unmatched.narration || unmatched.safe_haven_reference}`,
      idempotency_key: `incoming_deposit:${unmatched.safe_haven_reference}`,
      wallet_id: walletId,
      metadata: {
        safe_haven_reference: unmatched.safe_haven_reference,
        account_number: unmatched.account_number,
        sender_name: unmatched.sender_name,
        manually_matched: true,
        matched_by: resolvedBy,
        match_reason: reason,
      },
    });

    if (ftResult.status === 'failed') {
      return { success: false, error: ftResult.error || 'Orchestrator failed' };
    }

    // 3. Update the unmatched credit record
    await supabase
      .from('unmatched_credits')
      .update({
        status: 'matched',
        matched_customer_id: customerId,
        matched_wallet_id: walletId,
        financial_transaction_id: ftResult.id,
        resolution_reason: reason,
        resolved_by: resolvedBy,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', unmatchedCreditId);

    // 4. Dispatch notification to customer
    const { data: customer } = await supabase
      .from('customers')
      .select('auth_id')
      .eq('id', customerId)
      .maybeSingle();

    if (customer?.auth_id) {
      dispatchNotification({
        event: 'deposit_received',
        user_id: customer.auth_id,
        variables: {
          amount: Number(unmatched.amount).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' }),
          sender: unmatched.sender_name || 'External account',
          reference: unmatched.safe_haven_reference,
        },
        metadata: { ft_id: ftResult.id, manually_matched: true },
        related_entity_type: 'wallet_transaction',
      }).catch(() => {});
    }

    return { success: true, ft_id: ftResult.id };

  } catch (error) {
    console.error('[IncomingCredit:resolve] Error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Reverse an unmatched credit (return funds to sender).
 * Does NOT create a wallet credit — just marks as reversed.
 */
export async function reverseUnmatchedCredit(
  unmatchedCreditId: string,
  reversedBy: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getServiceClient();

  try {
    const { error } = await supabase
      .from('unmatched_credits')
      .update({
        status: 'reversed',
        resolution_reason: reason,
        resolved_by: reversedBy,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', unmatchedCreditId)
      .eq('status', 'requires_reconciliation');

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
