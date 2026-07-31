import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

// GET /api/migrate — checks which RPC functions exist and returns SQL to run manually
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const expectedKey = process.env.CRON_SECRET;
  if (!expectedKey || authHeader !== `Bearer ${expectedKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const functionChecks: Record<string, boolean> = {};

  // Test each function to see if it exists
  try {
    const { error } = await supabase.rpc('get_wallet_confirmed_balance' as any, { p_wallet_id: '00000000-0000-0000-0000-000000000000' });
    functionChecks.get_wallet_confirmed_balance = !error;
  } catch { functionChecks.get_wallet_confirmed_balance = false; }

  try {
    const { error } = await supabase.rpc('increment_candidate_votes' as any, { p_election_id: '00000000-0000-0000-0000-000000000000', p_membership_id: '00000000-0000-0000-0000-000000000000' });
    functionChecks.increment_candidate_votes = !error;
  } catch { functionChecks.increment_candidate_votes = false; }

  try {
    const { error } = await supabase.rpc('increment_product_units' as any, { p_product_id: '00000000-0000-0000-0000-000000000000', p_units: 0 });
    functionChecks.increment_product_units = !error;
  } catch { functionChecks.increment_product_units = false; }

  try {
    const { error } = await supabase.rpc('update_group_member_contribution' as any, { p_group_account_id: '00000000-0000-0000-0000-000000000000', p_wallet_id: '00000000-0000-0000-0000-000000000000', p_amount: 0 });
    functionChecks.update_group_member_contribution = !error;
  } catch { functionChecks.update_group_member_contribution = false; }

  const allExist = Object.values(functionChecks).every(v => v === true);
  const missing = Object.entries(functionChecks).filter(([_, v]) => !v).map(([k]) => k);

  return NextResponse.json({
    allFunctionsExist: allExist,
    missingFunctions: missing,
    functionChecks,
    instructions: allExist 
      ? 'All RPC functions are already present in the database.'
      : `Missing: ${missing.join(', ')}. Run supabase/migrations/00036_missing_rpc_functions.sql in the Supabase SQL Editor.`
  });
}
