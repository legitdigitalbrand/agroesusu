import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options as any)
            );
          } catch {
            // Can be ignored when called from a Server Component
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const publicRoutes = ['/auth/login', '/auth/register', '/auth/callback'];
  const isPublicRoute = publicRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  if (!user && !isPublicRoute) {
    // Preserve the full original destination (path + query) so the user lands
    // back where they intended after signing in — critical for deep links
    // like group invites (/groups/[id]?invite=...) and any other direct link.
    const originalDestination = request.nextUrl.pathname + request.nextUrl.search;

    const url = request.nextUrl.clone();

    // Group invite links are almost always for people who don't have an
    // account yet — send them to register instead of login, still preserving
    // the destination so they land back on the group after signing up.
    const isGroupInvite =
      request.nextUrl.pathname.startsWith('/groups/') &&
      request.nextUrl.searchParams.has('invite');

    url.pathname = isGroupInvite ? '/auth/register' : '/auth/login';
    url.search = `?redirect=${encodeURIComponent(originalDestination)}`;

    return NextResponse.redirect(url);
  }

  if (user && isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
