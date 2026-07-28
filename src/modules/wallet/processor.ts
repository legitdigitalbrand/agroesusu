// ============================================================================
// Event Processing Pipeline (Phase 4 — Updated to call Orchestrator)
// 
// CHANGED IN PHASE 4:
//   Previously: created wallet_transactions rows directly + refreshed balance
//   Now: calls the Orchestrator to post to the Ledger, which then creates
//        the wallet_transactions read model entry and refreshes the balance.
//
// The event processor's job is now:
//   1. Parse the inbound event
//   2. Match to a wallet
//   3. Call the Orchestrator with a FinancialTransactionRequest
//   4. The Orchestrator handles: journal entry → posting → balance cache → read model
//   5. Mark the inbound event as processed
//
// If the Orchestrator fails, the event stays as 'failed' and is retriable.
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { initiate } from '../orchestrator';
import type { ProcessBatchResult, ProcessEventResult } from './types';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing Supabase environment variables for service client');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

interface SafeHavenWebhookPayload {
  _id?: string;
  transactionId?: string;
  eventId?: string;
  reference?: string;
  amount?: number;
  type?: string;
  eventType?: string;
  status?: string;
  accountNumber?: string;
  account_number?: string;
  destinationAccountNumber?: string;
  sourceAccountNumber?: string;
  beneficiaryAccountNumber?: string;
  beneficiaryAccountName?: string;
  beneficiaryBankCode?: string;
  beneficiaryBankName?: string;
  senderName?: string;
  senderAccountNumber?: string;
  senderBankCode?: string;
  senderBankName?: string;
  narration?: string;
  narrative?: string;
  paymentReference?: string;
  sessionId?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

function extractAccountNumber(payload: SafeHavenWebhookPayload): string | null {
  return (
    payload.accountNumber ||
    payload.account_number ||
    payload.destinationAccountNumber ||
    payload.sourceAccountNumber ||
    (payload.data && (payload.data as SafeHavenWebhookPayload).accountNumber) ||
    (payload.data && (payload.data as SafeHavenWebhookPayload).account_number) ||
    null
  );
}

function extractAmount(payload: SafeHavenWebhookPayload): number {
  const amount = payload.amount || (payload.data && (payload.data as SafeHavenWebhookPayload).amount);
  if (typeof amount === 'string') return parseFloat(amount);
  return Number(amount) || 0;
}

function extractDirection(payload: SafeHavenWebhookPayload): 'credit' | 'debit' {
  const eventType = (payload.eventType || payload.type || '').toLowerCase();
  if (eventType.includes('credit') || eventType.includes('deposit')) return 'credit';
  if (eventType.includes('debit') || eventType.includes('withdrawal')) return 'debit';
  if (payload.beneficiaryAccountNumber || payload.destinationAccountNumber) return 'debit';
  return 'credit';
}

function extractTransactionType(payload: SafeHavenWebhookPayload, direction: 'credit' | 'debit'): 'wallet_deposit' | 'wallet_withdrawal' {
  return direction === 'credit' ? 'wallet_deposit' : 'wallet_withdrawal';
}

function extractExternalReference(payload: SafeHavenWebhookPayload): string | null {
  return payload._id || payload.transactionId || payload.sessionId || payload.reference ||
    (payload.data && (payload.data as SafeHavenWebhookPayload)._id) || null;
}

function extractCounterparty(payload: SafeHavenWebhookPayload, direction: 'credit' | 'debit') {
  if (direction === 'credit') {
    return {
      account_number: payload.senderAccountNumber || null,
      account_name: payload.senderName || null,
      bank_code: payload.senderBankCode || null,
      bank_name: payload.senderBankName || null,
    };
  } else {
    return {
      account_number: payload.beneficiaryAccountNumber || payload.destinationAccountNumber || null,
      account_name: payload.beneficiaryAccountName || null,
      bank_code: payload.beneficiaryBankCode || null,
      bank_name: payload.beneficiaryBankName || null,
    };
  }
}

/**
 * Process a single inbound event.
 * Now calls the Orchestrator instead of writing wallet_transactions directly.
 */
export async function processEvent(eventId: string): Promise<ProcessEventResult> {
  const supabase = getServiceClient();

  try {
    // 1. Fetch the event
    const { data: event, error: fetchError } = await supabase
      .from('inbound_events')
      .select('id, external_event_id, source, event_type, raw_payload, processing_status, processing_attempts')
      .eq('id', eventId)
      .single();

    if (fetchError || !event) {
      return { event_id: eventId, status: 'failed', error: 'Event not found' };
    }

    if (event.processing_status !== 'received') {
      return { event_id: eventId, status: 'skipped', error: `Event already ${event.processing_status}` };
    }

    // 2. Mark as processing
    await supabase
      .from('inbound_events')
      .update({
        processing_status: 'processing',
        processing_attempts: event.processing_attempts + 1,
      })
      .eq('id', eventId);

    // 3. Parse the payload
    const payload = event.raw_payload as SafeHavenWebhookPayload;
    const accountNumber = extractAccountNumber(payload);
    const amount = extractAmount(payload);
    const direction = extractDirection(payload);
    const transactionType = extractTransactionType(payload, direction);
    const externalRef = extractExternalReference(payload);
    const counterparty = extractCounterparty(payload, direction);

    if (!accountNumber) {
      throw new Error('Could not extract account number from webhook payload');
    }
    if (amount <= 0) {
      throw new Error(`Invalid amount: ${amount}`);
    }

    // 4. Find the wallet
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('id, customer_id, account_number, status')
      .eq('account_number', accountNumber)
      .single();

    if (walletError || !wallet) {
      throw new Error(`Wallet not found for account number: ${accountNumber}`);
    }

    // 5. Check if already processed (idempotency at the event level)
    const { data: existingTx } = await supabase
      .from('financial_transactions')
      .select('id, status')
      .eq('idempotency_key', `wallet_deposit:${eventId}`)
      .maybeSingle();

    if (existingTx && existingTx.status === 'completed') {
      // Already processed via Orchestrator — mark event as processed
      await supabase
        .from('inbound_events')
        .update({
          processing_status: 'processed',
          processed_at: new Date().toISOString(),
          wallet_id: wallet.id,
          customer_id: wallet.customer_id,
        })
        .eq('id', eventId);

      return { event_id: eventId, status: 'skipped', transaction_id: existingTx.id };
    }

    // 6. Call the Orchestrator to initiate the financial transaction
    const result = await initiate({
      transaction_type: transactionType,
      source_module: 'wallet',
      source_reference: eventId,
      amount,
      currency: 'NGN',
      description: payload.narration || payload.narrative || `${transactionType} via Safe Haven`,
      idempotency_key: `${transactionType}:${eventId}`,
      wallet_id: wallet.id,
      metadata: {
        external_reference: externalRef,
        counterparty,
        raw_event_type: event.event_type,
        external_event_id: event.external_event_id,
      },
    });

    if (result.status === 'failed') {
      throw new Error(`Orchestrator failed: ${result.error || 'Unknown error'}`);
    }

    // 7. Mark the inbound event as processed
    await supabase
      .from('inbound_events')
      .update({
        processing_status: 'processed',
        processed_at: new Date().toISOString(),
        wallet_id: wallet.id,
        customer_id: wallet.customer_id,
        financial_transaction_id: result.id,
      })
      .eq('id', eventId);

    return { event_id: eventId, status: 'processed', transaction_id: result.id };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Processor] Failed to process event ${eventId}:`, errorMessage);

    await supabase
      .from('inbound_events')
      .update({
        processing_status: 'failed',
        error_message: errorMessage,
      })
      .eq('id', eventId);

    return { event_id: eventId, status: 'failed', error: errorMessage };
  }
}

/**
 * Process a batch of received events.
 */
export async function processEventBatch(batchSize: number = 50): Promise<ProcessBatchResult> {
  const supabase = getServiceClient();
  const results: ProcessEventResult[] = [];

  const { data: events, error } = await supabase
    .from('inbound_events')
    .select('id')
    .eq('processing_status', 'received')
    .order('received_at', { ascending: true })
    .limit(batchSize);

  if (error) {
    throw new Error(`Failed to fetch events: ${error.message}`);
  }

  if (!events || events.length === 0) {
    return { processed: 0, failed: 0, skipped: 0, results: [] };
  }

  for (const event of events) {
    const result = await processEvent(event.id);
    results.push(result);
  }

  const processed = results.filter(r => r.status === 'processed').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const skipped = results.filter(r => r.status === 'skipped').length;

  return { processed, failed, skipped, results };
}
