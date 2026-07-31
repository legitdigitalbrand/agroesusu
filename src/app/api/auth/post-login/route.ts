import { NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import {
  PIN_VERIFIED_COOKIE_NAME,
  PIN_VERIFIED_COOKIE_OPTIONS,
} from '@/lib/auth/device';

// POST /api/auth/post-login
// Called after successful password authentication.
// Sets the pin_verified cookie and checks if the user needs PIN setup.

export async function POST(request: Request) {
  const limited = applyRateLimit(request, "/api/auth/post-login", RATE_LIMITS.AUTH);
  if (limited) return limited;
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Check if the user has ANY device PINs
    const { count } = await supabase
      .from('device_pins')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id);

    const hasAnyPin = (count || 0) > 0;

    // Set pin_verified cookie (user just authenticated with password)
    const response = NextResponse.json({
      success: true,
      needsPinSetup: !hasAnyPin,
    });

    response.cookies.set(PIN_VERIFIED_COOKIE_NAME, 'true', PIN_VERIFIED_COOKIE_OPTIONS);

    return response;
  } catch (err) {
    console.error('[post-login] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
