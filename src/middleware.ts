import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// ════════════════════════════════════════════════════════════
// Agriqcap — Authentication Middleware
//
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

const adminRoutes = ['/admin'];

function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some((r) => pathname === r || pathname.startsWith(r + '/'));
}

function isAdminRoute(pathname: string): boolean {
  return adminRoutes.some((r) => pathname === r || pathname.startsWith(r + '/'));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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

  if (!session) {
    if (isPublicRoute(pathname)) {
      return response;
    }
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect to dashboard if they visit login/signup while logged in
  if (pathname === '/login' || pathname === '/signup') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Admin route protection
  if (isAdminRoute(pathname)) {
    try {
      const { data: isStaff } = await supabase.rpc('is_staff');
      if (!isStaff) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    } catch {
      // Let client-side handle it
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|favicon.svg|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
