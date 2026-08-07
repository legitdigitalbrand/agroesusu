import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function GET(request: NextRequest) {
  const limited = applyRateLimit(request, '/api/admin/activity', RATE_LIMITS.ADMIN);
  if (limited) return limited;

  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: staff } = await supabase
      .from('staff_users')
      .select('id')
      .eq('auth_id', user.id)
      .eq('employment_status', 'active')
      .maybeSingle();
    if (!staff) return NextResponse.json({ error: 'Staff access required' }, { status: 403 });

    const serviceClient = createServiceClient();

    // Fetch recent activities from multiple sources in parallel
    const [customers, loans, txs, deposits, adminActions] = await Promise.all([
      serviceClient.from('customers')
        .select('id, full_name, customer_number, created_at')
        .order('created_at', { ascending: false })
        .limit(5),
      serviceClient.from('loans')
        .select('id, principal_amount, status, created_at')
        .order('created_at', { ascending: false })
        .limit(5),
      serviceClient.from('financial_transactions')
        .select('id, transaction_reference, transaction_type, amount, status, initiated_at')
        .order('initiated_at', { ascending: false })
        .limit(5),
      serviceClient.from('financial_transactions')
        .select('id, transaction_reference, amount, initiated_at')
        .eq('transaction_type', 'wallet_deposit')
        .order('initiated_at', { ascending: false })
        .limit(5),
      serviceClient.from('admin_action_log')
        .select('id, action, action_category, entity_type, entity_id, created_at, admin_user_id')
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    const activities: Array<{
      type: string;
      description: string;
      amount: number | null;
      entity_id: string;
      timestamp: string;
    }> = [];

    // Customer registrations
    (customers.data || []).forEach(c => {
      activities.push({
        type: 'signup',
        description: `New customer: ${c.full_name} (${c.customer_number})`,
        amount: null,
        entity_id: c.id,
        timestamp: c.created_at,
      });
    });

    // Loan applications
    (loans.data || []).forEach(l => {
      activities.push({
        type: 'loan',
        description: `Loan application: ${l.status}`,
        amount: Number(l.principal_amount) || null,
        entity_id: l.id,
        timestamp: l.created_at,
      });
    });

    // Transactions
    (txs.data || []).forEach(t => {
      activities.push({
        type: 'transaction',
        description: `${t.transaction_type}: ${t.status}`,
        amount: Number(t.amount) || null,
        entity_id: t.id,
        timestamp: t.initiated_at,
      });
    });

    // Wallet deposits
    (deposits.data || []).forEach(d => {
      activities.push({
        type: 'funding',
        description: `Wallet funded: ${d.transaction_reference}`,
        amount: Number(d.amount) || null,
        entity_id: d.id,
        timestamp: d.initiated_at,
      });
    });

    // Admin actions
    (adminActions.data || []).forEach(a => {
      activities.push({
        type: 'admin',
        description: `Admin: ${a.action} (${a.action_category})`,
        amount: null,
        entity_id: a.entity_id || a.id,
        timestamp: a.created_at,
      });
    });

    // Sort by timestamp desc and limit 20
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const sorted = activities.slice(0, 20);

    return NextResponse.json({ activity: sorted });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
