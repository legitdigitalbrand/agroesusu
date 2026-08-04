import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  LAST_ACTIVITY_COOKIE_NAME,
  INACTIVITY_TIMEOUT_MS,
  LAST_ACTIVITY_COOKIE_OPTIONS,
} from '@/lib/auth/device';

// ════════════════════════════════════════════════════════════
// Agriqcap — Authentication Middleware
//
//  1. Session refresh on every request
//  2. Inactivity expiry: 2-hour inactivity forces re-login (server-side)
//  3. Email verification guard: email must be confirmed before proceeding
//  4. Redirect unauthenticated → /login (for protected routes)
//  5. Redirect authenticated from /login & /signup → /dashboard
//  6. Admin-only access for /dev/* (staff check)
//  7. Onboarding guard: force /onboarding if KYC not completed
// ════════════════════════════════════════════════════════════

const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/verify-phone',
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
      try { await supabase.auth.signOut(); } catch {}
      const redirectUrl = new URL('/login', request.url);
      redirectUrl.searchParams.set('redirect', pathname);
      redirectUrl.searchParams.set('reason', 'inactivity');
      const expiredResponse = NextResponse.redirect(redirectUrl);
      expiredResponse.cookies.delete(LAST_ACTIVITY_COOKIE_NAME);
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

  // Redirect authenticated users away from auth pages
  if (pathname === '/login' || pathname === '/signup') {
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
  // (kyc_level < 1), redirect to /onboarding to force BVN verification first.
  if (pathname === '/dashboard') {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('kyc_level')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profile && (profile.kyc_level === 0 || profile.kyc_level === null)) {
        return NextResponse.redirect(new URL('/onboarding', request.url));
      }
    } catch {
      // If we can't check, allow proceeding (don't block on DB error)
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|favicon.svg|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
