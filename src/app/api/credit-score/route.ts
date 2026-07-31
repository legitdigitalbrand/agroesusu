import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// GET /api/credit-score
// Returns the authenticated customer's credit score and risk profile.
// The score is calculated server-side — the frontend never computes or modifies it.
export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle();

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const serviceClient = createServiceClient();

    // Get the latest risk profile
    const { data: riskProfile } = await serviceClient
      .from('customer_risk_profiles')
      .select('credit_score, risk_band, savings_score, repayment_score, participation_score, calculated_at, factors')
      .eq('customer_id', customer.id)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!riskProfile) {
      return NextResponse.json({
        has_score: false,
        message: 'No credit score calculated yet. Maintain savings activity and repayment history to build your score.',
      });
    }

    return NextResponse.json({
      has_score: true,
      score: riskProfile.credit_score,
      risk_band: riskProfile.risk_band,
      factors: riskProfile.factors,
      calculated_at: riskProfile.calculated_at,
      breakdown: {
        savings_score: riskProfile.savings_score,
        repayment_score: riskProfile.repayment_score,
        participation_score: riskProfile.participation_score,
      },
    });

  } catch (error) {
    console.error('[API:credit-score] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
