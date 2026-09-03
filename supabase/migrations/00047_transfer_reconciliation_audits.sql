-- ============================================================================
-- 00047 — Transfer Reconciliation Audit Trail (Gate 4, P1)
--
-- Purpose:
--   Every reconciliation attempt on a pending/stale transfer (whether from
--   the cron, the webhook, or a manual admin trigger) writes an immutable
--   audit record: what the provider said, what we did, what state resulted.
--
--   This is the evidence trail for:
--     - why funds were settled, reversed, or retained
--     - webhook-vs-cron race resolution (claim_lost records)
--     - crash recovery decisions
--     - regulator/auditor questions about money movement
--
-- Security: RLS enabled with NO policies — anon/authenticated denied.
-- All writes via service_role from backend reconciliation code only.
-- Records are append-only by convention; nothing in code updates or deletes
-- audit rows.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.transfer_reconciliation_audits (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Subject transfer (RESTRICT: audit outlives, never orphaned)
  transfer_id           uuid NOT NULL REFERENCES public.transfers(id) ON DELETE RESTRICT,

  -- Provider facts at the time of the attempt
  safe_haven_reference  text,
  previous_status       text NOT NULL,
  provider_status       text NOT NULL,          -- mapped: success | pending | failed
  provider_raw_status   text,                   -- raw string from Safe Haven, e.g. 'REVERSED'

  -- Outcome of this attempt
  resulting_status      text NOT NULL,
  action                text NOT NULL,          -- settled | reversed_funds_returned |
                                                -- pending_retry | retained_error |
                                                -- claim_lost | terminal_noop |
                                                -- flagged_manual | settled_legacy |
                                                -- marked_failed_no_funds
  source                text NOT NULL DEFAULT 'cron',  -- cron | webhook | manual

  -- Diagnostics
  error_message         text,
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_tra_source CHECK (source IN ('cron', 'webhook', 'manual'))
);

CREATE INDEX IF NOT EXISTS idx_tra_transfer_id
  ON public.transfer_reconciliation_audits (transfer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tra_created_at
  ON public.transfer_reconciliation_audits (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tra_action_open
  ON public.transfer_reconciliation_audits (action, created_at DESC)
  WHERE action IN ('retained_error', 'flagged_manual');

COMMENT ON TABLE public.transfer_reconciliation_audits IS 'Gate 4 P1: immutable audit trail of every stale-transfer reconciliation attempt (provider status, action taken, resulting state).';

-- RLS: deny all direct access (service_role bypasses)
ALTER TABLE public.transfer_reconciliation_audits ENABLE ROW LEVEL SECURITY;
-- No policies: customers and staff UI have no direct access. Backend only.
