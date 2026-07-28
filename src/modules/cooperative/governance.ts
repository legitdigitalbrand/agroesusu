// ============================================================================
// Governance — Elections, Votes, Resolutions, Meetings
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { logGovernanceEvent } from './audit';
import type { Election, Vote, Resolution, Meeting, VoteType } from './types';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// ============================================================================
// Elections
// ============================================================================
export async function createElection(
  cooperativeId: string,
  title: string,
  description: string,
  positionId: string | null,
  opensAt: Date,
  closesAt: Date,
): Promise<Election> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('cooperative_elections')
    .insert({
      cooperative_id: cooperativeId,
      position_id: positionId,
      title, description,
      opens_at: opensAt.toISOString(),
      closes_at: closesAt.toISOString(),
      status: 'draft',
    })
    .select('*')
    .single();
  if (error) throw new Error(`Failed to create election: ${error.message}`);
  
  await logGovernanceEvent({
    cooperative_id: cooperativeId,
    event_type: 'election_created',
    entity_type: 'election',
    entity_id: data.id,
    event_data: { title, position_id: positionId, opens_at: opensAt, closes_at: closesAt },
  });
  
  return data as Election;
}

export async function openElection(electionId: string): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase
    .from('cooperative_elections')
    .update({ status: 'open' })
    .eq('id', electionId)
    .eq('status', 'draft');
  if (error) throw new Error(`Failed to open election: ${error.message}`);
  
  const { data: election } = await supabase
    .from('cooperative_elections').select('cooperative_id').eq('id', electionId).single();
  if (election) {
    await logGovernanceEvent({
      cooperative_id: election.cooperative_id,
      event_type: 'election_opened',
      entity_type: 'election',
      entity_id: electionId,
    });
  }
}

export async function closeElection(electionId: string): Promise<Election | null> {
  const supabase = getServiceClient();
  
  // Get election with candidates
  const { data: election } = await supabase
    .from('cooperative_elections')
    .select('*')
    .eq('id', electionId)
    .eq('status', 'open')
    .single();
  if (!election) return null;
  
  // Get candidates with vote counts
  const { data: candidates } = await supabase
    .from('cooperative_election_candidates')
    .select('*')
    .eq('election_id', electionId)
    .order('vote_count', { ascending: false });
  
  const winner = candidates && candidates.length > 0 ? candidates[0] : null;
  const totalVotes = (candidates || []).reduce((sum, c) => sum + Number(c.vote_count), 0);
  
  const { data: updated, error } = await supabase
    .from('cooperative_elections')
    .update({
      status: 'closed',
      winning_membership_id: winner?.membership_id || null,
      total_votes: totalVotes,
    })
    .eq('id', electionId)
    .select('*')
    .single();
  if (error) throw new Error(`Failed to close election: ${error.message}`);
  
  // If winner, appoint to position
  if (winner && election.position_id) {
    await supabase
      .from('cooperative_executive_positions')
      .update({
        held_by_membership_id: winner.membership_id,
        appointed_at: new Date().toISOString(),
      })
      .eq('id', election.position_id);
  }
  
  await logGovernanceEvent({
    cooperative_id: election.cooperative_id,
    event_type: 'election_closed',
    entity_type: 'election',
    entity_id: electionId,
    event_data: { winner: winner?.membership_id, total_votes: totalVotes },
  });
  
  return updated as Election;
}

