import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/auth/pin-status
// Returns whether the current user has any device PINs.

export async function GET() {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ authenticated: false });
    }

    const userId = session.user.id;

    const { count } = await supabase
      .from('device_pins')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    return NextResponse.json({
      authenticated: true,
      hasAnyPin: (count || 0) > 0,
    });
  } catch (err) {
    console.error('[pin-status] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
