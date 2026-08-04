import { NextResponse } from 'next/server';
import { getBankingProvider } from '@/modules/integrations';

// GET /api/banks — list all supported banks
export async function GET() {
  try {
    const provider = getBankingProvider();
    const banks = await provider.listBanks();
    return NextResponse.json({ banks });
  } catch (error) {
    console.error('[API:banks] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list banks' },
      { status: 500 }
    );
  }
}
