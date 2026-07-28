import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { listActiveProducts } from '@/modules/loans';

export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const products = await listActiveProducts();
    return NextResponse.json({ products });
  } catch (error) {
    console.error('[API:loan-products] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
