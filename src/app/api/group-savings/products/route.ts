import { NextResponse } from 'next/server';
import { listGroupSavingsProducts } from '@/modules/cooperative';
import { requireAuth } from '@/lib/auth/api-guard';

export async function GET() {
  try {
    const { user } = await requireAuth();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const products = await listGroupSavingsProducts();
    return NextResponse.json({ products });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
