import { NextResponse } from 'next/server';
import { getBankingProvider } from '@/modules/integrations/safe-haven';

// GET /api/banks — list all Nigerian banks from Safe Haven
// Used for transfer/withdrawal beneficiary bank selection
export async function GET() {
  try {
    const provider = getBankingProvider();
    const banks = await provider.listBanks();
    
    return NextResponse.json({
      banks: banks.map(b => ({
        name: b.bankName,
        code: b.bankCode,
      })),
      count: banks.length,
    });
  } catch (error) {
    console.error('[API:banks] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to load bank list. Please try again.',
      banks: [],
    }, { status: 500 });
  }
}
