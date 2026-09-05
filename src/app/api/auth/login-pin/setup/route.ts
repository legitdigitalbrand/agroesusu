import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { hashPin, isValidPinFormat, signPinCookie, PIN_COOKIE_NAME, PIN_COOKIE_OPTIONS } from '@/lib/auth/login-pin';

// POST /api/auth/login-pin/setup
// First-time PIN creation. Only succeeds when NO PIN exists yet (409
// otherwise) — an attacker with a hijacked session cannot silently replace a
// victim's PIN; use the (password re-auth) reset route for that.
export async function POST(request: NextRequest) {
  const limited = applyRateLimit(request, '/api/auth/login-pin/setup', RATE_LIMITS.AUTH);
  if (limited) return limited;

  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { pin, confirmPin } = body;

    if (!isValidPinFormat(pin) || !isValidPinFormat(confirmPin)) {
      return NextResponse.json({ error: 'PIN must be exactly 4 digits.' }, { status: 400 });
    }
    if (pin !== confirmPin) {
      return NextResponse.json({ error: 'PINs do not match.' }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    // First-time only: if a PIN row already exists, direct the user to the
    // password-re-auth reset flow instead of silently replacing it.
    const { data: existingPin } = await serviceClient
      .from('login_pins')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingPin) {
      return NextResponse.json(
        { error: 'A login PIN already exists. Use the reset flow in Settings.' },
        { status: 409 }
      );
    }

    const { error: insertError } = await serviceClient.from('login_pins').insert({
      user_id: user.id,
      pin_hash: hashPin(pin),
      failed_attempts: 0,
    });

    if (insertError) {
      console.error('[login-pin-setup] Insert failed:', insertError.message);
      return NextResponse.json({ error: 'Could not save your PIN. Please try again.' }, { status: 500 });
    }

    // Flag the profile so the middleware gates future sessions (service role
    // only — the protect_sensitive_profile_columns trigger blocks user writes).
    await serviceClient
      .from('profiles')
      .update({ has_login_pin: true })
      .eq('id', user.id);

    const res = NextResponse.json({ success: true });
    res.cookies.set(PIN_COOKIE_NAME, await signPinCookie(user.id), PIN_COOKIE_OPTIONS);
    return res;
  } catch {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
