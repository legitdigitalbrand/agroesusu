-- ============================================================================
-- Migration 00009: Safe Haven API Call Log + Idempotency Keys
-- 
-- Two append-only tables for the Integration Domain:
--   1. safe_haven_api_calls — logs every outbound API call (request + response,
--      minus secrets) for reconciliation and dispute resolution.
--   2. idempotency_keys — tracks idempotent operations to prevent duplicate
--      execution on network retries.
--
-- Per Phase 2 constraint: "Every outbound call to Safe Haven must be logged
-- for reconciliation and dispute resolution. This is a regulated-money system;
-- 'we don't have a log of what Safe Haven told us' is not acceptable."
--
-- DOWN PATH: DROP TABLE idempotency_keys; DROP TABLE safe_haven_api_calls;
--           DROP TYPE idempotency_status; DROP TYPE api_call_status;
-- ============================================================================

BEGIN;

CREATE TYPE api_call_status AS ENUM (
  'success',
  'client_error',     -- 4xx
  'server_error',     -- 5xx
  'timeout',
  'network_error'
);

CREATE TYPE idempotency_status AS ENUM (
  'in_progress',    -- Call started, not yet completed
  'completed',      -- Call succeeded, result stored
  'failed',         -- Call failed, error stored
  'expired'         -- Key expired (TTL passed)
);

-- ============================================================================
-- SAFE HAVEN API CALL LOG
-- ============================================================================

CREATE TABLE public.safe_haven_api_calls (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Call identification
  call_type         text NOT NULL,    -- 'authenticate', 'initiate_verification', 'validate_verification', 'create_sub_account', 'get_balance', 'name_enquiry', 'transfer', 'transfer_status'
  idempotency_key   text,            -- The idempotency key used (if any)
  
  -- Request
  request_method    text NOT NULL,    -- GET, POST, PUT, DELETE
  request_url       text NOT NULL,    -- Full URL (minus query secrets)
  request_headers   jsonb,           -- Non-secret headers (Content-Type, Accept, etc.)
  request_body      jsonb,           -- Request payload (secrets redacted)
  
  -- Response
  response_status   integer,          -- HTTP status code
  response_body     jsonb,           -- Response payload
  response_headers  jsonb,
  
  -- Error info
  status            api_call_status NOT NULL DEFAULT 'success',
  error_message     text,
  error_code        text,            -- Safe Haven's error code if available
  
  -- Performance
  latency_ms        integer,          -- Request duration in milliseconds
  
  -- Tracing
  correlation_id    uuid NOT NULL DEFAULT gen_random_uuid(),
  
  -- Timestamp
  created_at        timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT chk_call_type_not_empty CHECK (length(trim(call_type)) > 0),
  CONSTRAINT chk_request_method_valid CHECK (request_method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH'))
);

CREATE INDEX idx_sh_api_calls_type ON public.safe_haven_api_calls(call_type, created_at);
CREATE INDEX idx_sh_api_calls_status ON public.safe_haven_api_calls(status, created_at);
CREATE INDEX idx_sh_api_calls_correlation ON public.safe_haven_api_calls(correlation_id);
CREATE INDEX idx_sh_api_calls_idempotency ON public.safe_haven_api_calls(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_sh_api_calls_created_at ON public.safe_haven_api_calls(created_at);

-- ============================================================================
-- IDEMPOTENCY KEYS
-- ============================================================================

CREATE TABLE public.idempotency_keys (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Key identification
  key               text NOT NULL UNIQUE,    -- Format: "<operation>:<entityId>:<hashOfParams>"
  operation_type    text NOT NULL,            -- 'initiate_verification', 'create_sub_account', 'transfer', etc.
  
  -- Request context
  entity_id         text,                     -- The domain entity ID (customer_id, wallet_id, etc.)
  request_hash      text NOT NULL,            -- SHA-256 hash of the request parameters
  
  -- Stored result
  status            idempotency_status NOT NULL DEFAULT 'in_progress',
  response          jsonb,                    -- The stored response (for replay on retry)
  
  -- Timestamps
  created_at        timestamptz NOT NULL DEFAULT now(),
  completed_at      timestamptz,
  expires_at        timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),  -- Keys expire after 24h
  
  -- Constraints
  CONSTRAINT chk_key_not_empty CHECK (length(trim(key)) > 0),
  CONSTRAINT chk_operation_not_empty CHECK (length(trim(operation_type)) > 0)
);

CREATE INDEX idx_idempotency_key ON public.idempotency_keys(key);
CREATE INDEX idx_idempotency_operation ON public.idempotency_keys(operation_type, status);
CREATE INDEX idx_idempotency_entity ON public.idempotency_keys(entity_id) WHERE entity_id IS NOT NULL;
CREATE INDEX idx_idempotency_status ON public.idempotency_keys(status);
CREATE INDEX idx_idempotency_expires ON public.idempotency_keys(expires_at);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- Both tables are internal — only staff with audit.read can read.
-- Writes happen via service_role (the integration adapter).

ALTER TABLE public.safe_haven_api_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY sh_api_calls_read_staff
  ON public.safe_haven_api_calls FOR SELECT
  TO authenticated
  USING (public.has_permission('audit.read') OR public.has_role('super_admin'));

CREATE POLICY idempotency_keys_read_staff
  ON public.idempotency_keys FOR SELECT
  TO authenticated
  USING (public.has_permission('audit.read') OR public.has_role('super_admin'));

COMMIT;

-- ============================================================================
-- DOWN PATH:
--   DROP TABLE idempotency_keys;
--   DROP TYPE idempotency_status;
--   DROP TABLE safe_haven_api_calls;
--   DROP TYPE api_call_status;
-- ============================================================================
