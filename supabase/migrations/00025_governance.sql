-- ============================================================================
-- Migration 00025: Governance — Elections, Votes, Meetings, Resolutions
-- 
-- Governance actions are immutable historical records. Corrections are
-- new records referencing the original, not edits.
-- ============================================================================

BEGIN;

CREATE TYPE election_status AS ENUM ('draft', 'open', 'closed', 'cancelled');
CREATE TYPE vote_type AS ENUM ('yes', 'no', 'abstain');
CREATE TYPE resolution_status AS ENUM ('proposed', 'voting', 'passed', 'failed', 'withdrawn');
CREATE TYPE meeting_status AS ENUM ('scheduled', 'held', 'cancelled', 'postponed');

-- ============================================================================
-- Elections (for executive positions)
-- ============================================================================
CREATE TABLE public.cooperative_elections (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id        uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  position_id           uuid REFERENCES public.cooperative_executive_positions(id) ON DELETE SET NULL,
  
  title                 text NOT NULL,
  description           text,
  
  -- Election period
  opens_at              timestamptz NOT NULL,
  closes_at             timestamptz NOT NULL,
  
  status                election_status NOT NULL DEFAULT 'draft',
  
  -- Results (computed when closed)
  winning_membership_id uuid REFERENCES public.cooperative_memberships(id) ON DELETE SET NULL,
  total_votes           integer NOT NULL DEFAULT 0,
  total_eligible        integer NOT NULL DEFAULT 0,
  
  -- Standard
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid REFERENCES auth.users(id),
  
  CONSTRAINT chk_election_dates CHECK (closes_at > opens_at),
  CONSTRAINT chk_election_title CHECK (title <> '')
);

CREATE INDEX idx_elec_cooperative ON public.cooperative_elections(cooperative_id);
CREATE INDEX idx_elec_status ON public.cooperative_elections(status);
CREATE INDEX idx_elec_dates ON public.cooperative_elections(opens_at, closes_at);

-- ============================================================================
-- Election Candidates
-- ============================================================================
CREATE TABLE public.cooperative_election_candidates (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id           uuid NOT NULL REFERENCES public.cooperative_elections(id) ON DELETE CASCADE,
  membership_id         uuid NOT NULL REFERENCES public.cooperative_memberships(id) ON DELETE CASCADE,
  
  manifesto             text,
  vote_count            integer NOT NULL DEFAULT 0,
  
  created_at            timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE (election_id, membership_id)
);

CREATE INDEX idx_ec_election ON public.cooperative_election_candidates(election_id);

-- ============================================================================
-- Votes (for elections and resolutions)
-- ============================================================================
CREATE TABLE public.cooperative_votes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id        uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  
  -- What is being voted on
  election_id           uuid REFERENCES public.cooperative_elections(id) ON DELETE CASCADE,
  resolution_id         uuid,  -- FK added after resolutions table
  
  -- Who voted
  voter_membership_id   uuid NOT NULL REFERENCES public.cooperative_memberships(id) ON DELETE RESTRICT,
  
  -- The vote
  vote                  vote_type NOT NULL,
  
  -- Audit
  voted_at              timestamptz NOT NULL DEFAULT now(),
  
  -- One vote per person per election/resolution
  CONSTRAINT chk_vote_target CHECK (
    (election_id IS NOT NULL AND resolution_id IS NULL) OR
    (election_id IS NULL AND resolution_id IS NULL) OR
    (election_id IS NULL AND resolution_id IS NOT NULL)
  ),
  UNIQUE (election_id, voter_membership_id),
  UNIQUE (resolution_id, voter_membership_id)
);

CREATE INDEX idx_votes_election ON public.cooperative_votes(election_id) WHERE election_id IS NOT NULL;
CREATE INDEX idx_votes_resolution ON public.cooperative_votes(resolution_id) WHERE resolution_id IS NOT NULL;
CREATE INDEX idx_votes_cooperative ON public.cooperative_votes(cooperative_id);

-- ============================================================================
-- Committees
-- ============================================================================
CREATE TABLE public.cooperative_committees (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id        uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  
  name                  text NOT NULL,
  description           text,
  purpose               text,
  
  is_active             boolean NOT NULL DEFAULT true,
  
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT chk_comm_name CHECK (name <> ''),
  UNIQUE (cooperative_id, name)
);

