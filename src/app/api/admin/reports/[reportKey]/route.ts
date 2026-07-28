import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getComplianceDepositsReport, getComplianceLoansReport,
  getReconciliationReport, getKYCStatusReport,
  getRiskReport, getInvestmentPoolPerformance,
  getOperationalDashboard, getLoanPortfolio, getSavingsPortfolio, getInvestmentPortfolio,
  exportReport,
} from '@/modules/reporting';

export async function GET(
  request: NextRequest,
  context: { params: { reportKey: string } }
) {
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
    const format = (searchParams.get('format') || 'json') as 'csv' | 'json';

    // Generate the report data based on report key
    let reportData: Record<string, unknown>[] = [];
    let reportName = '';

    switch (context.params.reportKey) {
      case 'compliance_total_deposits':
        reportData = [await getComplianceDepositsReport() as unknown as Record<string, unknown>];
        reportName = 'Total Deposits Held';
        break;
      case 'compliance_loans_outstanding':
        reportData = [await getComplianceLoansReport() as unknown as Record<string, unknown>];
        reportName = 'Total Loans Outstanding';
        break;
      case 'compliance_reconciliation':
        reportData = [await getReconciliationReport() as unknown as Record<string, unknown>];
        reportName = 'Reconciliation Status';
        break;
      case 'compliance_kyc_status':
        reportData = [await getKYCStatusReport() as unknown as Record<string, unknown>];
        reportName = 'KYC Verification Status';
        break;
      case 'risk_loan_default':
        const riskReport = await getRiskReport();
        reportData = riskReport.default_rate_by_product as unknown as Record<string, unknown>[];
        reportName = 'Loan Default Rate by Product';
        break;
      case 'risk_savings_to_loan':
        const risk = await getRiskReport();
        reportData = [{ savings_to_loan_ratio: risk.savings_to_loan_ratio, total_savings: risk.total_savings, total_loans: risk.total_loans }];
        reportName = 'Savings-to-Loan Ratio';
        break;
      case 'risk_investment_performance':
        const invPerf = await getInvestmentPoolPerformance();
        reportData = [
          ...invPerf.guaranteed.products as unknown as Record<string, unknown>[],
          ...invPerf.variable_pool.products as unknown as Record<string, unknown>[],
          ...invPerf.expected.products as unknown as Record<string, unknown>[],
        ];
        reportName = 'Investment Pool Performance';
        break;
      case 'operational_dashboard':
        reportData = [await getOperationalDashboard() as unknown as Record<string, unknown>];
        reportName = 'Operational Dashboard';
        break;
      case 'operational_loans':
        reportData = [await getLoanPortfolio() as unknown as Record<string, unknown>];
        reportName = 'Loan Portfolio';
        break;
      case 'operational_savings':
        reportData = [await getSavingsPortfolio() as unknown as Record<string, unknown>];
        reportName = 'Savings Portfolio';
        break;
      case 'operational_investments':
        reportData = [await getInvestmentPortfolio() as unknown as Record<string, unknown>];
        reportName = 'Investment Portfolio';
        break;
      default:
        return NextResponse.json({ error: `Unknown report key: ${context.params.reportKey}` }, { status: 400 });
    }

    if (format === 'csv' || format === 'json') {
      const result = await exportReport(
        context.params.reportKey,
        reportName,
        reportData,
        format,
        user.id,
      );

      if (format === 'csv') {
        return new NextResponse(result.content, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="${context.params.reportKey}.csv"`,
          },
        });
      } else {
        return NextResponse.json({
          report: context.params.reportKey,
          data: reportData,
          row_count: result.row_count,
        });
      }
    }

    return NextResponse.json({ error: 'Unsupported format' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
