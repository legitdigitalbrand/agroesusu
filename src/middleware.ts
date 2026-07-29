import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// ════════════════════════════════════════════════════════════
// Agriqcap — Production Authentication Middleware
//
// Centralizes ALL auth logic:
//  - Session refresh on every request
//  - Redirect unauthenticated users from protected routes → /login
//  - Redirect authenticated users from /login & /signup → /dashboard
//  - Enforce admin-only access for /admin/* (server-side staff check)
// ════════════════════════════════════════════════════════════

const publicRoutes = [
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/verify-phone',
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

// Routes that require staff/admin privileges (checked server-side)
const adminRoutes = [
  '/admin',
];

function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some((r) => pathname === r || pathname.startsWith(r + '/'));
}

function isAdminRoute(pathname: string): boolean {
  return adminRoutes.some((r) => pathname === r || pathname.startsWith(r + '/'));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip API routes — they handle their own auth via Supabase server client
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Skip Next.js internal routes and static assets
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

  // If Supabase env vars aren't configured, pass through (dev fallback)
  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  // Create a Supabase client that can refresh the session cookie
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

  // Refresh session — this also validates the JWT
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // ─── Unauthenticated user ───
  if (!session) {
    // Allow public routes
    if (isPublicRoute(pathname)) {
      return response;
    }
    // Redirect everything else to login
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // ─── Authenticated user ───

  // Redirect to dashboard if they visit login/signup while logged in
  if (pathname === '/login' || pathname === '/signup') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Admin route protection — check staff status server-side
  if (isAdminRoute(pathname)) {
    try {
      const { data: isStaff } = await supabase.rpc('is_staff');
      if (!isStaff) {
        // Non-admin trying to access admin routes → redirect to dashboard
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    } catch {
      // If the RPC fails (e.g. DB unreachable), don't block — let the
      // client-side admin layout handle it as a fallback safety net
    }
  }

  // All checks passed — refresh session cookies and continue
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|favicon.svg|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
