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
//  2. Inactivity expiry: 2-hour inactivity forces re-login
//  3. Email verification guard: email must be confirmed before proceeding
//  4. Redirect unauthenticated → /login (for protected routes)
//  5. Redirect authenticated from /login & /signup → /dashboard
//  6. PIN gate: authenticated users without pin_verified cookie
//     → /set-pin (if no device cookie) or /pin-login (if device cookie)
//  7. Admin-only access for /admin/* or /dev/* (staff check)
// ════════════════════════════════════════════════════════════

const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/set-pin',
  '/forgot-pin',
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
  '/pin-login',
  '/verify-email',
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

  const {
    data: { session },
  } = await supabase.auth.getSession();

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
        await supabase.auth.signOut();
        const apiResponse = NextResponse.json(
          { error: 'Session expired due to inactivity. Please sign in again.' },
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

  // Check 2-hour inactivity expiry
  const lastActivityCookie = request.cookies.get(LAST_ACTIVITY_COOKIE_NAME)?.value;
  if (lastActivityCookie) {
    const lastActivity = parseInt(lastActivityCookie, 10);
    if (!isNaN(lastActivity) && now - lastActivity > INACTIVITY_TIMEOUT_MS) {
      await supabase.auth.signOut();
      const redirectUrl = new URL('/login', request.url);
      redirectUrl.searchParams.set('redirect', pathname);
      redirectUrl.searchParams.set('reason', 'inactivity');
      const expiredResponse = NextResponse.redirect(redirectUrl);
      expiredResponse.cookies.delete(LAST_ACTIVITY_COOKIE_NAME);
      expiredResponse.cookies.delete(PIN_VERIFIED_COOKIE_NAME);
      return expiredResponse;
    }
  }

  // Update last_activity cookie on response
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
