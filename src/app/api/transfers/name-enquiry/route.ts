import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { getBankingProvider } from '@/modules/integrations';

// POST /api/transfers/name-enquiry
// Verifies a beneficiary's account name before transfer.
// Body: { bankCode: string, accountNumber: string }
export async function POST(request: NextRequest) {
  const limited = applyRateLimit(request, "/api/transfers/name-enquiry", RATE_LIMITS.TRANSFER);
  if (limited) return limited;
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { bankCode, accountNumber } = body;

    if (!bankCode || !accountNumber) {
      return NextResponse.json(
        { error: 'bankCode and accountNumber are required' },
        { status: 400 }
      );
    }

    if (accountNumber.length !== 10 || !/^\d{10}$/.test(accountNumber)) {
      return NextResponse.json(
        { error: 'Account number must be exactly 10 digits' },
        { status: 400 }
      );
    }

    const provider = getBankingProvider();
    const result = await provider.nameEnquiry({ accountNumber, bankCode });

    return NextResponse.json({
      sessionId: result.sessionId,
      accountName: result.accountName,
      accountNumber: result.accountNumber,
      bankCode: result.bankCode,
      bankName: result.bankName,
    });

  } catch (error) {
    console.error('[API:name-enquiry] Error:', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    const isNetworkError = errMsg.includes('ERR_NAME_NOT_RESOLVED') ||
      errMsg.includes('fetch failed') ||
      errMsg.includes('ECONNREFUSED') ||
      errMsg.includes('ENOTFOUND');
    if (isNetworkError) {
      return NextResponse.json(
        { error: 'Unable to connect to banking service. Check your connection and try again.', code: 'network_error' },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Name enquiry failed' },
      { status: 500 }
    );
  }
}
