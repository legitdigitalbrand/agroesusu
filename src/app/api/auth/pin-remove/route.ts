import { NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';

// POST /api/auth/pin-remove
// Removes the PIN for a specific device (e.g., revoking a lost or compromised device)

export async function POST(request: Request) {
  const limited = applyRateLimit(request, "/api/auth/pin-remove", RATE_LIMITS.AUTH);
  if (limited) return limited;
  try {
    const { deviceId } = await request.json();

    if (!deviceId) {
      return NextResponse.json({ error: 'Device ID required' }, { status: 400 });
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { error } = await supabase
      .from('device_pins')
      .delete()
      .eq('user_id', user.id)
      .eq('device_id', deviceId);

    if (error) {
      console.error('[pin-remove] DB error:', error.message);
      return NextResponse.json({ error: 'Failed to remove PIN' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[pin-remove] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
