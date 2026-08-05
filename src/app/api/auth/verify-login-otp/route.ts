import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  OTP_VERIFIED_COOKIE_NAME,
  OTP_VERIFIED_COOKIE_OPTIONS,
  OTP_PENDING_COOKIE_NAME,
  OTP_LENGTH,
} from '@/lib/auth/device';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

// ════════════════════════════════════════════════════════════
// POST /api/auth/verify-login-otp
//
// Verifies the 6-digit OTP code entered by the user during sign-in.
// On success, sets the otp_verified cookie — which the middleware
// checks to allow access to protected routes.
//
// Body: { code: string }
// Requires: active Supabase session + otp_pending cookie.
// ════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  // Rate limit: 10 verification attempts per minute per IP
  const limited = applyRateLimit(request, '/api/auth/verify-login-otp', RATE_LIMITS.VERIFICATION);
  if (limited) return limited;

  let body: { code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const code = body.code?.trim();
  if (!code || code.length !== OTP_LENGTH || !/^\d+$/.test(code)) {
    return NextResponse.json(
      { error: `Please enter a valid ${OTP_LENGTH}-digit code.`, code: 'invalid_format' },
      { status: 400 }
    );
  }

  // Check the pending cookie
  const pendingCookie = request.cookies.get(OTP_PENDING_COOKIE_NAME)?.value;
  if (!pendingCookie) {
    return NextResponse.json(
      { error: 'No verification code was requested. Please sign in again.', code: 'no_pending' },
      { status: 400 }
    );
  }

  let pendingData: { email?: string; expiresAt?: number };
  try {
    pendingData = JSON.parse(pendingCookie);
  } catch {
    return NextResponse.json(
      { error: 'Invalid session state. Please sign in again.', code: 'invalid_pending' },
      { status: 400 }
    );
  }

  // Check expiry
  if (!pendingData.expiresAt || Date.now() > pendingData.expiresAt) {
    return NextResponse.json(
      { error: 'Verification code has expired. Please request a new one.', code: 'expired' },
      { status: 400 }
    );
  }

  const email = pendingData.email;
  if (!email) {
    return NextResponse.json({ error: 'Invalid session state' }, { status: 400 });
  }

  const supabase = createClient();

  // Verify the OTP through Supabase's GoTrue
  try {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    });

    if (error) {
      // Common errors: invalid token, expired token, already used
      const message = error.message.toLowerCase();
      if (message.includes('expired') || message.includes('invalid') || message.includes('no longer')) {
        return NextResponse.json(
          { error: 'Invalid or expired code. Please check and try again.', code: 'invalid_otp' },
          { status: 400 }
        );
      }
      console.error('[verify-login-otp] verifyOtp error:', error.message);
      return NextResponse.json(
        { error: 'Verification failed. Please try again.', code: 'verify_failed' },
        { status: 400 }
      );
    }
  } catch (err) {
    console.error('[verify-login-otp] Network error:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'Unable to verify code. Please check your connection.', code: 'network_error' },
      { status: 503 }
    );
  }

  // OTP verified — set the verified cookie and clear the pending cookie
  const res = NextResponse.json({ success: true });
  res.cookies.set(OTP_VERIFIED_COOKIE_NAME, 'true', OTP_VERIFIED_COOKIE_OPTIONS);
  res.cookies.delete(OTP_PENDING_COOKIE_NAME);
  return res;
}
