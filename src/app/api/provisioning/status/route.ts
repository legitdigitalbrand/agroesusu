import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// GET /api/provisioning/status
// Returns the Safe Haven provisioning status for the authenticated customer.
export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceClient = createServiceClient();

    // Get customer
    const { data: customer } = await supabase
      .from('customers')
      .select('id, bvn, nin, status')
      .eq('auth_id', user.id)
      .maybeSingle();

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Check for Safe Haven account
    const { data: safeHavenAccount } = await serviceClient
      .from('safe_haven_accounts')
      .select('account_number, account_name, bank_name, status')
      .eq('customer_id', customer.id)
      .maybeSingle();

    // Check for pending identity verifications
    const { data: pendingVerifications } = await serviceClient
      .from('safe_haven_identity_verifications')
      .select('identity_id, type, status, initiated_at')
      .eq('customer_id', customer.id)
      .order('initiated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      hasSafeHavenAccount: !!safeHavenAccount,
      account: safeHavenAccount || null,
      hasBVN: !!customer.bvn,
      hasNIN: !!customer.nin,
      pendingVerification: pendingVerifications?.status === 'otp_sent' ? pendingVerifications : null,
      customerStatus: customer.status,
    });

  } catch (error) {
    console.error('[API:provisioning-status] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
