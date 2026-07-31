import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(_request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { error, count } = await supabase
      .from('notifications')
      .update({ read: true, delivery_status: 'read' })
      .eq('user_id', user.id)
      .eq('read', false);

    if (error) {
      return NextResponse.json({ error: 'Failed to mark all as read' }, { status: 500 });
    }

    return NextResponse.json({ success: true, marked: count || 0 });
  } catch (error) {
    console.error('[API] Mark all read error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
