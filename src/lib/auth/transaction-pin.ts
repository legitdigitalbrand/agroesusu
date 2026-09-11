// ============================================================================
// AgroPocket — Transaction PIN verification (server-side)
//
// An extra security layer for money-movement endpoints (e.g. bank transfers).
// Reuses the login PIN (login_pins table): one scrypt-hashed PIN per user,
// server-side brute-force lockout (5 failed attempts → 15-minute lock).
//
// Endpoints call verifyTransactionPin() BEFORE touching any funds. The
// plaintext PIN is never stored or logged; failed attempts increment only on
// a wrong PIN, not on downstream business failures.
// ============================================================================

import { createServiceClient } from '@/lib/supabase/service';
import {
  verifyPinHash,
  PIN_MAX_FAILED_ATTEMPTS,
  PIN_LOCKOUT_MINUTES,
} from './login-pin';

export type TransactionPinResult =
  | { ok: true }
  | {
      ok: false;
      /** HTTP status to return */
      status: number;
      /** Stable error code the frontend can branch on */
      code: 'pin_required' | 'pin_not_set' | 'pin_invalid' | 'pin_locked';
      error: string;
      attempts_left?: number;
    };

/**
 * Verify a 4-digit transaction PIN for a user.
 *
 * Returns:
 *   ok                      — PIN correct; proceed with the transaction
 *   pin_required (400)      — no PIN in the request body
 *   pin_not_set (403)       — user has no PIN configured yet
 *   pin_invalid (401)       — wrong PIN; includes attempts_left before lockout
 *   pin_locked (429)        — too many attempts; PIN locked server-side
 */
export async function verifyTransactionPin(userId: string, pin: unknown): Promise<TransactionPinResult> {
  if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
    return { ok: false, status: 400, code: 'pin_required', error: 'Enter your 4-digit PIN to continue.' };
  }

  const serviceClient = createServiceClient();
  const { data: pinRow } = await serviceClient
    .from('login_pins')
    .select('id, pin_hash, failed_attempts, locked_until')
    .eq('user_id', userId)
    .maybeSingle();

  if (!pinRow) {
    return {
      ok: false,
      status: 403,
      code: 'pin_not_set',
      error: 'Set up a transaction PIN to continue.',
    };
  }

  // Lockout window active?
  const lockedUntil = pinRow.locked_until ? new Date(pinRow.locked_until).getTime() : 0;
  if (lockedUntil > Date.now()) {
    const minutesLeft = Math.ceil((lockedUntil - Date.now()) / 60000);
    return {
      ok: false,
      status: 429,
      code: 'pin_locked',
      error: `Too many incorrect attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`,
    };
  }

  if (!verifyPinHash(pin, pinRow.pin_hash)) {
    const failed = (pinRow.failed_attempts || 0) + 1;
    const shouldLock = failed >= PIN_MAX_FAILED_ATTEMPTS;
    await serviceClient
      .from('login_pins')
      .update({
        failed_attempts: shouldLock ? 0 : failed,
        locked_until: shouldLock
          ? new Date(Date.now() + PIN_LOCKOUT_MINUTES * 60000).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pinRow.id);

    if (shouldLock) {
      return {
        ok: false,
        status: 429,
        code: 'pin_locked',
        error: `Too many incorrect attempts. Your PIN is locked for ${PIN_LOCKOUT_MINUTES} minutes.`,
      };
    }
    return {
      ok: false,
      status: 401,
      code: 'pin_invalid',
      error: 'Incorrect PIN.',
      attempts_left: PIN_MAX_FAILED_ATTEMPTS - failed,
    };
  }

  // Correct PIN — reset failure counters.
  await serviceClient
    .from('login_pins')
    .update({
      failed_attempts: 0,
      locked_until: null,
      last_used_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', pinRow.id);

  return { ok: true };
}
