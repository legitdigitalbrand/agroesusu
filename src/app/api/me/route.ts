import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// GET /api/me — returns the authenticated customer's profile, wallet, and account summaries
// This is the bootstrap endpoint for the customer app — every screen starts here.
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

    // Customer profile
    const { data: customer } = await supabase
      .from('customers')
      .select('id, full_name, email, phone, bvn, nin, kyc_level, kyc_status, residential_address, state, lga, occupation, farm_type, primary_produce, nok_name, nok_phone, nok_relationship, created_at')
      .eq('auth_id', user.id)
      .maybeSingle();

    if (!customer) return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });

    const serviceClient = createServiceClient();

    // Get wallet
    const { data: wallet } = await serviceClient
      .from('wallets')
      .select('id, status, available_balance, ledger_balance, reserved_balance, pending_balance, currency, account_number')
      .eq('customer_id', customer.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    // Get savings accounts summary
    const { data: savingsAccounts } = await serviceClient
      .from('savings_accounts')
      .select('id, status, current_balance, interest_earned')
      .eq('customer_id', customer.id)
      .in('status', ['active', 'locked']);
    const savingsSummary = {
      count: savingsAccounts?.length || 0,
      total_balance: (savingsAccounts || []).reduce((s, a) => s + Number(a.current_balance || 0), 0),
      total_interest: (savingsAccounts || []).reduce((s, a) => s + Number(a.interest_earned || 0), 0),
    };

    // Get loans summary
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

    // Get investment portfolio summary
    const { data: investments } = await serviceClient
      .from('investment_accounts')
      .select('id, status, current_value')
      .eq('customer_id', customer.id)
      .in('status', ['active', 'matured']);
    const investmentSummary = {
      count: investments?.length || 0,
      total_value: (investments || []).reduce((s, a) => s + Number(a.current_value || 0), 0),
    };

    // Get cooperative memberships
    const { data: memberships } = await serviceClient
      .from('cooperative_memberships')
      .select('cooperative_id, role, status, joined_at, cooperatives(name)')
      .eq('customer_id', customer.id)
      .eq('status', 'active');

    return NextResponse.json({
      type: 'customer',
      profile: customer,
      wallet: wallet || null,
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
