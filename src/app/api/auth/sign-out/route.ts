import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  OTP_VERIFIED_COOKIE_NAME,
  OTP_PENDING_COOKIE_NAME,
  LAST_ACTIVITY_COOKIE_NAME,
  DEVICE_COOKIE_NAME,
} from '@/lib/auth/device';
import { PIN_COOKIE_NAME } from '@/lib/auth/login-pin';

// ════════════════════════════════════════════════════════════
// POST /api/auth/sign-out
//
// Signs out the user and clears ALL custom auth cookies:
// - agriqcap_otp_verified (email OTP gate)
// - agriqcap_otp_pending (OTP in progress)
// - agriqcap_last_activity (inactivity tracking)
// - agriqcap_device (device ID)
//
// This ensures a fresh sign-in requires a new OTP verification.
// ════════════════════════════════════════════════════════════

export async function POST(_request: NextRequest) {
  const supabase = createClient();

  // Sign out from Supabase (best-effort)
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn('[sign-out] Remote signOut failed:', err instanceof Error ? err.message : err);
  }

  // Clear all custom cookies
  const res = NextResponse.json({ success: true });
  res.cookies.delete(OTP_VERIFIED_COOKIE_NAME);
  res.cookies.delete(OTP_PENDING_COOKIE_NAME);
  res.cookies.delete(LAST_ACTIVITY_COOKIE_NAME);
  res.cookies.delete(DEVICE_COOKIE_NAME);
  // PIN gate cookie dies with the session — PIN must be re-entered after sign-in.
  res.cookies.delete(PIN_COOKIE_NAME);

  return res;
}
