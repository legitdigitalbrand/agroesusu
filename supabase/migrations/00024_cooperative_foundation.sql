-- ============================================================================
-- Migration 00024: Cooperative Foundation
-- 
-- Cooperatives, memberships, and configurable executive positions.
-- Also adds 2005 (Group Savings Pools) to the chart of accounts.
-- ============================================================================

BEGIN;

-- Add Group Savings Pools parent account (liability)
INSERT INTO public.accounts (account_code, account_type, account_category, name, description, is_system_account)
VALUES (
  '2005', 'liability', 'other', 'Group Savings Pools (Parent)',
  'Parent account for all group savings pool sub-accounts. Each group savings account gets its own child account. Increases when members contribute, decreases when payouts are made.',
  true
)
ON CONFLICT (account_code) DO NOTHING;

-- ============================================================================
-- Cooperatives
-- ============================================================================
CREATE TYPE cooperative_status AS ENUM ('draft', 'active', 'suspended', 'dissolved');
CREATE TYPE membership_status AS ENUM ('pending', 'active', 'suspended', 'expired', 'revoked', 'left');
CREATE TYPE membership_role AS ENUM ('member', 'executive', 'admin');

CREATE TABLE public.cooperatives (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_code       text NOT NULL UNIQUE,
  name                  text NOT NULL,
  description           text,
  
  config                jsonb NOT NULL DEFAULT '{
    "voting_quorum_percentage": 50,
    "voting_pass_percentage": 50,
    "min_members": 5,
    "membership_fee": 0,
    "meeting_frequency_days": 30,
    "allow_self_join": true
  }'::jsonb,
  
  status                cooperative_status NOT NULL DEFAULT 'draft',
  founded_date          date,
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  version               integer NOT NULL DEFAULT 1,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid REFERENCES auth.users(id),
  updated_by            uuid REFERENCES auth.users(id),
  
  CONSTRAINT chk_coop_name_not_empty CHECK (name <> ''),
  CONSTRAINT chk_coop_version_positive CHECK (version > 0)
);

CREATE SEQUENCE IF NOT EXISTS public.cooperative_ref_seq;

CREATE OR REPLACE FUNCTION public.generate_cooperative_code()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'COOP-' || lpad(nextval('cooperative_ref_seq')::text, 4, '0');
$$;

CREATE OR REPLACE FUNCTION public.set_cooperative_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.cooperative_code IS NULL OR NEW.cooperative_code = '' THEN
    NEW.cooperative_code := public.generate_cooperative_code();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_coop_set_code
  BEFORE INSERT ON public.cooperatives
  FOR EACH ROW EXECUTE FUNCTION public.set_cooperative_code();

CREATE TRIGGER trg_coop_updated_at
  BEFORE UPDATE ON public.cooperatives
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX idx_coops_status ON public.cooperatives(status);

-- ============================================================================
-- Cooperative Memberships
-- ============================================================================
CREATE TABLE public.cooperative_memberships (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id        uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  customer_id           uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  
  membership_number     text NOT NULL,
  status                membership_status NOT NULL DEFAULT 'pending',
  role                  membership_role NOT NULL DEFAULT 'member',
  
  joined_at             timestamptz,
  left_at               timestamptz,
  member_metadata       jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  version               integer NOT NULL DEFAULT 1,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT chk_cm_version_positive CHECK (version > 0),
  UNIQUE (cooperative_id, customer_id)
);

CREATE INDEX idx_cm_cooperative ON public.cooperative_memberships(cooperative_id);
CREATE INDEX idx_cm_customer ON public.cooperative_memberships(customer_id);
CREATE INDEX idx_cm_status ON public.cooperative_memberships(status);

-- ============================================================================
-- Executive Positions (configurable per cooperative)
-- ============================================================================
CREATE TABLE public.cooperative_executive_positions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id        uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  
  title                 text NOT NULL,
  position_description  text,
  sort_order            integer NOT NULL DEFAULT 0,
  
  held_by_membership_id uuid REFERENCES public.cooperative_memberships(id) ON DELETE SET NULL,
  appointed_at          timestamptz,
  term_ends_at          timestamptz,
  
  is_active             boolean NOT NULL DEFAULT true,
  
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT chk_ep_title_not_empty CHECK (title <> ''),
  UNIQUE (cooperative_id, title)
);

CREATE INDEX idx_ep_cooperative ON public.cooperative_executive_positions(cooperative_id);
CREATE INDEX idx_ep_active ON public.cooperative_executive_positions(is_active) WHERE is_active = true;

-- ============================================================================
-- Seed: Example Cooperative
-- ============================================================================
INSERT INTO public.cooperatives (name, description, status, founded_date, config)
VALUES (
  'AgroEsusu Farmers Cooperative',
  'A cooperative for agricultural savings and lending, serving smallholder farmers across Nigeria.',
  'active',
  '2026-01-15',
  '{
    "voting_quorum_percentage": 50,
    "voting_pass_percentage": 50,
    "min_members": 5,
    "membership_fee": 0,
    "meeting_frequency_days": 30,
    "allow_self_join": true,
    "cooperative_type": "agricultural"
  }'::jsonb
)
ON CONFLICT DO NOTHING;

-- Seed executive positions for the example cooperative
INSERT INTO public.cooperative_executive_positions (cooperative_id, title, position_description, sort_order)
SELECT c.id, p.title, p.desc_text, p.sort_order
FROM public.cooperatives c
CROSS JOIN (VALUES
  ('President', 'Leads the cooperative and chairs all meetings', 1),
  ('Vice President', 'Assists the President and acts in their absence', 2),
  ('Secretary', 'Maintains records, minutes, and official correspondence', 3),
  ('Treasurer', 'Manages cooperative finances and reports at meetings', 4)
) AS p(title, desc_text, sort_order)
WHERE c.cooperative_code = 'COOP-0001'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.cooperatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cooperative_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cooperative_executive_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY coops_read_all
  ON public.cooperatives FOR SELECT TO authenticated
  USING (status IN ('active', 'suspended'));

CREATE POLICY coops_read_staff_all
  ON public.cooperatives FOR SELECT TO authenticated
  USING (public.has_permission('admin.read') OR public.has_role('super_admin'));

CREATE POLICY cm_read_self
  ON public.cooperative_memberships FOR SELECT TO authenticated
  USING (customer_id IN (SELECT c.id FROM public.customers c WHERE c.auth_id = auth.uid()));

CREATE POLICY cm_read_staff
  ON public.cooperative_memberships FOR SELECT TO authenticated
  USING (public.has_permission('wallet.read') OR public.has_role('super_admin'));

CREATE POLICY cm_read_cooperative_members
  ON public.cooperative_memberships FOR SELECT TO authenticated
  USING (cooperative_id IN (
    SELECT m2.cooperative_id FROM public.cooperative_memberships m2
    JOIN public.customers c2 ON c2.id = m2.customer_id
    WHERE c2.auth_id = auth.uid() AND m2.status = 'active'
  ));

CREATE POLICY ep_read_all
  ON public.cooperative_executive_positions FOR SELECT TO authenticated
  USING (true);

COMMIT;
