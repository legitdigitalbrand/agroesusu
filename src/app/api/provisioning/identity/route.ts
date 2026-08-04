import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getBankingProvider } from '@/modules/integrations';

// POST /api/provisioning/identity
// Initiates BVN or NIN verification with Safe Haven.
// The customer provides their BVN/NIN, we send it to Safe Haven for verification.
// Safe Haven sends an OTP to the phone number registered with the BVN/NIN.
//
// Request body:
//   { type: "BVN" | "NIN", number: string }
//
// Response:
//   { identityId: string, status: "otp_sent" }
//   or { error: string } on failure
export async function POST(request: NextRequest) {
  const limited = applyRateLimit(request, "/api/provisioning/identity", RATE_LIMITS.PROVISIONING);
  if (limited) return limited;
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { type, number } = body;

    if (!type || !['BVN', 'NIN'].includes(type)) {
      return NextResponse.json({ error: 'Type must be BVN or NIN' }, { status: 400 });
    }
    if (!number || number.length !== 11) {
      return NextResponse.json({ error: `${type} must be 11 digits` }, { status: 400 });
    }

    // Get customer record
    const { data: customer } = await supabase
      .from('customers')
      .select('id, full_name, email, phone, bvn, nin')
      .eq('auth_id', user.id)
      .maybeSingle();

    if (!customer) {
      return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });
    }

    // Check if already verified for this type
    if (type === 'BVN' && customer.bvn) {
      return NextResponse.json({ error: 'BVN already verified', alreadyVerified: true }, { status: 409 });
    }
    if (type === 'NIN' && customer.nin) {
      return NextResponse.json({ error: 'NIN already verified', alreadyVerified: true }, { status: 409 });
    }

    // Get the Safe Haven banking provider.
    // In mock mode (SAFE_HAVEN_ENV=mock), this returns a MockBankingProvider that
    // makes NO outbound HTTP calls — all responses are local and deterministic.
    // However, this route still requires Supabase for auth + DB storage.
    // If Supabase is unreachable (DNS failure, paused project), the error is
    // from Supabase, not from the banking provider.
    const provider = getBankingProvider();

    // We need a debit account number for Safe Haven identity verification
    // Use the Safe Haven settlement account or a sandbox account
    const debitAccountNumber = process.env.SAFE_HAVEN_DEBIT_ACCOUNT || '';

    // Initiate identity verification
    const result = await provider.initiateIdentityVerification({
      customerId: customer.id,
      type: type as 'BVN' | 'NIN',
      number,
      debitAccountNumber,
    });

    // Store the identity verification attempt
    const serviceClient = createServiceClient();
    await serviceClient.from('safe_haven_identity_verifications').upsert({
      customer_id: customer.id,
      identity_id: result.identityId,
      type,
      number,
      status: 'otp_sent',
      initiated_at: new Date().toISOString(),
    });

    // In mock mode, include the test OTP in the response so the frontend can display it
    const isMock = !process.env.SAFE_HAVEN_ENV || process.env.SAFE_HAVEN_ENV === 'mock' || !process.env.SAFE_HAVEN_API_KEY || !process.env.SAFE_HAVEN_SECRET_KEY;
    return NextResponse.json({
      identityId: result.identityId,
      status: result.status,
      message: isMock
        ? `Mock OTP sent. Use 123456 to verify your ${type}.`
        : `OTP sent to the phone number registered with your ${type}`,
    });

  } catch (error) {
    console.error('[API:provisioning-identity] Error:', error);
    // Detect network/DNS errors (Supabase unreachable, paused project, wrong URL)
    const errMsg = error instanceof Error ? error.message : String(error);
    const isNetworkError = errMsg.includes('ERR_NAME_NOT_RESOLVED') ||
      errMsg.includes('ERR_INTERNET_DISCONNECTED') ||
      errMsg.includes('fetch failed') ||
      errMsg.includes('ECONNREFUSED') ||
      errMsg.includes('ENOTFOUND') ||
      errMsg.includes('Failed to fetch');
    if (isNetworkError) {
      return NextResponse.json(
        { error: 'Unable to connect to the authentication service. Please check your internet connection and try again.', code: 'network_error' },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Identity verification failed' },
      { status: 500 }
    );
  }
}
