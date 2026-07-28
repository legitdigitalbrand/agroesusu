-- ============================================================================
-- Migration 00004: Customer Skeleton (Identity Domain)
-- 
-- Creates the customers table — the foundational entity from Volume 05 Part 5.3.
-- This is a SKELETON: core lifecycle + identity fields only.
-- Personal profile, contact info, address, employment, next-of-kin, 
-- identity references, and communication preferences are deferred to Phase 2+.
--
-- Key decisions:
--   1. Customer identity uses UUID (auth.users.id) as the link to Supabase Auth.
--   2. CustomerNumber follows the canonical format: CUS-YYYY-NNNNNN (Part 5.2).
--   3. BVN and NIN fields are included as nullable placeholders (Part 5.2/5.3)
--      per the CTO constraint: "BVN/NIN fields should be anticipated in the 
--      Identity schema shape even though verification logic isn't built yet."
--   4. Customer lifecycle states from Volume 05 Part 5.3 are implemented as enum.
--   5. Version column supports optimistic concurrency (Part 5.2 standard metadata).
--
-- DOWN PATH: DROP TABLE customers; DROP TYPE customer_status; DROP TYPE customer_type;
--           DROP FUNCTION generate_customer_number(); DROP TRIGGER customers_updated_at;
-- ============================================================================

BEGIN;

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

CREATE TYPE customer_type AS ENUM (
  'individual',
  'cooperative',
  'sme',
  'corporate'     -- future
);

CREATE TYPE customer_status AS ENUM (
  'prospective',         -- Initial state, not yet registered
  'registered',          -- Account created, not verified
  'email_verified',      -- Email confirmed
  'phone_verified',      -- Phone confirmed
  'identity_verified',   -- BVN/NIN verified
  'membership_approved', -- Approved by cooperative
  'active',              -- Fully active
  'dormant',             -- No activity for defined period
  'suspended',           -- Temporarily deactivated
  'closed'               -- Permanently closed
);

CREATE TYPE preferred_channel AS ENUM (
  'email',
  'sms',
  'whatsapp',
  'push',
  'in_app'
);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Generate sequential customer number in format CUS-YYYY-NNNNNN
-- Uses a sequence to ensure uniqueness and ordering
CREATE SEQUENCE IF NOT EXISTS public.customer_number_seq;

CREATE OR REPLACE FUNCTION public.generate_customer_number()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'CUS-' || EXTRACT(YEAR FROM now())::text || '-' || 
         lpad(nextval('customer_number_seq')::text, 6, '0');
$$;

-- ============================================================================
-- CUSTOMERS TABLE
-- ============================================================================

