import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ════════════════════════════════════════════════════════════
// OAuth Callback Handler
//
// Supabase redirects here after Google OAuth completes.
// We exchange the code for a session, create the customer
// record + wallet if needed, then redirect to dashboard.
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

    // Check if staff
    const { data: isStaff } = await supabase.rpc('is_staff');
    if (isStaff) {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }

    // Create customer + wallet if not exists (idempotent)
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle();

    if (!customer) {
      try {
        await fetch(`${requestUrl.origin}/api/bootstrap`, { method: 'POST' });
      } catch (e) {
        console.error('[auth/callback] Bootstrap error:', e);
      }
    }

    // Set profile_complete in user metadata
    await supabase.auth.updateUser({
      data: { profile_complete: true }
    });

    return NextResponse.redirect(new URL(next, request.url));
  }

  return NextResponse.redirect(new URL('/login', request.url));
}
