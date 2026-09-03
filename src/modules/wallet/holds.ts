// ============================================================================
// Wallet Holds — pooling-safe concurrency guard wrappers
// (Gate 4, P0 item 3)
//
// Wraps the DB functions from migration 00046. A hold is placed BEFORE the
// balance check + FTO reservation of any money-movement flow. The atomic
// conditional UPDATE inside reserve_wallet_hold serializes concurrent
// requests at the database level: the second concurrent request sees the
// first request's reservation and fails the room check, regardless of stale
// application-side balance reads.
//
// Lifecycle:
//   reserveWalletHold()  → before FTO reservation
//   releaseWalletHold()  → after FTO reservation posted (success), or on any
//                          failure path (finally)
//   sweepStaleWalletHolds() → cron-driven crash recovery
// ============================================================================

import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type HoldReservationResult =
  | { status: 'reserved'; available_balance: number }
  | { status: 'duplicate' }
  | { status: 'insufficient'; available_balance: number }
  | { status: 'error'; message: string };

/**
 * Atomically reserve funds on a wallet (concurrency guard).
 * The room check happens inside the DB transaction against the LIVE row,
 * so concurrent requests cannot both pass it.
 */
export async function reserveWalletHold(
  walletId: string,
  idempotencyKey: string,
  amount: number
): Promise<HoldReservationResult> {
  const supabase = getServiceClient();
  const { data, error } = await supabase.rpc('reserve_wallet_hold', {
    p_wallet_id: walletId,
    p_idempotency_key: idempotencyKey,
    p_amount: amount,
  });

  if (error) return { status: 'error', message: error.message };
  const result = data as Record<string, unknown>;
  const status = result.status as string;

  if (status === 'reserved') {
    return {
      status: 'reserved',
      available_balance: Number(result.available_balance ?? 0),
    };
  }
  if (status === 'duplicate') return { status: 'duplicate' };
  if (status === 'insufficient') {
    return {
      status: 'insufficient',
      available_balance: Number(result.available_balance ?? 0),
    };
  }
  return { status: 'error', message: String(result.message || 'Hold reservation failed') };
}

/**
 * Release a wallet hold (idempotent). Call in a finally block on every path
 * after the FTO reservation has either posted (funds now escrowed in the
 * ledger/read model) or failed.
 */
export async function releaseWalletHold(idempotencyKey: string): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase.rpc('release_wallet_hold', {
    p_idempotency_key: idempotencyKey,
  });
  if (error) {
    console.error('[WalletHolds] Release failed:', error.message);
  }
}

/**
 * Crash recovery: release active holds older than maxAgeMinutes.
 * Called by the reconciliation cron.
 */
export async function sweepStaleWalletHolds(maxAgeMinutes = 15): Promise<number> {
  const supabase = getServiceClient();
  const { data, error } = await supabase.rpc('sweep_stale_wallet_holds', {
    p_max_age_minutes: maxAgeMinutes,
  });
  if (error) {
    console.error('[WalletHolds] Sweep failed:', error.message);
    return 0;
  }
  return Number(data) || 0;
}
