import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Minimal middleware — refreshes the Supabase session on every request.
// Public/protected route lists will be populated as the app is built.
const publicRoutes = ['/', '/login', '/signup'];

function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some((r) => pathname === r || pathname.startsWith(r + '/'));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api')) {
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
