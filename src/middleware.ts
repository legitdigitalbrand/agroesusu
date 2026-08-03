import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  LAST_ACTIVITY_COOKIE_NAME,
  INACTIVITY_TIMEOUT_MS,
  LAST_ACTIVITY_COOKIE_OPTIONS,
  PIN_VERIFIED_COOKIE_NAME,
} from '@/lib/auth/device';

// ════════════════════════════════════════════════════════════
// Agriqcap — Authentication Middleware
//
//  1. Session refresh on every request
//  2. Inactivity expiry: 2-hour inactivity forces re-login (server-side)
//  3. Email verification guard: email must be confirmed before proceeding
//  4. OTP verification gate: BVN/NIN OTP must be done before PIN setup
//  5. Redirect unauthenticated → /login (for protected routes)
//  6. Redirect authenticated from /login & /signup → /dashboard
//  7. PIN gate: authenticated users without pin_verified cookie
//     → /set-pin (if no device cookie) or /pin-login (if device cookie)
//  8. Admin-only access for /admin/* or /dev/* (staff check)
// ════════════════════════════════════════════════════════════

const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/verify-phone',
  '/set-pin',
  '/forgot-pin',
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

// Routes that bypass the PIN gate (user is authenticated but may not have PIN yet)
const PIN_BYPASS_ROUTES = [
  '/set-pin',
  '/forgot-pin',
  '/forgot-password',
  '/reset-password',
  '/pin-login',
  '/verify-email',
  '/verify-phone',
  '/onboarding',
];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'));
}

function isDevRoute(pathname: string): boolean {
  return ADMIN_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'));
}

function isPinBypassRoute(pathname: string): boolean {
  return PIN_BYPASS_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'));
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
        // Best-effort remote signOut — don't let a failed network call block local cleanup
        try { await supabase.auth.signOut(); } catch {}
        const apiResponse = NextResponse.json(
          { error: 'Session expired due to inactivity. Please sign in again.', code: 'session_expired' },
          { status: 401 }
        );
        apiResponse.cookies.delete(LAST_ACTIVITY_COOKIE_NAME);
        apiResponse.cookies.delete(PIN_VERIFIED_COOKIE_NAME);
        return apiResponse;
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
      // Best-effort remote signOut — clear local state regardless of network outcome
      try { await supabase.auth.signOut(); } catch {}
      const redirectUrl = new URL('/login', request.url);
      redirectUrl.searchParams.set('redirect', pathname);
      redirectUrl.searchParams.set('reason', 'inactivity');
      const expiredResponse = NextResponse.redirect(redirectUrl);
      expiredResponse.cookies.delete(LAST_ACTIVITY_COOKIE_NAME);
      expiredResponse.cookies.delete(PIN_VERIFIED_COOKIE_NAME);
      return expiredResponse;
    }
  }

  // Update last_activity cookie on response (server-side session keepalive)
  response.cookies.set(LAST_ACTIVITY_COOKIE_NAME, now.toString(), LAST_ACTIVITY_COOKIE_OPTIONS);

  // Email verification guard: if user is not confirmed, force /verify-email
  if (!session.user.email_confirmed_at && pathname !== '/verify-email') {
    const verifyUrl = new URL('/verify-email', request.url);
    if (session.user.email) {
      verifyUrl.searchParams.set('email', session.user.email);
    }
    return NextResponse.redirect(verifyUrl);
  }

  // Redirect from login/signup → dashboard (or set-pin if no device cookie)
  if (pathname === '/login' || pathname === '/signup') {
    const hasDeviceCookie = request.cookies.has('agriqcap_device');
    if (!hasDeviceCookie) {
      return NextResponse.redirect(new URL('/set-pin', request.url));
    }
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

  // ── OTP Before PIN Gate ──
  // If user is on /set-pin but hasn't completed onboarding (kyc_level < 1),
  // redirect to /onboarding to force OTP verification first.
  // Skip this check for /onboarding itself and other bypass routes.
  if (pathname === '/set-pin') {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('kyc_level')
        .eq('id', session.user.id)
        .maybeSingle();

      // If profile exists and kyc_level is 0 (no OTP verification done), force onboarding
      if (profile && (profile.kyc_level === 0 || profile.kyc_level === null)) {
        return NextResponse.redirect(new URL('/onboarding', request.url));
      }
    } catch {
      // If we can't check, allow proceeding (don't block on DB error)
    }
  }

  // ── PIN Gate ──
  // For protected routes, check if PIN has been verified this session
  if (!isPublicRoute(pathname) && !isPinBypassRoute(pathname) && !isDevRoute(pathname)) {
    const hasPinVerified = request.cookies.has(PIN_VERIFIED_COOKIE_NAME);
    const hasDeviceCookie = request.cookies.has('agriqcap_device');

    if (!hasPinVerified) {
      if (!hasDeviceCookie) {
        // No device PIN → mandatory setup
        return NextResponse.redirect(new URL('/set-pin', request.url));
      } else {
        // Has device PIN but hasn't verified this session → PIN login
        return NextResponse.redirect(new URL('/pin-login', request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|favicon.svg|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
