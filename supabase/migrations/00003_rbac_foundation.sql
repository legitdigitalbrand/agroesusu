-- ============================================================================
-- Migration 00003: Enterprise RBAC Foundation
-- 
-- Creates the role-based access control infrastructure:
--   - roles (system + custom roles)
--   - role_permissions (permission mappings)
--   - staff_users (staff identity, separate from customer identity)
--   - staff_role_assignments (links staff to roles, with expiry support)
--
-- Architectural decisions:
--   1. Staff and customer identities are modeled separately. Both use
--      Supabase Auth (auth.users) for authentication, but staff have a
--      dedicated staff_users table with employment metadata and RBAC roles.
--   2. RBAC is enforced at TWO layers: (a) BFF middleware (fast 403s),
--      (b) Postgres RLS (security backstop). See ARCHITECTURE_DECISIONS.md.
--   3. Seven system roles are seeded per the architecture (Volume 03/04).
--   4. Permissions use a dot-notation convention: "<resource>.<action>"
--      e.g., "loans.approve", "customers.read", "audit.read".
--
-- DOWN PATH: DROP all four tables + associated types/functions in reverse order.
-- ============================================================================

BEGIN;

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

CREATE TYPE staff_employment_status AS ENUM (
  'active',
  'suspended',
  'terminated',
  'on_leave'
);

CREATE TYPE role_type AS ENUM (
  'system',    -- Built-in roles, cannot be deleted
  'custom'     -- Admin-defined roles
);

CREATE TYPE assignment_status AS ENUM (
  'active',
  'revoked',
  'expired'
);

-- ============================================================================
-- HELPER FUNCTION: handle_updated_at (no table dependency)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- ROLES TABLE
-- ============================================================================

CREATE TABLE public.roles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL UNIQUE,
  description   text,
  role_type     role_type NOT NULL DEFAULT 'custom',
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES auth.users(id),
  
  CONSTRAINT chk_role_name_not_empty CHECK (length(trim(name)) > 0)
);

CREATE INDEX idx_roles_name ON public.roles(name);
CREATE INDEX idx_roles_type ON public.roles(role_type);

CREATE TRIGGER trg_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- ROLE_PERMISSIONS TABLE
-- ============================================================================

CREATE TABLE public.role_permissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id       uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission    text NOT NULL,    -- dot-notation: "loans.approve", "customers.read"
  resource      text NOT NULL,    -- e.g., "loans", "customers", "audit"
  action        text NOT NULL,    -- e.g., "create", "read", "update", "delete", "approve", "export"
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES auth.users(id),
  
  CONSTRAINT uq_role_permission UNIQUE (role_id, permission),
  CONSTRAINT chk_permission_format CHECK (permission ~ '^[a-z_]+\.[a-z_]+$')
);

CREATE INDEX idx_role_permissions_role ON public.role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission ON public.role_permissions(permission);
CREATE INDEX idx_role_permissions_resource ON public.role_permissions(resource);

-- ============================================================================
-- STAFF_USERS TABLE
-- ============================================================================

CREATE TABLE public.staff_users (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id             uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  staff_number        text NOT NULL UNIQUE,    -- e.g., STF-2026-000001
  full_name           text NOT NULL,
  email               text NOT NULL,
  phone               text,
  department          text,
  employment_status   staff_employment_status NOT NULL DEFAULT 'active',
  is_active           boolean NOT NULL DEFAULT true,
  last_login_at       timestamptz,
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid REFERENCES auth.users(id),
  
  CONSTRAINT chk_staff_number_format CHECK (staff_number ~ '^STF-[0-9]{4}-[0-9]{6}$'),
  CONSTRAINT chk_staff_email_not_empty CHECK (length(trim(email)) > 0),
  CONSTRAINT chk_staff_name_not_empty CHECK (length(trim(full_name)) > 0)
);

