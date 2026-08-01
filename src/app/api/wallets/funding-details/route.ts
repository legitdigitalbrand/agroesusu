import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// GET /api/wallets/funding-details
// Returns the customer's Safe Haven DVA account details for wallet funding.
// Always returns 200 with a provisioned flag — never 400 for expected states.
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: customer } = await supabase
      .from('customers')
      .select('id, status, kyc_level')
      .eq('auth_id', user.id)
      .maybeSingle();

    if (!customer) {
      // Customer record doesn't exist yet — this is an expected state for new users
      // who haven't completed the bootstrap step. Return 200, not 404.
      return NextResponse.json({
        provisioned: false,
        message: 'Your profile is being set up. Please complete your account setup to start funding your wallet.',
      }, { status: 200 });
    }

    const serviceClient = createServiceClient();

    // Check for Safe Haven DVA account
    const { data: safeHavenAccount } = await serviceClient
      .from('safe_haven_accounts')
      .select('account_number, account_name, bank_name, bank_code, status')
      .eq('customer_id', customer.id)
      .maybeSingle();

    if (!safeHavenAccount) {
      // No DVA provisioned — check KYC status to give specific guidance
      const kycLevel = customer.kyc_level || 'tier_0';
      let message = 'You need to complete identity verification to get a funding account.';
      if (kycLevel === 'tier_1' || kycLevel === 'tier_2') {
        message = 'Your identity is verified but your funding account is being created. This usually takes a few moments. Please retry or contact support if it persists.';
      }

      return NextResponse.json({
        provisioned: false,
        message,
        kyc_level: kycLevel,
      }, { status: 200 });
    }

    if (safeHavenAccount.status !== 'active') {
      return NextResponse.json({
        provisioned: false,
        message: `Your funding account is ${safeHavenAccount.status}. Please contact support to resolve this.`,
        account: safeHavenAccount,
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
        safe_haven_account_number: safeHavenAccount.account_number,
        status: 'pending',
        ip_address: ip || null,
        user_agent: userAgent || null,
      });

    return NextResponse.json({
      provisioned: true,
      account: {
        account_name: safeHavenAccount.account_name,
        account_number: safeHavenAccount.account_number,
        bank_name: safeHavenAccount.bank_name,
        bank_code: safeHavenAccount.bank_code,
      },
      wallet_id: wallet.id,
      instructions: 'Transfer money to the account above. Your wallet will be credited automatically once the transfer is confirmed by Safe Haven.',
    });

  } catch (error) {
    console.error('[API:funding-details] Error:', error);
    return NextResponse.json({
      provisioned: false,
      message: 'We could not load your funding details. Please try again or contact support.',
    }, { status: 200 });  // Return 200 so the UI shows a proper state, not a crash
  }
}
