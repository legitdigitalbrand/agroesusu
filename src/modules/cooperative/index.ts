/**
 * Cooperative Governance & Group Savings Module
 * 
 * Phase 7: Makes cooperatives real — memberships, governance (elections,
 * resolutions, meetings), group savings (Equal Share, Common Pool, Seasonal,
 * Emergency Fund), and Esusu rotation mechanics.
 * 
 * Fulfills Phase 6's CooperativeParticipation contract with real data.
 * 
 * Public API:
 *   - Membership: listCooperatives, getCooperative, joinCooperative, activateMembership, getMembership, listCooperativeMembers, leaveCooperative, getExecutivePositions
 *   - Governance: createElection, openElection, closeElection, listElections, castVote, createResolution, listResolutions, createMeeting, listMeetings, recordMeetingAttendance
 *   - Group Savings: listGroupSavingsProducts, createGroupSavingsAccount, activateGroupAccount, getGroupSavingsAccount, getGroupPoolBalance, joinGroupSavings, getGroupMembers, contributeToGroup, processGroupPayout
 *   - Esusu: createEsusuGroup, startEsusu, getEsusuGroup, getEsusuByGroupAccount, getEsusuPayouts, processNextPayout, processEsusuPayouts
 *   - Participation: computeParticipationSignal, getLatestParticipationSignal, getCooperativeParticipation
 *   - Audit: logGovernanceEvent, getGovernanceLog
 */

// Membership
export { listCooperatives, getCooperative, joinCooperative, activateMembership, getMembership, listCooperativeMembers, leaveCooperative, getExecutivePositions } from './membership';

// Governance
export { createElection, openElection, closeElection, listElections, castVote, createResolution, listResolutions, createMeeting, listMeetings, recordMeetingAttendance } from './governance';

// Group Savings
export { listGroupSavingsProducts, createGroupSavingsAccount, activateGroupAccount, getGroupSavingsAccount, getGroupPoolBalance, joinGroupSavings, getGroupMembers, contributeToGroup, processGroupPayout } from './group-savings';

// Esusu
export { createEsusuGroup, startEsusu, getEsusuGroup, getEsusuByGroupAccount, getEsusuPayouts, processNextPayout, processEsusuPayouts } from './esusu';

// Participation Signal (Phase 6 contract fulfillment)
export { computeParticipationSignal, getLatestParticipationSignal, getCooperativeParticipation, computeParticipationScore } from './participation';

// Audit
export { logGovernanceEvent, getGovernanceLog } from './audit';

// Types
export type {
  CooperativeStatus, MembershipStatus, MembershipRole, ElectionStatus, VoteType,
  ResolutionStatus, MeetingStatus, GroupSavingsType, GroupAccountStatus,
  GroupMembershipStatus, EsusuStatus, PayoutStatus, MissedContributionPolicy,
  Cooperative, CooperativeMembership, ExecutivePosition, Election, ElectionCandidate,
  Vote, Resolution, Meeting, GroupSavingsProduct, GroupSavingsAccount,
  GroupSavingsMembership, EsusuGroup, EsusuPayout, CooperativeParticipationSignal,
} from './types';