CREATE INDEX idx_staff_auth_id ON public.staff_users(auth_id);
CREATE INDEX idx_staff_email ON public.staff_users(email);
CREATE INDEX idx_staff_employment_status ON public.staff_users(employment_status);

CREATE TRIGGER trg_staff_updated_at
  BEFORE UPDATE ON public.staff_users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- STAFF_ROLE_ASSIGNMENTS TABLE
-- ============================================================================

CREATE TABLE public.staff_role_assignments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id      uuid NOT NULL REFERENCES public.staff_users(id) ON DELETE CASCADE,
  role_id       uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  status        assignment_status NOT NULL DEFAULT 'active',
  assigned_by   uuid REFERENCES auth.users(id),
  assigned_at   timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz,    -- NULL = no expiry; supports temporary privileges
  revoked_at    timestamptz,
  revoke_reason text,
  
  CONSTRAINT uq_active_assignment UNIQUE (staff_id, role_id)
);

CREATE INDEX idx_staff_role_staff ON public.staff_role_assignments(staff_id);
CREATE INDEX idx_staff_role_role ON public.staff_role_assignments(role_id);
CREATE INDEX idx_staff_role_status ON public.staff_role_assignments(status);

-- ============================================================================
-- HELPER FUNCTIONS (must come AFTER table creation — they reference tables)
-- ============================================================================

-- Check if current auth user is a staff member
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.staff_users
    WHERE auth_id = auth.uid()
    AND employment_status = 'active'
  );
END;
$$;

-- Check if current auth user has a specific permission
CREATE OR REPLACE FUNCTION public.has_permission(p_permission text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.staff_role_assignments sra
    JOIN public.role_permissions rp ON rp.role_id = sra.role_id
    WHERE sra.staff_id = (
      SELECT id FROM public.staff_users WHERE auth_id = auth.uid()
    )
    AND sra.status = 'active'
    AND (sra.expires_at IS NULL OR sra.expires_at > now())
    AND rp.permission = p_permission
  );
END;
$$;

-- Check if current auth user has any of the listed roles (by role name)
CREATE OR REPLACE FUNCTION public.has_role(p_role_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.staff_role_assignments sra
    JOIN public.roles r ON r.id = sra.role_id
    WHERE sra.staff_id = (
      SELECT id FROM public.staff_users WHERE auth_id = auth.uid()
    )
    AND sra.status = 'active'
    AND (sra.expires_at > now() OR sra.expires_at IS NULL)
    AND r.name = p_role_name
  );
END;
$$;

-- ============================================================================
-- SEED: SYSTEM ROLES
-- ============================================================================

INSERT INTO public.roles (name, description, role_type, created_by) VALUES
  ('super_admin',     'Full platform access. Can manage all configurations, users, and financial operations.', 'system', NULL),
  ('operations',      'Operations Manager. Manages day-to-day platform operations, monitors transactions, handles escalations.', 'system', NULL),
  ('loan_officer',     'Reviews and processes loan applications, manages collections, handles customer inquiries.', 'system', NULL),
  ('finance',         'Finance Officer. Manages settlements, reconciliations, and financial reporting.', 'system', NULL),
  ('compliance',      'Compliance Officer. Handles KYC reviews, AML monitoring, sanctions screening, regulatory reporting.', 'system', NULL),
  ('customer_support', 'Customer Support. Handles customer inquiries, account issues, and basic account management.', 'system', NULL),
  ('marketing',       'Marketing Administrator. Manages campaigns, announcements, and promotional content.', 'system', NULL);

-- ============================================================================
-- SEED: BASE PERMISSIONS PER ROLE
-- ============================================================================

DO $$
DECLARE
  r_super_admin uuid := (SELECT id FROM public.roles WHERE name = 'super_admin');
  r_operations  uuid := (SELECT id FROM public.roles WHERE name = 'operations');
  r_loan        uuid := (SELECT id FROM public.roles WHERE name = 'loan_officer');
  r_finance     uuid := (SELECT id FROM public.roles WHERE name = 'finance');
  r_compliance  uuid := (SELECT id FROM public.roles WHERE name = 'compliance');
  r_support     uuid := (SELECT id FROM public.roles WHERE name = 'customer_support');
  r_marketing   uuid := (SELECT id FROM public.roles WHERE name = 'marketing');
