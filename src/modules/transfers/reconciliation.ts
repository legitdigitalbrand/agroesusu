// ============================================================================
// Transfer Reconciliation — stale pending transfer recovery
// (Gate 4, P1)
//
// PROBLEM: a transfer that Safe Haven returns `pending` keeps the customer's
// funds reserved in escrow (Phase 1 posted, Phase 2 waiting). If the Safe
// Haven webhook is delayed, lost, or never delivered, the transfer stays
// pending and the funds stay locked indefinitely.
//
// SOLUTION: this module re-examines stale pending transfers against the
// AUTHORITATIVE provider status (provider.getTransferStatus) and applies it:
//
//   SUCCESS   → settle (D Escrow 2004, C SH Settlement 1000), finalize, audit
//   FAILED    → reverse reservation (funds back to wallet), mark failed, audit
//   REVERSED  → provider returned the funds: reverse reservation, mark
//               reversed, audit (distinct outcome from plain failure)
//   PENDING   → keep the hold and the reservation, audit, retry next cron
//   PROVIDER UNAVAILABLE → change nothing, retain safely, audit, retry later
//
// CONCURRENCY (webhook vs cron vs manual): a claim-based optimistic state
// machine. Before applying ANY financial effect, the reconciler atomically
// claims the transfer with a conditional UPDATE
//     SET status = <claim> WHERE id = X AND status = <previous>
// If another reconciler (webhook, cron, admin) claimed it first, the update
// matches 0 rows and this attempt aborts with `claim_lost` — no double settle,
// no double reversal. Additionally, all financial effects go through the
// orchestrator with deterministic idempotency keys
//     bank_transfer_settlement:<idemKey>   (settlement)
//     reversal:<reservationFtId>           (reservation reversal)
// so even a claim race that slips through executes a single financial effect.
//
// IDEMPOTENCY: every path is safe to re-run. Terminal statuses
// (success/failed/reversed) are no-ops. FTOs dedup by key. Audits are
// append-only.
//
// CRITICAL RULE (per wallet/reconciliation.ts): reconciliation discrepancies
// are NEVER auto-resolved by code — orphaned/unknown states are flagged in
// reconciliation_flags for human review. Only confirmed provider outcomes
// (success/failed/reversed) are applied automatically.
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { getBankingProvider } from '@/modules/integrations';
import { initiate, reverse } from '@/modules/orchestrator';
import { refreshWalletBalanceCache } from '@/modules/ledger';
import { releaseWalletHold } from '@/modules/wallet/holds';

// Statuses that mean funds are escrowed (reservation posted) and awaiting
// the provider's outcome
const RESERVATION_HELD_STATUSES = ['reserved', 'settling', 'reversing', 'pending', 'pending_settlement'];
// 'initiated' = crash window before reservation confirmed — needs the
// reservation-existence check before any funds logic
const RECONCILABLE_STATUSES = [...RESERVATION_HELD_STATUSES, 'initiated'];
const TERMINAL_STATUSES = ['success', 'failed', 'reversed'];

/** Reconciliation threshold: default minutes before a pending transfer is stale */
export const DEFAULT_STALE_THRESHOLD_MINUTES = 15;
/** Max transfers per reconciliation run (protects cron duration) */
export const MAX_TRANSFERS_PER_RUN = 50;

export type ReconciliationSource = 'cron' | 'webhook' | 'manual';

