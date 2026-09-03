// ============================================================================
// Financial Idempotency — deterministic idempotency keys for money movement
// (Gate 4, P0 item 1)
//
// WHY: money-moving routes previously built idempotency keys with
// Date.now()/Math.random(). A retried request (double-click, network retry,
// browser refresh) produced a NEW key, so the orchestrator's dedup layer never
// fired and the same instruction was executed twice. Deterministic keys make
// the existing financial_transactions.idempotency_key UNIQUE constraint
// actually effective.
//
// CONTRACT (approved business decision — server-derived):
//   1. If the client supplies a `client_reference` (request body field), the
//      key is derived from (customer_id + client_reference) — stable forever,
//      strongest guarantee. The client may resend the same reference on retry.
//   2. Otherwise the key is derived from request parameters
//      (customer + wallet + amount + destination) plus a coarse time bucket.
//      Retries within DEDUP_WINDOW_MS collapse to the same key. Legitimate
//      identical repeats after the window succeed normally.
//
// Bucket-boundary handling: a retry that lands in the NEXT bucket would miss
// the current-bucket key, so `candidateKeysFor()` returns the current AND
// previous bucket keys — callers check both for an existing transaction.
// ============================================================================

import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';

export const DEDUP_WINDOW_MS = 60_000; // 60-second dedup window

export interface IdempotencyParams {
  /** Customer UUID — scopes the key to one actor */
  customer_id: string;
  /** Wallet UUID the operation debits (optional for deposits to a known wallet) */
  wallet_id?: string;
  /** Positive decimal amount (normalized to 2dp before hashing) */
  amount: number;
  /** Destination discriminator: beneficiary account number, etc. */
  destination?: string;
  /** Optional client-supplied reference — when present it wins (stable forever) */
  client_reference?: string;
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Normalize an amount for stable hashing (trailing-zero and float noise) */
function normalizeAmount(amount: number): string {
  return (Math.round(amount * 100) / 100).toFixed(2);
}

function currentBucket(now: number = Date.now()): string {
  return String(Math.floor(now / DEDUP_WINDOW_MS));
}

/**
 * Derive the primary deterministic idempotency key for a money movement.
 * Deterministic: the same parameters within the dedup window always produce
 * the same key; never uses Date.now()/Math.random() as entropy.
 */
export function deriveIdempotencyKey(
  prefix: string,
  params: IdempotencyParams,
  now: number = Date.now()
): string {
  if (params.client_reference) {
    const hash = sha256(`${params.customer_id}:${params.client_reference}`).slice(0, 32);
    return `${prefix}:cr:${hash}`;
  }
  const paramHash = sha256(
    [
      params.customer_id,
      params.wallet_id || '',
      normalizeAmount(params.amount),
      params.destination || '',
    ].join('|')
  ).slice(0, 32);
  return `${prefix}:bk:${paramHash}:${currentBucket(now)}`;
}

/**
 * All keys a retry of the SAME logical request could have produced.
 * - client_reference present: just the stable key (forever-stable).
 * - param-derived: current bucket AND previous bucket (a retry near the
 *   window boundary must still find the original transaction).
 */
export function candidateKeysFor(
  prefix: string,
  params: IdempotencyParams,
  now: number = Date.now()
): string[] {
  if (params.client_reference) {
    return [deriveIdempotencyKey(prefix, params)];
  }
  const paramHash = sha256(
    [
      params.customer_id,
      params.wallet_id || '',
      normalizeAmount(params.amount),
      params.destination || '',
    ].join('|')
  ).slice(0, 32);
  const bucket = Math.floor(now / DEDUP_WINDOW_MS);
  return [
    `${prefix}:bk:${paramHash}:${bucket}`,
    `${prefix}:bk:${paramHash}:${bucket - 1}`,
  ];
}

export interface ExistingTransaction {
  id: string;
  transaction_reference: string;
  status: string;
  amount: number;
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Check whether a financial transaction already exists for any candidate key.
 * Returns the existing transaction (completed or in-flight) or null.
 * Failed transactions are ignored — the orchestrator deletes them on retry,
 * so a retry after a failure proceeds as a new transaction.
 */
export async function findExistingTransaction(
  keys: string[]
): Promise<ExistingTransaction | null> {
  if (keys.length === 0) return null;
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('financial_transactions')
    .select('id, transaction_reference, status, amount')
    .in('idempotency_key', keys)
    .neq('status', 'failed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Idempotency check failed: ${error.message}`);
  if (!data) return null;
  return {
    id: data.id as string,
    transaction_reference: data.transaction_reference as string,
    status: data.status as string,
    amount: Number(data.amount),
  };
}

/**
 * Check whether a transfer (transfers table row) already exists for any
 * candidate reference. Used alongside the FTO check because the transfers
 * table has its own UNIQUE(reference) constraint.
 */
export async function findExistingTransfer(
  keys: string[]
): Promise<{ id: string; reference: string; status: string } | null> {
  if (keys.length === 0) return null;
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('transfers')
    .select('id, reference, status')
    .in('reference', keys)
    .neq('status', 'failed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Transfer idempotency check failed: ${error.message}`);
  if (!data) return null;
  return {
    id: data.id as string,
    reference: data.reference as string,
    status: data.status as string,
  };
}

/**
 * Derive a deterministic, human-readable payment/reference token from the
 * idempotency key. Retries produce the SAME reference, so the transfers
 * table UNIQUE(reference) constraint rejects duplicates at the DB level.
 */
export function deriveReference(prefix: string, idempotencyKey: string): string {
  const token = sha256(idempotencyKey).slice(0, 10).toUpperCase();
  return `${prefix}-${token}`;
}
