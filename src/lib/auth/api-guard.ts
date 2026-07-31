import { createClient } from '@/lib/supabase/server';

/**
 * API Guard — server-side authorization for API routes.
 * 
 * Usage:
 *   const { user, customerId, isStaff } = await requireAuth(request);
 *   if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 *   if (!customerId && !isStaff) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
 */

export async function requireAuth() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return { user: null, customerId: null, isStaff: false, supabase };
  }

  const { data: isStaff } = await supabase.rpc('is_staff');
  
  let customerId: string | null = null;
  if (!isStaff) {
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle();
    customerId = customer?.id || null;
  }

  return { user, customerId, isStaff: !!isStaff, supabase };
}

/**
 * Verify that a resource belongs to the authenticated customer.
 * Returns true if the customer owns the resource or is staff.
 */
export async function verifyOwnership(
  supabase: ReturnType<typeof createClient>,
  customerId: string | null,
  isStaff: boolean,
  table: string,
  resourceId: string,
  column: string = 'id'
): Promise<boolean> {
  if (isStaff) return true;
  if (!customerId) return false;
  
  const { data } = await supabase
    .from(table)
    .select('customer_id')
    .eq(column, resourceId)
    .maybeSingle();
  
  return data?.customer_id === customerId;
}

/**
 * Require staff permission for an action.
 */
export async function requireStaffPermission(
  supabase: ReturnType<typeof createClient>,
  permission: string
): Promise<boolean> {
  const { data: isStaff } = await supabase.rpc('is_staff');
  if (!isStaff) return false;
  
  const { data: hasPermission } = await supabase.rpc('has_permission', {
    p_permission: permission,
  });
  return !!hasPermission;
}
