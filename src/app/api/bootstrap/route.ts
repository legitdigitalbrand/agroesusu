import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// POST /api/bootstrap — creates a customer record and wallet for the authenticated user.
// Called after Supabase auth signup to complete the customer onboarding (Tier 0).
//
// This is the "progressive registration" step:
//   1. Auth user already created by Supabase (signUp)
//   2. This endpoint creates the customer record (status: 'registered')
//   3. This endpoint creates a primary wallet (status: 'created')
//   4. User can now access the dashboard at Tier 0

export async function POST() {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Determine signup method from auth metadata (set by Google OAuth flow or manual signup)
    const signupMethod = 'manual';

    // Check if customer already exists (idempotent)
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id, customer_number, signup_method')
      .eq('auth_id', user.id)
      .maybeSingle();

    if (existingCustomer) {
      // Existing customer — no updates needed
      return NextResponse.json({
        message: 'Customer already exists',
        customer_id: existingCustomer.id,
        customer_number: existingCustomer.customer_number,
      });
    }

    const serviceClient = createServiceClient();

    // Get name and phone from the profiles table (auto-created by trigger) or auth metadata
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, phone, email')
      .eq('id', user.id)
      .maybeSingle();

    const fullName = profile?.full_name || (user.user_metadata as { full_name?: string })?.full_name || 'New User';
    const phone = profile?.phone || (user.user_metadata as { phone?: string })?.phone || null;
    const email = profile?.email || user.email || null;

    // 1. Create customer record (uses generate_customer_number() DB function)
    const { data: customer, error: customerError } = await serviceClient
      .from('customers')
      .insert({
        auth_id: user.id,
        customer_number: null, // Will be set by trigger/default
        full_name: fullName,
        email: email,
        phone: phone,
        status: 'registered',
        signup_method: signupMethod,
        created_by: user.id,
      })
      .select('id, customer_number')
      .single();

    if (customerError) {
      console.error('[bootstrap] Customer creation error:', customerError);
      return NextResponse.json(
        { error: 'Failed to create customer record', details: customerError.message },
        { status: 500 }
      );
    }

    // 2. Create primary wallet (uses generate_wallet_number() DB function)
    const { data: wallet, error: walletError } = await serviceClient
      .from('wallets')
      .insert({
        customer_id: customer.id,
        wallet_type: 'primary',
        status: 'active', // Active immediately for sandbox; Safe Haven provisioning deferred
        created_by: user.id,
      })
      .select('id, wallet_number')
      .single();

    if (walletError) {
      console.error('[bootstrap] Wallet creation error:', walletError);
      // Customer was created but wallet failed — not fatal, user can still use the app
      return NextResponse.json({
        message: 'Customer created (wallet creation deferred)',
        customer_id: customer.id,
        customer_number: customer.customer_number,
        wallet_error: walletError.message,
      });
    }

    // Set profile_complete in auth metadata
    await supabase.auth.updateUser({
      data: { profile_complete: true }
    });

    return NextResponse.json({
      message: 'Customer and wallet created successfully',
      customer_id: customer.id,
      customer_number: customer.customer_number,
      wallet_id: wallet.id,
      wallet_number: wallet.wallet_number,
    });
  } catch (error) {
    console.error('[bootstrap] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
