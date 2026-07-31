import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

// POST /api/migrate — executes migration 00036
// Protected by CRON_SECRET
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const expectedKey = process.env.CRON_SECRET;
  if (!expectedKey || authHeader !== `Bearer ${expectedKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // The SQL to create the missing RPC functions
  const statements = [
    `CREATE OR REPLACE FUNCTION public.get_wallet_confirmed_balance(p_wallet_id UUID)
RETURNS NUMERIC(15,2) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_balance NUMERIC(15,2);
BEGIN
  SELECT COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END), 0)
  INTO v_balance FROM public.wallet_transactions WHERE wallet_id = p_wallet_id AND status = 'confirmed';
  RETURN v_balance;
END; $$;`,
    `GRANT EXECUTE ON FUNCTION public.get_wallet_confirmed_balance(UUID) TO authenticated;`,
    `CREATE OR REPLACE FUNCTION public.increment_candidate_votes(p_election_id UUID, p_membership_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.cooperative_election_candidates SET vote_count = vote_count + 1
  WHERE election_id = p_election_id AND membership_id = p_membership_id;
END; $$;`,
    `GRANT EXECUTE ON FUNCTION public.increment_candidate_votes(UUID, UUID) TO authenticated;`,
    `CREATE OR REPLACE FUNCTION public.increment_product_units(p_product_id UUID, p_units NUMERIC)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.investment_products SET units_issued = units_issued + p_units, updated_at = now()
  WHERE id = p_product_id;
END; $$;`,
    `GRANT EXECUTE ON FUNCTION public.increment_product_units(UUID, NUMERIC) TO authenticated;`,
    `CREATE OR REPLACE FUNCTION public.update_group_member_contribution(p_group_account_id UUID, p_wallet_id UUID, p_amount NUMERIC)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_customer_id UUID;
BEGIN
  SELECT customer_id INTO v_customer_id FROM public.wallets WHERE id = p_wallet_id;
  IF v_customer_id IS NULL THEN RETURN; END IF;
  UPDATE public.group_savings_memberships
  SET total_contributed = total_contributed + p_amount, contributions_count = contributions_count + 1,
      last_contribution_at = now(), updated_at = now()
  WHERE group_account_id = p_group_account_id AND customer_id = v_customer_id AND status = 'active';
END; $$;`,
    `GRANT EXECUTE ON FUNCTION public.update_group_member_contribution(UUID, UUID, NUMERIC) TO authenticated;`,
  ];

  const supabase = createServiceClient();
  const results: string[] = [];
  
  // Execute each statement using the supabase-js query method
  for (const stmt of statements) {
    try {
      const { error } = await (supabase as any).rpc('exec_sql', { query: stmt });
      if (error) {
        // If exec_sql doesn't exist, try direct query
        results.push(`SKIP: ${error.message}`);
      } else {
        results.push('OK');
      }
    } catch (e) {
      results.push(`ERR: ${e instanceof Error ? e.message : 'unknown'}`);
    }
  }

  // Check if exec_sql RPC exists by testing the functions
  const testResults: Record<string, boolean> = {};
  try {
    const { data: test1, error: e1 } = await supabase.rpc('get_wallet_confirmed_balance' as any, { p_wallet_id: '00000000-0000-0000-0000-000000000000' });
    testResults.get_wallet_confirmed_balance = !e1;
  } catch { testResults.get_wallet_confirmed_balance = false; }

  return NextResponse.json({ 
    statementResults: results,
    functionTests: testResults,
    note: 'If exec_sql RPC is not available, functions may need manual application via Supabase SQL Editor'
  });
}
