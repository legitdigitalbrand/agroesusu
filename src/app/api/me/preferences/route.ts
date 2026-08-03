import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/me/preferences — returns user UI preferences (stored in auth user_metadata)
// PATCH /api/me/preferences — updates user UI preferences

export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Read preferences from user_metadata
    const metadata = user.user_metadata || {};
    return NextResponse.json({
      dismiss_onboarding: !!metadata.dismiss_onboarding,
      ...metadata,
    });
  } catch (error) {
    console.error('[preferences GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, {status: 401 });
    }

    const body = await request.json();

    // Only allow specific preference keys
    const allowedKeys = ['dismiss_onboarding', 'coop_waitlist'];
    const updates: Record<string, unknown> = {};
    for (const key of allowedKeys) {
      if (key in body) {
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid preference keys provided' }, { status: 400 });
    }

    // Merge with existing user_metadata
    const existingMetadata = user.user_metadata || {};
    const newMetadata = { ...existingMetadata, ...updates };

    const { error: updateError } = await supabase.auth.updateUser({
      data: newMetadata,
    });

    if (updateError) {
      console.error('[preferences PATCH] supabase error:', updateError);
      return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
    }

    return NextResponse.json({ success: true, ...newMetadata });
  } catch (error) {
    console.error('[preferences PATCH]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
