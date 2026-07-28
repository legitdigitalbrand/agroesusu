-- ============================================================================
-- Migration 00027: Esusu — Rotation Logic & Payouts
-- 
-- Esusu (rotating savings): N members contribute each cycle, one member
-- receives the full pool. Rotation order, cycle length, and missed-
-- contribution policy are configurable per Esusu group.
-- ============================================================================

BEGIN;

CREATE TYPE esusu_status AS ENUM (
  'forming',       -- Gathering members
  'active',        -- Rotation in progress
  'completed',     -- All members have received their payout
  'cancelled',     -- Cancelled before completion
  'suspended'      -- Temporarily suspended (e.g., missed contributions)
);

CREATE TYPE missed_contribution_policy AS ENUM (
  'skip_turn',       -- Member loses their turn, paid later or not at all
  'penalty',          -- Member keeps their turn but pays a penalty
  'group_vote',       -- Group votes on what to do
  'exclude_member'    -- Member is removed from the rotation
);

CREATE TYPE payout_status AS ENUM (
  'scheduled',     -- Payout is scheduled for this cycle
  'processing',    -- Payout in progress (Orchestrator called)
  'completed',     -- Payout completed (funds in wallet)
  'failed',        -- Payout failed (Orchestrator error)
  'cancelled'      -- Payout cancelled (e.g., member left)
);

-- ============================================================================
-- Esusu Groups (extends group_savings_accounts)
-- ============================================================================
CREATE TABLE public.esusu_groups (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_account_id      uuid NOT NULL REFERENCES public.group_savings_accounts(id) ON DELETE CASCADE,
  
  -- Esusu-specific config
  contribution_amount    numeric(15,2) NOT NULL,        -- Fixed per member per cycle
  cycle_length_days     integer NOT NULL DEFAULT 30,    -- How often contributions are due
  total_cycles          integer NOT NULL,               -- = number of members (each gets one payout)
  
  -- Rotation
  rotation_order        jsonb NOT NULL DEFAULT '[]'::jsonb,  -- Array of membership IDs in order
  current_cycle         integer NOT NULL DEFAULT 0,
  current_position      integer NOT NULL DEFAULT 0,     -- Index in rotation_order
  
  -- Missed contribution handling
  missed_policy         missed_contribution_policy NOT NULL DEFAULT 'penalty',
  missed_penalty_rate   numeric(5,2) NOT NULL DEFAULT 10.00,  -- % penalty for missed contribution
  
  -- Status
  status                esusu_status NOT NULL DEFAULT 'forming',
  started_at            timestamptz,
  completed_at          timestamptz,
  
  -- Standard
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
  version               integer NOT NULL DEFAULT 1,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid REFERENCES auth.users(id),
  
  CONSTRAINT chk_eg_contribution_positive CHECK (contribution_amount > 0),
  CONSTRAINT chk_eg_cycle_positive CHECK (cycle_length_days > 0),
  CONSTRAINT chk_eg_total_cycles CHECK (total_cycles >= 2),
  CONSTRAINT chk_eg_version CHECK (version > 0)
);

CREATE INDEX idx_eg_group_account ON public.esusu_groups(group_account_id);
CREATE INDEX idx_eg_status ON public.esusu_groups(status);

-- ============================================================================
-- Esusu Payouts (record of each rotation payout)
-- ============================================================================
CREATE TABLE public.esusu_payouts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  esusu_group_id        uuid NOT NULL REFERENCES public.esusu_groups(id) ON DELETE CASCADE,
  
  cycle_number          integer NOT NULL,                -- Which cycle this payout is for
  recipient_customer_id  uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  recipient_membership_id uuid REFERENCES public.group_savings_memberships(id) ON DELETE SET NULL,
  
  -- Amounts
  total_pool_amount     numeric(15,2) NOT NULL,          -- Total contributions for this cycle
  payout_amount         numeric(15,2) NOT NULL,          -- What recipient actually gets (after penalties)
  penalty_deducted      numeric(15,2) NOT NULL DEFAULT 0,
  
  -- Timing
  scheduled_date        date NOT NULL,
  processed_at          timestamptz,
  
  status                payout_status NOT NULL DEFAULT 'scheduled',
  
  -- Orchestrator reference
  financial_transaction_id uuid,                         -- FT ID from Orchestrator
  
  -- Standard
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT chk_ep_cycle_positive CHECK (cycle_number > 0),
  CONSTRAINT chk_ep_pool_positive CHECK (total_pool_amount > 0),
  UNIQUE (esusu_group_id, cycle_number)
);