BEGIN
  -- Super Admin: all permissions
  INSERT INTO public.role_permissions (role_id, permission, resource, action) VALUES
    (r_super_admin, 'customers.read', 'customers', 'read'),
    (r_super_admin, 'customers.create', 'customers', 'create'),
    (r_super_admin, 'customers.update', 'customers', 'update'),
    (r_super_admin, 'customers.delete', 'customers', 'delete'),
    (r_super_admin, 'staff.read', 'staff', 'read'),
    (r_super_admin, 'staff.create', 'staff', 'create'),
    (r_super_admin, 'staff.update', 'staff', 'update'),
    (r_super_admin, 'staff.delete', 'staff', 'delete'),
    (r_super_admin, 'roles.read', 'roles', 'read'),
    (r_super_admin, 'roles.create', 'roles', 'create'),
    (r_super_admin, 'roles.update', 'roles', 'update'),
    (r_super_admin, 'roles.delete', 'roles', 'delete'),
    (r_super_admin, 'loans.read', 'loans', 'read'),
    (r_super_admin, 'loans.approve', 'loans', 'approve'),
    (r_super_admin, 'loans.reject', 'loans', 'reject'),
    (r_super_admin, 'loans.disburse', 'loans', 'disburse'),
    (r_super_admin, 'savings.read', 'savings', 'read'),
    (r_super_admin, 'wallet.read', 'wallet', 'read'),
    (r_super_admin, 'ledger.read', 'ledger', 'read'),
    (r_super_admin, 'audit.read', 'audit', 'read'),
    (r_super_admin, 'audit.export', 'audit', 'export'),
    (r_super_admin, 'config.read', 'config', 'read'),
    (r_super_admin, 'config.update', 'config', 'update'),
    (r_super_admin, 'compliance.read', 'compliance', 'read'),
    (r_super_admin, 'compliance.update', 'compliance', 'update'),
    (r_super_admin, 'reporting.read', 'reporting', 'read'),
    (r_super_admin, 'reporting.export', 'reporting', 'export');

  -- Operations
  INSERT INTO public.role_permissions (role_id, permission, resource, action) VALUES
    (r_operations, 'customers.read', 'customers', 'read'),
    (r_operations, 'customers.update', 'customers', 'update'),
    (r_operations, 'staff.read', 'staff', 'read'),
    (r_operations, 'loans.read', 'loans', 'read'),
    (r_operations, 'loans.approve', 'loans', 'approve'),
    (r_operations, 'loans.reject', 'loans', 'reject'),
    (r_operations, 'savings.read', 'savings', 'read'),
    (r_operations, 'wallet.read', 'wallet', 'read'),
    (r_operations, 'ledger.read', 'ledger', 'read'),
    (r_operations, 'audit.read', 'audit', 'read'),
    (r_operations, 'config.read', 'config', 'read'),
    (r_operations, 'compliance.read', 'compliance', 'read'),
    (r_operations, 'reporting.read', 'reporting', 'read');

  -- Loan Officer
  INSERT INTO public.role_permissions (role_id, permission, resource, action) VALUES
    (r_loan, 'customers.read', 'customers', 'read'),
    (r_loan, 'loans.read', 'loans', 'read'),
    (r_loan, 'loans.approve', 'loans', 'approve'),
    (r_loan, 'loans.reject', 'loans', 'reject'),
    (r_loan, 'savings.read', 'savings', 'read'),
    (r_loan, 'wallet.read', 'wallet', 'read'),
    (r_loan, 'compliance.read', 'compliance', 'read');

  -- Finance
  INSERT INTO public.role_permissions (role_id, permission, resource, action) VALUES
    (r_finance, 'loans.read', 'loans', 'read'),
    (r_finance, 'loans.disburse', 'loans', 'disburse'),
    (r_finance, 'savings.read', 'savings', 'read'),
    (r_finance, 'wallet.read', 'wallet', 'read'),
    (r_finance, 'ledger.read', 'ledger', 'read'),
    (r_finance, 'audit.read', 'audit', 'read'),
    (r_finance, 'reporting.read', 'reporting', 'read'),
    (r_finance, 'reporting.export', 'reporting', 'export');

  -- Compliance
  INSERT INTO public.role_permissions (role_id, permission, resource, action) VALUES
    (r_compliance, 'customers.read', 'customers', 'read'),
    (r_compliance, 'compliance.read', 'compliance', 'read'),
    (r_compliance, 'compliance.update', 'compliance', 'update'),
    (r_compliance, 'audit.read', 'audit', 'read'),
    (r_compliance, 'audit.export', 'audit', 'export'),
    (r_compliance, 'loans.read', 'loans', 'read'),
    (r_compliance, 'savings.read', 'savings', 'read'),
    (r_compliance, 'wallet.read', 'wallet', 'read'),
    (r_compliance, 'reporting.read', 'reporting', 'read');

  -- Customer Support
  INSERT INTO public.role_permissions (role_id, permission, resource, action) VALUES
    (r_support, 'customers.read', 'customers', 'read'),
    (r_support, 'customers.update', 'customers', 'update'),
    (r_support, 'loans.read', 'loans', 'read'),
    (r_support, 'savings.read', 'savings', 'read'),
    (r_support, 'wallet.read', 'wallet', 'read'),
    (r_support, 'compliance.read', 'compliance', 'read');

  -- Marketing
  INSERT INTO public.role_permissions (role_id, permission, resource, action) VALUES
    (r_marketing, 'customers.read', 'customers', 'read'),
    (r_marketing, 'reporting.read', 'reporting', 'read');
