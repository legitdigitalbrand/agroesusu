import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getBankingProvider } from '@/modules/integrations';
import { ensureProfileRow } from '@/lib/supabase/ensure-profile';
import { PII_ENCRYPTION_KEY } from '@/lib/config/pii-key';

// POST /api/provisioning/identity/validate
// Validates the OTP from Safe Haven identity verification.
// On success, stores the verified BVN/NIN (both plaintext for backward compat
// AND encrypted via pgcrypto), updates kyc_tier, and creates/links a DVA.

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
    // Store in BOTH plaintext (backward compat) AND encrypted columns
    const updateData: Record<string, unknown> = {};
    if (type === 'BVN') {
      updateData.bvn = number;
      // Also encrypt and store in bvn_encrypted via RPC
      if (PII_ENCRYPTION_KEY) {
        const { data: encryptedBvn } = await serviceClient.rpc('encrypt_pii', {
          plaintext: number,
          key: PII_ENCRYPTION_KEY,
        });
        if (encryptedBvn) updateData.bvn_encrypted = encryptedBvn;
      }
    }
    if (type === 'NIN') {
      updateData.nin = number;
      // Also encrypt and store in nin_encrypted via RPC
      if (PII_ENCRYPTION_KEY) {
        const { data: encryptedNin } = await serviceClient.rpc('encrypt_pii', {
          plaintext: number,
          key: PII_ENCRYPTION_KEY,
        });
        if (encryptedNin) updateData.nin_encrypted = encryptedNin;
      }
    }

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
    await ensureProfileRow({
      userId: user.id,
      fullName: customer.full_name,
      email: customer.email,
      phone: customer.phone,
      kycTier: 'tier_1',
    });
    await serviceClient
      .from('profiles')
      .update({ kyc_tier: 'tier_1' })
      .eq('id', user.id);

    // Check if customer already has a Safe Haven sub-account
    const { data: existingAccount } = await serviceClient
      .from('safe_haven_accounts')
      .select('id, account_number, account_name, bank_name, bank_code, created_at')
      .eq('customer_id', customer.id)
      .maybeSingle();

    if (existingAccount) {
      await serviceClient
        .from('wallets')
        .update({
          account_number: existingAccount.account_number,
          account_name: existingAccount.account_name,
          bank_name: existingAccount.bank_name,
          bank_code: existingAccount.bank_code,
          dva_provisioned_at: existingAccount.created_at || new Date().toISOString(),
        })
        .eq('customer_id', customer.id)
        .eq('wallet_type', 'primary');

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
        .update({
          account_number: subAccount.accountNumber,
          account_name: subAccount.accountName,
          bank_name: subAccount.bankName,
          bank_code: subAccount.bankCode,
          dva_provisioned_at: new Date().toISOString(),
        })
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
    // Gate 3: Return generic error message, never leak internal details
    return NextResponse.json(
      { error: 'Identity verification failed. Please try again or contact support.' },
      { status: 500 }
    );
  }
}
