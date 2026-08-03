import { NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import {
  PIN_VERIFIED_COOKIE_NAME,
  PIN_VERIFIED_COOKIE_OPTIONS,
} from '@/lib/auth/device';

// POST /api/auth/post-login
// Called after successful password authentication.
// Sets the pin_verified cookie if user already has a device PIN.
// Returns needsPinSetup flag for the client to redirect appropriately.

export async function POST(request: Request) {
  const limited = applyRateLimit(request, "/api/auth/post-login", RATE_LIMITS.AUTH);
  if (limited) return limited;

  try {
    const supabase = createClient();
    let session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'] = null;
    try {
      const result = await supabase.auth.getSession();
      session = result.data.session;
    } catch {
      return NextResponse.json({
        error: 'Unable to connect to the authentication service. Please try again.',
        code: 'network_error'
      }, { status: 503 });
    }

    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Check if the user has ANY device PINs
    const { count, error: pinCountError } = await supabase
      .from('device_pins')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id);

    if (pinCountError) {
      console.error('[post-login] Error checking device_pins:', pinCountError.message);
    }

    const hasAnyPin = (count || 0) > 0;

    // Only set pin_verified cookie if user already has a device PIN.
    // If they need PIN setup, DON'T set pin_verified — middleware will
    // redirect them to /set-pin (which itself redirects to /onboarding if OTP not done).
    const response = NextResponse.json({
      success: true,
      needsPinSetup: !hasAnyPin,
    });

    if (hasAnyPin) {
      response.cookies.set(PIN_VERIFIED_COOKIE_NAME, 'true', PIN_VERIFIED_COOKIE_OPTIONS);
    }

    return response;
  } catch (err) {
    console.error('[post-login] Error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