export async function listElections(cooperativeId: string): Promise<Election[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('cooperative_elections')
    .select('*')
    .eq('cooperative_id', cooperativeId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to list elections: ${error.message}`);
  return (data || []) as Election[];
}

// ============================================================================
// Votes
// ============================================================================
export async function castVote(
  cooperativeId: string,
  electionId: string,
  voterMembershipId: string,
  voteType: VoteType = 'yes',
  candidateMembershipId?: string,
): Promise<Vote> {
  const supabase = getServiceClient();
  
  // Verify election is open
  const { data: election } = await supabase
    .from('cooperative_elections')
    .select('status, closes_at')
    .eq('id', electionId)
    .single();
  if (!election || election.status !== 'open') throw new Error('Election is not open');
  if (new Date(election.closes_at) < new Date()) throw new Error('Voting period has closed');
  
  // Insert vote
  const { data: vote, error } = await supabase
    .from('cooperative_votes')
    .insert({
      cooperative_id: cooperativeId,
      election_id: electionId,
      voter_membership_id: voterMembershipId,
      vote: voteType,
    })
    .select('*')
    .single();
  if (error) {
    if (error.code === '23505') throw new Error('You have already voted in this election');
    throw new Error(`Failed to cast vote: ${error.message}`);
  }
  
  // Increment candidate vote count if voting yes for a candidate
  if (voteType === 'yes' && candidateMembershipId) {
    await supabase.rpc('increment_candidate_votes', {
      p_election_id: electionId,
      p_membership_id: candidateMembershipId,
    }).then(() => {}, () => {}); // Ignore errors if RPC doesn't exist
  }
  
  await logGovernanceEvent({
    cooperative_id: cooperativeId,
    event_type: 'vote_cast',
    entity_type: 'election',
    entity_id: electionId,
    event_data: { voter: voterMembershipId, vote: voteType, candidate: candidateMembershipId },
    actor_membership_id: voterMembershipId,
  });
  
  return vote as Vote;
}

// ============================================================================
// Resolutions
// ============================================================================
export async function createResolution(
  cooperativeId: string,
  title: string,
  description: string,
  proposedByMembershipId: string,
  meetingId?: string,
): Promise<Resolution> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('cooperative_resolutions')
    .insert({
      cooperative_id: cooperativeId,
      meeting_id: meetingId || null,
      title, description,
      status: 'proposed',
      proposed_by_membership_id: proposedByMembershipId,
    })
    .select('*')
    .single();
  if (error) throw new Error(`Failed to create resolution: ${error.message}`);
  
  await logGovernanceEvent({
    cooperative_id: cooperativeId,
    event_type: 'resolution_proposed',
    entity_type: 'resolution',
    entity_id: data.id,
    actor_membership_id: proposedByMembershipId,
    event_data: { title },
  });
  
  return data as Resolution;
}

export async function listResolutions(cooperativeId: string): Promise<Resolution[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('cooperative_resolutions')
    .select('*')
    .eq('cooperative_id', cooperativeId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to list resolutions: ${error.message}`);
  return (data || []) as Resolution[];
}

// ============================================================================
// Meetings
// ============================================================================
export async function createMeeting(
  cooperativeId: string,
  title: string,
  meetingType: string,
  scheduledAt: Date,
  description?: string,
  location?: string,
): Promise<Meeting> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('cooperative_meetings')
    .insert({
      cooperative_id: cooperativeId,
      title, meeting_type: meetingType,
      description: description || null,
      scheduled_at: scheduledAt.toISOString(),
      location: location || null,
      status: 'scheduled',
    })
    .select('*')
    .single();
  if (error) throw new Error(`Failed to create meeting: ${error.message}`);
  
  await logGovernanceEvent({
    cooperative_id: cooperativeId,
    event_type: 'meeting_scheduled',
    entity_type: 'meeting',
    entity_id: data.id,
    event_data: { title, scheduled_at: scheduledAt.toISOString() },
  });
  
  return data as Meeting;
}

export async function listMeetings(cooperativeId: string): Promise<Meeting[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('cooperative_meetings')
    .select('*')
    .eq('cooperative_id', cooperativeId)
    .order('scheduled_at', { ascending: false });
  if (error) throw new Error(`Failed to list meetings: ${error.message}`);
  return (data || []) as Meeting[];
}

export async function recordMeetingAttendance(
  meetingId: string,
  membershipId: string,
  attended: boolean,
  apology: boolean = false,
): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase
    .from('cooperative_meeting_attendance')
    .upsert({
      meeting_id: meetingId,
      membership_id: membershipId,
      attended, apology,
    });
  if (error) throw new Error(`Failed to record attendance: ${error.message}`);
}