CREATE TABLE public.cooperative_committee_members (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  committee_id          uuid NOT NULL REFERENCES public.cooperative_committees(id) ON DELETE CASCADE,
  membership_id         uuid NOT NULL REFERENCES public.cooperative_memberships(id) ON DELETE CASCADE,
  role_in_committee     text NOT NULL DEFAULT 'member',
  
  joined_at             timestamptz NOT NULL DEFAULT now(),
  left_at               timestamptz,
  
  UNIQUE (committee_id, membership_id)
);

CREATE INDEX idx_comm_members ON public.cooperative_committee_members(committee_id);

-- ============================================================================
-- Meetings
-- ============================================================================
CREATE TABLE public.cooperative_meetings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id        uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  
  title                 text NOT NULL,
  meeting_type          text NOT NULL DEFAULT 'general',  -- general, emergency, annual, committee
  description           text,
  
  scheduled_at          timestamptz NOT NULL,
  ended_at              timestamptz,
  location              text,
  
  status                meeting_status NOT NULL DEFAULT 'scheduled',
  
  -- Minutes
  minutes               text,
  attendance_count      integer NOT NULL DEFAULT 0,
  
  -- Standard
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid REFERENCES auth.users(id),
  
  CONSTRAINT chk_meeting_title CHECK (title <> '')
);

CREATE INDEX idx_meetings_cooperative ON public.cooperative_meetings(cooperative_id);
CREATE INDEX idx_meetings_status ON public.cooperative_meetings(status);
CREATE INDEX idx_meetings_scheduled ON public.cooperative_meetings(scheduled_at);

-- Meeting attendance
CREATE TABLE public.cooperative_meeting_attendance (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id            uuid NOT NULL REFERENCES public.cooperative_meetings(id) ON DELETE CASCADE,
  membership_id         uuid NOT NULL REFERENCES public.cooperative_memberships(id) ON DELETE CASCADE,
  
  attended              boolean NOT NULL DEFAULT false,
  apology               boolean NOT NULL DEFAULT false,
  
  created_at            timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE (meeting_id, membership_id)
);

-- ============================================================================
-- Resolutions
-- ============================================================================
CREATE TABLE public.cooperative_resolutions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id        uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  meeting_id            uuid REFERENCES public.cooperative_meetings(id) ON DELETE SET NULL,
  
  title                 text NOT NULL,
  description           text,
  
  -- Voting period (if not decided in a meeting)
  voting_opens_at       timestamptz,
  voting_closes_at      timestamptz,
  
  status                resolution_status NOT NULL DEFAULT 'proposed',
  
  -- Results
  votes_for             integer NOT NULL DEFAULT 0,
  votes_against         integer NOT NULL DEFAULT 0,
  votes_abstain         integer NOT NULL DEFAULT 0,
  
  proposed_by_membership_id uuid REFERENCES public.cooperative_memberships(id) ON DELETE SET NULL,
  
  -- Standard
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  passed_at             timestamptz,
  
  CONSTRAINT chk_res_title CHECK (title <> '')
);

