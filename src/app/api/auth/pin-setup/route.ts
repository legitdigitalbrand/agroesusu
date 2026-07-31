import { NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import {
  DEVICE_COOKIE_NAME,
  COOKIE_OPTIONS,
  PIN_VERIFIED_COOKIE_NAME,
  PIN_VERIFIED_COOKIE_OPTIONS,
} from '@/lib/auth/device';
import crypto from 'crypto';

// POST /api/auth/pin-setup
// Sets up a mandatory 4-digit PIN for the authenticated user's device.
// Called after successful Email + Password authentication.
// Sets the device_id as an httpOnly cookie.

export async function POST(request: Request) {
  const limited = applyRateLimit(request, "/api/auth/pin-setup", RATE_LIMITS.AUTH);
  if (limited) return limited;
  try {
    const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { pin, deviceName } = await request.json();

    if (!pin || typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: 'PIN must be exactly 4 digits' }, { status: 400 });
    }

    // Generate a secure device ID (server-side, not client-provided)
    const deviceId = crypto.randomUUID();
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Hash the PIN with a per-row salt
    const salt = crypto.randomBytes(16).toString('hex');
    const pinHash = crypto.pbkdf2Sync(pin, salt, 10000, 64, 'sha256').toString('hex');

    // Insert the device PIN record
    const { error } = await supabase
      .from('device_pins')
      .insert({
        user_id: user.id,
        device_id: deviceId,
        pin_hash: pinHash,
        pin_salt: salt,
        failed_attempts: 0,
        locked_at: null,
        device_name: deviceName || null,
        user_agent: userAgent,
        last_used_at: new Date().toISOString(),
      });

    if (error) {
      // If device already exists (shouldn't happen since we generate server-side),
      // update the PIN instead
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Device already registered' }, { status: 409 });
      }
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
