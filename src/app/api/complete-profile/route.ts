import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// ════════════════════════════════════════════════════════════
// POST /api/complete-profile
//
// Called after the "Complete your profile" form is submitted.
// Marks the customer record as phone_verified and stores the
// signup_method (google vs manual) for audit/compliance.
//
// Uses the service role client because updating phone_verified
// and signup_method on the customers table may require elevated
// permissions (RLS may restrict customer updates to service role).
// ════════════════════════════════════════════════════════════

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      phone_verified,
      signup_method,
      full_name,
      phone,
      residential_address,
      state,
      lga,
    } = body;

    // Validate the authenticated user
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceClient = createServiceClient();

    // Update the customer record
    const { data: customer, error: customerError } = await serviceClient
      .from('customers')
      .update({
        phone_verified: !!phone_verified,
        signup_method: signup_method === 'google' ? 'google' : 'manual',
        full_name: full_name || undefined,
        phone: phone || undefined,
      })
      .eq('auth_id', user.id)
      .select('id, customer_number')
      .single();

    if (customerError) {
      console.error('[complete-profile] Customer update error:', customerError);
      return NextResponse.json(
        { error: 'Failed to update customer: ' + customerError.message },
        { status: 500 }
      );
    }

    // Update the profiles table with address info
    const { error: profileError } = await serviceClient
      .from('profiles')
      .update({
        full_name: full_name || undefined,
        phone: phone || undefined,
        residential_address: residential_address || undefined,
        state: state || undefined,
        lga: lga || undefined,
      })
      .eq('id', user.id);

    if (profileError) {
      console.error('[complete-profile] Profile update error:', profileError);
      // Non-fatal — customer record was updated
    }

    return NextResponse.json({
      message: 'Profile completed successfully',
      customer_id: customer.id,
      customer_number: customer.customer_number,
      phone_verified: !!phone_verified,
      signup_method: signup_method === 'google' ? 'google' : 'manual',
    });
  } catch (error) {
    console.error('[complete-profile] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
