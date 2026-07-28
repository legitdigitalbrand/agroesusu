// ============================================================================
// Savings Product Management
// 
// Admin-configurable product definitions. All product parameters live in
// the savings_products table. No code deploy needed to launch a new product.
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import type { SavingsProduct } from './types';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** List all active savings products (for customer-facing product catalog) */
export async function listActiveProducts(): Promise<SavingsProduct[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('savings_products')
    .select('*')
    .eq('is_active', true)
    .order('is_featured', { ascending: false })
    .order('product_name', { ascending: true });

  if (error) throw new Error(`Failed to list products: ${error.message}`);
  return (data || []) as SavingsProduct[];
}

/** Get a single product by ID */
export async function getProduct(productId: string): Promise<SavingsProduct | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('savings_products')
    .select('*')
    .eq('id', productId)
    .maybeSingle();

  if (error) throw new Error(`Failed to get product: ${error.message}`);
  return data as SavingsProduct | null;
}

/** Get a product by code (e.g., 'FLEX', 'FD-90') */
export async function getProductByCode(code: string): Promise<SavingsProduct | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('savings_products')
    .select('*')
    .eq('product_code', code)
    .maybeSingle();

  if (error) throw new Error(`Failed to get product by code: ${error.message}`);
  return data as SavingsProduct | null;
}

/** Create a new savings product (admin only) */
export async function createProduct(
  product: Partial<SavingsProduct> & { product_code: string; product_name: string; product_type: SavingsProduct['product_type'] }
): Promise<SavingsProduct> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('savings_products')
    .insert(product)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to create product: ${error.message}`);
  return data as SavingsProduct;
}

/** Update a product (admin only) — does NOT affect existing accounts */
export async function updateProduct(
  productId: string,
  updates: Partial<SavingsProduct>
): Promise<SavingsProduct> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('savings_products')
    .update(updates)
    .eq('id', productId)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to update product: ${error.message}`);
  return data as SavingsProduct;
}