-- Add FK for votes → resolutions (deferred because resolutions table didn't exist yet)
ALTER TABLE public.cooperative_votes
  ADD CONSTRAINT cv_resolution_fk
  FOREIGN KEY (resolution_id) REFERENCES public.cooperative_resolutions(id) ON DELETE CASCADE;

CREATE INDEX idx_res_cooperative ON public.cooperative_resolutions(cooperative_id);
CREATE INDEX idx_res_status ON public.cooperative_resolutions(status);

-- ============================================================================
-- Governance Audit Log (append-only, hash-chained, immutable)
-- ============================================================================
CREATE TYPE governance_event_type AS ENUM (
  'election_created',
  'election_opened',
  'election_closed',
  'vote_cast',
  'candidate_nominated',
  'position_appointed',
  'position_revoked',
  'resolution_proposed',
  'resolution_passed',
  'resolution_failed',
  'meeting_scheduled',
  'meeting_held',
  'meeting_cancelled',
  'member_joined',
  'member_left',
  'member_suspended',
  'committee_created',
  'committee_member_added',
  'committee_member_removed'
);

CREATE TABLE public.governance_audit_log (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id        uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  
  event_type            governance_event_type NOT NULL,
  
  -- What entity does this event relate to?
  entity_type           text NOT NULL,            -- 'election', 'resolution', 'meeting', 'position', 'membership', 'committee'
  entity_id             uuid,                     -- ID of the related entity
  
  -- Who performed the action
  actor_membership_id   uuid REFERENCES public.cooperative_memberships(id) ON DELETE SET NULL,
  actor_user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- What happened (full details)
  event_data            jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Hash chain (tamper-evident)
  previous_hash         text,
  event_hash            text NOT NULL,
  
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Append-only: no UPDATE or DELETE
CREATE OR REPLACE FUNCTION public.prevent_governance_log_modification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Governance audit log is append-only. Modification not permitted.';
END;
$$;

CREATE TRIGGER trg_gov_no_update
  BEFORE UPDATE ON public.governance_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_governance_log_modification();

CREATE TRIGGER trg_gov_no_delete
  BEFORE DELETE ON public.governance_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_governance_log_modification();

CREATE INDEX idx_gov_cooperative ON public.governance_audit_log(cooperative_id);
CREATE INDEX idx_gov_event_type ON public.governance_audit_log(event_type);
CREATE INDEX idx_gov_entity ON public.governance_audit_log(entity_type, entity_id) WHERE entity_id IS NOT NULL;
CREATE INDEX idx_gov_created_at ON public.governance_audit_log(created_at);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.cooperative_elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cooperative_election_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cooperative_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cooperative_committees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cooperative_committee_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cooperative_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cooperative_meeting_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cooperative_resolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_audit_log ENABLE ROW LEVEL SECURITY;

-- Members of a cooperative can see its governance records
CREATE POLICY gov_read_coop_members ON public.cooperative_elections FOR SELECT TO authenticated
  USING (cooperative_id IN (SELECT m.cooperative_id FROM public.cooperative_memberships m JOIN public.customers c ON c.id = m.customer_id WHERE c.auth_id = auth.uid() AND m.status = 'active'));
CREATE POLICY gov_read_staff ON public.cooperative_elections FOR SELECT TO authenticated
  USING (public.has_permission('admin.read') OR public.has_role('super_admin'));

CREATE POLICY gc_read_coop_members ON public.cooperative_election_candidates FOR SELECT TO authenticated
  USING (election_id IN (SELECT id FROM public.cooperative_elections));
CREATE POLICY gc_read_staff ON public.cooperative_election_candidates FOR SELECT TO authenticated
  USING (public.has_permission('admin.read') OR public.has_role('super_admin'));

CREATE POLICY votes_read_coop_members ON public.cooperative_votes FOR SELECT TO authenticated
  USING (cooperative_id IN (SELECT m.cooperative_id FROM public.cooperative_memberships m JOIN public.customers c ON c.id = m.customer_id WHERE c.auth_id = auth.uid() AND m.status = 'active'));
CREATE POLICY votes_read_staff ON public.cooperative_votes FOR SELECT TO authenticated
  USING (public.has_permission('admin.read') OR public.has_role('super_admin'));

CREATE POLICY comm_read_all ON public.cooperative_committees FOR SELECT TO authenticated
  USING (cooperative_id IN (SELECT m.cooperative_id FROM public.cooperative_memberships m JOIN public.customers c ON c.id = m.customer_id WHERE c.auth_id = auth.uid() AND m.status = 'active'));
CREATE POLICY comm_read_staff ON public.cooperative_committees FOR SELECT TO authenticated
  USING (public.has_permission('admin.read') OR public.has_role('super_admin'));

CREATE POLICY cm_read_all ON public.cooperative_committee_members FOR SELECT TO authenticated USING (true);
CREATE POLICY meetings_read_all ON public.cooperative_meetings FOR SELECT TO authenticated USING (true);
CREATE POLICY ma_read_all ON public.cooperative_meeting_attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY res_read_all ON public.cooperative_resolutions FOR SELECT TO authenticated USING (true);
CREATE POLICY gal_read_all ON public.governance_audit_log FOR SELECT TO authenticated USING (true);

COMMIT;
