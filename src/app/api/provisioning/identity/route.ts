import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getBankingProvider } from '@/modules/integrations';

// POST /api/provisioning/identity
// Initiates BVN or NIN verification with Safe Haven.
//
// IMPORTANT: If the user's BVN/NIN is already in the customers table but their
// kyc_tier is still tier_0 (a known bug from the validate route's old Path 1),
// we AUTO-REPAIR: set kyc_tier to tier_1 and return a success response telling
// the frontend to skip ahead. This prevents the user from being permanently
// stuck seeing the BVN form with no way forward.

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

    const { data: customer } = await supabase
      .from('customers')
      .select('id, full_name, email, phone, bvn, nin')
      .eq('auth_id', user.id)
      .maybeSingle();

    if (!customer) {
      return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });
    }

    // Check if already verified
    const alreadyHasBvn = type === 'BVN' && customer.bvn;
    const alreadyHasNin = type === 'NIN' && customer.nin;

    if (alreadyHasBvn || alreadyHasNin) {
      // BVN/NIN is already in the customers table. Check if kyc_tier is also set.
      const { data: profile } = await supabase
        .from('profiles')
        .select('kyc_tier')
        .eq('id', user.id)
        .maybeSingle();

      const kycTier = (profile as { kyc_tier?: string } | null)?.kyc_tier || 'tier_0';

      if (kycTier === 'tier_0') {
        // ── AUTO-REPAIR ──
        // The BVN/NIN was verified previously but kyc_tier didn't persist
        // (due to the old validate route Path 1 bug). Repair it now.
        const serviceClient = createServiceClient();
        await serviceClient
          .from('profiles')
          .update({ kyc_tier: 'tier_1' })
          .eq('id', user.id);

        // Check if a Safe Haven account (DVA) exists
        const { data: existingAccount } = await serviceClient
          .from('safe_haven_accounts')
          .select('id, account_number, account_name, bank_name, bank_code')
          .eq('customer_id', customer.id)
          .maybeSingle();

        if (existingAccount) {
          // DVA exists — just link the wallet
          await serviceClient
            .from('wallets')
            .update({ account_number: existingAccount.account_number })
            .eq('customer_id', customer.id)
            .eq('wallet_type', 'primary');

          await serviceClient
            .from('customers')
            .update({ status: 'active' })
            .eq('id', customer.id);
        } else {
          // No DVA — create one using the banking provider (mock mode creates
          // a mock account; sandbox mode calls Safe Haven API)
          const provider = getBankingProvider();
          try {
            const firstName = customer.full_name?.split(' ')[0] || '';
            const lastName = customer.full_name?.split(' ').slice(1).join(' ') || '';
            const subAccount = await provider.createSubAccount({
              identityVerificationId: 'repair-' + Date.now(),
              firstName,
              lastName,
              email: customer.email || undefined,
              phoneNumber: customer.phone || undefined,
              bvn: customer.bvn || undefined,
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
          } catch (dvaError) {
            console.error('[API:provisioning-identity] Auto-repair DVA creation failed:', dvaError);
            // DVA creation failed but kyc_tier was still repaired — not fatal
          }
        }

        return NextResponse.json({
          identityId: null,
          status: 'already_verified_repaired',
          message: 'Your identity was already verified. Your account has been updated. Redirecting to your dashboard.',
          repaired: true,
        });
      }

      // Genuinely already verified at tier_1+ — nothing to do
      return NextResponse.json({
        error: `${type} already verified`,
        alreadyVerified: true,
      }, { status: 409 });
    }

    // Get the Safe Haven banking provider
    const provider = getBankingProvider();
    const debitAccountNumber = process.env.SAFE_HAVEN_DEBIT_ACCOUNT || '';

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
