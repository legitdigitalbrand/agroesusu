import { NextResponse } from 'next/server';
import { listActiveProducts } from '@/modules/investments';

export async function GET() {
  try {
    const products = await listActiveProducts();
    return NextResponse.json({ products });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
