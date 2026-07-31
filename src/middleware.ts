import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// ════════════════════════════════════════════════════════════
// Agriqcap — Authentication Middleware
//
//  1. Session refresh on every request
//  2. Redirect unauthenticated → /login (for protected routes)
//  3. Redirect authenticated from /login & /signup → /dashboard
//  4. PIN gate: authenticated users without pin_verified cookie
//     → /set-pin (if no device cookie) or /pin-login (if device cookie)
//  5. Admin-only access for /admin/* (staff check)
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

  // Skip API routes and static files
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  if (
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname === '/favicon.svg' ||
    pathname === '/manifest.json' ||
    pathname.startsWith('/icon')
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

  // ── No session ──
  if (!session) {
    if (isPublicRoute(pathname)) {
      return response;
    }
    // Protected route + no session → /login
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // ── Has session ──

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
    const hasPinVerified = request.cookies.has('agriqcap_pin_verified');
    const hasDeviceCookie = request.cookies.has('agriqcap_device');

    if (!hasPinVerified) {
      if (!hasDeviceCookie) {
        // No device PIN → mandatory setup
        return NextResponse.redirect(new URL('/set-pin', request.url));
      } else {
        // Has device PIN but hasn't verified this session → PIN login
        // (But if they just authenticated via password, they should go to dashboard)
        // The login page handles this: after password auth, we skip the gate
        // by setting the pin_verified cookie server-side.
        // For now, redirect to pin-login.
        return NextResponse.redirect(new URL('/pin-login', request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|favicon.svg|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
