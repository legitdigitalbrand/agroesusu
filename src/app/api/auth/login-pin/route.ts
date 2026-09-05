import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/auth/login-pin
// Returns whether the current user has a login PIN set up — used by the login
// flow to route to PIN verification vs first-time PIN creation.
export async function GET(_request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('has_login_pin')
      .eq('id', user.id)
      .maybeSingle();

    return NextResponse.json({
      has_pin: (profile as { has_login_pin?: boolean } | null)?.has_login_pin === true,
    }, { status: 200 });
  } catch {
    return NextResponse.json({ has_pin: false }, { status: 200 });
  }
}
