import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server-side Supabase client (for Server Components, Route Handlers, Server Actions).
 * Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
 * to be set in Vercel Environment Variables (or .env.local for dev).
 */
export function createClient() {
  const cookieStore = cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    const missing = [
      !supabaseUrl && 'NEXT_PUBLIC_SUPABASE_URL',
      !supabaseAnonKey && 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ].filter(Boolean).join(' and ');

    throw new Error(
      `Configuration error: ${missing} is not set. ` +
      `Add it in your Vercel dashboard → Settings → Environment Variables, ` +
      `or in your .env.local file for local development.`
    );
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options as Record<string, boolean | number | string | Date> | undefined)
          );
        } catch {}
      },
    },
  });
}
