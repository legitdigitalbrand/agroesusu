// ============================================================================
// Administration Module
// 
// Unified admin console API surface. This module is about PRESENTATION and
// ACCESS CONTROL over existing config APIs — it doesn't rebuild those APIs.
// 
// Admin actions are logged in admin_action_log with the same rigor as
// customer-facing financial actions.
// ============================================================================

import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Admin Console Feature Map by Role
 * 
 * This defines exactly what each RBAC role can see/do in the admin console.
 * It matches Phase 1's role definitions precisely.
 */
export const ADMIN_FEATURE_MAP: Record<string, { features: string[]; description: string }> = {
  super_admin: {
    description: 'Full platform access. Can manage all configurations, users, and financial operations.',
    features: [
      'dashboard', 'audit_log', 'reporting_all', 'compliance_all',
      'savings_products', 'loan_products', 'investment_products', 'group_savings_products',
      'rbac_management', 'staff_management', 'cooperative_management',
      'system_config', 'override_financial', 'export_all',
    ],
  },
  operations: {
    description: 'Manages day-to-day platform operations, monitors transactions, handles escalations.',
    features: [
      'dashboard', 'audit_log', 'reporting_operational',
      'savings_products', 'loan_products', 'investment_products', 'group_savings_products',
      'cooperative_management', 'export_operational',
    ],
  },
  finance: {
    description: 'Manages settlements, reconciliations, and financial reporting.',
    features: [
      'dashboard', 'reporting_financial', 'compliance_deposits', 'compliance_loans',
      'reconciliation', 'risk_portfolio', 'export_financial',
    ],
  },
  compliance: {
    description: 'Handles KYC reviews, AML monitoring, sanctions screening, regulatory reporting.',
    features: [
      'audit_log', 'compliance_all', 'kyc_management', 'reporting_compliance',
      'audit_governance', 'audit_admin_actions', 'export_compliance',
    ],
  },
  loan_officer: {
    description: 'Reviews and processes loan applications, manages collections, handles customer inquiries.',
    features: [
      'dashboard', 'loan_products', 'risk_loan_portfolio', 'loan_applications',
      'collections', 'customer_profiles', 'credit_scores',
    ],
  },
  customer_support: {
    description: 'Handles customer inquiries, account issues, and basic account management.',
    features: [
      'customer_profiles', 'wallet_transactions', 'savings_accounts_view',
      'loan_accounts_view', 'ticket_management',
    ],
  },
  marketing: {
    description: 'Manages campaigns, announcements, and promotional content.',
    features: [
      'product_catalog_view', 'announcements', 'blog_management',
    ],
  },
};

/**
 * Get the feature map for a specific role.
 */
export function getRoleFeatures(roleName: string): string[] {
  return ADMIN_FEATURE_MAP[roleName]?.features || [];
}

/**
 * Check if a role has access to a specific feature.
 */
export function hasFeatureAccess(roleName: string, feature: string): boolean {
  const features = getRoleFeatures(roleName);
  return features.includes(feature);
}

/**
 * Log an admin action.
 * Every admin console action is logged with the same rigor as customer-facing financial actions.
 */
export async function logAdminAction(params: {
  admin_user_id: string;
  admin_role: string;
  action: string;
  action_category: string;
  entity_type?: string;
  entity_id?: string;
  before_state?: Record<string, unknown>;
  after_state?: Record<string, unknown>;
  result?: string;
  error_message?: string;
  source_ip?: string;
  user_agent?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase.from('admin_action_log').insert({
    admin_user_id: params.admin_user_id,
    admin_role: params.admin_role,
    action: params.action,
    action_category: params.action_category,
    entity_type: params.entity_type || null,
    entity_id: params.entity_id || null,
    before_state: params.before_state || null,
    after_state: params.after_state || null,
    result: params.result || 'success',
    error_message: params.error_message || null,
    source_ip: params.source_ip || null,
    user_agent: params.user_agent || null,
    metadata: params.metadata || null,
  });
  if (error) throw new Error(`Failed to log admin action: ${error.message}`);
}

/**
 * Get admin dashboard data — aggregated admin console overview.
 */
export async function getAdminOverview() {
  const supabase = getServiceClient();

  // Count active staff users
  const { count: staffCount } = await supabase
    .from('staff_users')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');

  // Count role assignments
  const { data: roleAssignments } = await supabase
    .from('staff_role_assignments')
    .select('role_id, roles(name)')
    .eq('status', 'active');

  const roleDistribution = new Map<string, number>();
  for (const assignment of (roleAssignments || [])) {
    const roleName = ((assignment as { roles: { name: string }[] }).roles as { name: string }[])?.[0]?.name || 'unknown';
    roleDistribution.set(roleName, (roleDistribution.get(roleName) || 0) + 1);
  }

  // Count active products across modules
  const { count: savingsProducts } = await supabase
    .from('savings_products')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);
  const { count: loanProducts } = await supabase
    .from('loan_products')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);
  const { count: investmentProducts } = await supabase
    .from('investment_products')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);
  const { count: groupSavingsProducts } = await supabase
    .from('group_savings_products')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  return {
    staff: {
      total_active: staffCount || 0,
      role_distribution: Array.from(roleDistribution.entries()).map(([role, count]) => ({ role, count })),
    },
    products: {
      savings: savingsProducts || 0,
      loans: loanProducts || 0,
      investments: investmentProducts || 0,
      group_savings: groupSavingsProducts || 0,
    },
  };
}

/**
 * List available reports for a given role.
 */
export async function listAvailableReports(roleName: string) {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('report_definitions')
    .select('*')
    .eq('is_active', true)
    .contains('allowed_roles', [roleName])
    .order('report_category', { ascending: true });
  if (error) throw new Error(`Failed to list reports: ${error.message}`);
  return data || [];
}
