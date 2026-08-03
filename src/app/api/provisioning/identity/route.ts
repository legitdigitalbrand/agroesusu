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

    // Get the Safe Haven banking provider
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

    return NextResponse.json({
      identityId: result.identityId,
      status: result.status,
      message: `OTP sent to the phone number registered with your ${type}`,
    });

  } catch (error) {
    console.error('[API:provisioning-identity] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Identity verification failed' },
      { status: 500 }
    );
  }
}
