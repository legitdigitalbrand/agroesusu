import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico, manifest.json, sw.js, public assets
     * - /api/cron/* (Vercel Cron — no session cookies, must never be redirected)
     * - /api/paystack/webhook (Paystack webhook — no session cookies)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|sw\\.js|api/cron|api/paystack/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|json|ico|webmanifest)$).*)',
  ],
};
