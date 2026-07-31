import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// GET /api/wallets/funding-details
// Returns the customer's Safe Haven DVA account details for wallet funding.
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
      return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });
    }

    const serviceClient = createServiceClient();
    const { data: safeHavenAccount } = await serviceClient
      .from('safe_haven_accounts')
      .select('account_number, account_name, bank_name, bank_code, status')
      .eq('customer_id', customer.id)
      .maybeSingle();

    if (!safeHavenAccount) {
      return NextResponse.json({
        provisioned: false,
        message: 'No Safe Haven account provisioned. Complete identity verification first.',
      }, { status: 200 });
    }

    if (safeHavenAccount.status !== 'active') {
      return NextResponse.json({
        provisioned: true,
        account: safeHavenAccount,
        message: `Account is ${safeHavenAccount.status}. Please contact support.`,
      }, { status: 200 });
    }

    const { data: wallet } = await serviceClient
      .from('wallets')
      .select('id, status')
      .eq('customer_id', customer.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (!wallet) {
      return NextResponse.json({ error: 'No active wallet found' }, { status: 400 });
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
