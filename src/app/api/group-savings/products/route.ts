import { NextResponse } from 'next/server';
import { listGroupSavingsProducts } from '@/modules/cooperative';

export async function GET() {
  try {
    const products = await listGroupSavingsProducts();
    return NextResponse.json({ products });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
