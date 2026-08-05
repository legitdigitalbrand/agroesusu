import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  OTP_PENDING_COOKIE_NAME,
  OTP_PENDING_COOKIE_OPTIONS,
  OTP_EXPIRY_MS,
} from '@/lib/auth/device';
import { generateOtp, hashOtp } from '@/lib/auth/otp';
import { sendBrandedEmail, isResendConfigured } from '@/lib/email/resend';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

// ════════════════════════════════════════════════════════════
// POST /api/auth/send-login-otp
//
// Called after successful email+password authentication.
// Sends a 6-digit OTP to the user's email.
//
// If RESEND_API_KEY is set: generates OTP server-side, sends
// branded email via Resend, stores hash in otp_pending cookie.
// If not: falls back to Supabase GoTrue's built-in OTP.
//
// Requires: active Supabase session (from signInWithPassword).
// ════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  // Rate limit: 5 OTP requests per minute per IP
  const limited = applyRateLimit(request, '/api/auth/send-login-otp', RATE_LIMITS.OTP);
  if (limited) return limited;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: 'Auth service not configured', code: 'config_error' },
      { status: 503 }
    );
  }

  const supabase = createClient();

  // Get the current session (created by signInWithPassword on the client)
  let session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'] = null;
  try {
    const result = await supabase.auth.getSession();
    session = result.data.session;
  } catch {
    return NextResponse.json(
      { error: 'Unable to connect to the authentication service.', code: 'network_error' },
      { status: 503 }
    );
  }

  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const email = session.user.email;
  if (!email) {
    return NextResponse.json({ error: 'No email associated with account' }, { status: 400 });
  }

  const useResend = process.env.OTP_PROVIDER === "resend" && isResendConfigured();

  if (useResend) {
    // ── Resend path: generate OTP, send branded email, store hash in cookie ──

    const code = generateOtp();
    const hashedCode = hashOtp(code);

    const result = await sendBrandedEmail({
      to: email,
      subject: 'Your Agriqcap Login Code',
      title: 'Login Verification Code',
      message: `Your verification code is <strong style="font-size:28px;letter-spacing:6px;color:#1B5E20;">${code}</strong><br><br>This code expires in 5 minutes. If you didn't attempt to log in, please ignore this email and contact support immediately.`,
      footerNote: 'Never share this code with anyone. Agriqcap will never ask for your verification code.',
    });

    if (!result.sent) {
      console.error('[send-login-otp] Resend failed:', result.error);
      // Fall back to Supabase GoTrue if Resend fails
      return await sendViaGoTrue(supabaseUrl, supabaseAnonKey, email);
    }

    // Store hashed OTP in the pending cookie
    const pendingData = JSON.stringify({
      email,
      sentAt: Date.now(),
      expiresAt: Date.now() + OTP_EXPIRY_MS,
      otpHash: hashedCode,
      provider: 'resend',
    });

    const res = NextResponse.json({ success: true, email });
    res.cookies.set(OTP_PENDING_COOKIE_NAME, pendingData, OTP_PENDING_COOKIE_OPTIONS);
    return res;

  } else {
    // ── Supabase GoTrue fallback path ──

    return await sendViaGoTrue(supabaseUrl, supabaseAnonKey, email);
  }
}

// ── Helper: send OTP via Supabase GoTrue (fallback) ──────────

async function sendViaGoTrue(
  supabaseUrl: string,
  supabaseAnonKey: string,
  email: string
): Promise<NextResponse> {
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({
        email,
        create_user: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[send-login-otp] GoTrue error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to send verification code. Please try again.', code: 'send_failed' },
        { status: 502 }
      );
    }
  } catch (err) {
    console.error('[send-login-otp] Network error:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'Unable to reach the email service. Please check your connection.', code: 'network_error' },
      { status: 503 }
    );
  }

  // Set pending cookie with email and expiry timestamp (no otpHash — GoTrue verifies)
  const pendingData = JSON.stringify({
    email,
    sentAt: Date.now(),
    expiresAt: Date.now() + OTP_EXPIRY_MS,
    provider: 'gotrue',
  });

  const res = NextResponse.json({ success: true, email });
  res.cookies.set(OTP_PENDING_COOKIE_NAME, pendingData, OTP_PENDING_COOKIE_OPTIONS);
  return res;
}
