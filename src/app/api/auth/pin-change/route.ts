import { NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { DEVICE_COOKIE_NAME } from '@/lib/auth/device';
import crypto from 'crypto';

// POST /api/auth/pin-change
// Changes the PIN for the current device. Requires the current PIN for verification.

export async function POST(request: Request) {
  const limited = applyRateLimit(request, "/api/auth/pin-change", RATE_LIMITS.AUTH);
  if (limited) return limited;
  try {
    const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { currentPin, newPin } = await request.json();

    if (!currentPin || !/^\d{4}$/.test(currentPin)) {
      return NextResponse.json({ error: 'Current PIN must be 4 digits' }, { status: 400 });
    }
    if (!newPin || !/^\d{4}$/.test(newPin)) {
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
      .select('id, pin_hash, pin_salt')
      .eq('user_id', user.id)
      .eq('device_id', deviceId)
      .maybeSingle();

    if (dbError || !pinRecord) {
      return NextResponse.json({ error: 'No PIN found for this device' }, { status: 404 });
    }

    // Verify current PIN
    const computedHash = crypto.pbkdf2Sync(currentPin, pinRecord.pin_salt, 10000, 64, 'sha256').toString('hex');
    if (computedHash !== pinRecord.pin_hash) {
      return NextResponse.json({ error: 'Current PIN is incorrect' }, { status: 401 });
    }

    // Set new PIN
    const newSalt = crypto.randomBytes(16).toString('hex');
    const newHash = crypto.pbkdf2Sync(newPin, newSalt, 10000, 64, 'sha256').toString('hex');

    await supabase
      .from('device_pins')
      .update({
        pin_hash: newHash,
        pin_salt: newSalt,
        failed_attempts: 0,
        locked_at: null,
      })
      .eq('id', pinRecord.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[pin-change] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
