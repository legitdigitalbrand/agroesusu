import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getBankingProvider } from '@/modules/integrations';

// POST /api/provisioning/identity/validate
// Validates the OTP from Safe Haven identity verification.
// On success, stores the verified BVN/NIN and creates a Safe Haven sub-account (DVA).
//
// Request body:
//   { identityId: string, otp: string, type: "BVN" | "NIN", number: string }
//
// Response:
//   { verified: true, accountNumber: string, accountName: string, bankName: string }
//   or { error: string } on failure
export async function POST(request: NextRequest) {
  const limited = applyRateLimit(request, "/api/provisioning/validate", RATE_LIMITS.PROVISIONING);
  if (limited) return limited;
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    // TEMPORARY: log raw body for 400 diagnosis (remove after fix confirmed)
    console.log('[API:provisioning-validate] Raw body:', JSON.stringify(body));
    const { identityId, otp, type, number } = body;

    const missing: string[] = [];
    if (!identityId) missing.push('identityId');
    if (!otp) missing.push('otp');
    if (!type) missing.push('type');
    if (!number) missing.push('number');
    if (missing.length > 0) {
      console.log('[API:provisioning-validate] Missing fields:', missing.join(', '));
      return NextResponse.json({ 
        error: `Missing required fields: ${missing.join(', ')}`,
        missing 
      }, { status: 400 });
    }

    // Get customer
    const { data: customer } = await supabase
      .from('customers')
      .select('id, full_name, email, phone, bvn, nin')
      .eq('auth_id', user.id)
      .maybeSingle();

    if (!customer) {
      return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });
    }

    const provider = getBankingProvider();

    // Validate the identity verification
    const validationResult = await provider.validateIdentityVerification({
      identityId,
      otp,
      type: type as 'BVN' | 'NIN',
      customerId: customer.id,
    });

    if (!validationResult.verified) {
      return NextResponse.json({ error: 'Verification failed. Check your OTP and try again.' }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    // Update customer with verified BVN/NIN
    const updateData: Record<string, unknown> = {};
    if (type === 'BVN') updateData.bvn = number;
    if (type === 'NIN') updateData.nin = number;

    await serviceClient
      .from('customers')
      .update(updateData)
      .eq('id', customer.id);

    // Update identity verification record
    await serviceClient
      .from('safe_haven_identity_verifications')
      .update({ status: 'verified', verified_at: new Date().toISOString() })
      .eq('identity_id', identityId);

    // Check if customer already has a Safe Haven sub-account
    const { data: existingAccount } = await serviceClient
      .from('safe_haven_accounts')
      .select('id, account_number')
      .eq('customer_id', customer.id)
      .maybeSingle();

    if (existingAccount) {
      // Already has a sub-account — update wallet with account number
      await serviceClient
        .from('wallets')
        .update({ account_number: existingAccount.account_number })
        .eq('customer_id', customer.id)
        .eq('wallet_type', 'primary');

      // Update customer status to active
      await serviceClient
        .from('customers')
        .update({ status: 'active' })
        .eq('id', customer.id);

      return NextResponse.json({
        verified: true,
        message: 'Identity verified. Existing Safe Haven account linked.',
      });
    }

    // Create Safe Haven sub-account (DVA)
    try {
      const firstName = (validationResult.firstName || customer.full_name?.split(' ')[0] || '') as string;
      const lastName = (validationResult.lastName || customer.full_name?.split(' ').slice(1).join(' ') || '') as string;

      const subAccount = await provider.createSubAccount({
        identityVerificationId: identityId,
        firstName,
        lastName,
        email: customer.email || undefined,
        phoneNumber: customer.phone || undefined,
        bvn: type === 'BVN' ? number : customer.bvn || undefined,
        customerName: customer.full_name || `${firstName} ${lastName}`,
      });

      // Store the Safe Haven account
      await serviceClient.from('safe_haven_accounts').insert({
        customer_id: customer.id,
        safe_haven_account_id: subAccount.accountId,
        account_number: subAccount.accountNumber,
        account_name: subAccount.accountName,
        bank_name: subAccount.bankName,
        bank_code: subAccount.bankCode,
        status: 'active',
        created_at: new Date().toISOString(),
      });

      // Update wallet with the Safe Haven account number
      await serviceClient
        .from('wallets')
        .update({ account_number: subAccount.accountNumber })
        .eq('customer_id', customer.id)
        .eq('wallet_type', 'primary');

      // Update customer status
      await serviceClient
        .from('customers')
        .update({ status: 'active' })
        .eq('id', customer.id);

      // Update KYC tier
      await serviceClient
        .from('profiles')
        .update({ kyc_tier: 'tier_1' })
        .eq('id', user.id);

      return NextResponse.json({
        verified: true,
        accountNumber: subAccount.accountNumber,
        accountName: subAccount.accountName,
        bankName: subAccount.bankName,
        message: 'Identity verified and Safe Haven account created successfully',
      });

    } catch (subAccountError) {
      // Identity verification succeeded but sub-account creation failed
      // This is retryable — customer can retry later
      console.error('[API:provisioning-validate] Sub-account creation failed:', subAccountError);

      // Still mark identity as verified, just no sub-account yet
      await serviceClient
        .from('profiles')
        .update({ kyc_tier: 'tier_1' })
        .eq('id', user.id);

      return NextResponse.json({
        verified: true,
        accountNumber: null,
        message: 'Identity verified. Safe Haven account creation pending — please retry from the dashboard.',
        retryable: true,
      });
    }

  } catch (error) {
    console.error('[API:provisioning-validate] Error:', error);
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
      { error: error instanceof Error ? error.message : 'Validation failed' },
      { status: 500 }
    );
  }
}
