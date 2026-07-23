import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const publicRoutes = [
  '/',
  '/loan-plans',
  '/savings-plans',
  '/features',
  '/about',
  '/careers',
  '/blog',
  '/faqs',
  '/contact',
  '/login',
  '/signup',
  '/onboarding',
];

function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some((r) => pathname === r || pathname.startsWith(r + '/'));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip API routes entirely — they handle their own auth
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  const response = NextResponse.next();

  // ALWAYS run the Supabase session refresh, even on public routes.
  // This ensures session cookies are refreshed/stored on every navigation,
  // which is critical for pages like /onboarding that need a valid session
  // but are public (accessible without auth).
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Can't refresh session without env vars — let the request through.
    // The client-side validation will catch this.
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

  // This call refreshes the session (if expired) and sets updated cookies on the response.
  // Must be awaited so the refreshed cookies are attached before the response is sent.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // For protected routes only — redirect to login if no session.
  // Public routes (including /onboarding) get through with or without a session.
  if (!session && !isPublicRoute(pathname)) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
