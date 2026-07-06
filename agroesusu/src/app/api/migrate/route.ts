import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * TEMPORARY migration check endpoint.
 * Checks whether Phase 1.5 columns already exist.
 * Delete this file after migration is confirmed.
 */
export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Check profiles table columns
  const { data: profileSample, error: profileErr } = await supabase
    .from('profiles')
    .select('*')
    .limit(1);

  if (profileErr) {
    return NextResponse.json({ error: 'Cannot read profiles table', details: profileErr.message }, { status: 500 });
  }

  const profileKeys = Object.keys(profileSample?.[0] || {});

  // Check savings_groups table columns
  const { data: groupSample, error: groupErr } = await supabase
    .from('savings_groups')
    .select('*')
    .limit(1);

  if (groupErr) {
    return NextResponse.json({ error: 'Cannot read savings_groups table', details: groupErr.message }, { status: 500 });
  }

  const groupKeys = Object.keys(groupSample?.[0] || []);

  const needed = {
    paystack_customer_code: profileKeys.includes('paystack_customer_code'),
    paystack_dva_account_number: profileKeys.includes('paystack_dva_account_number'),
    paystack_dva_bank_name: profileKeys.includes('paystack_dva_bank_name'),
    dva_status: profileKeys.includes('dva_status'),
    bvn_last_4: profileKeys.includes('bvn_last_4'),
    bvn_hash: profileKeys.includes('bvn_hash'),
    invite_token: groupKeys.includes('invite_token'),
  };

  const allPresent = Object.values(needed).every(Boolean);

  return NextResponse.json({
    all_columns_present: allPresent,
    column_status: needed,
    current_profile_columns: profileKeys,
    current_group_columns: groupKeys,
    message: allPresent
      ? 'All Phase 1.5 columns already exist — no migration needed.'
      : 'Some columns are missing. Run migration_phase1_5.sql in Supabase Dashboard → SQL Editor.'
  });
}
