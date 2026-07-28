// ============================================================================
// Loan Product Management
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import type { LoanProduct } from './types';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function listActiveProducts(): Promise<LoanProduct[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('loan_products')
    .select('*')
    .eq('is_active', true)
    .order('is_featured', { ascending: false })
    .order('product_name', { ascending: true });
  if (error) throw new Error(`Failed to list loan products: ${error.message}`);
  return (data || []) as LoanProduct[];
}

export async function getProduct(productId: string): Promise<LoanProduct | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('loan_products')
    .select('*')
    .eq('id', productId)
    .maybeSingle();
  if (error) throw new Error(`Failed to get loan product: ${error.message}`);
  return data as LoanProduct | null;
}

export async function getProductByCode(code: string): Promise<LoanProduct | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('loan_products')
    .select('*')
    .eq('product_code', code)
    .maybeSingle();
  if (error) throw new Error(`Failed to get product by code: ${error.message}`);
  return data as LoanProduct | null;
}

export async function createProduct(product: Partial<LoanProduct>): Promise<LoanProduct> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('loan_products')
    .insert(product)
    .select('*')
    .single();
  if (error) throw new Error(`Failed to create loan product: ${error.message}`);
  return data as LoanProduct;
}

export async function updateProduct(productId: string, updates: Partial<LoanProduct>): Promise<LoanProduct> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('loan_products')
    .update(updates)
    .eq('id', productId)
    .select('*')
    .single();
  if (error) throw new Error(`Failed to update loan product: ${error.message}`);
  return data as LoanProduct;
}
