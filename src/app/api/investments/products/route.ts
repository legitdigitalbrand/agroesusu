import { NextResponse } from 'next/server';
import { listActiveProducts } from '@/modules/investments';
import { requireAuth } from '@/lib/auth/api-guard';

export async function GET() {
  try {
    const { user } = await requireAuth();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const products = await listActiveProducts();
    return NextResponse.json({ products });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