CREATE TABLE public.customers (
  -- Identity
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id                   uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_number           text NOT NULL UNIQUE,    -- CUS-2026-000001
  customer_type             customer_type NOT NULL DEFAULT 'individual',
  
  -- Lifecycle
  status                    customer_status NOT NULL DEFAULT 'prospective',
  registration_date         timestamptz NOT NULL DEFAULT now(),
  activation_date           timestamptz,              -- set when status → active
  
  -- Basic profile (skeleton — full profile in Phase 2+)
  full_name                 text NOT NULL,
  email                     text UNIQUE,              -- canonical Email value object (Part 5.2)
  phone                     text,                     -- canonical Phone value object (Part 5.2)
  phone_country_code        text DEFAULT '+234',
  phone_verified            boolean NOT NULL DEFAULT false,
  email_verified            boolean NOT NULL DEFAULT false,
  
  -- Identity placeholders (verification logic deferred to Compliance domain)
  bvn                       text,                     -- 11 digits, verified in Phase 2+
  nin                       text,                     -- 11 digits, verified in Phase 2+
  
  -- Preferences (skeleton — full preferences in Phase 2+)
  preferred_language        text NOT NULL DEFAULT 'en',
  preferred_channel         preferred_channel NOT NULL DEFAULT 'in_app',
  
  -- Standard metadata (Part 5.2 canonical metadata model)
  version                   integer NOT NULL DEFAULT 1,  -- optimistic concurrency
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  created_by                uuid REFERENCES auth.users(id),
  updated_by                uuid REFERENCES auth.users(id),
  
  -- Constraints
  CONSTRAINT chk_customer_number_format CHECK (customer_number ~ '^CUS-[0-9]{4}-[0-9]{6}$'),
  CONSTRAINT chk_email_format CHECK (email IS NULL OR email ~ '^[^@]+@[^@]+\.[^@]+$'),
  CONSTRAINT chk_bvn_format CHECK (bvn IS NULL OR (bvn ~ '^[0-9]{11}$' AND length(bvn) = 11)),
  CONSTRAINT chk_nin_format CHECK (nin IS NULL OR (nin ~ '^[0-9]{11}$' AND length(nin) = 11)),
  CONSTRAINT chk_name_not_empty CHECK (length(trim(full_name)) > 0),
  CONSTRAINT chk_version_positive CHECK (version > 0)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_customers_auth_id ON public.customers(auth_id);
CREATE INDEX idx_customers_customer_number ON public.customers(customer_number);
CREATE INDEX idx_customers_email ON public.customers(email);
CREATE INDEX idx_customers_phone ON public.customers(phone);
CREATE INDEX idx_customers_status ON public.customers(status);
CREATE INDEX idx_customers_type ON public.customers(customer_type);
CREATE INDEX idx_customers_created_at ON public.customers(created_at);
-- BVN and NIN indexes for uniqueness checks during KYC
CREATE INDEX idx_customers_bvn ON public.customers(bvn) WHERE bvn IS NOT NULL;
CREATE INDEX idx_customers_nin ON public.customers(nin) WHERE nin IS NOT NULL;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-generate customer number on insert
CREATE OR REPLACE FUNCTION public.set_customer_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.customer_number IS NULL OR NEW.customer_number = '' THEN
    NEW.customer_number := public.generate_customer_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_customers_set_number
  BEFORE INSERT ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_customer_number();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- Customers can read their own record.
-- Staff with 'customers.read' permission can read customer records.
-- Staff with 'customers.update' can update.
-- Only super_admin can delete (and even then, soft-delete is preferred).

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Customer reads own record
CREATE POLICY customers_read_self
  ON public.customers FOR SELECT
  TO authenticated
  USING (auth_id = auth.uid());

-- Staff reads customer records (requires customers.read permission)
CREATE POLICY customers_read_staff
  ON public.customers FOR SELECT
  TO authenticated
  USING (public.has_permission('customers.read'));

-- Customer updates own record (limited self-service fields)
-- Note: this allows self-update but Phase 2 will add column-level restrictions
CREATE POLICY customers_update_self
  ON public.customers FOR UPDATE
  TO authenticated
  USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());

-- Staff updates customer records
CREATE POLICY customers_update_staff
  ON public.customers FOR UPDATE
  TO authenticated
  USING (public.has_permission('customers.update'))
  WITH CHECK (public.has_permission('customers.update'));

-- Only super_admin can insert customers (staff creates customers through admin)
CREATE POLICY customers_insert_staff
  ON public.customers FOR INSERT
  TO authenticated
  WITH CHECK (public.has_permission('customers.create'));

-- Only super_admin can delete
CREATE POLICY customers_delete_super_admin
  ON public.customers FOR DELETE
  TO authenticated
  USING (public.has_role('super_admin'));

COMMIT;

-- ============================================================================
-- DOWN PATH:
--   DROP TABLE customers;
--   DROP FUNCTION set_customer_number();
--   DROP SEQUENCE customer_number_seq;
--   DROP FUNCTION generate_customer_number();
--   DROP TYPE preferred_channel;
--   DROP TYPE customer_status;
--   DROP TYPE customer_type;
-- ============================================================================
