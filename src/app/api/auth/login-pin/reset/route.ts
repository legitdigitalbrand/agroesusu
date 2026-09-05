import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { hashPin, isValidPinFormat, signPinCookie, PIN_COOKIE_NAME, PIN_COOKIE_OPTIONS } from '@/lib/auth/login-pin';

// POST /api/auth/login-pin/reset
// Replaces the login PIN. Requires CURRENT PASSWORD re-authentication —
// a hijacked session alone cannot change the victim's PIN.
export async function POST(request: NextRequest) {
  const limited = applyRateLimit(request, '/api/auth/login-pin/reset', RATE_LIMITS.AUTH);
  if (limited) return limited;

  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { currentPassword, newPin, confirmPin } = body;

    if (typeof currentPassword !== 'string' || !currentPassword) {
      return NextResponse.json({ error: 'Current password is required.' }, { status: 400 });
    }
    if (!isValidPinFormat(newPin) || !isValidPinFormat(confirmPin)) {
      return NextResponse.json({ error: 'New PIN must be exactly 4 digits.' }, { status: 400 });
    }
    if (newPin !== confirmPin) {
      return NextResponse.json({ error: 'PINs do not match.' }, { status: 400 });
    }

    // Re-authenticate with the password WITHOUT creating a new session:
    // direct token grant; the returned tokens are discarded after the check.
    const authUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`;
    const authRes = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: user.email, password: currentPassword }),
    });

    if (!authRes.ok) {
      return NextResponse.json(
        { error: 'Incorrect password. Please try again.' },
        { status: 401 }
      );
    }

    const serviceClient = createServiceClient();
    const now = new Date().toISOString();

    // Replace or create the PIN row.
    const { data: existingPin } = await serviceClient
      .from('login_pins')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingPin) {
      const { error: updateError } = await serviceClient
        .from('login_pins')
        .update({
          pin_hash: hashPin(newPin),
          failed_attempts: 0,
          locked_until: null,
          updated_at: now,
        })
        .eq('id', existingPin.id);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await serviceClient.from('login_pins').insert({
        user_id: user.id,
        pin_hash: hashPin(newPin),
        failed_attempts: 0,
      });
      if (insertError) throw insertError;
      await serviceClient
        .from('profiles')
        .update({ has_login_pin: true })
        .eq('id', user.id);
    }

    const res = NextResponse.json({ success: true });
    res.cookies.set(PIN_COOKIE_NAME, await signPinCookie(user.id), PIN_COOKIE_OPTIONS);
    return res;
  } catch {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
