-- ============================================================================
-- Migration 00011: Reconciliation Flags
-- 
-- Records discrepancies between our recorded wallet balance (sum of confirmed
-- transactions) and Safe Haven's actual account balance.
--
-- CRITICAL RULE: Reconciliation flags are NEVER auto-resolved by code.
-- All flags go to human review (compliance/finance staff).
-- Resolution happens through an approved manual workflow, not code.
--
-- Flag lifecycle:
--   open → investigating → resolved (with resolution_type + notes)
--   open → escalated (requires senior staff)
--
-- Resolution types:
--   matched      — After investigation, balances actually matched (false positive)
--   adjusted     — Manual balance adjustment was made (creates adjustment transaction)
--   write_off    — Discrepancy written off (with approval)
--   escalated    — Escalated to Safe Haven support or senior staff
--
-- DOWN PATH: DROP TABLE reconciliation_flags; DROP TYPE reconciliation_status;
--           DROP TYPE reconciliation_resolution;
-- ============================================================================

BEGIN;

CREATE TYPE reconciliation_status AS ENUM (
  'open',          -- Flag raised, not yet reviewed
  'investigating', -- Staff is investigating
  'resolved',      -- Flag resolved (resolution_type and notes filled)
  'escalated'      -- Escalated to Safe Haven or senior staff
);

CREATE TYPE reconciliation_resolution AS ENUM (
  'matched',       -- False positive — balances actually matched after investigation
  'adjusted',      -- Manual adjustment made (adjustment transaction created)
  'write_off',     -- Discrepancy written off with approval
  'escalated',     -- Escalated externally (Safe Haven support, CBN, etc.)
  'pending_sh'     -- Waiting for Safe Haven to respond
);

CREATE TABLE public.reconciliation_flags (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What's being reconciled
  wallet_id             uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  
  -- The discrepancy
  our_balance           numeric(15,2) NOT NULL,    -- Our cached balance at time of check
  sh_balance            numeric(15,2) NOT NULL,    -- Safe Haven's reported balance
  discrepancy_amount    numeric(15,2) NOT NULL,   -- our_balance - sh_balance (positive = we're ahead)
  discrepancy_direction text NOT NULL CHECK (discrepancy_direction IN ('positive', 'negative')),
  
  -- When
  checked_at            timestamptz NOT NULL DEFAULT now(),
  
  -- Resolution
  status                reconciliation_status NOT NULL DEFAULT 'open',
  resolution_type       reconciliation_resolution,
  resolution_notes      text,
  resolved_by           uuid REFERENCES auth.users(id),
  resolved_at           timestamptz,
  
  -- Investigation
  investigated_by       uuid REFERENCES auth.users(id),
  investigated_at       timestamptz,
  investigation_notes   text,
  
  -- Metadata
  sh_response_snapshot  jsonb,    -- Full Safe Haven response for audit
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Tracing
  correlation_id        uuid NOT NULL DEFAULT gen_random_uuid(),
  
  -- Timestamps
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT chk_discrepancy_nonzero CHECK (discrepancy_amount <> 0),
  CONSTRAINT chk_discrepancy_direction_consistent CHECK (
    (discrepancy_amount > 0 AND discrepancy_direction = 'positive') OR
    (discrepancy_amount < 0 AND discrepancy_direction = 'negative')
  )
);

-- Indexes
CREATE INDEX idx_recon_flags_wallet ON public.reconciliation_flags(wallet_id);
CREATE INDEX idx_recon_flags_status ON public.reconciliation_flags(status, created_at);
CREATE INDEX idx_recon_flags_created_at ON public.reconciliation_flags(created_at);
CREATE INDEX idx_recon_flags_correlation ON public.reconciliation_flags(correlation_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- Staff with 'audit.read' can read flags.
-- Staff with 'audit.read' + 'compliance.update' can update (investigate/resolve).
-- Service role creates flags (from reconciliation job).

ALTER TABLE public.reconciliation_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY recon_flags_read_staff
  ON public.reconciliation_flags FOR SELECT
  TO authenticated
  USING (public.has_permission('audit.read') OR public.has_role('super_admin'));

CREATE POLICY recon_flags_update_staff
  ON public.reconciliation_flags FOR UPDATE
  TO authenticated
  USING (public.has_permission('compliance.update') OR public.has_role('super_admin'))
  WITH CHECK (public.has_permission('compliance.update') OR public.has_role('super_admin'));

COMMIT;

-- ============================================================================
-- DOWN PATH:
--   DROP TABLE reconciliation_flags;
--   DROP TYPE reconciliation_resolution;
--   DROP TYPE reconciliation_status;
-- ============================================================================
