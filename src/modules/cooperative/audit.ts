// ============================================================================
// Governance Audit Trail
// 
// Append-only, immutable log for governance actions. Hash-chained for
// tamper-evidence. Corrections are new records referencing the original.
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

interface LogGovernanceEventParams {
  cooperative_id: string;
  event_type: string;
  entity_type: string;
  entity_id?: string;
  event_data?: Record<string, unknown>;
  actor_membership_id?: string;
  actor_user_id?: string;
}

export async function logGovernanceEvent(params: LogGovernanceEventParams): Promise<string> {
  const supabase = getServiceClient();

  // Get previous hash for chain
  const { data: lastEntry } = await supabase
    .from('governance_audit_log')
    .select('event_hash')
    .eq('cooperative_id', params.cooperative_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const previousHash = lastEntry?.event_hash || 'genesis';
  const timestamp = new Date().toISOString();
  
  // Compute hash: previous_hash + event_type + entity_type + entity_id + timestamp + data
  const hashInput = `${previousHash}|${params.event_type}|${params.entity_type}|${params.entity_id || ''}|${timestamp}|${JSON.stringify(params.event_data || {})}`;
  const eventHash = createHash('sha256').update(hashInput).digest('hex');

  const { data, error } = await supabase
    .from('governance_audit_log')
    .insert({
      cooperative_id: params.cooperative_id,
      event_type: params.event_type,
      entity_type: params.entity_type,
      entity_id: params.entity_id || null,
      event_data: params.event_data || {},
      actor_membership_id: params.actor_membership_id || null,
      actor_user_id: params.actor_user_id || null,
      previous_hash: previousHash,
      event_hash: eventHash,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to log governance event: ${error.message}`);
  return data.id;
}

export async function getGovernanceLog(coopId: string, limit: number = 50): Promise<unknown[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('governance_audit_log')
    .select('*')
    .eq('cooperative_id', coopId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to get governance log: ${error.message}`);
  return data || [];
}
