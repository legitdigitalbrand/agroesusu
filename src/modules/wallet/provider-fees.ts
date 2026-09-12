// ============================================================================
// Provider Fee Mirroring
//
// Safe Haven charges fees + VAT (+ stamp duty) directly against the
// customer's real DVA account on transfers in and out. Those charges drain
// REAL provider money but historically were never booked in our internal
// ledger, so the wallet ledger overstated what the DVA could actually pay
// out — the root cause of the 2026-09-11 "No sufficient funds" transfer
// bounces (wallet showed ₦100, DVA held ~₦41 because ₦48+ of accumulated
// provider fees were invisible).
//
// This module mirrors those charges into the double-entry ledger as
// `provider_fee` postings: D Wallet (customer's claim drops — their DVA
// paid the fee), C Safe Haven (1000) (real-money mirror drops).
//
// Posting is IDEMPOTENT: each fee is keyed to the Safe Haven event id, so
// webhook replays and backfill re-runs can never double-charge.
//
// `backfillProviderFees()` is run nightly by the /api/cron/reconcile job
// so any fee event the webhook missed is picked up automatically.
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { initiate } from '@/modules/orchestrator';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export interface ProviderFeeInput {
  wallet_id: string;
  amount: number;
  description: string;
  idempotency_key: string;
  metadata?: Record<string, unknown>;
}

export type ProviderFeeStatus = 'posted' | 'skipped' | 'failed';

export interface ProviderFeeResult {
  posted: boolean;
  status: ProviderFeeStatus;
  amount: number;
  transaction_reference?: string;
  error?: string;
}

/**
 * Extract the total fee amount (fees + VAT + stamp duty) a provider event
 * charged against the DVA. Returns 0 when the event carries no fee.
 */
export function extractProviderFee(payload: Record<string, unknown>): number {
  const data = (payload.data || payload) as Record<string, unknown>;
  const fees = Number(data.fees || data.fee || 0);
  const vat = Number(data.vat || 0);
  const stampDuty = Number(data.stampDuty || 0);
  const total = Math.round((fees + vat + stampDuty) * 100) / 100;
  return total > 0 ? total : 0;
}

/**
 * Extract the provider-side account id (e.g. '6aa01f4390737600248a15d2')
 * a debit/credit event refers to. Safe Haven debit webhooks carry it in
 * `data.account` and NOT the DVA account number.
 */
export function extractProviderAccountId(payload: Record<string, unknown>): string | null {
  const data = (payload.data || payload) as Record<string, unknown>;
  const account = data.account as string | undefined;
  if (account && typeof account === 'string' && account.length >= 8) return account;
  return null;
}

/**
 * Post a provider fee charge to the ledger (idempotent by key).
 * Zero/negative amounts are skipped, never posted.
 */