export interface TransferReconciliationResult {
  transfer_id: string;
  reference: string;
  status: 'settled' | 'reversed_funds_returned' | 'marked_failed' |
          'still_pending' | 'retained_error' | 'claim_lost' |
          'terminal_noop' | 'flagged_manual' | 'not_found';
  provider_status?: string;
  provider_raw_status?: string;
  message: string;
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

interface TransferRow {
  id: string;
  reference: string;
  payment_reference: string | null;
  status: string;
  amount: number;
  wallet_id: string;
  customer_id: string;
  metadata: Record<string, unknown> | null;
  provider_response: Record<string, unknown> | null;
}

interface AuditRecord {
  transferId: string;
  safeHavenReference?: string;
  previousStatus: string;
  providerStatus: string;
  providerRawStatus?: string;
  resultingStatus: string;
  action: string;
  source: ReconciliationSource;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

async function writeAudit(supabase: ReturnType<typeof getServiceClient>, audit: AuditRecord): Promise<void> {
  const { error } = await supabase.from('transfer_reconciliation_audits').insert({
    transfer_id: audit.transferId,
    safe_haven_reference: audit.safeHavenReference ?? null,
    previous_status: audit.previousStatus,
    provider_status: audit.providerStatus,
    provider_raw_status: audit.providerRawStatus ?? null,
    resulting_status: audit.resultingStatus,
    action: audit.action,
    source: audit.source,
    error_message: audit.errorMessage ?? null,
    metadata: audit.metadata ?? {},
  });
  if (error) {
    // Audit failure must never block the financial effect — but it MUST be logged
    console.error('[TransferRecon] Audit write failed:', error.message, JSON.stringify(audit));
  }
}

/**
 * Look up a transfer's reservation FTO (financial transaction) by its
 * deterministic idempotency key. Returns the FT row or null.
 */
async function findReservationFt(
  supabase: ReturnType<typeof getServiceClient>,
  reservationKey: string
): Promise<{ id: string; status: string } | null> {
  const { data, error } = await supabase
    .from('financial_transactions')
    .select('id, status')
    .eq('idempotency_key', reservationKey)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return { id: data.id as string, status: data.status as string };
}

/**
 * Atomically claim a transfer for reconciliation.
 * Conditional UPDATE ... WHERE status = previous — if another reconciler
 * (webhook/cron/manual) got there first, this returns null and the caller
 * aborts with claim_lost. This is the database-level state check that
 * prevents webhook + cron from both settling or reversing the same transfer.
 */
async function claimTransfer(
  supabase: ReturnType<typeof getServiceClient>,
  transferId: string,
  previousStatus: string,
  claimStatus: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('transfers')
    .update({ status: claimStatus })
    .eq('id', transferId)
    .eq('status', previousStatus)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error(`[TransferRecon] Claim failed for ${transferId}:`, error.message);
    return false;
  }
  return Boolean(data);
}

/** Detect a provider-side reversal from the raw status string */
function isProviderReversal(mappedStatus: string, rawStatus?: string): boolean {
  if (mappedStatus === 'failed' && rawStatus && /revers/i.test(rawStatus)) return true;
  return false;
}

/**
 * Settle a confirmed-successful transfer:
 *   Phase 2 — D Escrow (2004), C Safe Haven Settlement (1000)
 * Deterministic FTO key `bank_transfer_settlement:<idemKey>` makes the
 * settlement idempotent: a webhook and the cron can both attempt it; the
 * orchestrator executes it exactly once.
 */
async function settleTransfer(
  supabase: ReturnType<typeof getServiceClient>,
  transfer: TransferRow,
  idempotencyKey: string,
  safeHavenReference: string,
  providerResponse: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  const result = await initiate({
    transaction_type: 'wallet_withdrawal_settlement' as never,
    source_module: 'wallet',
    source_reference: transfer.id,
    amount: Number(transfer.amount),
    currency: 'NGN',
    description: `Transfer settlement (reconciled): ${transfer.reference}`,
    idempotency_key: `bank_transfer_settlement:${idempotencyKey}`,
    wallet_id: transfer.wallet_id,
    metadata: {
      transfer_id: transfer.id,
      payment_reference: transfer.payment_reference,
      safe_haven_reference: safeHavenReference,
      reconciled: true,
    },
  });

  if (result.status === 'failed') {
    return { ok: false, error: result.error || 'Settlement FTO failed' };
  }

  // Persist the confirmed provider facts on the transfer row
  await supabase
    .from('transfers')
    .update({
      provider_response: { ...providerResponse, reconciled: { status: 'success', reference: safeHavenReference } },
    })
    .eq('id', transfer.id);

  await refreshWalletBalanceCache(transfer.wallet_id).catch(() => {});
  return { ok: true };
}

/**
 * Reverse a transfer's reservation: funds return from escrow to the wallet.
 * Deterministic FTO key `reversal:<reservationFtId>` — exactly-once even if
 * webhook and cron both trigger it.
 */
async function reverseTransferReservation(
  supabase: ReturnType<typeof getServiceClient>,
  transfer: TransferRow,
  reservationFtId: string,
  reason: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await reverse({
      original_transaction_id: reservationFtId,
      reason,
      idempotency_key: `reversal:${reservationFtId}`,
    });

    if (result.status === 'failed') {
      // CRITICAL: funds stuck in escrow — flag for human review, never auto-resolve
      await supabase.from('reconciliation_flags').insert({
        wallet_id: transfer.wallet_id,
        flag_type: 'reversal_failed',
        description: `Reservation reversal failed for transfer ${transfer.reference}: ${result.error}`,
        severity: 'critical',
        metadata: { transfer_id: transfer.id, reservation_ft_id: reservationFtId, reason },
      });
      return { ok: false, error: result.error || 'Reversal FTO failed' };
    }

    await refreshWalletBalanceCache(transfer.wallet_id).catch(() => {});
    return { ok: true };
  } catch (err) {
    await supabase.from('reconciliation_flags').insert({
      wallet_id: transfer.wallet_id,
      flag_type: 'reversal_failed',
      description: `Reservation reversal threw for transfer ${transfer.reference}: ${err instanceof Error ? err.message : String(err)}`,
      severity: 'critical',
      metadata: { transfer_id: transfer.id, reservation_ft_id: reservationFtId, reason },
    });
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Reconcile a single transfer against the authoritative Safe Haven status.
 * Idempotent: terminal transfers are no-ops; races abort on claim_lost.
 *
 * @param transferId transfers.id
 * @param source who is asking: 'cron' | 'webhook' | 'manual'
 */
export async function reconcileTransfer(
  transferId: string,
  source: ReconciliationSource = 'cron'
): Promise<TransferReconciliationResult> {
  const supabase = getServiceClient();

  // 1. Load the transfer
  const { data: transfer, error: transferError } = await supabase
    .from('transfers')
    .select('id, reference, payment_reference, status, amount, wallet_id, customer_id, metadata, provider_response')
    .eq('id', transferId)
    .maybeSingle();

  if (transferError || !transfer) {
    return { transfer_id: transferId, reference: '', status: 'not_found', message: 'Transfer not found' };
  }
  const t = transfer as unknown as TransferRow;

  // 2. Terminal transfers: idempotent no-op (duplicate reconciliation)
  if (TERMINAL_STATUSES.includes(t.status)) {
    await writeAudit(supabase, {
      transferId: t.id,
      safeHavenReference: t.payment_reference || undefined,
      previousStatus: t.status,
      providerStatus: 'not_queried',
      resultingStatus: t.status,
      action: 'terminal_noop',
      source,
      metadata: { reason: 'Transfer already in terminal state — no action taken' },
    });
    return {
      transfer_id: t.id,
      reference: t.reference,
      status: 'terminal_noop',
      message: `Transfer already ${t.status} — no action taken`,
    };
  }

  if (!RECONCILABLE_STATUSES.includes(t.status)) {
    return {
      transfer_id: t.id,
      reference: t.reference,
      status: 'terminal_noop',
      message: `Status '${t.status}' is not reconcilable`,
    };
  }

  const idempotencyKey = (t.metadata?.idempotency_key as string) || null;
  // Status as READ from the database — this is what the audit trail records
  // as `previous_status` (the adoption claim below is an intermediate effect
  // of this same attempt, not a prior state).
  const originalStatus = t.status;
  let previousStatus = t.status;

  // 3. For 'initiated' (crash window): determine whether the reservation
  //    ever posted before doing anything with funds
  let reservationFtId: string | null = null;
  if (previousStatus === 'initiated') {
    if (!idempotencyKey) {
      // Legacy transfer created before the two-phase refactor: no reservation
      // model — flag for manual handling, never auto-move funds
      await supabase.from('reconciliation_flags').insert({
        wallet_id: t.wallet_id,
        flag_type: 'legacy_transfer_stale',
        description: `Legacy transfer ${t.reference} stuck in 'initiated' — no idempotency metadata; manual review required`,
        severity: 'high',
        metadata: { transfer_id: t.id, status: previousStatus },
      });
      await writeAudit(supabase, {
        transferId: t.id, safeHavenReference: t.payment_reference || undefined,
        previousStatus, providerStatus: 'not_queried', resultingStatus: previousStatus,
        action: 'flagged_manual', source,
        metadata: { reason: 'Legacy transfer without idempotency metadata' },
      });
      return { transfer_id: t.id, reference: t.reference, status: 'flagged_manual', message: 'Legacy transfer flagged for manual review' };
    }
    const reservation = await findReservationFt(supabase, `bank_transfer_reservation:${idempotencyKey}`);
    if (!reservation || reservation.status !== 'completed') {
      // Reservation never posted (crash before Phase 1 completed) — no funds
      // are escrowed. Release the concurrency hold if any remains and mark
      // the transfer failed; it can be re-initiated safely.
      await releaseWalletHold(`hold:${idempotencyKey}`).catch(() => {});
      await supabase.from('transfers').update({
        status: 'failed',
        provider_response: { ...t.provider_response, reconciled: { action: 'marked_failed_no_funds', at: new Date().toISOString() } },
      }).eq('id', t.id);
      await writeAudit(supabase, {
        transferId: t.id, safeHavenReference: t.payment_reference || undefined,
        previousStatus, providerStatus: 'not_queried', resultingStatus: 'failed',
        action: 'marked_failed_no_funds', source,
        metadata: { reason: 'Reservation never posted — no funds escrowed; hold released' },
      });
      return { transfer_id: t.id, reference: t.reference, status: 'marked_failed', message: 'Reservation never posted — marked failed, hold released' };
    }
    // Reservation posted but the route crashed before recording it — adopt it
    reservationFtId = reservation.id;
    await claimTransfer(supabase, t.id, 'initiated', 'reserved');
    // The transfer is now 'reserved' — subsequent claims must filter on the
    // CURRENT status, not the stale read-time one
    previousStatus = 'reserved';
  } else if (idempotencyKey) {
    // Post-initiation statuses: funds are escrowed via the reservation.
    // Find the reservation FT (metadata first, key lookup as fallback for
    // crash windows between reservation and metadata write).
    reservationFtId = (t.metadata?.reservation_ft_id as string) || null;
    if (!reservationFtId) {
      const reservation = await findReservationFt(supabase, `bank_transfer_reservation:${idempotencyKey}`);
      reservationFtId = reservation?.id || null;
    }
  }

  // 4. Query the AUTHORITATIVE provider status
  const provider = getBankingProvider();
  let providerStatus: 'success' | 'pending' | 'failed';
  let providerRawStatus: string | undefined;
  let providerReference: string | undefined;
  let providerMessage: string | undefined;

  try {
    const statusResult = await provider.getTransferStatus(t.payment_reference || t.reference);
    providerStatus = statusResult.status;
    providerRawStatus = statusResult.rawStatus;
    providerReference = statusResult.reference;
    providerMessage = statusResult.message;
  } catch (providerError) {
    // PROVIDER UNAVAILABLE / UNKNOWN: retain everything safely, audit, retry later
    const msg = providerError instanceof Error ? providerError.message : String(providerError);
    await writeAudit(supabase, {
      transferId: t.id, safeHavenReference: t.payment_reference || undefined,
      previousStatus: originalStatus, providerStatus: 'unavailable', resultingStatus: previousStatus,
      action: 'retained_error', source, errorMessage: msg,
      metadata: { retained: true, hold: 'kept', reservation: 'kept' },
    });
    return {
      transfer_id: t.id,
      reference: t.reference,
      status: 'retained_error',
      message: `Provider unavailable — transfer retained, will retry: ${msg}`,
    };
  }

  // 5. Apply the provider result safely
  // ── SUCCESS ──────────────────────────────────────────────────────────────
  if (providerStatus === 'success') {
    if (!idempotencyKey || !reservationFtId) {
      // Legacy single-phase transfer or missing reservation: money may have
      // left Safe Haven without our escrow model accounting for it — flag for
      // human review, never auto-resolve
      await supabase.from('reconciliation_flags').insert({
        wallet_id: t.wallet_id,
        flag_type: 'orphaned_transfer_success',
        description: `Provider reports SUCCESS for transfer ${t.reference} but no reservation FTO exists — manual ledger review required`,
        severity: 'critical',
        metadata: { transfer_id: t.id, payment_reference: t.payment_reference, idempotency_key: idempotencyKey },
      });
      await writeAudit(supabase, {
        transferId: t.id, safeHavenReference: providerReference || t.payment_reference || undefined,
        previousStatus, providerStatus: 'success', providerRawStatus,
        resultingStatus: previousStatus, action: 'flagged_manual', source,
        errorMessage: 'Provider success without reservation FTO',
      });
      return { transfer_id: t.id, reference: t.reference, status: 'flagged_manual', message: 'Provider success without reservation — flagged critical for manual review' };
    }

    // Claim (optimistic lock) — aborts if webhook/manual already handling
    const claimed = await claimTransfer(supabase, t.id, previousStatus, 'settling');
    if (!claimed) {
      await writeAudit(supabase, {
        transferId: t.id, safeHavenReference: providerReference || t.payment_reference || undefined,
        previousStatus, providerStatus: 'success', providerRawStatus,
        resultingStatus: 'claimed_elsewhere', action: 'claim_lost', source,
        metadata: { race: 'another reconciler claimed this transfer first' },
      });
      return { transfer_id: t.id, reference: t.reference, status: 'claim_lost', message: 'Another reconciler is handling this transfer' };
    }

    const settlement = await settleTransfer(
      supabase, t, idempotencyKey, providerReference || t.payment_reference || t.reference,
      t.provider_response || {}
    );

    if (!settlement.ok) {
      // Settlement posting failed — funds left Safe Haven but our books are
      // not updated. Return to pending_settlement (retried next cron) and
      // flag; do NOT falsely mark success.
      await supabase.from('transfers').update({ status: 'pending_settlement' })
        .eq('id', t.id).eq('status', 'settling');
      await supabase.from('reconciliation_flags').insert({
        wallet_id: t.wallet_id,
        flag_type: 'settlement_failed',
        description: `Settlement FTO failed for confirmed transfer ${t.reference}: ${settlement.error}`,
        severity: 'critical',
        metadata: { transfer_id: t.id, idempotency_key: idempotencyKey },
      });
      await writeAudit(supabase, {
        transferId: t.id, safeHavenReference: providerReference || undefined,
        previousStatus, providerStatus: 'success', providerRawStatus,
        resultingStatus: 'pending_settlement', action: 'retained_error', source,
        errorMessage: settlement.error,
      });
      return { transfer_id: t.id, reference: t.reference, status: 'retained_error', message: `Settlement failed — flagged and retained: ${settlement.error}` };
    }

    const finalized = await supabase
      .from('transfers')
      .update({ status: 'success' })
      .eq('id', t.id)
      .eq('status', 'settling')
      .select('id')
      .maybeSingle();

    if (!finalized.data) {
      // Status moved off 'settling' between claim and finalize — someone else
      // intervened; the settlement FTO dedup guarantees no double effect.
      await writeAudit(supabase, {
        transferId: t.id, safeHavenReference: providerReference || undefined,
        previousStatus: 'settling', providerStatus: 'success', providerRawStatus,
        resultingStatus: 'unknown_concurrent_change', action: 'claim_lost', source,
        metadata: { note: 'Settlement FTO posted (idempotent); status changed concurrently' },
      });
      return { transfer_id: t.id, reference: t.reference, status: 'claim_lost', message: 'Status changed concurrently — settlement FTO idempotency guarantees single effect' };
    }

    await writeAudit(supabase, {
      transferId: t.id, safeHavenReference: providerReference || undefined,
      previousStatus: originalStatus, providerStatus: 'success', providerRawStatus,
      resultingStatus: 'success', action: 'settled', source,
      metadata: { reservation_ft_id: reservationFtId },
    });
    return { transfer_id: t.id, reference: t.reference, status: 'settled', provider_status: 'success', provider_raw_status: providerRawStatus, message: 'Transfer settled via reconciliation' };
  }

  // ── REVERSED (provider returned the funds) ──────────────────────────────
  if (isProviderReversal(providerStatus, providerRawStatus)) {
    return applyReversalOutcome(
      supabase, t, idempotencyKey, reservationFtId, previousStatus, originalStatus,
      'reversed', 'reversed_funds_returned', 'reversed_funds_returned',
      providerReference, providerRawStatus, providerMessage, source
    );
  }

  // ── FAILED ───────────────────────────────────────────────────────────────
  if (providerStatus === 'failed') {
    return applyReversalOutcome(
      supabase, t, idempotencyKey, reservationFtId, previousStatus, originalStatus,
      'failed', 'reversed_funds_returned', 'reversed_funds_returned',
      providerReference, providerRawStatus, providerMessage, source
    );
  }

  // ── STILL PENDING ───────────────────────────────────────────────────────
  await writeAudit(supabase, {
    transferId: t.id, safeHavenReference: providerReference || t.payment_reference || undefined,
    previousStatus: originalStatus, providerStatus: 'pending', providerRawStatus,
    resultingStatus: previousStatus, action: 'pending_retry', source,
    metadata: { hold: 'kept', reservation: 'kept', retry_scheduled: true },
  });
  return {
    transfer_id: t.id,
    reference: t.reference,
    status: 'still_pending',
    provider_status: 'pending',
    provider_raw_status: providerRawStatus,
    message: 'Still pending at provider — funds retained, reconciliation will retry',
  };
}

/**
 * Shared failure/reversal path: claim, reverse the reservation (funds back
 * to the wallet), finalize, audit. `finalStatus` is 'failed' or 'reversed'.
 */
async function applyReversalOutcome(
  supabase: ReturnType<typeof getServiceClient>,
  t: TransferRow,
  idempotencyKey: string | null,
  reservationFtId: string | null,
  previousStatus: string,
  auditPreviousStatus: string,
  finalStatus: 'failed' | 'reversed',
  action: string,
  resultStatus: TransferReconciliationResult['status'],
  providerReference?: string,
  providerRawStatus?: string,
  providerMessage?: string,
  source: ReconciliationSource = 'cron'
): Promise<TransferReconciliationResult> {
  if (!idempotencyKey || !reservationFtId) {
    // No reservation to reverse — nothing is escrowed. Mark final and audit.
    const claimed = await claimTransfer(supabase, t.id, previousStatus, 'reversing');
    if (!claimed) {
      await writeAudit(supabase, {
        transferId: t.id, safeHavenReference: providerReference || undefined,
        previousStatus, providerStatus: finalStatus, providerRawStatus,
        resultingStatus: 'claimed_elsewhere', action: 'claim_lost', source,
      });
      return { transfer_id: t.id, reference: t.reference, status: 'claim_lost', message: 'Another reconciler is handling this transfer' };
    }
    await supabase.from('transfers').update({
      status: finalStatus,
      provider_response: { ...t.provider_response, reconciled: { status: finalStatus, message: providerMessage } },
    }).eq('id', t.id);
    await writeAudit(supabase, {
      transferId: t.id, safeHavenReference: providerReference || undefined,
      previousStatus, providerStatus: finalStatus, providerRawStatus,
      resultingStatus: finalStatus, action: 'marked_failed_no_funds', source,
      errorMessage: providerMessage,
    });
    return { transfer_id: t.id, reference: t.reference, status: 'marked_failed', message: `Provider ${finalStatus}; no funds were escrowed — marked final` };
  }

  // Claim (optimistic lock) — aborts if webhook/manual already handling
  const claimed = await claimTransfer(supabase, t.id, previousStatus, 'reversing');
  if (!claimed) {
    await writeAudit(supabase, {
      transferId: t.id, safeHavenReference: providerReference || undefined,
      previousStatus, providerStatus: finalStatus, providerRawStatus,
      resultingStatus: 'claimed_elsewhere', action: 'claim_lost', source,
      metadata: { race: 'another reconciler claimed this transfer first' },
    });
    return { transfer_id: t.id, reference: t.reference, status: 'claim_lost', message: 'Another reconciler is handling this transfer' };
  }

  const reversal = await reverseTransferReservation(
    supabase, t, reservationFtId,
    `Transfer ${finalStatus} at provider (reconciled): ${providerMessage || finalStatus}`
  );

  if (!reversal.ok) {
    // Reversal failed — funds stuck in escrow. Return to the previous state
    // so the next cron run retries; the failure is flagged (inside
    // reverseTransferReservation) for human review.
    await supabase.from('transfers').update({ status: previousStatus })
      .eq('id', t.id).eq('status', 'reversing');
    await writeAudit(supabase, {
      transferId: t.id, safeHavenReference: providerReference || undefined,
      previousStatus, providerStatus: finalStatus, providerRawStatus,
      resultingStatus: previousStatus, action: 'retained_error', source,
      errorMessage: reversal.error,
    });
    return { transfer_id: t.id, reference: t.reference, status: 'retained_error', message: `Reversal failed — retained and flagged: ${reversal.error}` };
  }

  await supabase.from('transfers').update({
    status: finalStatus,
    provider_response: { ...t.provider_response, reconciled: { status: finalStatus, reference: providerReference, message: providerMessage } },
  }).eq('id', t.id).eq('status', 'reversing');

  await writeAudit(supabase, {
    transferId: t.id, safeHavenReference: providerReference || undefined,
    previousStatus: auditPreviousStatus, providerStatus: finalStatus, providerRawStatus,
    resultingStatus: finalStatus, action, source,
    metadata: { reservation_ft_id: reservationFtId, funds: 'returned_to_wallet' },
  });
  return {
    transfer_id: t.id, reference: t.reference, status: resultStatus,
    provider_status: finalStatus, provider_raw_status: providerRawStatus,
    message: finalStatus === 'reversed'
      ? 'Provider reversed the transfer — reservation reversed, funds returned to wallet'
      : 'Provider reports failure — reservation reversed, funds returned to wallet',
  };
}

/**
 * Reconcile all stale pending transfers.
 * Called by the cron (every 15 min) and by manual admin triggers.
 *
 * Stale = status reconcilable AND older than maxAgeMinutes. Only transfers
 * that are still holding funds (reservation pending at the provider) or in
 * crash-window states are selected.
 */
export async function reconcileStaleTransfers(
  maxAgeMinutes: number = DEFAULT_STALE_THRESHOLD_MINUTES,
  source: ReconciliationSource = 'cron'
): Promise<{
  processed: number;
  results: TransferReconciliationResult[];
}> {
  const supabase = getServiceClient();
  const staleBefore = new Date(Date.now() - maxAgeMinutes * 60_000).toISOString();

  const { data: staleTransfers, error } = await supabase
    .from('transfers')
    .select('id')
    .in('status', RECONCILABLE_STATUSES)
    .lt('created_at', staleBefore)
    .order('created_at', { ascending: true })
    .limit(MAX_TRANSFERS_PER_RUN);

  if (error) {
    throw new Error(`Failed to fetch stale transfers: ${error.message}`);
  }
  if (!staleTransfers || staleTransfers.length === 0) {
    return { processed: 0, results: [] };
  }

  const results: TransferReconciliationResult[] = [];
  for (const row of staleTransfers) {
    try {
      results.push(await reconcileTransfer(row.id as string, source));
    } catch (err) {
      console.error(`[TransferRecon] Reconciliation of ${row.id} failed:`, err);
      results.push({
        transfer_id: row.id as string,
        reference: '',
        status: 'retained_error',
        message: err instanceof Error ? err.message : 'Reconciliation attempt failed',
      });
    }
  }

  return { processed: staleTransfers.length, results };
}
