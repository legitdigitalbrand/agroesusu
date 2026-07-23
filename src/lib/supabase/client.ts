import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser-side Supabase client.
 * Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
 * to be set in Vercel Environment Variables (or .env.local for dev).
 */
export function createClient() {
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
      `or in your .env.local file for local development. ` +
      `See https://supabase.com/dashboard/project/_/settings/api for the values.`
    );
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