export async function postProviderFee(input: ProviderFeeInput): Promise<ProviderFeeResult> {
  const amount = Math.round(input.amount * 100) / 100;
  if (!(amount > 0)) {
    return { posted: false, status: 'skipped', amount: 0 };
  }
  try {
    const result = await initiate({
      transaction_type: 'provider_fee',
      source_module: 'wallet',
      source_reference: input.wallet_id,
      amount,
      currency: 'NGN',
      description: input.description,
      idempotency_key: input.idempotency_key,
      wallet_id: input.wallet_id,
      metadata: input.metadata,
    });
    if (result.status === 'failed') {
      return { posted: false, status: 'failed', amount, error: result.error };
    }
    return {
      posted: true,
      status: 'posted',
      amount,
      transaction_reference: result.transaction_reference,
    };
  } catch (error) {
    return {
      posted: false,
      status: 'failed',
      amount,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Resolve a wallet for a provider event payload.
 * 1. By the provider-side account id stored on the wallet (set when the
 *    DVA's credits were first processed — see linkWalletToProviderAccount).
 * 2. Fall back to a wallet_id passed in (credit events carry it after
 *    processIncomingCredit resolves the DVA).
 */
export async function resolveWalletForProviderEvent(
  payload: Record<string, unknown>,
  knownWalletId?: string | null
): Promise<string | null> {
  const supabase = getServiceClient();
  const providerAccountId = extractProviderAccountId(payload);
  if (providerAccountId) {
    const { data: wallet } = await supabase
      .from('wallets')
      .select('id')
      .eq('safe_haven_account_id', providerAccountId)
      .eq('status', 'active')
      .maybeSingle();
    if (wallet) return wallet.id as string;
  }
  if (knownWalletId) return knownWalletId;
  return null;
}

/**
 * Persist the provider-side account id on the wallet so that:
 *  - debit-event fee mirroring can resolve the wallet, and
 *  - external reconciliation can query the real DVA balance.
 * No-op when the wallet already has one or the payload has none.
 */
export async function linkWalletToProviderAccount(
  walletId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const supabase = getServiceClient();
  const providerAccountId = extractProviderAccountId(payload);
  if (!providerAccountId) return;
  const { data: wallet } = await supabase
    .from('wallets')
    .select('id, safe_haven_account_id')
    .eq('id', walletId)
    .maybeSingle();
  if (!wallet || wallet.safe_haven_account_id) return;
  await supabase
    .from('wallets')
    .update({ safe_haven_account_id: providerAccountId })
    .eq('id', walletId);
}

/**
 * Mirror the fee carried by a webhook event payload (credit or debit).
 * Never throws — webhook processing must not fail because of fee posting.
 * Returns the outcome for logging/audit.
 */
export async function mirrorProviderFeeForEvent(
  payload: Record<string, unknown>,
  knownWalletId?: string | null
): Promise<ProviderFeeResult & { wallet_id: string | null }> {
  const fee = extractProviderFee(payload);
  if (!(fee > 0)) {
    return { posted: false, status: 'skipped', amount: 0, wallet_id: knownWalletId || null };
  }
  const walletId = await resolveWalletForProviderEvent(payload, knownWalletId);
  if (!walletId) {
    return {
      posted: false,
      status: 'failed',
      amount: fee,
      wallet_id: null,
      error: 'No wallet resolved for provider fee event',
    };
  }
  const data = (payload.data || payload) as Record<string, unknown>;
  const eventId = (payload._id as string) || (data._id as string) || 'unknown';
  const result = await postProviderFee({
    wallet_id: walletId,
    amount: fee,
    description: `Safe Haven fee on transfer of ₦${Number(data.amount || 0)}`,
    idempotency_key: `provider_fee:${eventId}`,
    metadata: {
      provider_event_id: eventId,
      fees: Number(data.fees || 0),
      vat: Number(data.vat || 0),
      stamp_duty: Number(data.stampDuty || 0),
      transfer_amount: Number(data.amount || 0),
    },
  });
  return { ...result, wallet_id: walletId };
}

// ─── Backfill ─────────────────────────────────────────────────────────────

export interface BackfillReport {
  scanned_events: number;
  fee_events: number;
  fees_posted: number;
  fees_skipped: number;
  fees_failed: number;
  total_amount_posted: number;
  wallets_linked: number;
  unresolvable_events: Array<{
    event_id: string;
    event_type: string;
    amount: number;
    fee: number;
    reason: string;
  }>;
}

/**
 * One-shot / nightly idempotent backfill:
 *  1. Link wallets to their provider-side account ids from resolved events.
 *  2. Post every fee-bearing event that has no provider_fee posting yet.
 *
 * Events whose own processing failed/rejected (e.g. a credit that never
 * got booked) are reported, NOT charged — their fee only becomes real
 * once the underlying transaction is resolved by a human.
 */
export async function backfillProviderFees(): Promise<BackfillReport> {
  const supabase = getServiceClient();
  const report: BackfillReport = {
    scanned_events: 0,
    fee_events: 0,
    fees_posted: 0,
    fees_skipped: 0,
    fees_failed: 0,
    total_amount_posted: 0,
    wallets_linked: 0,
    unresolvable_events: [],
  };

  const { data: events, error } = await supabase
    .from('inbound_events')
    .select('id, external_event_id, event_type, customer_id, wallet_id, processing_status, raw_payload')
    .order('created_at', { ascending: true })
    .limit(10000);

  if (error || !events) {
    report.unresolvable_events.push({
      event_id: 'query',
      event_type: 'error',
      amount: 0,
      fee: 0,
      reason: error?.message || 'No events returned',
    });
    return report;
  }

  for (const event of events) {
    report.scanned_events += 1;
    const payload = (event.raw_payload || {}) as Record<string, unknown>;
    const data = (payload.data || payload) as Record<string, unknown>;
    const eventId = (event.external_event_id as string) || (payload._id as string) || (data._id as string) || event.id;
    const fee = extractProviderFee(payload);
    if (!(fee > 0)) continue;
    report.fee_events += 1;

    // The fee is only real if the underlying event was actually processed.
    if (['failed', 'rejected', 'processing_failed'].includes(event.processing_status as string)) {
      report.unresolvable_events.push({
        event_id: eventId,
        event_type: event.event_type,
        amount: Number(data.amount || 0),
        fee,
        reason: `Event processing_status=${event.processing_status} — underlying transaction unresolved, fee not charged`,
      });
      continue;
    }

    // Resolve the wallet: prefer the event's own linkage (credit events),
    // fall back to the provider account id → wallets mapping.
    let walletId = (event.wallet_id as string | null) || null;
    if (!walletId && event.customer_id) {
      const { data: wallet } = await supabase
        .from('wallets')
        .select('id')
        .eq('customer_id', event.customer_id)
        .eq('status', 'active')
        .maybeSingle();
      walletId = (wallet?.id as string) || null;
    }
    if (!walletId) {
      const providerAccountId = extractProviderAccountId(payload);
      if (providerAccountId) {
        const { data: wallet } = await supabase
          .from('wallets')
          .select('id')
          .eq('safe_haven_account_id', providerAccountId)
          .eq('status', 'active')
          .maybeSingle();
        walletId = (wallet?.id as string) || null;
      }
    }

    // Credit events teach us the wallet ↔ provider-account mapping.
    if (walletId) {
      try {
        const before = await supabase
          .from('wallets')
          .select('safe_haven_account_id')
          .eq('id', walletId)
          .maybeSingle();
        if (before.data && !before.data.safe_haven_account_id) {
          await linkWalletToProviderAccount(walletId, payload);
          if (extractProviderAccountId(payload)) report.wallets_linked += 1;
        }
      } catch {
        // Non-fatal: linking is an optimization for reconciliation
      }
    }

    if (!walletId) {
      report.unresolvable_events.push({
        event_id: eventId,
        event_type: event.event_type,
        amount: Number(data.amount || 0),
        fee,
        reason: 'No wallet resolved for this provider account',
      });
      continue;
    }

    // Pre-check: the orchestrator's idempotency makes a re-run a no-op,
    // but reporting it as a fresh posting would overstate the totals.
    const { data: alreadyPosted } = await supabase
      .from('financial_transactions')
      .select('id')
      .eq('idempotency_key', `provider_fee:${eventId}`)
      .maybeSingle();
    if (alreadyPosted) {
      report.fees_skipped += 1;
      continue;
    }

    const result = await postProviderFee({
      wallet_id: walletId,
      amount: fee,
      description: `Safe Haven fee on transfer of ₦${Number(data.amount || 0)}`,
      idempotency_key: `provider_fee:${eventId}`,
      metadata: {
        provider_event_id: eventId,
        fees: Number(data.fees || 0),
        vat: Number(data.vat || 0),
        stamp_duty: Number(data.stampDuty || 0),
        transfer_amount: Number(data.amount || 0),
        backfilled: true,
      },
    });

    if (result.status === 'posted') {
      report.fees_posted += 1;
      report.total_amount_posted += result.amount;
    } else if (result.status === 'skipped') {
      report.fees_skipped += 1;
    } else {
      report.fees_failed += 1;
      report.unresolvable_events.push({
        event_id: eventId,
        event_type: event.event_type,
        amount: Number(data.amount || 0),
        fee,
        reason: result.error || 'Posting failed',
      });
    }
  }

  return report;
}
