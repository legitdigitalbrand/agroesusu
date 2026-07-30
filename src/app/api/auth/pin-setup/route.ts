import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

// POST /api/auth/pin-setup
// Sets up a 4-digit PIN for the current user's device.
// Must be called after a successful Email OTP authentication.

export async function POST(request: Request) {
  try {
    const { pin, deviceId } = await request.json();

    if (!pin || typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: 'PIN must be exactly 4 digits' }, { status: 400 });
    }

    if (!deviceId || typeof deviceId !== 'string' || deviceId.length < 8) {
      return NextResponse.json({ error: 'Invalid device identifier' }, { status: 400 });
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Hash the PIN with a per-row salt
    const salt = crypto.randomBytes(16).toString('hex');
    const pinHash = crypto.pbkdf2Sync(pin, salt, 10000, 64, 'sha256').toString('hex');

    // Upsert: replace existing PIN for this device
    const { error } = await supabase
      .from('device_pins')
      .upsert({
        user_id: user.id,
        device_id: deviceId,
        pin_hash: pinHash,
        pin_salt: salt,
        failed_attempts: 0,
        locked_at: null,
      }, {
        onConflict: 'user_id,device_id'
      });

    if (error) {
      console.error('[pin-setup] DB error:', error.message);
      return NextResponse.json({ error: 'Failed to save PIN' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[pin-setup] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