END $$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_role_assignments ENABLE ROW LEVEL SECURITY;

-- Roles: staff can read roles; only super_admin can modify
CREATE POLICY roles_read_staff
  ON public.roles FOR SELECT
  TO authenticated
  USING (public.is_staff());

CREATE POLICY roles_write_super_admin
  ON public.roles FOR ALL
  TO authenticated
  USING (public.has_role('super_admin'))
  WITH CHECK (public.has_role('super_admin'));

-- Role permissions: staff can read; only super_admin can modify
CREATE POLICY role_permissions_read_staff
  ON public.role_permissions FOR SELECT
  TO authenticated
  USING (public.is_staff());

CREATE POLICY role_permissions_write_super_admin
  ON public.role_permissions FOR ALL
  TO authenticated
  USING (public.has_role('super_admin'))
  WITH CHECK (public.has_role('super_admin'));

-- Staff users: staff can read other staff; self can read own record; super_admin can modify
CREATE POLICY staff_read_self
  ON public.staff_users FOR SELECT
  TO authenticated
  USING (auth_id = auth.uid());

CREATE POLICY staff_read_other_staff
  ON public.staff_users FOR SELECT
  TO authenticated
  USING (public.is_staff());

CREATE POLICY staff_write_super_admin
  ON public.staff_users FOR ALL
  TO authenticated
  USING (public.has_role('super_admin'))
  WITH CHECK (public.has_role('super_admin'));

-- Staff role assignments: staff can read assignments; super_admin can modify
CREATE POLICY staff_role_assignments_read_staff
  ON public.staff_role_assignments FOR SELECT
  TO authenticated
  USING (public.is_staff());

CREATE POLICY staff_role_assignments_write_super_admin
  ON public.staff_role_assignments FOR ALL
  TO authenticated
  USING (public.has_role('super_admin'))
  WITH CHECK (public.has_role('super_admin'));

COMMIT;
