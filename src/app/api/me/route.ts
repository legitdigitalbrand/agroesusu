import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// GET /api/me — returns the authenticated customer's profile, wallet, and account summaries
// This is the bootstrap endpoint for the customer app — every screen starts here.
//
// NOTE: The system has two tables:
//   - profiles (auto-created on auth signup, has KYC/extended fields)
//   - customers (domain model, has customer_number, status, etc.)
// This endpoint queries both and merges them into a unified response.

export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Check if this is a staff user — staff don't have customer records
    const { data: isStaff } = await supabase.rpc('is_staff');

    if (isStaff) {
      // Return staff profile instead
      const { data: staff } = await supabase
        .from('staff_users')
        .select('id, staff_number, full_name, email, phone, department, employment_status, is_active')
        .eq('auth_id', user.id)
        .maybeSingle();

      if (!staff) return NextResponse.json({ error: 'Staff profile not found' }, { status: 404 });

      // Get role assignments
      const { data: roles } = await supabase
        .from('staff_role_assignments')
        .select('roles(id, name)')
        .eq('staff_id', staff.id)
        .eq('status', 'active')
        .order('assigned_at', { ascending: false });

      const roleNames = ((roles || []) as unknown[]).map((r) => {
        const roleData = (r as { roles: { name: string }[] }).roles;
        return Array.isArray(roleData) ? roleData[0]?.name : (roleData as { name: string })?.name;
      }).filter(Boolean);

      return NextResponse.json({
        type: 'staff',
        profile: staff,
        roles: roleNames,
      });
    }

    // ─── Customer profile ───
    // Query customers table for domain fields
    const { data: customer } = await supabase
      .from('customers')
      .select('id, customer_number, full_name, email, phone, status, bvn, nin, created_at')
      .eq('auth_id', user.id)
      .maybeSingle();

    // If no customer record exists yet, the user needs to be bootstrapped
    if (!customer) {
      return NextResponse.json({ error: 'Customer profile not found', needsBootstrap: true }, { status: 404 });
    }

    // Query profiles table for extended KYC fields
    const { data: profile } = await supabase
      .from('profiles')
      .select('kyc_tier, residential_address, state, lga, occupation, farm_type, primary_produce, nok_name, nok_phone, nok_relationship')
      .eq('id', user.id)
      .maybeSingle();

    const serviceClient = createServiceClient();

    // ─── Wallet ───
    // Wallets table uses cached_* prefix for balance columns
    const { data: wallet } = await serviceClient
      .from('wallets')
      .select('id, status, cached_available_balance, cached_ledger_balance, reserved_balance, wallet_number, account_number')
      .eq('customer_id', customer.id)
      .in('status', ['active', 'created'])
      .limit(1)
      .maybeSingle();

    // Map wallet to the response format the frontend expects
    const walletResponse = wallet ? {
      id: wallet.id,
      status: wallet.status,
      available_balance: wallet.cached_available_balance || 0,
      ledger_balance: wallet.cached_ledger_balance || 0,
      reserved_balance: wallet.reserved_balance || 0,
      pending_balance: 0, // Not tracked as a wallet column; computed from transactions if needed
      currency: 'NGN',
      account_number: wallet.account_number,
      wallet_number: wallet.wallet_number,
    } : null;

    // ─── Savings summary ───
    // Note: savings_accounts table does NOT have current_balance — balance comes from Ledger.
    // We use total_interest_earned (correct column name) and count accounts by status.
    const { data: savingsAccounts } = await serviceClient
      .from('savings_accounts')
      .select('id, status, total_interest_earned')
      .eq('customer_id', customer.id)
      .in('status', ['active', 'matured', 'pending']);
    
    // Fetch actual balances from Ledger for each account
    let totalSavingsBalance = 0;
    if (savingsAccounts && savingsAccounts.length > 0) {
      const { getSavingsBalance } = await import('@/modules/savings');
      for (const acct of savingsAccounts) {
        try {
          const bal = await getSavingsBalance(acct.id);
          totalSavingsBalance += typeof bal === 'number' ? bal : 0;
        } catch {
          // Skip if balance fetch fails
        }
      }
    }
    
    const savingsSummary = {
      count: savingsAccounts?.length || 0,
      total_balance: totalSavingsBalance,
      total_interest: (savingsAccounts || []).reduce((s, a) => s + Number(a.total_interest_earned || 0), 0),
    };

    // ─── Loans summary ───
    const { data: loans } = await serviceClient
      .from('loans')
      .select('id, status, outstanding_balance, next_due_date')
      .eq('customer_id', customer.id)
      .in('status', ['pending', 'approved', 'disbursed', 'active', 'overdue']);
    const loanSummary = {
      count: loans?.length || 0,
      total_outstanding: (loans || []).reduce((s, l) => s + Number((l as { outstanding_balance?: number }).outstanding_balance || 0), 0),
      has_pending: (loans || []).some(l => (l as { status: string }).status === 'pending'),
    };

    // ─── Investment summary ───
    const { data: investments } = await serviceClient
      .from('investment_accounts')
      .select('id, status, current_value')
      .eq('customer_id', customer.id)
      .in('status', ['active', 'matured']);
    const investmentSummary = {
      count: investments?.length || 0,
      total_value: (investments || []).reduce((s, a) => s + Number(a.current_value || 0), 0),
    };

    // ─── Cooperative memberships ───
    const { data: memberships } = await serviceClient
      .from('cooperative_memberships')
      .select('cooperative_id, role, status, joined_at, cooperatives(name)')
      .eq('customer_id', customer.id)
      .eq('status', 'active');

    // ─── Build merged response ───
    const kycTier = (profile as { kyc_tier?: string } | null)?.kyc_tier || 'tier_0';

    // Map KYC tier to a level number
    const kycLevelMap: Record<string, number> = {
      'tier_0': 0,
      'tier_1': 1,
      'tier_2': 2,
      'tier_3': 3,
    };

    return NextResponse.json({
      type: 'customer',
      profile: {
        id: customer.id,
        full_name: customer.full_name,
        email: customer.email,
        phone: customer.phone,
        bvn: customer.bvn,
        nin: customer.nin,
        kyc_level: kycLevelMap[kycTier] || 0,
        kyc_status: customer.status === 'active' ? 'verified' : 'unverified',
        residential_address: (profile as { residential_address?: string } | null)?.residential_address || null,
        state: (profile as { state?: string } | null)?.state || null,
        lga: (profile as { lga?: string } | null)?.lga || null,
        occupation: (profile as { occupation?: string } | null)?.occupation || null,
        farm_type: (profile as { farm_type?: string } | null)?.farm_type || null,
        primary_produce: (profile as { primary_produce?: string } | null)?.primary_produce || null,
        nok_name: (profile as { nok_name?: string } | null)?.nok_name || null,
        nok_phone: (profile as { nok_phone?: string } | null)?.nok_phone || null,
        nok_relationship: (profile as { nok_relationship?: string } | null)?.nok_relationship || null,
        created_at: customer.created_at,
      },
      wallet: walletResponse,
      summaries: {
        savings: savingsSummary,
        loans: loanSummary,
        investments: investmentSummary,
        cooperatives: (memberships || []).map((m) => {
          const coopData = (m as unknown as { cooperatives: { name: string } | { name: string }[] }).cooperatives;
          return {
            cooperative_id: (m as { cooperative_id: string }).cooperative_id,
            cooperative_name: Array.isArray(coopData) ? coopData[0]?.name : (coopData as { name: string })?.name,
            role: (m as { role: string }).role,
            joined_at: (m as { joined_at: string }).joined_at,
          };
        }),
      },
    });
  } catch (error) {
    console.error('[API:me] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
