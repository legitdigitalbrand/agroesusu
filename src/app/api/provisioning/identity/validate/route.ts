import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getBankingProvider } from '@/modules/integrations';
import { ensureProfileRow } from '@/lib/supabase/ensure-profile';
import { PII_ENCRYPTION_KEY } from '@/lib/config/pii-key';

// POST /api/provisioning/identity/validate
// Completes Safe Haven identity verification with the customer's OTP.
//
// Safe Haven's OTP is one-time and must be presented at subaccount creation
// for BVN/NIN (the standalone identity/v2/validate consumes it). Therefore:
//  - With an existing active DVA: standalone validate, then link the account.
//  - Without a DVA: the OTP goes straight to subaccount creation, which
//    verifies it — a wrong OTP means the provider rejects creation and
//    nothing is marked verified.
// On success, stores the verified BVN/NIN (plaintext for backward compat AND
// encrypted via pgcrypto), updates kyc_tier, and creates/links the DVA.

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
    const serviceClient = createServiceClient();

    // ─────────────────────────────────────────────────────────────────────
    // PATH SELECTION
    //
    // Safe Haven's OTP is ONE-TIME and, for BVN/NIN identities, must be
    // presented at SUBACCOUNT CREATION (POST /accounts/v2/subaccount
    // verifies the otp itself). The standalone identity/v2/validate call
    // consumes the same OTP — validating first and creating afterwards can
    // NEVER work ("OTP already verified" with otp, bare 400 without).
    //
    // Therefore:
    //  - Customer with an ACTIVE DVA → no creation needed; the standalone
    //    validate path is safe (OTP consumption is harmless there).
    //  - Customer with NO active DVA → the combined path: present the OTP
    //    directly to subaccount creation. A wrong OTP makes the provider
    //    reject creation, so nothing is marked verified on failure.
    // ─────────────────────────────────────────────────────────────────────
    const { data: existingAccount } = await serviceClient
      .from('safe_haven_accounts')
      .select('id, account_number, account_name, bank_name, bank_code, created_at')
      .eq('customer_id', customer.id)
      .eq('status', 'active')
      .maybeSingle();

    // Shared post-verification persistence (identity row, PII columns,
    // customer surface fields, tier_0 → tier_1 promotion).
    const persistVerification = async (verifiedData: Record<string, unknown>) => {
      const updateData: Record<string, unknown> = {};
      if (type === 'BVN') {
        updateData.bvn = number;
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
        if (PII_ENCRYPTION_KEY) {
          const { data: encryptedNin } = await serviceClient.rpc('encrypt_pii', {
            plaintext: number,
            key: PII_ENCRYPTION_KEY,
          });
          if (encryptedNin) updateData.nin_encrypted = encryptedNin;
        }
      }
      await serviceClient.from('customers').update(updateData).eq('id', customer.id);

      await serviceClient
        .from('safe_haven_identity_verifications')
        .update({
          status: 'verified',
          verified_at: new Date().toISOString(),
          verified_data: verifiedData,
        })
        .eq('identity_id', identityId);

      await serviceClient
        .from('customers')
        .update({
          identity_verification_id: identityId,
          identity_verification_status: 'verified',
          identity_type: type,
          identity_verified_at: new Date().toISOString(),
        })
        .eq('id', customer.id);

      const { data: currentProfile } = await serviceClient
        .from('profiles')
        .select('kyc_tier')
        .eq('id', user.id)
        .maybeSingle();
      const currentTier = (currentProfile as { kyc_tier?: string } | null)?.kyc_tier || 'tier_0';
      if (currentTier === 'tier_0') {
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
      }
    };

    if (existingAccount) {
      // ── PATH A: active DVA exists → standalone validate, then link ──
      const validationResult = await provider.validateIdentityVerification({
        identityId,
        otp,
        type: type as 'BVN' | 'NIN',
        customerId: customer.id,
      });
      if (!validationResult.verified) {
        return NextResponse.json({ error: 'Verification failed. Check your OTP and try again.' }, { status: 400 });
      }

      await persistVerification({
        identityValidationId: validationResult.identityValidationId || identityId,
        firstName: validationResult.firstName || null,
        lastName: validationResult.lastName || null,
        middleName: validationResult.middleName || null,
        dateOfBirth: validationResult.dateOfBirth || null,
        gender: validationResult.gender || null,
        type,
        number,
      });

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

    // ── PATH B: no active DVA → combined OTP verification + creation ──
    // The subaccount endpoint verifies the OTP itself. A wrong/already-used
    // OTP makes the provider reject the call — nothing is persisted then.
    const rawPhone = customer.phone || '';
    let phoneNumber = rawPhone.replace(/[^\d+]/g, '');
    if (phoneNumber.startsWith('0')) phoneNumber = '+234' + phoneNumber.slice(1);
    else if (phoneNumber.startsWith('234')) phoneNumber = '+' + phoneNumber;
    else if (!phoneNumber.startsWith('+')) phoneNumber = '+' + phoneNumber;

    if (!phoneNumber || !customer.email) {
      return NextResponse.json({
        error: 'Add a phone number and email to your profile, then restart verification.',
      }, { status: 400 });
    }

    let subAccount;
    try {
      subAccount = await provider.createSubAccount({
        identityType: type,
        identityNumber: number,
        identityId,
        phoneNumber,
        emailAddress: customer.email,
        // Deterministic per customer — idempotent across retries.
        externalReference: `agriqcap-wallet-${customer.id}`,
        otp,
        customerName: customer.full_name || undefined,
      });
    } catch (createError) {
      console.error('[API:provisioning-validate] Combined verification/creation failed:', createError);
      // The provider rejected the OTP or the request — verification did NOT
      // succeed. Never persist a verified state on a failed provider call.
      return NextResponse.json(
        { error: 'Verification failed. Check your OTP and try again.' },
        { status: 400 }
      );
    }

    // Provider accepted the OTP and created the account — persist everything.
    await persistVerification({
      identityValidationId: identityId,
      firstName: subAccount.firstName || null,
      lastName: subAccount.lastName || null,
      type,
      number,
      accountNumber: subAccount.accountNumber,
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
