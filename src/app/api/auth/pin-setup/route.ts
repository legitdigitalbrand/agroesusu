import { NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import {
  DEVICE_COOKIE_NAME,
  COOKIE_OPTIONS,
  PIN_VERIFIED_COOKIE_NAME,
  PIN_VERIFIED_COOKIE_OPTIONS,
} from '@/lib/auth/device';
import { hashPin, isValidPinFormat } from '@/lib/auth/pin';
import { randomUUID } from 'crypto';

// POST /api/auth/pin-setup
// Sets up a mandatory 4-digit PIN for the authenticated user's device.
// Called after successful Email + Password authentication + OTP verification.
// Sets the device_id as an httpOnly cookie.

export async function POST(request: Request) {
  const limited = applyRateLimit(request, "/api/auth/pin-setup", RATE_LIMITS.AUTH);
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

    if (!user.email_confirmed_at) {
      return NextResponse.json(
        { error: 'Email verification required before setting up a PIN', code: 'email_not_verified' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body.pin !== 'string') {
      return NextResponse.json({ error: 'PIN is required' }, { status: 400 });
    }

    const { pin, deviceName } = body;

    if (!isValidPinFormat(pin)) {
      return NextResponse.json({ error: 'PIN must be exactly 4 digits' }, { status: 400 });
    }

    // Get existing device_id from httpOnly cookie if available, or generate a new one server-side
    const cookieHeader = request.headers.get('cookie') || '';
    const deviceMatch = cookieHeader
      .split('; ')
      .find((c) => c.startsWith(`${DEVICE_COOKIE_NAME}=`));
    const existingDeviceId = deviceMatch ? deviceMatch.split('=')[1] : null;

    const deviceId = existingDeviceId || randomUUID();
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Hash the PIN using canonical PBKDF2 function from src/lib/auth/pin.ts
    const { pinHash, pinSalt } = hashPin(pin);

    // Upsert the device PIN record (resets lockout state and failed attempts)
    const { error } = await supabase
      .from('device_pins')
      .upsert(
        {
          user_id: user.id,
          device_id: deviceId,
          pin_hash: pinHash,
          pin_salt: pinSalt,
          failed_attempts: 0,
          locked_at: null,
          device_name: deviceName || null,
          user_agent: userAgent,
          last_used_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,device_id' }
      );

    if (error) {
      console.error('[pin-setup] DB error:', error.message, error.code, error.details, error.hint);

      // Handle specific DB errors with helpful messages
      if (error.code === '23505') {
        return NextResponse.json({ error: 'PIN already exists for this device. Try changing it instead.' }, { status: 409 });
      }
      if (error.code === '42501') {
        return NextResponse.json({ error: 'Permission denied. Please sign in again.' }, { status: 403 });
      }
      if (error.code === '42P01') {
        // Table doesn't exist — migration not run
        console.error('[pin-setup] device_pins table does not exist. Run migration 00034.');
        return NextResponse.json({ error: 'PIN setup is not available. Please contact support.' }, { status: 503 });
      }
      if (error.code === '42703') {
        // Column doesn't exist — migration 00035 (device metadata) not run
        console.error('[pin-setup] device_pins missing columns. Run migration 00035.');
        // Retry without the optional metadata columns
        const { error: retryError } = await supabase
          .from('device_pins')
          .upsert(
            {
              user_id: user.id,
              device_id: deviceId,
              pin_hash: pinHash,
              pin_salt: pinSalt,
              failed_attempts: 0,
              locked_at: null,
            },
            { onConflict: 'user_id,device_id' }
          );
        if (retryError) {
          console.error('[pin-setup] Retry without metadata failed:', retryError.message);
          return NextResponse.json({ error: 'Failed to save PIN. Please try again.' }, { status: 500 });
        }
        // Success on retry — set cookies and return
        const retryResponse = NextResponse.json({ success: true, deviceId });
        retryResponse.cookies.set(DEVICE_COOKIE_NAME, deviceId, COOKIE_OPTIONS);
        retryResponse.cookies.set(PIN_VERIFIED_COOKIE_NAME, 'true', PIN_VERIFIED_COOKIE_OPTIONS);
        return retryResponse;
      }

      console.error('[pin-setup] Full error:', JSON.stringify(error));
      return NextResponse.json({ error: 'Failed to save PIN. Please try again.' }, { status: 500 });
    }

    // Set the device_id and pin_verified cookies
    const response = NextResponse.json({ success: true, deviceId });
    response.cookies.set(DEVICE_COOKIE_NAME, deviceId, COOKIE_OPTIONS);
    response.cookies.set(PIN_VERIFIED_COOKIE_NAME, 'true', PIN_VERIFIED_COOKIE_OPTIONS);

    return response;
  } catch (err) {
    console.error('[pin-setup] Unexpected error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
