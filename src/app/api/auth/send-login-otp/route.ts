import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  OTP_PENDING_COOKIE_NAME,
  OTP_PENDING_COOKIE_OPTIONS,
  OTP_EXPIRY_MS,
} from '@/lib/auth/device';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

// ════════════════════════════════════════════════════════════
// POST /api/auth/send-login-otp
//
// Called after successful email+password authentication.
// Sends a 6-digit OTP to the user's email via Supabase GoTrue.
// Sets an otp_pending cookie to track the OTP request.
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

  // Send OTP via GoTrue API directly (bypasses session context to avoid conflicts)
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

  // Set pending cookie with email and expiry timestamp
  const pendingData = JSON.stringify({
    email,
    sentAt: Date.now(),
    expiresAt: Date.now() + OTP_EXPIRY_MS,
  });

  const res = NextResponse.json({ success: true, email });
  res.cookies.set(OTP_PENDING_COOKIE_NAME, pendingData, OTP_PENDING_COOKIE_OPTIONS);
  return res;
}
