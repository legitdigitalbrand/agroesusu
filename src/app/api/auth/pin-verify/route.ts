import { NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import {
  DEVICE_COOKIE_NAME,
  PIN_VERIFIED_COOKIE_NAME,
  PIN_VERIFIED_COOKIE_OPTIONS,
} from '@/lib/auth/device';
import { verifyPin, isValidPinFormat } from '@/lib/auth/pin';

// POST /api/auth/pin-verify
// Verifies a 4-digit PIN for a trusted device.
// The device_id comes from the httpOnly cookie (server-set, not client-provided).
// If correct: sets pin_verified cookie, refreshes Supabase session.
// If wrong: increments failed_attempts. After 5, locks PIN.

const MAX_PIN_ATTEMPTS = 5;

export async function POST(request: Request) {
  const limited = applyRateLimit(request, '/api/auth/pin-verify', RATE_LIMITS.AUTH);
  if (limited) return limited;

  try {
    // Check if there's a valid session first
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({
        error: 'Session expired. Please sign in with email and password.',
        code: 'no_session'
      }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body.pin !== 'string') {
      return NextResponse.json({ error: 'PIN is required' }, { status: 400 });
    }

    const { pin } = body;

    if (!isValidPinFormat(pin)) {
      return NextResponse.json({ error: 'PIN must be 4 digits' }, { status: 400 });
    }

    // Get device_id from httpOnly cookie (NOT from client request body)
    const cookieHeader = request.headers.get('cookie') || '';
    const deviceMatch = cookieHeader
      .split('; ')
      .find((c) => c.startsWith(`${DEVICE_COOKIE_NAME}=`));
    const deviceId = deviceMatch ? deviceMatch.split('=')[1] : null;

    if (!deviceId) {
      return NextResponse.json({
        error: 'Device not recognized. Please sign in with email and password.',
        code: 'no_device'
      }, { status: 401 });
    }

    const userId = session.user.id;

    // Look up the PIN record for this device
    const { data: pinRecord, error: dbError } = await supabase
      .from('device_pins')
      .select('id, pin_hash, pin_salt, failed_attempts, locked_at')
      .eq('user_id', userId)
      .eq('device_id', deviceId)
      .maybeSingle();

    if (dbError) {
      console.error('[pin-verify] DB error:', dbError.message, dbError.code);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    if (!pinRecord) {
      return NextResponse.json({
        error: 'No PIN set for this device. Please set up a PIN.',
        code: 'no_pin'
      }, { status: 404 });
    }

    // Check if PIN is locked — auto-unlock after 15 minutes
    if (pinRecord.locked_at) {
      const lockoutMs = 15 * 60 * 1000; // 15 minutes
      const lockedAt = new Date(pinRecord.locked_at).getTime();
      const now = Date.now();
      
      if (now - lockedAt < lockoutMs) {
        const remainingMs = lockoutMs - (now - lockedAt);
        const remainingMin = Math.ceil(remainingMs / 60000);
        return NextResponse.json({
          error: `PIN locked. Try again in ${remainingMin} minute${remainingMin === 1 ? '' : 's'} or sign in with email and password.`,
          code: 'pin_locked',
          remaining_minutes: remainingMin,
        }, { status: 403 });
      }
      
      // Auto-unlock: reset failed attempts and locked_at
      console.log('[pin-verify] Auto-unlocking PIN after 15-min lockout period');
      await supabase
        .from('device_pins')
        .update({ failed_attempts: 0, locked_at: null })
        .eq('id', pinRecord.id);
      
      // Re-fetch the record to continue verification with fresh state
      pinRecord.failed_attempts = 0;
      pinRecord.locked_at = null;
    }

    // ── Fix: Handle null/missing pin_salt ──
    // Older records may have pin_hash in "hash:salt" format without a separate pin_salt column.
    // The verifyPin function handles this fallback internally, but we log it for debugging.
    if (!pinRecord.pin_salt && !pinRecord.pin_hash?.includes(':')) {
      console.error('[pin-verify] PIN record has no salt and hash is not in hash:salt format:', pinRecord.id);
      return NextResponse.json({
        error: 'PIN data corrupted. Please reset your PIN.',
        code: 'pin_corrupted'
      }, { status: 500 });
    }

    // Verify PIN using canonical verifyPin from src/lib/auth/pin.ts
    // verifyPin handles: whitespace trimming, null salt fallback, timing-safe comparison
    const isPinValid = verifyPin(pin, pinRecord.pin_hash, pinRecord.pin_salt);
    
    // Debug logging for "correct PIN denied" investigation
    if (!isPinValid) {
      console.warn('[pin-verify] PIN verification failed', {
        pinRecordId: pinRecord.id,
        hashLength: pinRecord.pin_hash?.length || 0,
        saltLength: pinRecord.pin_salt?.length || 0,
        hasSalt: !!pinRecord.pin_salt,
        hashHasColon: pinRecord.pin_hash?.includes(':') || false,
      });
    }

    if (!isPinValid) {
      // Increment failed attempts on existing record
      const newFailedAttempts = (pinRecord.failed_attempts || 0) + 1;
      const shouldLock = newFailedAttempts >= MAX_PIN_ATTEMPTS;

      const { error: updateError } = await supabase
        .from('device_pins')
        .update({
          failed_attempts: newFailedAttempts,
          locked_at: shouldLock ? new Date().toISOString() : null,
        })
        .eq('id', pinRecord.id);

      if (updateError) {
        console.error('[pin-verify] Failed to update failed_attempts:', updateError.message);
      }

      return NextResponse.json({
        error: shouldLock
          ? 'PIN locked due to too many failed attempts. Please sign in with email and password.'
          : `Incorrect PIN. ${MAX_PIN_ATTEMPTS - newFailedAttempts} attempts remaining.`,
        code: shouldLock ? 'pin_locked' : 'wrong_pin',
        attempts_remaining: Math.max(0, MAX_PIN_ATTEMPTS - newFailedAttempts),
      }, { status: 401 });
    }

    // PIN is correct — reset failed attempts and update last_used_at
    const { error: resetError } = await supabase
      .from('device_pins')
      .update({
        failed_attempts: 0,
        locked_at: null,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', pinRecord.id);

    if (resetError) {
      console.error('[pin-verify] Failed to reset failed_attempts:', resetError.message);
      // Don't fail the request — PIN was correct, let the user through
    }

    // Set pin_verified cookie
    const response = NextResponse.json({
      success: true,
      message: 'PIN verified successfully',
    });

    response.cookies.set(
      PIN_VERIFIED_COOKIE_NAME,
      'true',
      PIN_VERIFIED_COOKIE_OPTIONS
    );

    // Refresh the Supabase session
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      console.error('[pin-verify] Session refresh error:', refreshError.message);
      // Don't fail — PIN was correct, session refresh is best-effort
    }

    return response;
  } catch (err) {
    console.error('[pin-verify] Unexpected error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
