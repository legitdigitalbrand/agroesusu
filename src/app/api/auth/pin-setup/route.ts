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
import crypto from 'crypto';

// POST /api/auth/pin-setup
// Sets up a mandatory 4-digit PIN for the authenticated user's device.
// Called after successful Email + Password authentication.
// Sets the device_id as an httpOnly cookie.

export async function POST(request: Request) {
  const limited = applyRateLimit(request, '/api/auth/pin-setup', RATE_LIMITS.AUTH);
  if (limited) return limited;
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!user.email_confirmed_at) {
      return NextResponse.json(
        { error: 'Email verification required before setting up a PIN' },
        { status: 403 }
      );
    }

    const { pin, deviceName } = await request.json();

    if (!isValidPinFormat(pin)) {
      return NextResponse.json({ error: 'PIN must be exactly 4 digits' }, { status: 400 });
    }

    // Get existing device_id from httpOnly cookie if available, or generate a new one server-side
    const cookieHeader = request.headers.get('cookie') || '';
    const deviceMatch = cookieHeader
      .split('; ')
      .find((c) => c.startsWith(`${DEVICE_COOKIE_NAME}=`));
    const existingDeviceId = deviceMatch ? deviceMatch.split('=')[1] : null;

    const deviceId = existingDeviceId || crypto.randomUUID();
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
      console.error('[pin-setup] DB error:', error.message);
      return NextResponse.json({ error: 'Failed to save PIN' }, { status: 500 });
    }

    // Set the device_id and pin_verified cookies
    const response = NextResponse.json({ success: true, deviceId });
    response.cookies.set(DEVICE_COOKIE_NAME, deviceId, COOKIE_OPTIONS);
    response.cookies.set(PIN_VERIFIED_COOKIE_NAME, 'true', PIN_VERIFIED_COOKIE_OPTIONS);

    return response;
  } catch (err) {
    console.error('[pin-setup] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
