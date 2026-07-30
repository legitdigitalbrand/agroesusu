import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

// POST /api/auth/pin-verify
// Verifies a 4-digit PIN for a device. If correct, attempts to refresh
// the existing Supabase session. Does NOT mint a new session — the PIN
// only unlocks a still-valid (refreshable) session.
//
// After 5 failed attempts, the PIN is locked and the user must use Email OTP.

const MAX_PIN_ATTEMPTS = 5;

export async function POST(request: Request) {
  try {
    const { pin, deviceId } = await request.json();

    if (!pin || !/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: 'PIN must be 4 digits' }, { status: 400 });
    }

    if (!deviceId) {
      return NextResponse.json({ error: 'Device not recognized' }, { status: 400 });
    }

    const supabase = createClient();

    // Check if there's a valid (refreshable) session
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      // No session at all — PIN can't help
      return NextResponse.json({
        error: 'No active session. Please sign in with email.',
        code: 'no_session'
      }, { status: 401 });
    }

    const userId = session.user.id;

    // Look up the PIN record
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
      // No PIN set up for this device
      return NextResponse.json({
        error: 'No PIN set up for this device',
        code: 'no_pin'
      }, { status: 404 });
    }

    // Check if locked out
    if (pinRecord.locked_at) {
      return NextResponse.json({
        error: 'Too many failed attempts. Please use email sign-in.',
        code: 'locked'
      }, { status: 429 });
    }

    // Verify the PIN
    const computedHash = crypto.pbkdf2Sync(pin, pinRecord.pin_salt, 10000, 64, 'sha256').toString('hex');

    if (computedHash === pinRecord.pin_hash) {
      // PIN correct — reset failed attempts
      await supabase
        .from('device_pins')
        .update({ failed_attempts: 0, locked_at: null })
        .eq('id', pinRecord.id);

      // Try to refresh the session
      const { error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError) {
        return NextResponse.json({
          error: 'Your session has expired. Please sign in with email.',
          code: 'session_expired'
        }, { status: 401 });
      }

      return NextResponse.json({ success: true });
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
          error: 'Too many wrong attempts. PIN locked. Please use email sign-in.',
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
