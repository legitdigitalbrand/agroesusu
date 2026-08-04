import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST /api/auth/post-login
// Called after successful email+password authentication.
// Returns user session status — no PIN logic remains.

export async function POST() {
  try {
    const supabase = createClient();
    let session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'] = null;
    try {
      const result = await supabase.auth.getSession();
      session = result.data.session;
    } catch {
      return NextResponse.json({
        error: 'Unable to connect to the authentication service. Please try again.',
        code: 'network_error'
      }, { status: 503 });
    }

    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: session.user.id,
        email: session.user.email,
        emailConfirmed: !!session.user.email_confirmed_at,
      },
    });
  } catch (err) {
    console.error('[post-login] Error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
