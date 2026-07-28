import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createGroupSavingsAccount } from '@/modules/cooperative';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { product_id, name, cooperative_id, description } = body;
    if (!product_id || !name) return NextResponse.json({ error: 'product_id and name are required' }, { status: 400 });

    const account = await createGroupSavingsAccount(product_id, name, cooperative_id, description);
    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 400 });
  }
}
