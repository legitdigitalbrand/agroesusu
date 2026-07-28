import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getComplianceDepositsReport, getComplianceLoansReport,
  getReconciliationReport, getKYCStatusReport,
} from '@/modules/reporting';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: staff } = await supabase
      .from('staff_users')
      .select('id')
      .eq('auth_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (!staff) return NextResponse.json({ error: 'Staff access required' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type') || 'all';

    const reports: Record<string, unknown> = {};

    if (reportType === 'all' || reportType === 'deposits') {
      reports.deposits = await getComplianceDepositsReport();
    }
    if (reportType === 'all' || reportType === 'loans') {
      reports.loans_outstanding = await getComplianceLoansReport();
    }
    if (reportType === 'all' || reportType === 'reconciliation') {
      reports.reconciliation = await getReconciliationReport();
    }
    if (reportType === 'all' || reportType === 'kyc') {
      reports.kyc_status = await getKYCStatusReport();
    }

    return NextResponse.json(reports);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
