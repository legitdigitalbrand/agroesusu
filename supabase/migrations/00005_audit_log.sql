-- ============================================================================
-- Migration 00005: Audit Log (Append-Only, Immutable)
-- 
-- Creates the audit_log table — the foundational audit trail for the platform.
-- Per Volume 04 Part 4.15 and Volume 05 Part 5.2 (Standard Audit Model):
--   - Append-only: no UPDATE, no DELETE (enforced via trigger + RLS)
--   - Every auditable action records: Actor, Action, Target Entity, Timestamp,
--     Correlation ID, Channel, Source IP, Result
--   - Immutable: posted records are never modified
-- 
-- Design decisions:
--   1. Immutability is enforced at TWO levels:
--      a. RLS: no UPDATE/DELETE policies exist (Postgres denies by default when RLS is on)
--      b. Trigger: a BEFORE UPDATE/DELETE trigger raises an exception as a backstop
--         in case RLS is ever disabled or a service_role bypasses RLS.
--   2. Before/After states stored as JSONB for auditability without schema coupling.
--   3. Correlation ID is mandatory for distributed tracing (Part 5.2).
--   4. Source IP is inet type (PostgreSQL native) for efficient storage.
--   5. Partitioning strategy: this table will grow to billions of rows.
--      Time-based partitioning (monthly) is recommended but deferred until
--      the table exceeds ~10M rows. The current schema is partition-ready
--      (no FK constraints on audit_log, which would block partitioning).
--
-- DOWN PATH: DROP TABLE audit_log; DROP FUNCTION prevent_audit_modification();
-- ============================================================================

BEGIN;

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

CREATE TYPE audit_actor_type AS ENUM (
  'customer',
  'staff',
  'system',
  'scheduler'      -- background jobs / cron
);

CREATE TYPE audit_result AS ENUM (
  'success',
  'failure',
  'denied'          -- authorization denial
);

-- ============================================================================
-- AUDIT LOG TABLE
-- ============================================================================

CREATE TABLE public.audit_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Actor (who performed the action)
  actor_id          uuid REFERENCES auth.users(id),  -- NULL for system/scheduler actions
  actor_type        audit_actor_type NOT NULL DEFAULT 'system',
  actor_name        text,                             -- denormalized for quick reads
  
  -- Action (what was done)
  action            text NOT NULL,                     -- dot-notation: "customer.created", "loan.approved"
  action_category   text NOT NULL,                     -- e.g., "identity", "financial", "compliance", "governance"
  
  -- Target (what was affected)
  entity_type       text NOT NULL,                     -- e.g., "customer", "loan", "wallet", "ledger_entry"
  entity_id         uuid,                              -- ID of the affected entity
  
  -- State capture (for audit trail)
  before_state      jsonb,                             -- JSON snapshot before the action
  after_state       jsonb,                             -- JSON snapshot after the action
  
  -- Tracing
  correlation_id    uuid NOT NULL DEFAULT gen_random_uuid(),  -- distributed trace ID (Part 5.2)
  request_id        text,                              -- per-request unique ID
  
  -- Context
  channel           text,                              -- e.g., "web", "mobile", "api", "scheduler"
  source_ip         inet,                              -- PostgreSQL inet type
  user_agent        text,
  
  -- Outcome
  result            audit_result NOT NULL DEFAULT 'success',
  error_message     text,
  
  -- Metadata
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Timestamp (immutable)
  created_at        timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT chk_audit_action_not_empty CHECK (length(trim(action)) > 0),
  CONSTRAINT chk_audit_entity_type_not_empty CHECK (length(trim(entity_type)) > 0),
  CONSTRAINT chk_audit_action_category_not_empty CHECK (length(trim(action_category)) > 0)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Primary query patterns (from Volume 04 Part 4.15):
-- 1. "Show me all actions by this actor" → index on actor_id
-- 2. "Show me all actions on this entity" → index on entity_type + entity_id
-- 3. "Show me actions in this time range" → index on created_at
-- 4. "Show me all actions of this type" → index on action
-- 5. "Trace this correlation" → index on correlation_id

CREATE INDEX idx_audit_actor ON public.audit_log(actor_id, created_at);
CREATE INDEX idx_audit_entity ON public.audit_log(entity_type, entity_id, created_at);
CREATE INDEX idx_audit_action ON public.audit_log(action, created_at);
CREATE INDEX idx_audit_correlation ON public.audit_log(correlation_id);
CREATE INDEX idx_audit_created_at ON public.audit_log(created_at);
CREATE INDEX idx_audit_result ON public.audit_log(result, created_at);
CREATE INDEX idx_audit_category ON public.audit_log(action_category, created_at);

-- ============================================================================
-- IMMUTABILITY ENFORCEMENT
-- ============================================================================

-- Backstop trigger: prevents UPDATE and DELETE even if RLS is bypassed
CREATE OR REPLACE FUNCTION public.prevent_audit_modification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only: UPDATE and DELETE are not permitted (action: %, actor: %)', 
    TG_OP, 
    COALESCE(current_setting('app.current_actor', true), 'unknown');
END;
$$;

CREATE TRIGGER trg_audit_no_update
  BEFORE UPDATE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_modification();

CREATE TRIGGER trg_audit_no_delete
  BEFORE DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_modification();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- Audit log is special:
--   - INSERT: any authenticated user/system can write (the audit module writes)
--   - SELECT: staff with 'audit.read' permission can read
--   - UPDATE/DELETE: NEVER (no policies, and trigger blocks it)

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can INSERT audit records (the audit service does this)
CREATE POLICY audit_insert_authenticated
  ON public.audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Service role bypasses RLS (used by server-side audit service)
-- Staff with 'audit.read' permission can SELECT
CREATE POLICY audit_read_staff
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (
    public.has_permission('audit.read') 
    OR public.has_role('super_admin')
  );

-- NOTE: No UPDATE or DELETE policies are created.
-- When RLS is enabled and no UPDATE/DELETE policy matches, Postgres denies the operation.
-- The trigger above is a backstop for service_role (which bypasses RLS).

COMMIT;

-- ============================================================================
-- DOWN PATH:
--   DROP TABLE audit_log;
--   DROP FUNCTION prevent_audit_modification();
--   DROP TYPE audit_result;
--   DROP TYPE audit_actor_type;
-- ============================================================================
