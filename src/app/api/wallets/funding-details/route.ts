import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { ensureCustomerDva } from '@/modules/wallet/dva';

// GET /api/wallets/funding-details
// Returns the customer's Safe Haven DVA account details for wallet funding.
// Always returns 200 with a provisioned flag — never 400 for expected states.
const isSandboxMode = () => {
  const env = process.env.SAFE_HAVEN_ENV || 'mock';
  const hasCredentials = process.env.SAFE_HAVEN_API_KEY && process.env.SAFE_HAVEN_SECRET_KEY;
  return env === 'mock' || !hasCredentials;
};
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: customer } = await supabase
      .from('customers')
      .select('id, status, full_name, email, phone, bvn, nin')
      .eq('auth_id', user.id)
      .maybeSingle();

    if (!customer) {
      // Customer record doesn't exist yet — this is an expected state for new users
      // who haven't completed the bootstrap step. Return 200, not 404.
      return NextResponse.json({
        provisioned: false,
        sandbox_mode: isSandboxMode(),
        message: 'Your profile is being set up. Please complete your account setup to start funding your wallet.',
      }, { status: 200 });
    }

    const serviceClient = createServiceClient();

    // Read KYC tier from profiles table (single source of truth, same as /api/me)
    const { data: profile } = await supabase
      .from('profiles')
      .select('kyc_tier')
      .eq('id', user.id)
      .maybeSingle();
    const kycTier = (profile as { kyc_tier?: string } | null)?.kyc_tier || 'tier_0';

    // Check for an ACTIVE Safe Haven DVA account (inactive/invalid rows are
    // never displayed as fundable banking details)
    const { data: safeHavenAccount } = await serviceClient
      .from('safe_haven_accounts')
      .select('account_number, account_name, bank_name, bank_code, status')
      .eq('customer_id', customer.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!safeHavenAccount) {
      // No ACTIVE DVA. For identity-verified customers, provision one now —
      // idempotently (existing active DVA is reused; races resolve via the
      // UNIQUE(customer_id) constraint; provider failures fail-safe).
      if (kycTier === 'tier_1' || kycTier === 'tier_2' || kycTier === 'tier_3') {
        const provisioned = await ensureCustomerDva({
          id: customer.id,
          full_name: customer.full_name,
          email: customer.email,
          phone: customer.phone,
          bvn: customer.bvn,
          nin: customer.nin,
        });

        if (provisioned.status === 'verification_required') {
          // Accurate state: real provider-validated identity is required
          // before a funding account can exist. Drives the contextual
          // verification CTA on the wallet page.
          return NextResponse.json({
            provisioned: false,
            sandbox_mode: isSandboxMode(),
            verification_required: true,
            message: provisioned.message,
            kyc_level: kycTier,
          }, { status: 200 });
        }

        if (provisioned.status === 'error') {
          // Accurate failure state — never fabricated account details
          return NextResponse.json({
            provisioned: false,
            sandbox_mode: isSandboxMode(),
            message: provisioned.message,
            kyc_level: kycTier,
          }, { status: 200 });
        }
      } else {
        // Unverified — accurate setup state with the existing verification action
        return NextResponse.json({
          provisioned: false,
          sandbox_mode: isSandboxMode(),
          message: 'You need to complete identity verification to get a funding account.',
          kyc_level: kycTier,
        }, { status: 200 });
      }
    }

    // (Re-)read the authoritative ACTIVE DVA — either the one found above or
    // the one just provisioned.
    const { data: activeDva } = await serviceClient
      .from('safe_haven_accounts')
      .select('account_number, account_name, bank_name, bank_code, status')
      .eq('customer_id', customer.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!activeDva) {
      // Provisioning did not yield an active record — accurate state, no fake data
      return NextResponse.json({
        provisioned: false,
        sandbox_mode: isSandboxMode(),
        message: 'Your funding account could not be created. Please retry or contact support.',
        kyc_level: kycTier,
      }, { status: 200 });
    }

    // Check for active wallet
    const { data: wallet } = await serviceClient
      .from('wallets')
      .select('id, status')
      .eq('customer_id', customer.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (!wallet) {
      return NextResponse.json({
        provisioned: false,
        sandbox_mode: isSandboxMode(),
        message: 'Your wallet is not active yet. Please contact support.',
      }, { status: 200 });
    }

    // Create incoming deposit request to track intent
    const ip = request.headers.get('x-forwarded-for') || '';
    const userAgent = request.headers.get('user-agent') || '';

    await serviceClient
      .from('incoming_deposit_requests')
      .insert({
        customer_id: customer.id,
        wallet_id: wallet.id,
        safe_haven_account_number: activeDva.account_number,
        status: 'pending',
        ip_address: ip || null,
        user_agent: userAgent || null,
      });

    return NextResponse.json({
      provisioned: true,
        sandbox_mode: isSandboxMode(),
      account: {
        account_name: activeDva.account_name,
        account_number: activeDva.account_number,
        bank_name: activeDva.bank_name,
        bank_code: activeDva.bank_code,
      },
      wallet_id: wallet.id,
      instructions: 'Transfer money to the account above. Your wallet will be credited automatically once the transfer is confirmed by Safe Haven.',
    });

  } catch (error) {
    console.error('[API:funding-details] Error:', error);
    return NextResponse.json({
      provisioned: false,
        sandbox_mode: isSandboxMode(),
      message: 'We could not load your funding details. Please try again or contact support.',
    }, { status: 200 });  // Return 200 so the UI shows a proper state, not a crash
  }
}
