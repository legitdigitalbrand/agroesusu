import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ════════════════════════════════════════════════════════════
// OAuth Callback Handler
//
// Supabase redirects here after Google OAuth completes.
// We check if the user's profile is complete (phone + address).
// If not, redirect to /complete-profile (mandatory gate).
// If yes, redirect to dashboard (or admin if staff).
// ════════════════════════════════════════════════════════════

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/dashboard';

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      console.error('[auth/callback] Code exchange error:', error.message);
      return NextResponse.redirect(new URL('/login?error=oauth_failed', request.url));
    }

    // Get the user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Check if staff (staff don't use Google OAuth, but handle gracefully)
    const { data: isStaff } = await supabase.rpc('is_staff');
    if (isStaff) {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }

    // Check if customer record exists
    const { data: customer } = await supabase
      .from('customers')
      .select('id, phone_verified, signup_method')
      .eq('auth_id', user.id)
      .maybeSingle();

    // Check if profile is complete: phone_verified AND has address
    let hasAddress = false;
    let phoneVerified = false;

    if (customer) {
      phoneVerified = customer.phone_verified;
      const { data: profile } = await supabase
        .from('profiles')
        .select('residential_address')
        .eq('id', user.id)
        .maybeSingle();
      hasAddress = !!(profile?.residential_address);
    }

    // For Google users: customer may not exist yet, or may not have phone/address
    const profileComplete = customer && phoneVerified && hasAddress;

    if (!profileComplete) {
      // Route to mandatory profile completion
      const redirectUrl = new URL('/complete-profile', request.url);
      redirectUrl.searchParams.set('oauth', '1');
      return NextResponse.redirect(redirectUrl);
    }

    // Profile is complete → go to dashboard
    return NextResponse.redirect(new URL(next, request.url));
  }

  // No code param → redirect to login
  return NextResponse.redirect(new URL('/login', request.url));
}
