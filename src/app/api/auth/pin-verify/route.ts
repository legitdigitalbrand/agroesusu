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

    const supabase = createClient();

    // Check if there's a valid session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({
        error: 'Session expired. Please sign in with email and password.',
        code: 'no_session'
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
      console.error('[pin-verify] DB error:', dbError.message);
      return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
    }

    if (!pinRecord) {
      return NextResponse.json({
        error: 'No PIN set up for this device',
        code: 'no_pin'
      }, { status: 404 });
    }

    // Check if locked out
    if (pinRecord.locked_at) {
      return NextResponse.json({
        error: 'PIN locked. Please use email and password to sign in.',
        code: 'locked'
      }, { status: 429 });
    }

    // Verify the PIN
    const computedHash = crypto.pbkdf2Sync(pin, pinRecord.pin_salt, 10000, 64, 'sha256').toString('hex');

    if (computedHash === pinRecord.pin_hash) {
      // PIN correct — reset failed attempts, update last_used
      await supabase
        .from('device_pins')
        .update({
          failed_attempts: 0,
          locked_at: null,
          last_used_at: new Date().toISOString(),
        })
        .eq('id', pinRecord.id);

      // Refresh the Supabase session
      await supabase.auth.refreshSession();

      // Set pin_verified cookie
      const response = NextResponse.json({ success: true });
      response.cookies.set(PIN_VERIFIED_COOKIE_NAME, 'true', PIN_VERIFIED_COOKIE_OPTIONS);

      return response;
    } else {
      // PIN wrong — increment failed attempts
      const newAttempts = (pinRecord.failed_attempts || 0) + 1;
      const shouldLock = newAttempts >= MAX_PIN_ATTEMPTS;

      await supabase
        .from('device_pins')
        .update({
          failed_attempts: newAttempts,
          locked_at: shouldLock ? new Date().toISOString() : null,
        })
        .eq('id', pinRecord.id);

      const remaining = MAX_PIN_ATTEMPTS - newAttempts;

      if (shouldLock) {
        return NextResponse.json({
          error: 'PIN locked after 5 failed attempts. Please use email and password.',
          code: 'locked',
          remaining: 0,
        }, { status: 429 });
      }

      return NextResponse.json({
        error: `Wrong PIN. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
        code: 'wrong_pin',
        remaining,
      }, { status: 401 });
    }
  } catch (err) {
    console.error('[pin-verify] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
