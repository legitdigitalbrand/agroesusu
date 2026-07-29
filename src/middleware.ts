import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Middleware — refreshes the Supabase session on every request.
// Public routes: marketing pages, login, signup.
// Protected routes: /dashboard, /savings, /loans, /investments, /cooperative, /profile, /admin/*
// Admin routes additionally require staff role (checked client-side in admin layout).

const publicRoutes = [
  '/',
  '/login',
  '/signup',
  '/about',
  '/blog',
  '/careers',
  '/contact',
  '/faqs',
  '/features',
  '/loan-plans',
  '/savings-plans',
];

function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some((r) => pathname === r || pathname.startsWith(r + '/'));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip API routes — they handle their own auth
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Skip Next.js internal routes
  if (pathname.startsWith('/_next') || pathname === '/favicon.ico' || pathname === '/manifest.json') {
    return NextResponse.next();
  }

  const response = NextResponse.next();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase env vars aren't configured, just pass through
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

  // If no session and trying to access a protected route, redirect to login
  if (!session && !isPublicRoute(pathname)) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // If logged in and trying to access login/signup, redirect to dashboard
  if (session && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
