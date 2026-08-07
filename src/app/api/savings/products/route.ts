import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { listActiveProducts } from '@/modules/savings';

// GET /api/savings/products — list active savings products
// Customers see: flexible, fixed_deposit, esusu
// Staff see all active products (for admin views)
export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const products = await listActiveProducts();

    // Check if user is staff
    const { data: isStaff } = await supabase.rpc('is_staff');

    if (isStaff) {
      // Staff see all active products
      return NextResponse.json({ products });
    }

    // Customers see: flexible, fixed_deposit, esusu
    // custom_pot is excluded — goal tracking is now part of flexible savings
    const customerProducts = products.filter(
      (p) => ['flexible', 'fixed_deposit', 'esusu'].includes(p.product_type)
    );

    return NextResponse.json({ products: customerProducts });

  } catch (error) {
    console.error('[API:savings-products] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
