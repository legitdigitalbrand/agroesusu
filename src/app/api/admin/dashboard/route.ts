import { NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getOperationalDashboard } from '@/modules/reporting';
import { getAdminOverview } from '@/modules/administration';

export async function GET(request: Request) {
  const limited = applyRateLimit(request, "/api/admin/dashboard", RATE_LIMITS.ADMIN);
  if (limited) return limited;
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify staff access
    const { data: staff } = await supabase
      .from('staff_users')
      .select('id')
      .eq('auth_id', user.id)
      .eq('employment_status', 'active')
      .maybeSingle();
    if (!staff) return NextResponse.json({ error: 'Staff access required' }, { status: 403 });

    const [dashboard, admin] = await Promise.all([
      getOperationalDashboard(),
      getAdminOverview(),
    ]);

    // Also fetch total customers and active groups
    const serviceClient = createServiceClient();
    const { count: totalCustomers } = await serviceClient
      .from('customers')
      .select('*', { count: 'exact', head: true });

    const { count: activeGroups } = await serviceClient
      .from('group_savings_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // Map API response to the shape the frontend expects
    return NextResponse.json({
      operational: {
        total_wallets: dashboard.portfolio.total_wallet_balances || 0,
        total_wallet_balance: dashboard.portfolio.total_wallet_balances || 0,
        total_savings_balance: dashboard.portfolio.total_savings || 0,
        total_loans_outstanding: dashboard.portfolio.total_loans_outstanding || 0,
        active_loans: dashboard.loans.total_active_loans || 0,
        pending_loans: 0,
        total_investments_value: dashboard.portfolio.total_investments || 0,
        active_investment_accounts: dashboard.investments.total_active_accounts || 0,
        total_group_savings: dashboard.portfolio.total_group_savings || 0,
        total_customers: totalCustomers || 0,
        active_groups: activeGroups || 0,
      },
      overview: admin,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
