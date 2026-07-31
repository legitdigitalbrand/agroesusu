import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { performNameEnquiry } from '@/modules/withdrawal';

export async function POST(request: NextRequest) {
  const limited = applyRateLimit(request, "/api/wallets/name-enquiry", RATE_LIMITS.WITHDRAW);
  if (limited) return limited;
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { bankCode, accountNumber } = body;

    if (!bankCode || !accountNumber) {
      return NextResponse.json({ error: 'Bank code and account number are required' }, { status: 400 });
    }

    if (accountNumber.length < 10 || accountNumber.length > 10) {
      return NextResponse.json({ error: 'Account number must be 10 digits' }, { status: 400 });
    }

    const result = await performNameEnquiry({ bankCode, accountNumber });

    return NextResponse.json({
      sessionId: result.sessionId,
      accountName: result.accountName,
      accountNumber: result.accountNumber,
      bankCode: result.bankCode,
      bankName: result.bankName,
    });
  } catch (error) {
    console.error('[API] Name enquiry error:', error);
    const message = error instanceof Error ? error.message : 'Name enquiry failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
