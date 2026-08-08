import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getBankingProvider } from '@/modules/integrations';
import { ensureProfileRow } from '@/lib/supabase/ensure-profile';

// POST /api/provisioning/identity/validate
// Validates the OTP from Safe Haven identity verification.
// On success, stores the verified BVN/NIN, updates kyc_tier, and creates
// (or links) a Safe Haven sub-account (DVA).
//
// BUG FIX: The previous "existing account" path (Path 1) updated the wallet
// and customer.status but NEVER updated profiles.kyc_tier. This caused users
// who already had a safe_haven_accounts record to stay at tier_0 forever.
// Now ALL paths update kyc_tier to tier_1.

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
    const { identityId, otp, type, number } = body;

    const missing: string[] = [];
    if (!identityId) missing.push('identityId');
    if (!otp) missing.push('otp');
    if (!type) missing.push('type');
    if (!number) missing.push('number');
    if (missing.length > 0) {
      return NextResponse.json({ 
        error: `Missing required fields: ${missing.join(', ')}`,
        missing 
      }, { status: 400 });
    }

    const { data: customer } = await supabase
      .from('customers')
      .select('id, full_name, email, phone, bvn, nin')
      .eq('auth_id', user.id)
      .maybeSingle();

    if (!customer) {
      return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });
    }

    const provider = getBankingProvider();

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

    // ── ALWAYS set kyc_tier to tier_1 on successful verification ──
    // Ensure the profiles row exists first (trigger may not have created it
    // if the user signed up after migration 00002 dropped the trigger).
    await ensureProfileRow({
      userId: user.id,
      fullName: customer.full_name,
      email: customer.email,
      phone: customer.phone,
      kycTier: 'tier_1',
    });
    // Now safe to update — row is guaranteed to exist
    await serviceClient
      .from('profiles')
      .update({ kyc_tier: 'tier_1' })
      .eq('id', user.id);

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

      await serviceClient
        .from('wallets')
        .update({ account_number: subAccount.accountNumber })
        .eq('customer_id', customer.id)
        .eq('wallet_type', 'primary');

      await serviceClient
        .from('customers')
        .update({ status: 'active' })
        .eq('id', customer.id);

      return NextResponse.json({
        verified: true,
        accountNumber: subAccount.accountNumber,
        accountName: subAccount.accountName,
        bankName: subAccount.bankName,
        message: 'Identity verified and Safe Haven account created successfully',
      });

    } catch (subAccountError) {
      // Identity verification succeeded but sub-account creation failed
      console.error('[API:provisioning-validate] Sub-account creation failed:', subAccountError);

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
