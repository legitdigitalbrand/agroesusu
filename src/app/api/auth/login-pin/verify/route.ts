import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { verifyPinHash, signPinCookie, PIN_COOKIE_NAME, PIN_COOKIE_OPTIONS, PIN_MAX_FAILED_ATTEMPTS, PIN_LOCKOUT_MINUTES } from '@/lib/auth/login-pin';

// POST /api/auth/login-pin/verify
// Verifies the 4-digit login PIN. Server-side brute-force protection:
// after 5 failed attempts the PIN is locked for 15 minutes.
export async function POST(request: NextRequest) {
  const limited = applyRateLimit(request, '/api/auth/login-pin/verify', RATE_LIMITS.AUTH);
  if (limited) return limited;

  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const pin = body.pin;
    if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: 'Enter your 4-digit PIN.' }, { status: 400 });
    }

    const serviceClient = createServiceClient();
    const { data: pinRow } = await serviceClient
      .from('login_pins')
      .select('id, pin_hash, failed_attempts, locked_until')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!pinRow) {
      // No PIN configured — nothing to verify against.
      return NextResponse.json({ error: 'No login PIN is set up for this account.' }, { status: 404 });
    }

    // Lockout window active?
    const lockedUntil = pinRow.locked_until ? new Date(pinRow.locked_until).getTime() : 0;
    if (lockedUntil > Date.now()) {
      const minutesLeft = Math.ceil((lockedUntil - Date.now()) / 60000);
      return NextResponse.json(
        { error: `Too many incorrect attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`, locked: true },
        { status: 429 }
      );
    }

    if (!verifyPinHash(pin, pinRow.pin_hash)) {
      const failed = (pinRow.failed_attempts || 0) + 1;
      const shouldLock = failed >= PIN_MAX_FAILED_ATTEMPTS;
      await serviceClient
        .from('login_pins')
        .update({
          failed_attempts: shouldLock ? 0 : failed,
          locked_until: shouldLock ? new Date(Date.now() + PIN_LOCKOUT_MINUTES * 60000).toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pinRow.id);

      if (shouldLock) {
        return NextResponse.json(
          { error: `Too many incorrect attempts. Your PIN is locked for ${PIN_LOCKOUT_MINUTES} minutes.`, locked: true },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: 'Incorrect PIN.', attempts_left: PIN_MAX_FAILED_ATTEMPTS - failed },
        { status: 401 }
      );
    }

    // Success — reset counters, set the signed gate cookie.
    await serviceClient
      .from('login_pins')
      .update({ failed_attempts: 0, locked_until: null, last_used_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', pinRow.id);

    const res = NextResponse.json({ success: true });
    res.cookies.set(PIN_COOKIE_NAME, await signPinCookie(user.id), PIN_COOKIE_OPTIONS);
    return res;
  } catch {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
