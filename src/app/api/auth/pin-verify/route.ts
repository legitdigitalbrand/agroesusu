import { NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import {
  DEVICE_COOKIE_NAME,
  PIN_VERIFIED_COOKIE_NAME,
  PIN_VERIFIED_COOKIE_OPTIONS,
} from '@/lib/auth/device';
import crypto from 'crypto';

// POST /api/auth/pin-verify
// Verifies a 4-digit PIN for a trusted device.
// The device_id comes from the httpOnly cookie (server-set, not client-provided).
// If correct: sets pin_verified cookie, refreshes Supabase session.
// If wrong: increments failed_attempts. After 5, locks PIN.

const MAX_PIN_ATTEMPTS = 5;

export async function POST(request: Request) {
  const limited = applyRateLimit(request, "/api/auth/pin-verify", RATE_LIMITS.AUTH);
  if (limited) return limited;
  try {
    // Check if there's a valid session first (before body parsing)
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({
        error: 'Session expired. Please sign in with email and password.',
        code: 'no_session'
      }, { status: 401 });
    }

    const { pin } = await request.json();

    if (!pin || !/^\d{4}$/.test(pin)) {
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
      .select('id, pin_hash, failed_attempts, locked_at')
      .eq('user_id', userId)
      .eq('device_id', deviceId)
      .single();

    if (dbError || !pinRecord) {
      return NextResponse.json({
        error: 'No PIN set for this device. Please set up a PIN.',
        code: 'no_pin'
      }, { status: 404 });
    }

    // Check if PIN is locked
    if (pinRecord.locked_at) {
      return NextResponse.json({
        error: 'PIN locked due to too many failed attempts. Please sign in with email and password.',
        code: 'pin_locked'
      }, { status: 403 });
    }

    // Hash the provided PIN with the stored salt
    const [storedHash, salt] = pinRecord.pin_hash.split(':');
    const providedHash = crypto
      .pbkdf2Sync(pin, salt, 100000, 64, 'sha512')
      .toString('hex');

    if (providedHash !== storedHash) {
      // Increment failed attempts
      const newFailedAttempts = (pinRecord.failed_attempts || 0) + 1;
      const shouldLock = newFailedAttempts >= MAX_PIN_ATTEMPTS;

      await supabase
        .from('device_pins')
        .update({
          failed_attempts: newFailedAttempts,
          locked_at: shouldLock ? new Date().toISOString() : null,
        })
        .eq('id', pinRecord.id);

      return NextResponse.json({
        error: shouldLock
          ? 'PIN locked due to too many failed attempts. Please sign in with email and password.'
          : `Incorrect PIN. ${MAX_PIN_ATTEMPTS - newFailedAttempts} attempts remaining.`,
        code: shouldLock ? 'pin_locked' : 'wrong_pin',
        attempts_remaining: Math.max(0, MAX_PIN_ATTEMPTS - newFailedAttempts),
      }, { status: 401 });
    }

    // PIN is correct — reset failed attempts
    await supabase
      .from('device_pins')
      .update({ failed_attempts: 0 })
      .eq('id', pinRecord.id);

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
      console.error('[pin-verify] Session refresh error:', refreshError);
    }

    return response;
  } catch (err) {
    console.error('[pin-verify] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
