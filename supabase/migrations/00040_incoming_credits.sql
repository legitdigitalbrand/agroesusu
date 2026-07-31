-- ═══════════════════════════════════════════════════════════════
-- Migration 00040: Incoming Credit Processing & Reconciliation
--
-- Phase 15: External wallet funding via Safe Haven incoming credits.
-- Handles unmatched credits that can't be immediately attributed to
-- a customer, and tracks incoming deposit requests.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Incoming Deposit Requests ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.incoming_deposit_requests (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id         UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    wallet_id           UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
    safe_haven_account_number TEXT NOT NULL,
    expected_amount     NUMERIC(18,2),
    status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'received', 'matched', 'expired', 'cancelled')),
    inbound_event_id    UUID REFERENCES public.inbound_events(id),
    financial_transaction_id TEXT,
    ip_address          INET,
    user_agent          TEXT,
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    matched_at          TIMESTAMPTZ,
    expires_at          TIMESTAMPTZ,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_incoming_deposit_customer ON incoming_deposit_requests(customer_id, status);
CREATE INDEX idx_incoming_deposit_account ON incoming_deposit_requests(safe_haven_account_number, status);
CREATE INDEX idx_incoming_deposit_status ON incoming_deposit_requests(status, created_at);

-- ── 2. Unmatched Credits ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.unmatched_credits (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inbound_event_id    UUID NOT NULL REFERENCES public.inbound_events(id) ON DELETE CASCADE,
    safe_haven_reference TEXT NOT NULL,
    account_number      TEXT,
    account_name        TEXT,
    amount              NUMERIC(18,2) NOT NULL,
    currency            TEXT NOT NULL DEFAULT 'NGN',
    sender_name         TEXT,
    sender_account_number TEXT,
    sender_bank_name    TEXT,
    narration           TEXT,
    status              TEXT NOT NULL DEFAULT 'requires_reconciliation'
                        CHECK (status IN ('requires_reconciliation', 'under_review', 'matched', 'reversed', 'resolved')),
    matched_customer_id UUID REFERENCES public.customers(id),
    matched_wallet_id   UUID REFERENCES public.wallets(id),
    financial_transaction_id TEXT,
    resolution_reason   TEXT,
    resolved_by         TEXT,
    resolved_at         TIMESTAMPTZ,
    metadata            JSONB DEFAULT '{}',
    correlation_id      UUID NOT NULL DEFAULT gen_random_uuid(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_unmatched_credits_status ON unmatched_credits(status, created_at);
CREATE INDEX idx_unmatched_credits_account ON unmatched_credits(account_number);
CREATE INDEX idx_unmatched_credits_reference ON unmatched_credits(safe_haven_reference);

-- ── 3. Extend ft_type enum for incoming deposits ───────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'ft_type' AND e.enumlabel = 'incoming_deposit'
    ) THEN
        ALTER TYPE ft_type ADD VALUE 'incoming_deposit';
    END IF;
END $$;

-- ── 4. RLS ────────────────────────────────────────────────────
ALTER TABLE incoming_deposit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE unmatched_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own incoming deposits"
    ON incoming_deposit_requests FOR SELECT
    TO authenticated
    USING (auth.uid() = (SELECT auth_id FROM customers WHERE id = customer_id));

CREATE POLICY "Staff read incoming deposits"
    ON incoming_deposit_requests FOR SELECT
    TO authenticated
    USING (public.has_permission('audit.read') OR public.has_role('super_admin'));

CREATE POLICY "Staff read unmatched credits"
    ON unmatched_credits FOR SELECT
    TO authenticated
    USING (public.has_permission('audit.read') OR public.has_role('super_admin'));

-- ── 5. Auto-update trigger ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_incoming_credit_tables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_incoming_deposit_requests_updated
    BEFORE UPDATE ON incoming_deposit_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_incoming_credit_tables_updated_at();

CREATE TRIGGER trg_unmatched_credits_updated
    BEFORE UPDATE ON unmatched_credits
    FOR EACH ROW
    EXECUTE FUNCTION update_incoming_credit_tables_updated_at();

COMMIT;
