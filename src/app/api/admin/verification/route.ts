import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function GET(request: NextRequest) {
  const limited = applyRateLimit(request, '/api/admin/verification', RATE_LIMITS.ADMIN);
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
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const skip = parseInt(searchParams.get('skip') || '0');

    let query = serviceClient
      .from('kyc_documents')
      .select('id, user_id, doc_type, file_url, file_name, status, verified_by, created_at, updated_at', { count: 'exact' });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    query = query.order('created_at', { ascending: false }).range(skip, skip + limit - 1);
    const { data: docs, error, count } = await query;

    if (error) throw new Error(error.message);

    // Enrich with customer info
    const enriched = await Promise.all((docs || []).map(async (doc) => {
      const { data: customer } = await serviceClient
        .from('customers')
        .select('id, full_name, email, phone, bvn, nin, status')
        .eq('auth_id', doc.user_id)
        .maybeSingle();

      // Fetch Safe Haven verification status
      const { data: shVerification } = await serviceClient
        .from('safe_haven_identity_verifications')
        .select('type, status, verified_at')
        .eq('customer_id', customer?.id || '')
        .order('created_at', { ascending: false })
        .limit(2);

      return {
        ...doc,
        customer: customer ? {
          id: customer.id,
          full_name: customer.full_name,
          email: customer.email,
          phone: customer.phone,
          bvn: customer.bvn ? `****${customer.bvn.slice(-4)}` : null,
          nin: customer.nin ? `****${customer.nin.slice(-4)}` : null,
          status: customer.status,
        } : null,
        safe_haven: shVerification || [],
      };
    }));

    return NextResponse.json({ verifications: enriched, total: count || 0 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
