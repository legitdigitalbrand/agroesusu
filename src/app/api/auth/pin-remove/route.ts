import { NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';

// POST /api/auth/pin-remove
// Removes the PIN for a specific device (e.g., revoking a lost or compromised device)

export async function POST(request: Request) {
  const limited = applyRateLimit(request, '/api/auth/pin-remove', RATE_LIMITS.AUTH);
  if (limited) return limited;

  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body || !body.deviceId) {
      return NextResponse.json({ error: 'Device ID required' }, { status: 400 });
    }

    const { deviceId } = body;

    const { error } = await supabase
      .from('device_pins')
      .delete()
      .eq('user_id', user.id)
      .eq('device_id', deviceId);

    if (error) {
      console.error('[pin-remove] DB error:', error.message, error.code);
      if (error.code === '42501') {
        return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
      }
      return NextResponse.json({ error: 'Failed to remove PIN' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[pin-remove] Unexpected error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
