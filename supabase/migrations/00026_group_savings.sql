-- ============================================================================
-- Migration 00026: Group Savings Products & Accounts
-- 
-- Extends Phase 5's product config pattern with group-level savings:
-- Equal Share, Common Pool, Seasonal, Emergency Fund.
-- Each group savings account gets its own liability ledger account
-- under parent 2005 (Group Savings Pools).
-- ============================================================================

BEGIN;

CREATE TYPE group_savings_type AS ENUM (
  'equal_share',     -- Everyone contributes the same amount, pool is shared
  'common_pool',     -- Members contribute varying amounts to a shared pool
  'seasonal',        -- Aligned with agricultural seasons
  'emergency_fund',  -- For emergency needs
  'esusu'            -- Rotating savings (handled by esusu module)
);

CREATE TYPE group_account_status AS ENUM (
  'pending',     -- Created, not yet active
  'active',      -- Accepting contributions
  'distributing', -- Payout/distribution in progress
  'completed',   -- Cycle complete
  'closed',      -- Permanently closed
  'suspended'    -- Temporarily suspended
);

CREATE TABLE public.group_savings_products (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code           text NOT NULL UNIQUE,
  product_name           text NOT NULL,
  group_type            group_savings_type NOT NULL,
  description           text,
  
  -- Contribution rules
  contribution_frequency text NOT NULL DEFAULT 'monthly', -- daily, weekly, monthly
  min_contribution       numeric(15,2) NOT NULL DEFAULT 100,
  max_contribution       numeric(15,2),
  fixed_contribution     numeric(15,2),  -- If set, all members must contribute exactly this
  
  -- Group size
  min_members            integer NOT NULL DEFAULT 2,
  max_members            integer NOT NULL DEFAULT 50,
  
  -- Payout/distribution rules
  payout_frequency       text NOT NULL DEFAULT 'end_of_cycle',
  payout_method          text NOT NULL DEFAULT 'equal_split', -- equal_split, rotation, proportional
  
  -- Interest (optional — some group savings earn interest)
  interest_rate          numeric(8,4) NOT NULL DEFAULT 0,
  interest_method        text NOT NULL DEFAULT 'flat',
  
  -- Cooperative linkage
  cooperative_required   boolean NOT NULL DEFAULT false,
  
  is_active              boolean NOT NULL DEFAULT true,
  metadata               jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  version               integer NOT NULL DEFAULT 1,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  created_by             uuid REFERENCES auth.users(id),
  
  CONSTRAINT chk_gsp_name CHECK (product_name <> ''),
  CONSTRAINT chk_gsp_version CHECK (version > 0)
);

CREATE INDEX idx_gsp_type ON public.group_savings_products(group_type);
CREATE INDEX idx_gsp_active ON public.group_savings_products(is_active) WHERE is_active = true;

-- ============================================================================
-- Group Savings Accounts (the pool)
-- ============================================================================
CREATE TABLE public.group_savings_accounts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_number        text NOT NULL UNIQUE,           -- GRP-YYYY-NNNNNNNN
  product_id            uuid NOT NULL REFERENCES public.group_savings_products(id) ON DELETE RESTRICT,
  cooperative_id         uuid REFERENCES public.cooperatives(id) ON DELETE SET NULL,
  
  name                  text NOT NULL,
  description           text,
  
  status                group_account_status NOT NULL DEFAULT 'pending',
  
  -- Cycle tracking
  cycle_number          integer NOT NULL DEFAULT 1,
  cycle_start_date      date,
  cycle_end_date        date,
  
  -- Contribution schedule
  next_contribution_date date,
  
  -- Payout tracking
  next_payout_date       date,
  total_payouts         numeric(15,2) NOT NULL DEFAULT 0,
  
  -- Metadata
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Standard
  version               integer NOT NULL DEFAULT 1,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid REFERENCES auth.users(id),
  
  CONSTRAINT chk_gsa_name CHECK (name <> ''),
  CONSTRAINT chk_gsa_version CHECK (version > 0),
  CONSTRAINT chk_gsa_ref_format CHECK (account_number ~ '^GRP-[0-9]{4}-[0-9]{8}$')
);

CREATE SEQUENCE IF NOT EXISTS public.group_savings_ref_seq;

CREATE OR REPLACE FUNCTION public.generate_group_account_number()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'GRP-' || EXTRACT(YEAR FROM now())::text || '-' || 
         lpad(nextval('group_savings_ref_seq')::text, 8, '0');
$$;

CREATE OR REPLACE FUNCTION public.set_group_account_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.account_number IS NULL OR NEW.account_number = '' THEN
    NEW.account_number := public.generate_group_account_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_gsa_set_number
  BEFORE INSERT ON public.group_savings_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_group_account_number();

CREATE TRIGGER trg_gsa_updated_at
  BEFORE UPDATE ON public.group_savings_accounts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Auto-create ledger account for group savings pools
-- When status → active, create child liability account under 2005
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_group_savings_ledger_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_id uuid;
  v_account_code text;