CREATE INDEX idx_ep_group ON public.esusu_payouts(esusu_group_id);
CREATE INDEX idx_ep_status ON public.esusu_payouts(status);
CREATE INDEX idx_ep_scheduled ON public.esusu_payouts(scheduled_date) WHERE status = 'scheduled';

-- ============================================================================
-- Esusu Contribution Tracking (per member per cycle)
-- ============================================================================
CREATE TABLE public.esusu_contributions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  esusu_group_id        uuid NOT NULL REFERENCES public.esusu_groups(id) ON DELETE CASCADE,
  membership_id         uuid NOT NULL REFERENCES public.group_savings_memberships(id) ON DELETE CASCADE,
  customer_id           uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  
  cycle_number          integer NOT NULL,
  contribution_date     date NOT NULL,
  
  amount_due            numeric(15,2) NOT NULL,
  amount_paid           numeric(15,2) NOT NULL DEFAULT 0,
  penalty               numeric(15,2) NOT NULL DEFAULT 0,
  
  status                text NOT NULL DEFAULT 'pending',  -- pending, paid, missed, late
  
  paid_at               timestamptz,
  
  -- Orchestrator reference (for the contribution transaction)
  financial_transaction_id uuid,
  
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE (esusu_group_id, membership_id, cycle_number)
);

CREATE INDEX idx_ec_group ON public.esusu_contributions(esusu_group_id);
CREATE INDEX idx_ec_cycle ON public.esusu_contributions(cycle_number);
CREATE INDEX idx_ec_status ON public.esusu_contributions(status);
CREATE INDEX idx_ec_membership ON public.esusu_contributions(membership_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.esusu_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esusu_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esusu_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY eg_read_members ON public.esusu_groups FOR SELECT TO authenticated
  USING (group_account_id IN (SELECT gsm.group_account_id FROM public.group_savings_memberships gsm JOIN public.customers c ON c.id = gsm.customer_id WHERE c.auth_id = auth.uid()));
CREATE POLICY eg_read_staff ON public.esusu_groups FOR SELECT TO authenticated
  USING (public.has_permission('wallet.read') OR public.has_role('super_admin'));

CREATE POLICY ep_read_members ON public.esusu_payouts FOR SELECT TO authenticated
  USING (esusu_group_id IN (SELECT eg.id FROM public.esusu_groups eg JOIN public.group_savings_memberships gsm ON gsm.group_account_id = eg.group_account_id JOIN public.customers c ON c.id = gsm.customer_id WHERE c.auth_id = auth.uid()));
CREATE POLICY ep_read_staff ON public.esusu_payouts FOR SELECT TO authenticated
  USING (public.has_permission('wallet.read') OR public.has_role('super_admin'));

CREATE POLICY ec_read_members ON public.esusu_contributions FOR SELECT TO authenticated
  USING (customer_id IN (SELECT c.id FROM public.customers c WHERE c.auth_id = auth.uid()));
CREATE POLICY ec_read_group_members ON public.esusu_contributions FOR SELECT TO authenticated
  USING (esusu_group_id IN (SELECT eg.id FROM public.esusu_groups eg JOIN public.group_savings_memberships gsm ON gsm.group_account_id = eg.group_account_id JOIN public.customers c ON c.id = gsm.customer_id WHERE c.auth_id = auth.uid()));
CREATE POLICY ec_read_staff ON public.esusu_contributions FOR SELECT TO authenticated
  USING (public.has_permission('wallet.read') OR public.has_role('super_admin'));

COMMIT;
