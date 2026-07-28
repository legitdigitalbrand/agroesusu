import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// GET /api/admin/reconciliation-flags
// Lists reconciliation flags for compliance/finance review.
// Staff only — requires 'audit.read' permission.
// Query params: status, page, limit
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const serviceClient = createServiceClient();
    
    // 1. Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Staff only
    const { data: isStaff } = await supabase.rpc('is_staff');
    if (!isStaff) {
      return NextResponse.json({ error: 'Forbidden: staff access required' }, { status: 403 });
    }

    // 3. Check audit.read permission
    const { data: hasPermission } = await supabase.rpc('has_permission', {
      p_permission: 'audit.read',
    });
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden: audit.read permission required' }, { status: 403 });
    }

    // 4. Parse query params
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const status = searchParams.get('status'); // open, investigating, resolved, escalated
    const offset = (page - 1) * limit;

    // 5. Query reconciliation flags (service client — RLS allows audit.read)
    let query = serviceClient
      .from('reconciliation_flags')
      .select(`
        id, wallet_id, our_balance, sh_balance, discrepancy_amount,
        discrepancy_direction, status, resolution_type, resolution_notes,
        resolved_by, resolved_at, investigated_by, investigated_at,
        investigation_notes, checked_at, created_at, correlation_id
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);

    const { data: flags, error: flagsError, count } = await query;

    if (flagsError) {
      console.error('[API:recon-flags] Query error:', flagsError);
      return NextResponse.json({ error: 'Failed to fetch reconciliation flags' }, { status: 500 });
    }

    const total = count || 0;
    const total_pages = Math.ceil(total / limit);

    return NextResponse.json({
      flags: flags || [],
      pagination: {
        page,
        limit,
        total,
        total_pages,
      },
    });

  } catch (error) {
    console.error('[API:recon-flags] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
