import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  LAST_ACTIVITY_COOKIE_NAME,
  INACTIVITY_TIMEOUT_MS,
  LAST_ACTIVITY_COOKIE_OPTIONS,
  OTP_VERIFIED_COOKIE_NAME,
} from '@/lib/auth/device';

// ════════════════════════════════════════════════════════════
// Agriqcap — Authentication Middleware
//
//  1. Session refresh on every request
//  2. Inactivity expiry: 2-hour inactivity forces re-login (server-side)
//  3. Email OTP gate: must verify email OTP after password login
//  4. Email verification guard: email must be confirmed before proceeding
//  5. Redirect unauthenticated → /login (for protected routes)
//  6. Redirect authenticated from /login & /signup → /dashboard
//  7. Admin-only access for /dev/* (staff check)
//  8. Onboarding guard: force /onboarding if KYC not completed
// ════════════════════════════════════════════════════════════

const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/verify-phone',
  '/verify-login',
  '/onboarding',
  '/about',
  '/blog',
  '/careers',
  '/contact',
  '/faqs',
  '/features',
  '/loan-plans',
  '/savings-plans',
  '/terms',
  '/privacy',
  '/help',
  '/welcome',
];

const ADMIN_ROUTES = ['/dev'];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'));
}

function isDevRoute(pathname: string): boolean {
  return ADMIN_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static files, webhooks, and cron jobs
  if (
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname === '/favicon.svg' ||
    pathname === '/manifest.json' ||
    pathname.startsWith('/icon') ||
    pathname.startsWith('/api/webhooks') ||
    pathname.startsWith('/api/cron')
  ) {
    return NextResponse.next();
  }

  const response = NextResponse.next();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options as Record<string, boolean | number | string | Date> | undefined)
        );
      },
    },
  });

  // If Supabase is unreachable (DNS failure, paused project), getSession will throw.
  // Treat it as "no session" — redirect to login — rather than crashing the middleware.
  let session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'] = null;
  try {
    const result = await supabase.auth.getSession();
    session = result.data.session;
  } catch {
    // Network/DNS error — no valid session, proceed as unauthenticated
    if (!isPublicRoute(pathname)) {
      const redirectUrl = new URL('/login', request.url);
      redirectUrl.searchParams.set('redirect', pathname);
      redirectUrl.searchParams.set('reason', 'connection_error');
      return NextResponse.redirect(redirectUrl);
    }
    return response;
  }

  const now = Date.now();

  // ── Handling API routes with Session ──
  if (pathname.startsWith('/api')) {
    if (!session) {
      return NextResponse.next();
    }

    // Check inactivity for API routes
    const lastActivityCookie = request.cookies.get(LAST_ACTIVITY_COOKIE_NAME)?.value;
    if (lastActivityCookie) {
      const lastActivity = parseInt(lastActivityCookie, 10);
      if (!isNaN(lastActivity) && now - lastActivity > INACTIVITY_TIMEOUT_MS) {
        try { await supabase.auth.signOut(); } catch {}
        const apiResponse = NextResponse.json(
          { error: 'Session expired due to inactivity. Please sign in again.', code: 'session_expired' },
          { status: 401 }
        );
        apiResponse.cookies.delete(LAST_ACTIVITY_COOKIE_NAME);
        apiResponse.cookies.delete(OTP_VERIFIED_COOKIE_NAME);
        return apiResponse;
      }
    }

    // Check OTP verification for API routes (except auth routes)
    // Gated by NEXT_PUBLIC_OTP_ENABLED — disabled until Resend domain is verified
    if (process.env.NEXT_PUBLIC_OTP_ENABLED === 'true' && !pathname.startsWith('/api/auth/')) {
      const otpVerified = request.cookies.get(OTP_VERIFIED_COOKIE_NAME)?.value;
      if (!otpVerified) {
        return NextResponse.json(
          { error: 'Email verification required. Please verify your sign-in.', code: 'otp_required' },
          { status: 403 }
        );
      }
    }

    // Touch last activity
    response.cookies.set(LAST_ACTIVITY_COOKIE_NAME, now.toString(), LAST_ACTIVITY_COOKIE_OPTIONS);
    return response;
  }

  // ── No session (Page Routes) ──
  if (!session) {
    if (isPublicRoute(pathname)) {
      return response;
    }
    // Protected route + no session → /login
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // ── Has session (Page Routes) ──

  // Check 2-hour inactivity expiry (server-side, cannot be bypassed by client)
  const lastActivityCookie = request.cookies.get(LAST_ACTIVITY_COOKIE_NAME)?.value;
  if (lastActivityCookie) {
    const lastActivity = parseInt(lastActivityCookie, 10);
    if (!isNaN(lastActivity) && now - lastActivity > INACTIVITY_TIMEOUT_MS) {
      try { await supabase.auth.signOut(); } catch {}
      const redirectUrl = new URL('/login', request.url);
      redirectUrl.searchParams.set('redirect', pathname);
      redirectUrl.searchParams.set('reason', 'inactivity');
      const expiredResponse = NextResponse.redirect(redirectUrl);
      expiredResponse.cookies.delete(LAST_ACTIVITY_COOKIE_NAME);
      expiredResponse.cookies.delete(OTP_VERIFIED_COOKIE_NAME);
      return expiredResponse;
    }
  }

  // Update last_activity cookie on response (server-side session keepalive)
  response.cookies.set(LAST_ACTIVITY_COOKIE_NAME, now.toString(), LAST_ACTIVITY_COOKIE_OPTIONS);

  // ── Email OTP verification gate ──
  // Gated by NEXT_PUBLIC_OTP_ENABLED — disabled until Resend domain is verified
  if (process.env.NEXT_PUBLIC_OTP_ENABLED === 'true') {
    const otpVerified = request.cookies.get(OTP_VERIFIED_COOKIE_NAME)?.value;
    if (!otpVerified) {
      // Allow the verify-login page itself
      if (pathname === '/verify-login') {
        return response;
      }
      // Allow auth pages (login, signup, etc.) — user might want to go back
      if (pathname === '/login' || pathname === '/signup') {
        // Redirect to verify-login since they already have a session
        const verifyUrl = new URL('/verify-login', request.url);
        if (session.user.email) {
          verifyUrl.searchParams.set('email', session.user.email);
        }
        return NextResponse.redirect(verifyUrl);
      }
      // Everything else → redirect to verify-login
      const verifyUrl = new URL('/verify-login', request.url);
      if (session.user.email) {
        verifyUrl.searchParams.set('email', session.user.email);
      }
      if (pathname !== '/dashboard') {
        verifyUrl.searchParams.set('redirect', pathname);
      }
      return NextResponse.redirect(verifyUrl);
    }
  }

  // Email verification guard: if user is not confirmed, force /verify-email
  // Gated by NEXT_PUBLIC_OTP_ENABLED — disabled until email verification is configured
  if (process.env.NEXT_PUBLIC_OTP_ENABLED === 'true' && !session.user.email_confirmed_at && pathname !== '/verify-email') {
    const verifyUrl = new URL('/verify-email', request.url);
    if (session.user.email) {
      verifyUrl.searchParams.set('email', session.user.email);
    }
    return NextResponse.redirect(verifyUrl);
  }

  // Redirect authenticated users away from auth pages
  if (pathname === '/login' || pathname === '/signup' || pathname === '/verify-login') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Dev route protection
  if (isDevRoute(pathname)) {
    try {
      const { data: isStaff } = await supabase.rpc('is_staff');
      if (!isStaff) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    } catch {
      // Let client-side handle it
    }
  }

  // Onboarding guard: if user is on /dashboard but hasn't completed onboarding
  // (kyc_tier is tier_0), redirect to /onboarding to force BVN verification first.
  // NOTE: The column is kyc_tier (string enum), NOT kyc_level (number).
  // The old code queried kyc_level which doesn't exist — Postgres errored,
  // the catch block swallowed it, and the guard was dead code.
  if (pathname === '/dashboard') {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('kyc_tier')
        .eq('id', session.user.id)
        .maybeSingle();

      // If profile row doesn't exist OR kyc_tier is tier_0, redirect to onboarding
      if (!profile || (profile as { kyc_tier?: string })?.kyc_tier === 'tier_0' || !(profile as { kyc_tier?: string })?.kyc_tier) {
        return NextResponse.redirect(new URL('/onboarding', request.url));
      }
    } catch {
      // If we can't check (table missing, etc.), allow proceeding
      // but log it — this should not happen in production
      console.error('[middleware] Failed to check kyc_tier for onboarding guard');
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|favicon.svg|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
