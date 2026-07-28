-- ============================================================================
-- Migration 00008: Inbound Events Landing Table
-- 
-- Append-only table for raw inbound events from Safe Haven (webhooks).
-- This is the LANDING ZONE — events land here and wait for processing.
-- Phase 5 (Orchestrator) will pick these up and post them through the Ledger.
-- Nothing is lost even before the Orchestrator exists.
--
-- Design (per Phase 2 prompt):
--   - Append-only (no UPDATE except for processing_status, no DELETE)
--   - Processing status: received → processing → processed / failed
--   - Raw payload preserved for audit and dispute resolution
--   - External event ID deduplication (prevents duplicate webhook processing)
--
-- DOWN PATH: DROP TABLE inbound_events; DROP TYPE inbound_event_status;
-- ============================================================================

BEGIN;

CREATE TYPE inbound_event_status AS ENUM (
  'received',      -- Webhook received, not yet processed
  'processing',    -- Being processed by the event handler
  'processed',     -- Successfully processed
  'failed',        -- Processing failed (will be retried or manually reviewed)
  'duplicate'      -- Duplicate of an already-received event
);

CREATE TYPE inbound_event_type AS ENUM (
  'transfer_received',         -- Incoming funds to a DVA
  'transfer_completed',        -- Outbound transfer completed
  'transfer_failed',           -- Outbound transfer failed
  'verification_completed',    -- Identity verification completed
  'account_credit',            -- Account credited
  'account_debit',             -- Account debited
  'unknown'                    -- Unrecognized event type (logged for investigation)
);

CREATE TABLE public.inbound_events (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- External reference (for deduplication)
  external_event_id     text,    -- Safe Haven's event/transaction ID (nullable if not provided)
  source                text NOT NULL DEFAULT 'safe_haven',
  event_type            inbound_event_type NOT NULL DEFAULT 'unknown',
  
  -- Raw data
  raw_payload           jsonb NOT NULL,
  raw_headers           jsonb,    -- HTTP headers (minus auth secrets)
  
  -- Processing
  processing_status     inbound_event_status NOT NULL DEFAULT 'received',
  processing_attempts   integer NOT NULL DEFAULT 0,
  processed_at          timestamptz,
  error_message         text,
  
  -- Linking (filled during processing)
  wallet_id             uuid REFERENCES public.wallets(id),
  customer_id           uuid REFERENCES public.customers(id),
  financial_transaction_id text,    -- Filled when Phase 5 Orchestrator processes this
  
  -- Tracing
  correlation_id        uuid NOT NULL DEFAULT gen_random_uuid(),
  
  -- Timestamps
  received_at           timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT chk_inbound_source_not_empty CHECK (length(trim(source)) > 0)
);

-- Deduplication: prevent duplicate external events from the same source
CREATE UNIQUE INDEX uq_inbound_external_event 
  ON public.inbound_events(source, external_event_id) 
  WHERE external_event_id IS NOT NULL;

CREATE INDEX idx_inbound_status ON public.inbound_events(processing_status, received_at);
CREATE INDEX idx_inbound_type ON public.inbound_events(event_type, received_at);
CREATE INDEX idx_inbound_received_at ON public.inbound_events(received_at);
CREATE INDEX idx_inbound_correlation ON public.inbound_events(correlation_id);
CREATE INDEX idx_inbound_wallet ON public.inbound_events(wallet_id) WHERE wallet_id IS NOT NULL;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- Webhook endpoints receive unauthenticated requests from Safe Haven.
-- The webhook handler authenticates via signature verification and inserts
-- using the service_role key (bypasses RLS).
-- Staff with 'audit.read' can read inbound events for monitoring.

ALTER TABLE public.inbound_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY inbound_events_read_staff
  ON public.inbound_events FOR SELECT
  TO authenticated
  USING (public.has_permission('audit.read') OR public.has_role('super_admin'));

-- No INSERT/UPDATE/DELETE policies for authenticated users.
-- Service role (used by webhook handler) bypasses RLS.

COMMIT;

-- ============================================================================
-- DOWN PATH:
--   DROP TABLE inbound_events;
--   DROP TYPE inbound_event_type;
--   DROP TYPE inbound_event_status;
-- ============================================================================
