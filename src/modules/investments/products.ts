// ============================================================================
// Investment Products — CRUD & Discovery
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import type { InvestmentProduct } from './types';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function listActiveProducts(): Promise<InvestmentProduct[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('investment_products')
    .select('*')
    .eq('is_active', true)
    .eq('status', 'active')
    .order('expected_return_rate', { ascending: true });
  if (error) throw new Error(`Failed to list investment products: ${error.message}`);
  return (data || []) as InvestmentProduct[];
}

export async function getProduct(productId: string): Promise<InvestmentProduct | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('investment_products')
    .select('*')
    .eq('id', productId)
    .maybeSingle();
  if (error) throw new Error(`Failed to get investment product: ${error.message}`);
  return data as InvestmentProduct | null;
}

export async function createProduct(product: Partial<InvestmentProduct>): Promise<InvestmentProduct> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('investment_products')
    .insert({
      product_name: product.product_name,
      investment_type: product.investment_type,
      description: product.description,
      expected_return_rate: product.expected_return_rate,
      return_type: product.return_type || 'flat',
      min_investment: product.min_investment || 1000,
      max_investment: product.max_investment,
      min_tenure_days: product.min_tenure_days || 30,
      max_tenure_days: product.max_tenure_days,
      nav_per_unit: product.nav_per_unit,
      total_units_available: product.total_units_available,
      risk_level: product.risk_level || 'moderate',
      risk_score: product.risk_score || 5,
      management_fee_rate: product.management_fee_rate || 0,
      early_exit_fee_rate: product.early_exit_fee_rate || 0,
      early_exit_lock_days: product.early_exit_lock_days || 0,
      allows_early_redemption: product.allows_early_redemption ?? true,
      allows_partial_redemption: product.allows_partial_redemption ?? true,
      allows_top_up: product.allows_top_up ?? false,
      auto_reinvest: product.auto_reinvest ?? false,
      cooperative_required: product.cooperative_required ?? false,
      risk_disclosure_text: product.risk_disclosure_text,
      risk_disclosure_version: product.risk_disclosure_version || '1.0',
      is_active: true,
      status: 'active',
      config: product.config || {},
    })
    .select('*')
    .single();
  if (error) throw new Error(`Failed to create investment product: ${error.message}`);
  return data as InvestmentProduct;
}