BEGIN
  IF NEW.status = 'active' AND (
    OLD.status IS DISTINCT FROM 'active' OR TG_OP = 'INSERT'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.accounts 
      WHERE metadata->>'group_account_id' = NEW.id::text
        AND account_category = 'other'
    ) THEN
      SELECT id INTO v_parent_id 
      FROM public.accounts 
      WHERE account_code = '2005';
      
      v_account_code := '2005.' || NEW.account_number;
      
      INSERT INTO public.accounts (
        account_code, account_type, account_category, name,
        description, parent_account_id,
        is_system_account, is_active, metadata
      ) VALUES (
        v_account_code, 'liability', 'other',
        'Group Pool: ' || NEW.account_number,
        'Group savings pool for ' || NEW.name,
        v_parent_id,
        false, true,
        jsonb_build_object('group_account_id', NEW.id::text, 'cooperative_id', NEW.cooperative_id::text, 'product_id', NEW.product_id::text)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_gsa_create_ledger_account
  AFTER INSERT OR UPDATE OF status ON public.group_savings_accounts
  FOR EACH ROW EXECUTE FUNCTION public.create_group_savings_ledger_account();

-- ============================================================================
-- Function: Get the ledger account for a group savings account
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_group_savings_account_id(p_group_account_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.accounts
  WHERE metadata->>'group_account_id' = p_group_account_id::text
    AND account_category = 'other'
    AND account_type = 'liability'
    AND is_active = true
  LIMIT 1;
$$;

-- ============================================================================
-- Group Savings Memberships (who's in the group)
-- ============================================================================
CREATE TYPE group_membership_status AS ENUM ('invited', 'active', 'suspended', 'left', 'removed');

CREATE TABLE public.group_savings_memberships (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_account_id      uuid NOT NULL REFERENCES public.group_savings_accounts(id) ON DELETE CASCADE,
  customer_id           uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  cooperative_membership_id uuid REFERENCES public.cooperative_memberships(id) ON DELETE SET NULL,
  
  status                group_membership_status NOT NULL DEFAULT 'invited',
  joined_at             timestamptz NOT NULL DEFAULT now(),
  left_at               timestamptz,
  
  -- Contribution tracking
  total_contributed     numeric(15,2) NOT NULL DEFAULT 0,
  total_received        numeric(15,2) NOT NULL DEFAULT 0,
  contributions_count   integer NOT NULL DEFAULT 0,
  missed_contributions  integer NOT NULL DEFAULT 0,
  last_contribution_at  timestamptz,
  
  -- Esusu rotation position (for esusu groups)
  rotation_position     integer,
  
  -- Metadata
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE (group_account_id, customer_id)
);

CREATE INDEX idx_gsm_group ON public.group_savings_memberships(group_account_id);
CREATE INDEX idx_gsm_customer ON public.group_savings_memberships(customer_id);
CREATE INDEX idx_gsm_status ON public.group_savings_memberships(status);

-- ============================================================================
-- Seed: Group Savings Products
-- ============================================================================
INSERT INTO public.group_savings_products (
  product_code, product_name, group_type, description,
  contribution_frequency, min_contribution, fixed_contribution,
  min_members, max_members,
  payout_frequency, payout_method,
  interest_rate, cooperative_required,
  is_active, metadata
) VALUES
  (
    'EQUAL-SHARE', 'Equal Share Savings', 'equal_share',
    'All members contribute the same amount. Pool is split equally at the end of the cycle.',
    'monthly', 1000, 5000,
    2, 20,
    'end_of_cycle', 'equal_split',
    0, true,
    true, '{"color": "#3B82F6", "icon": "users"}'
  ),
  (
    'COMMON-POOL', 'Common Pool Savings', 'common_pool',
    'Members contribute varying amounts to a shared pool. Payouts are proportional to contributions.',
    'monthly', 500, NULL,
    3, 30,
    'end_of_cycle', 'proportional',
    2.0000, true,
    true, '{"color": "#10B981", "icon": "pool"}'
  ),
  (
    'SEASONAL', 'Seasonal Savings', 'seasonal',
    'Agricultural savings aligned with planting and harvest cycles. Contributions during growing season, payout at harvest.',
    'weekly', 500, NULL,
    3, 50,
    'end_of_cycle', 'equal_split',
    5.0000, true,
    true, '{"color": "#F59E0B", "icon": "leaf", "seasonal": true}'
  ),
  (
    'EMERGENCY-FUND', 'Emergency Fund', 'emergency_fund',
    'Emergency savings pool for unexpected needs. Members can request emergency withdrawals subject to group approval.',
    'monthly', 200, NULL,
    5, 100,
    'on_demand', 'equal_split',
    1.0000, false,
    true, '{"color": "#EF4444", "icon": "shield"}'
  );

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.group_savings_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_savings_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_savings_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY gsp_read_all ON public.group_savings_products FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY gsp_read_staff ON public.group_savings_products FOR SELECT TO authenticated USING (public.has_permission('admin.read') OR public.has_role('super_admin'));

CREATE POLICY gsa_read_members ON public.group_savings_accounts FOR SELECT TO authenticated
  USING (id IN (SELECT gsm.group_account_id FROM public.group_savings_memberships gsm JOIN public.customers c ON c.id = gsm.customer_id WHERE c.auth_id = auth.uid()));
CREATE POLICY gsa_read_staff ON public.group_savings_accounts FOR SELECT TO authenticated
  USING (public.has_permission('wallet.read') OR public.has_role('super_admin'));

CREATE POLICY gsm_read_self ON public.group_savings_memberships FOR SELECT TO authenticated
  USING (customer_id IN (SELECT c.id FROM public.customers c WHERE c.auth_id = auth.uid()));
CREATE POLICY gsm_read_group_members ON public.group_savings_memberships FOR SELECT TO authenticated
  USING (group_account_id IN (SELECT gsm2.group_account_id FROM public.group_savings_memberships gsm2 JOIN public.customers c2 ON c2.id = gsm2.customer_id WHERE c2.auth_id = auth.uid() AND gsm2.status = 'active'));
CREATE POLICY gsm_read_staff ON public.group_savings_memberships FOR SELECT TO authenticated
  USING (public.has_permission('wallet.read') OR public.has_role('super_admin'));

COMMIT;
