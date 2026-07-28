// ============================================================================
// Audit Log Viewer
// 
// Queryable, filterable view over the accumulated audit trail:
//   - audit_log (Phase 1) — general platform actions
//   - governance_audit_log (Phase 7) — cooperative governance actions
//   - admin_action_log (Phase 9) — admin console actions
//   - financial_transactions (Phase 4) — Orchestrator state machine
// 
// Read-only — this view must NEVER be able to alter audit records.
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import type { AuditLogQuery, AuditLogEntry, AuditLogSummary } from './types';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Query the audit log with filters.
 * Searches across audit_log, governance_audit_log, and admin_action_log.
 */
export async function queryAuditLog(query: AuditLogQuery): Promise<{ entries: AuditLogEntry[]; total: number }> {
  const supabase = getServiceClient();
  const limit = Math.min(query.limit || 50, 500);
  const offset = query.offset || 0;

  // Query audit_log
  let auditQuery = supabase
    .from('audit_log')
    .select('id, actor_id, actor_name, action, action_category, entity_type, entity_id, result, error_message, metadata, created_at', { count: 'exact' });

  if (query.actor_id) auditQuery = auditQuery.eq('actor_id', query.actor_id);
  if (query.action) auditQuery = auditQuery.ilike('action', `%${query.action}%`);
  if (query.entity_type) auditQuery = auditQuery.eq('entity_type', query.entity_type);
  if (query.entity_id) auditQuery = auditQuery.eq('entity_id', query.entity_id);
  if (query.result) auditQuery = auditQuery.eq('result', query.result);
  if (query.date_from) auditQuery = auditQuery.gte('created_at', query.date_from);
  if (query.date_to) auditQuery = auditQuery.lte('created_at', query.date_to);

  auditQuery = auditQuery.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data: auditData, count: auditCount, error: auditError } = await auditQuery;
  if (auditError) throw new Error(`Audit log query failed: ${auditError.message}`);

  const entries: AuditLogEntry[] = ((auditData || []) as unknown[]).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      actor_id: r.actor_id as string | null,
      actor_name: r.actor_name as string | null,
      action: r.action as string,
      action_category: r.action_category as string | null,
      entity_type: r.entity_type as string | null,
      entity_id: r.entity_id as string | null,
      result: r.result as string,
      error_message: r.error_message as string | null,
      metadata: r.metadata as Record<string, unknown> | null,
      created_at: r.created_at as string,
    };
  });

  return { entries, total: auditCount || 0 };
}

/**
 * Query governance audit log (Phase 7 — hash-chained, append-only).
 */
export async function queryGovernanceAuditLog(query: AuditLogQuery): Promise<{ entries: unknown[]; total: number }> {
  const supabase = getServiceClient();
  const limit = Math.min(query.limit || 50, 500);
  const offset = query.offset || 0;

  let govQuery = supabase
    .from('governance_audit_log')
    .select('*', { count: 'exact' });

  if (query.action) govQuery = govQuery.ilike('action', `%${query.action}%`);
  if (query.date_from) govQuery = govQuery.gte('created_at', query.date_from);
  if (query.date_to) govQuery = govQuery.lte('created_at', query.date_to);

  govQuery = govQuery.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data, count, error } = await govQuery;
  if (error) throw new Error(`Governance audit log query failed: ${error.message}`);

  return { entries: data || [], total: count || 0 };
}

/**
 * Query admin action log (Phase 9 — admin console actions).
 */
export async function queryAdminActionLog(query: AuditLogQuery): Promise<{ entries: unknown[]; total: number }> {
  const supabase = getServiceClient();
  const limit = Math.min(query.limit || 50, 500);
  const offset = query.offset || 0;

  let adminQuery = supabase
    .from('admin_action_log')
    .select('*', { count: 'exact' });

  if (query.actor_id) adminQuery = adminQuery.eq('admin_user_id', query.actor_id);
  if (query.action) adminQuery = adminQuery.ilike('action', `%${query.action}%`);
  if (query.entity_type) adminQuery = adminQuery.eq('entity_type', query.entity_type);
  if (query.entity_id) adminQuery = adminQuery.eq('entity_id', query.entity_id);
  if (query.date_from) adminQuery = adminQuery.gte('created_at', query.date_from);
  if (query.date_to) adminQuery = adminQuery.lte('created_at', query.date_to);

  adminQuery = adminQuery.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data, count, error } = await adminQuery;
  if (error) throw new Error(`Admin action log query failed: ${error.message}`);

  return { entries: data || [], total: count || 0 };
}

/**
 * Get audit log summary — aggregate statistics for the compliance dashboard.
 */
export async function getAuditLogSummary(): Promise<AuditLogSummary> {
  const supabase = getServiceClient();

  // Get total count and date range
  const { count: totalCount } = await supabase
    .from('audit_log')
    .select('*', { count: 'exact', head: true });

  const { data: dateRange } = await supabase
    .from('audit_log')
    .select('created_at')
    .order('created_at', { ascending: true })
    .limit(1);
  
  const { data: latestEntry } = await supabase
    .from('audit_log')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1);

  // Aggregate by actor
  const { data: byActor } = await supabase
    .from('audit_log')
    .select('actor_name')
    .not('actor_name', 'is', null);

  const actorMap = new Map<string, number>();
  for (const entry of (byActor || [])) {
    const name = (entry as { actor_name: string }).actor_name;
    actorMap.set(name, (actorMap.get(name) || 0) + 1);
  }

  // Aggregate by action
  const { data: byActionData } = await supabase
    .from('audit_log')
    .select('action');
  const actionMap = new Map<string, number>();
  for (const entry of (byActionData || [])) {
    const action = (entry as { action: string }).action;
    actionMap.set(action, (actionMap.get(action) || 0) + 1);
  }

  // Aggregate by result
  const { data: byResultData } = await supabase
    .from('audit_log')
    .select('result');
  const resultMap = new Map<string, number>();
  for (const entry of (byResultData || [])) {
    const result = (entry as { result: string }).result;
    resultMap.set(result, (resultMap.get(result) || 0) + 1);
  }

  return {
    total_entries: totalCount || 0,
    by_actor: Array.from(actorMap.entries()).map(([actor, count]) => ({ actor, count })),
    by_module: [],  // Would need to aggregate by entity_type — requires SQL aggregation
    by_action: Array.from(actionMap.entries()).map(([action, count]) => ({ action, count })),
    by_result: Array.from(resultMap.entries()).map(([result, count]) => ({ result, count })),
    date_range: {
      earliest: (dateRange?.[0] as { created_at: string })?.created_at || new Date().toISOString(),
      latest: (latestEntry?.[0] as { created_at: string })?.created_at || new Date().toISOString(),
    },
  };
}
