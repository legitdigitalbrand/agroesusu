import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const filterRead = url.searchParams.get('read'); // 'true' | 'false' | null
    const filterType = url.searchParams.get('type');

    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (filterRead === 'true') query = query.eq('read', true);
    if (filterRead === 'false') query = query.eq('read', false);
    if (filterType) query = query.eq('type', filterType);

    const { data: notifications, count } = await query;

    return NextResponse.json({
      notifications: notifications || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[API] Notifications list error:', error);
    return NextResponse.json({ error: 'Failed to load notifications' }, { status: 500 });
  }
}
