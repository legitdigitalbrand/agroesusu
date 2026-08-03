import { NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { DEVICE_COOKIE_NAME } from '@/lib/auth/device';
import { hashPin, verifyPin, isValidPinFormat } from '@/lib/auth/pin';

const MAX_PIN_ATTEMPTS = 5;

// POST /api/auth/pin-change
// Changes the PIN for the current device. Requires the current PIN for verification.

export async function POST(request: Request) {
  const limited = applyRateLimit(request, '/api/auth/pin-change', RATE_LIMITS.AUTH);
  if (limited) return limited;

  try {
    const supabase = createClient();
    let user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'] = null;
    try {
      const result = await supabase.auth.getUser();
      user = result.data.user;
    } catch {
      return NextResponse.json({
        error: 'Unable to connect to the authentication service. Please try again.',
        code: 'network_error'
      }, { status: 503 });
    }
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Request body required' }, { status: 400 });
    }

    const { currentPin, newPin } = body;

    if (!isValidPinFormat(currentPin)) {
      return NextResponse.json({ error: 'Current PIN must be 4 digits' }, { status: 400 });
    }
    if (!isValidPinFormat(newPin)) {
      return NextResponse.json({ error: 'New PIN must be 4 digits' }, { status: 400 });
    }
    if (currentPin === newPin) {
      return NextResponse.json({ error: 'New PIN must be different from current PIN' }, { status: 400 });
    }

    const cookieHeader = request.headers.get('cookie') || '';
    const deviceMatch = cookieHeader
      .split('; ')
      .find((c) => c.startsWith(`${DEVICE_COOKIE_NAME}=`));
    const deviceId = deviceMatch ? deviceMatch.split('=')[1] : null;

    if (!deviceId) {
      return NextResponse.json({ error: 'Device not recognized' }, { status: 400 });
    }

    const { data: pinRecord, error: dbError } = await supabase
      .from('device_pins')
      .select('id, pin_hash, pin_salt, failed_attempts, locked_at')
      .eq('user_id', user.id)
      .eq('device_id', deviceId)
      .maybeSingle();

    if (dbError) {
      console.error('[pin-change] DB error:', dbError.message, dbError.code);
      if (dbError.code === '42P01') {
        return NextResponse.json({ error: 'PIN service is not available. Please contact support.' }, { status: 503 });
      }
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    if (!pinRecord) {
      return NextResponse.json({ error: 'No PIN found for this device', code: 'no_pin' }, { status: 404 });
    }

    // Check if PIN is locked
    if (pinRecord.locked_at) {
      return NextResponse.json({ error: 'PIN is locked. Please sign in with email and password first.', code: 'pin_locked' }, { status: 403 });
    }

    // Verify current PIN using canonical verifyPin
    if (!verifyPin(currentPin, pinRecord.pin_hash, pinRecord.pin_salt)) {
      // Increment failed attempts on wrong current PIN
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
          : `Current PIN is incorrect. ${MAX_PIN_ATTEMPTS - newFailedAttempts} attempts remaining.`,
        code: shouldLock ? 'pin_locked' : 'wrong_pin',
        attempts_remaining: Math.max(0, MAX_PIN_ATTEMPTS - newFailedAttempts),
      }, { status: 401 });
    }

    // Set new PIN using canonical PBKDF2 function
    const { pinHash: newHash, pinSalt: newSalt } = hashPin(newPin);

    const { error: updateError } = await supabase
      .from('device_pins')
      .update({
        pin_hash: newHash,
        pin_salt: newSalt,
        failed_attempts: 0,
        locked_at: null,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', pinRecord.id);

    if (updateError) {
      console.error('[pin-change] DB error:', updateError.message, updateError.code);
      return NextResponse.json({ error: 'Failed to update PIN' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[pin-change] Unexpected error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
