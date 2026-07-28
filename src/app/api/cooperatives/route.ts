import { NextResponse } from 'next/server';
import { listCooperatives } from '@/modules/cooperative';

export async function GET() {
  try {
    const cooperatives = await listCooperatives();
    return NextResponse.json({ cooperatives });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
