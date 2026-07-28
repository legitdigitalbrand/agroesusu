// ============================================================================
// Cooperative Membership Engine
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { logGovernanceEvent } from './audit';
import type { Cooperative, CooperativeMembership, ExecutivePosition } from './types';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function listCooperatives(): Promise<Cooperative[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('cooperatives')
    .select('*')
    .in('status', ['active', 'suspended'])
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Failed to list cooperatives: ${error.message}`);
  return (data || []) as Cooperative[];
}

export async function getCooperative(coopId: string): Promise<Cooperative | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('cooperatives')
    .select('*')
    .eq('id', coopId)
    .maybeSingle();
  if (error) throw new Error(`Failed to get cooperative: ${error.message}`);
  return data as Cooperative | null;
}

export async function getExecutivePositions(coopId: string): Promise<ExecutivePosition[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('cooperative_executive_positions')
    .select('*')
    .eq('cooperative_id', coopId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) throw new Error(`Failed to get executive positions: ${error.message}`);
  return (data || []) as ExecutivePosition[];
}

export async function joinCooperative(coopId: string, customerId: string): Promise<CooperativeMembership> {
  const supabase = getServiceClient();
  
  const coop = await getCooperative(coopId);
  if (!coop) throw new Error('Cooperative not found');
  if (coop.status !== 'active') throw new Error('Cooperative is not active');
  
  // Check if already a member
  const { data: existing } = await supabase
    .from('cooperative_memberships')
    .select('id, status')
    .eq('cooperative_id', coopId)
    .eq('customer_id', customerId)
    .maybeSingle();
  
  if (existing) {
    if (existing.status === 'active') throw new Error('Already a member of this cooperative');
    if (existing.status === 'suspended') throw new Error('Membership is suspended');
    // Reactivate if pending/left
    if (existing.status === 'left' || existing.status === 'pending') {
      const { data: updated, error } = await supabase
        .from('cooperative_memberships')
        .update({ status: 'pending', left_at: null })
        .eq('id', existing.id)
        .select('*')
        .single();
      if (error) throw new Error(`Failed to reactivate membership: ${error.message}`);
      return updated as CooperativeMembership;
    }
  }
  
  const config = coop.config as { allow_self_join?: boolean; membership_fee?: number };
  if (config.allow_self_join === false) {
    throw new Error('This cooperative does not allow self-join. Please contact an administrator.');
  }
  
  const { data: membership, error } = await supabase
    .from('cooperative_memberships')
    .insert({
      cooperative_id: coopId,
      customer_id: customerId,
      membership_number: 'MEM-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
      status: 'pending',
    })
    .select('*')
    .single();
  
  if (error) throw new Error(`Failed to join cooperative: ${error.message}`);
  
  // Log governance event
  await logGovernanceEvent({
    cooperative_id: coopId,
    event_type: 'member_joined',
    entity_type: 'membership',
    entity_id: membership.id,
    event_data: { customer_id: customerId, status: 'pending' },
  });
  
  return membership as CooperativeMembership;
}

export async function activateMembership(membershipId: string): Promise<CooperativeMembership> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('cooperative_memberships')
    .update({ status: 'active', joined_at: new Date().toISOString() })
    .eq('id', membershipId)
    .eq('status', 'pending')
    .select('*')
    .single();
  if (error) throw new Error(`Failed to activate membership: ${error.message}`);
  return data as CooperativeMembership;
}

export async function getMembership(customerId: string, coopId: string): Promise<CooperativeMembership | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('cooperative_memberships')
    .select('*')
    .eq('customer_id', customerId)
    .eq('cooperative_id', coopId)
    .maybeSingle();
  if (error) throw new Error(`Failed to get membership: ${error.message}`);
  return data as CooperativeMembership | null;
}

export async function listCooperativeMembers(coopId: string): Promise<CooperativeMembership[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('cooperative_memberships')
    .select('*')
    .eq('cooperative_id', coopId)
    .eq('status', 'active')
    .order('joined_at', { ascending: true });
  if (error) throw new Error(`Failed to list members: ${error.message}`);
  return (data || []) as CooperativeMembership[];
}

export async function leaveCooperative(membershipId: string): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase
    .from('cooperative_memberships')
    .update({ status: 'left', left_at: new Date().toISOString() })
    .eq('id', membershipId)
    .eq('status', 'active');
  if (error) throw new Error(`Failed to leave cooperative: ${error.message}`);
}
