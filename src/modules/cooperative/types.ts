// ============================================================================
// Cooperative Module — Type Definitions
// ============================================================================

export type CooperativeStatus = 'draft' | 'active' | 'suspended' | 'dissolved';
export type MembershipStatus = 'pending' | 'active' | 'suspended' | 'expired' | 'revoked' | 'left';
export type MembershipRole = 'member' | 'executive' | 'admin';
export type ElectionStatus = 'draft' | 'open' | 'closed' | 'cancelled';
export type VoteType = 'yes' | 'no' | 'abstain';
export type ResolutionStatus = 'proposed' | 'voting' | 'passed' | 'failed' | 'withdrawn';
export type MeetingStatus = 'scheduled' | 'held' | 'cancelled' | 'postponed';
export type GroupSavingsType = 'equal_share' | 'common_pool' | 'seasonal' | 'emergency_fund' | 'esusu';
export type GroupAccountStatus = 'pending' | 'active' | 'distributing' | 'completed' | 'closed' | 'suspended';
export type GroupMembershipStatus = 'invited' | 'active' | 'suspended' | 'left' | 'removed';
export type EsusuStatus = 'forming' | 'active' | 'completed' | 'cancelled' | 'suspended';
export type PayoutStatus = 'scheduled' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type MissedContributionPolicy = 'skip_turn' | 'penalty' | 'group_vote' | 'exclude_member';

export interface Cooperative {
  id: string;
  cooperative_code: string;
  name: string;
  description: string | null;
  config: Record<string, unknown>;
  status: CooperativeStatus;
  founded_date: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ExecutivePosition {
  id: string;
  cooperative_id: string;
  title: string;
  position_description: string | null;
  sort_order: number;
  held_by_membership_id: string | null;
  appointed_at: string | null;
  term_ends_at: string | null;
  is_active: boolean;
}

export interface CooperativeMembership {
  id: string;
  cooperative_id: string;
  customer_id: string;
  membership_number: string;
  status: MembershipStatus;
  role: MembershipRole;
  joined_at: string | null;
  left_at: string | null;
  member_metadata: Record<string, unknown>;
  created_at: string;
}

export interface Election {
  id: string;
  cooperative_id: string;
  position_id: string | null;
  title: string;
  description: string | null;
  opens_at: string;
  closes_at: string;
  status: ElectionStatus;
  winning_membership_id: string | null;
  total_votes: number;
  total_eligible: number;
}

export interface ElectionCandidate {
  id: string;
  election_id: string;
  membership_id: string;
  manifesto: string | null;
  vote_count: number;
}

export interface Vote {
  id: string;
  cooperative_id: string;
  election_id: string | null;
  resolution_id: string | null;
  voter_membership_id: string;
  vote: VoteType;
  voted_at: string;
}

export interface Resolution {
  id: string;
  cooperative_id: string;
  meeting_id: string | null;
  title: string;
  description: string | null;
  voting_opens_at: string | null;
  voting_closes_at: string | null;
  status: ResolutionStatus;
  votes_for: number;
  votes_against: number;
  votes_abstain: number;
  passed_at: string | null;
}

export interface Meeting {
  id: string;
  cooperative_id: string;
  title: string;
  meeting_type: string;
  description: string | null;
  scheduled_at: string;
  ended_at: string | null;
  location: string | null;
  status: MeetingStatus;
  minutes: string | null;
  attendance_count: number;
}

export interface GroupSavingsProduct {
  id: string;
  product_code: string;
  product_name: string;
  group_type: GroupSavingsType;
  description: string | null;
  contribution_frequency: string;
  min_contribution: number;
  max_contribution: number | null;
  fixed_contribution: number | null;
  min_members: number;
  max_members: number;
  payout_frequency: string;
  payout_method: string;
  interest_rate: number;
  cooperative_required: boolean;
  is_active: boolean;
  metadata: Record<string, unknown>;
}

export interface GroupSavingsAccount {
  id: string;
  account_number: string;
  product_id: string;
  cooperative_id: string | null;
  name: string;
  description: string | null;
  status: GroupAccountStatus;
  cycle_number: number;
  cycle_start_date: string | null;
  cycle_end_date: string | null;
  total_payouts: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface GroupSavingsMembership {
  id: string;
  group_account_id: string;
  customer_id: string;
  cooperative_membership_id: string | null;
  status: GroupMembershipStatus;
  joined_at: string;
  left_at: string | null;
  total_contributed: number;
  total_received: number;
  contributions_count: number;
  missed_contributions: number;
  last_contribution_at: string | null;
  rotation_position: number | null;
}

export interface EsusuGroup {
  id: string;
  group_account_id: string;
  contribution_amount: number;
  cycle_length_days: number;
  total_cycles: number;
  rotation_order: string[];
  current_cycle: number;
  current_position: number;
  missed_policy: MissedContributionPolicy;
  missed_penalty_rate: number;
  status: EsusuStatus;
  started_at: string | null;
  completed_at: string | null;
}

export interface EsusuPayout {
  id: string;
  esusu_group_id: string;
  cycle_number: number;
  recipient_customer_id: string;
  recipient_membership_id: string | null;
  total_pool_amount: number;
  payout_amount: number;
  penalty_deducted: number;
  scheduled_date: string;
  processed_at: string | null;
  status: PayoutStatus;
  financial_transaction_id: string | null;
}

export interface CooperativeParticipationSignal {
  id: string;
  customer_id: string;
  cooperative_id: string | null;
  membership_id: string | null;
  status: string;
  membership_tenure_days: number;
  participation_score: number;
  meeting_attendance_rate: number;
  voting_participation_rate: number;
  group_savings_consistency_rate: number;
  holds_executive_position: boolean;
  committees_count: number;
  snapshot_date: string;
}
