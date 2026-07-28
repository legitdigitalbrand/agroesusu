-- ============================================================================
-- Migration 00028: Cooperative Participation Signals
-- 
-- Daily pre-computed cooperative participation metrics per customer.
-- Phase 6's eligibility engine reads the latest signal to check
-- cooperative membership status and participation score.
-- 
-- This fulfills Phase 6's CooperativeParticipation contract:
--   status: 'verified' | 'not_member' | 'not_available'
--   cooperative_id?: string
--   membership_tenure_days?: number
--   participation_score?: number (0-100)
-- ============================================================================

BEGIN;

CREATE TABLE public.cooperative_participation_signals (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id           uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  cooperative_id        uuid REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  membership_id         uuid REFERENCES public.cooperative_memberships(id) ON DELETE CASCADE,
  
  -- Signal data (matches Phase 6's CooperativeParticipation interface)
  status                text NOT NULL DEFAULT 'not_member',  -- verified, not_member, not_available
  membership_tenure_days integer NOT NULL DEFAULT 0,
  participation_score    integer NOT NULL DEFAULT 0,          -- 0-100
  
  -- Components of the participation score
  meeting_attendance_rate numeric(5,2) NOT NULL DEFAULT 0,     -- % of meetings attended
  voting_participation_rate numeric(5,2) NOT NULL DEFAULT 0,  -- % of elections voted in
  group_savings_consistency_rate numeric(5,2) NOT NULL DEFAULT 0, -- % of on-time group contributions
  holds_executive_position boolean NOT NULL DEFAULT false,
  committees_count      integer NOT NULL DEFAULT 0,
  
  -- Snapshot date
  snapshot_date         date NOT NULL DEFAULT CURRENT_DATE,
  
  created_at            timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT chk_cps_score_range CHECK (participation_score >= 0 AND participation_score <= 100),
  UNIQUE (customer_id, snapshot_date)
);

CREATE INDEX idx_cps_customer ON public.cooperative_participation_signals(customer_id);
CREATE INDEX idx_cps_cooperative ON public.cooperative_participation_signals(cooperative_id);
CREATE INDEX idx_cps_snapshot ON public.cooperative_participation_signals(snapshot_date);
CREATE INDEX idx_cps_latest ON public.cooperative_participation_signals(customer_id, snapshot_date DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.cooperative_participation_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY cps_read_self ON public.cooperative_participation_signals FOR SELECT TO authenticated
  USING (customer_id IN (SELECT c.id FROM public.customers c WHERE c.auth_id = auth.uid()));
CREATE POLICY cps_read_staff ON public.cooperative_participation_signals FOR SELECT TO authenticated
  USING (public.has_permission('wallet.read') OR public.has_role('super_admin'));

COMMIT;
