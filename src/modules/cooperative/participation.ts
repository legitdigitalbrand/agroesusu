// ============================================================================
// Cooperative Participation Signal
// 
// FULFILLS Phase 6's CooperativeParticipation contract:
//   status: 'verified' | 'not_member' | 'not_available'
//   cooperative_id?: string
//   membership_tenure_days?: number
//   participation_score?: number (0-100)
// 
// Computes the signal from:
//   - Membership status and tenure
//   - Meeting attendance rate
//   - Voting participation rate
//   - Group savings contribution consistency
//   - Executive position held (bonus)
// 
// Phase 6's eligibility engine reads the latest signal from
// cooperative_participation_signals table.
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import type { CooperativeParticipationSignal } from './types';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Compute the participation score (0-100) from component metrics.
 * 
 * Score breakdown:
 *   Base: 20 (just being an active member)
 *   + tenure component: min(30, tenure_days / 365 * 30) — max 30 for 1+ year
 *   + attendance: attendance_rate * 20 — max 20
 *   + voting: voting_rate * 15 — max 15
 *   + group savings consistency: consistency_rate * 10 — max 10
 *   + executive position: 5 (if held)
 *   Total: max 100
 */
export function computeParticipationScore(
  tenureDays: number,
  attendanceRate: number,    // 0-100
  votingRate: number,        // 0-100
  groupSavingsConsistency: number, // 0-100
  holdsExecutivePosition: boolean,
): number {
  let score = 20; // Base for being a member
  score += Math.min(30, (tenureDays / 365) * 30);
  score += (attendanceRate / 100) * 20;
  score += (votingRate / 100) * 15;
  score += (groupSavingsConsistency / 100) * 10;
  if (holdsExecutivePosition) score += 5;
  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Compute and store the cooperative participation signal for a customer.
 * Called daily by cron or on-demand.
 */
export async function computeParticipationSignal(
  customerId: string,
): Promise<CooperativeParticipationSignal | null> {
  const supabase = getServiceClient();

  // 1. Get the customer's active cooperative membership
  const { data: membership } = await supabase
    .from('cooperative_memberships')
    .select('id, cooperative_id, status, joined_at')
    .eq('customer_id', customerId)
    .eq('status', 'active')
    .maybeSingle();

  if (!membership) {
    // Customer is not a cooperative member
    const { data: existingSignal } = await supabase
      .from('cooperative_participation_signals')
      .select('id')
      .eq('customer_id', customerId)
      .eq('snapshot_date', new Date().toISOString().split('T')[0])
      .maybeSingle();
    
    if (existingSignal) {
      return existingSignal as CooperativeParticipationSignal;
    }

    const { data: signal } = await supabase
      .from('cooperative_participation_signals')
      .insert({
        customer_id: customerId,
        status: 'not_member',
        membership_tenure_days: 0,
        participation_score: 0,
        meeting_attendance_rate: 0,
        voting_participation_rate: 0,
        group_savings_consistency_rate: 0,
        holds_executive_position: false,
        committees_count: 0,
        snapshot_date: new Date().toISOString().split('T')[0],
      })
      .select('*')
      .single();
    return signal as CooperativeParticipationSignal;
  }

  // 2. Compute membership tenure
  const joinedAt = membership.joined_at ? new Date(membership.joined_at) : new Date();
  const tenureDays = Math.floor((Date.now() - joinedAt.getTime()) / (1000 * 60 * 60 * 24));

  // 3. Compute meeting attendance rate
  const { data: meetings } = await supabase
    .from('cooperative_meetings')
    .select('id')
    .eq('cooperative_id', membership.cooperative_id)
    .eq('status', 'held')
    .gte('scheduled_at', membership.joined_at || new Date().toISOString());
  
  const totalMeetings = (meetings || []).length;
  let meetingsAttended = 0;
  
  if (totalMeetings > 0) {
    const meetingIds = (meetings || []).map(m => m.id);
    const { data: attendance } = await supabase
      .from('cooperative_meeting_attendance')
      .select('id')
      .eq('membership_id', membership.id)
      .eq('attended', true)
      .in('meeting_id', meetingIds);
    meetingsAttended = (attendance || []).length;
  }
  
  const attendanceRate = totalMeetings > 0 ? (meetingsAttended / totalMeetings) * 100 : 100;

  // 4. Compute voting participation rate
  const { data: elections } = await supabase
    .from('cooperative_elections')
    .select('id')
    .eq('cooperative_id', membership.cooperative_id)
    .in('status', ['closed', 'open'])
    .gte('opens_at', membership.joined_at || new Date().toISOString());
  
  const totalElections = (elections || []).length;
  const { data: votesCast } = await supabase
    .from('cooperative_votes')
    .select('id')
    .eq('voter_membership_id', membership.id);
  const votesCount = (votesCast || []).length;
  
  const votingRate = totalElections > 0 ? (Math.min(votesCount, totalElections) / totalElections) * 100 : 100;

  // 5. Compute group savings consistency
  const { data: groupMemberships } = await supabase
    .from('group_savings_memberships')
    .select('contributions_count, missed_contributions')
    .eq('customer_id', customerId)
    .eq('status', 'active');
  
  let totalContributions = 0;
  let totalMissed = 0;
  for (const gm of (groupMemberships || [])) {
    totalContributions += Number(gm.contributions_count);
    totalMissed += Number(gm.missed_contributions);
  }
  
  const totalDue = totalContributions + totalMissed;
  const groupSavingsConsistency = totalDue > 0 ? ((totalDue - totalMissed) / totalDue) * 100 : 100;

  // 6. Check if holds executive position
  const { data: execPosition } = await supabase
    .from('cooperative_executive_positions')
    .select('id')
    .eq('held_by_membership_id', membership.id)
    .eq('is_active', true)
    .maybeSingle();
  
  const holdsExecutivePosition = !!execPosition;

  // 7. Count committees
  const { count: committeesCount } = await supabase
    .from('cooperative_committee_members')
    .select('id', { count: 'exact', head: true })
    .eq('membership_id', membership.id)
    .is('left_at', null);
  
  // 8. Compute participation score
  const participationScore = computeParticipationScore(
    tenureDays, attendanceRate, votingRate, groupSavingsConsistency, holdsExecutivePosition
  );

  // 9. Store the signal (upsert for today's snapshot)
  const { data: signal, error } = await supabase
    .from('cooperative_participation_signals')
    .upsert({
      customer_id: customerId,
      cooperative_id: membership.cooperative_id,
      membership_id: membership.id,
      status: 'verified',
      membership_tenure_days: tenureDays,
      participation_score: participationScore,
      meeting_attendance_rate: Math.round(attendanceRate * 100) / 100,
      voting_participation_rate: Math.round(votingRate * 100) / 100,
      group_savings_consistency_rate: Math.round(groupSavingsConsistency * 100) / 100,
      holds_executive_position: holdsExecutivePosition,
      committees_count: committeesCount || 0,
      snapshot_date: new Date().toISOString().split('T')[0],
    })
    .select('*')
    .single();
  
  if (error) throw new Error(`Failed to store participation signal: ${error.message}`);
  return signal as CooperativeParticipationSignal;
}

/**
 * Get the latest cooperative participation signal for a customer.
 * This is what Phase 6's eligibility engine reads.
 */
export async function getLatestParticipationSignal(
  customerId: string,
): Promise<CooperativeParticipationSignal | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('cooperative_participation_signals')
    .select('*')
    .eq('customer_id', customerId)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to get participation signal: ${error.message}`);
  return data as CooperativeParticipationSignal | null;
}

/**
 * Get the cooperative participation data for Phase 6's eligibility engine.
 * This is the concrete implementation of the CooperativeParticipation interface
 * that replaces the stub in Phase 6's eligibility.ts.
 * 
 * Returns exactly the shape Phase 6 expects:
 *   status: 'verified' | 'not_member' | 'not_available'
 *   cooperative_id?: string
 *   membership_tenure_days?: number
 *   participation_score?: number (0-100)
 */
export async function getCooperativeParticipation(customerId: string): Promise<{
  status: 'verified' | 'not_member' | 'not_available';
  cooperative_id?: string;
  membership_tenure_days?: number;
  participation_score?: number;
}> {
  let signal = await getLatestParticipationSignal(customerId);
  
  if (!signal) {
    // No signal exists yet — compute on demand
    signal = await computeParticipationSignal(customerId);
  }
  
  if (!signal) {
    return { status: 'not_available' };
  }
  
  return {
    status: signal.status as 'verified' | 'not_member' | 'not_available',
    cooperative_id: signal.cooperative_id || undefined,
    membership_tenure_days: signal.membership_tenure_days,
    participation_score: signal.participation_score,
  };
}
