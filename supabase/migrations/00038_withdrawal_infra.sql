-- ═══════════════════════════════════════════════════════════════
-- Migration 00038: External Bank Withdrawal Infrastructure
--
-- Extends FT status enum for withdrawal lifecycle,
-- creates withdrawal requests table, extends notification_type enum.
-- ═══════════════════════════════════════════════════════════════

-- Extend ft_status for withdrawal lifecycle
ALTER TYPE ft_status ADD VALUE IF NOT EXISTS 'name_enquiry_completed';
ALTER TYPE ft_status ADD VALUE IF NOT EXISTS 'transfer_submitted';
ALTER TYPE ft_status ADD VALUE IF NOT EXISTS 'pending_settlement';
ALTER TYPE ft_status ADD VALUE IF NOT EXISTS 'requires_reconciliation';

-- New FT types for withdrawal two-phase
ALTER TYPE ft_type ADD VALUE IF NOT EXISTS 'wallet_withdrawal_reservation';
ALTER TYPE ft_type ADD VALUE IF NOT EXISTS 'wallet_withdrawal_settlement';

-- Extend notification_type for all Phase 14 events
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'deposit_received';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'withdrawal_initiated';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'withdrawal_completed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'withdrawal_failed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'transfer_pending';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'transfer_completed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'account_created';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'password_reset';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'security_event';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'savings_created';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'contribution_received';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'savings_withdrawal';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'savings_maturity';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'application_submitted';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'loan_rejected';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'loan_disbursement';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'loan_default';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'subscription_created';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'returns_received';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'investment_maturity';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'investment_redemption';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'verification_started';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'verification_completed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'verification_failed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'tier_upgraded';

-- Withdrawal requests table — tracks the full withdrawal lifecycle
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- References
    customer_id             UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    wallet_id               UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
    financial_transaction_id UUID REFERENCES public.financial_transactions(id),
    
    -- Beneficiary details
    beneficiary_bank_code    TEXT NOT NULL,
    beneficiary_bank_name    TEXT NOT NULL,
    beneficiary_account_number TEXT NOT NULL,
    beneficiary_account_name TEXT NOT NULL,  -- Verified via name enquiry
    
    -- Name enquiry
    name_enquiry_session_id  TEXT,  -- Safe Haven session ID from name enquiry
    name_enquiry_completed_at TIMESTAMPTZ,
    
    -- Transfer
    payment_reference        TEXT NOT NULL,  -- Our reference for the transfer
    safe_haven_reference     TEXT,  -- Safe Haven's transfer reference
    transfer_submitted_at   TIMESTAMPTZ,
    
    -- Amount
    amount                  NUMERIC(15,2) NOT NULL,
    fee                     NUMERIC(15,2) NOT NULL DEFAULT 0,
    narration               TEXT,
    
    -- Status machine
    status                  TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN (
        'initiated',        -- Request created
        'name_enquiry_completed', -- Name enquiry done, beneficiary verified
        'authorized',       -- All checks passed (tier, limits, risk, balance)
        'reserved',         -- Funds reserved in escrow (FT posted)
        'transfer_submitted', -- Safe Haven transfer API called
        'pending',          -- Transfer submitted, awaiting confirmation
        'completed',        -- Transfer confirmed successful
        'failed',           -- Transfer failed
        'reversed',         -- Transfer failed, funds returned to wallet
        'requires_reconciliation', -- Status unclear, needs manual reconciliation
        'cancelled'         -- User cancelled before transfer
    )),
    
    -- Failure tracking
    failure_reason          TEXT,
    failure_code           TEXT,
    
    -- Security audit
    initiated_by_ip        INET,
    initiated_by_device_id TEXT,
    initiated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at           TIMESTAMPTZ,
    failed_at              TIMESTAMPTZ,
    reversed_at            TIMESTAMPTZ,
    
    -- Idempotency
    idempotency_key         TEXT NOT NULL UNIQUE,
    
    -- Standard
    metadata               JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT chk_withdrawal_amount_positive CHECK (amount > 0)
);

CREATE INDEX idx_withdrawal_requests_customer ON withdrawal_requests(customer_id);
CREATE INDEX idx_withdrawal_requests_status ON withdrawal_requests(status);
CREATE INDEX idx_withdrawal_requests_wallet ON withdrawal_requests(wallet_id);
CREATE INDEX idx_withdrawal_requests_payment_ref ON withdrawal_requests(payment_reference);
CREATE INDEX idx_withdrawal_requests_safe_haven_ref ON withdrawal_requests(safe_haven_reference);

-- RLS
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own withdrawal requests"
    ON withdrawal_requests FOR SELECT
    USING (auth.uid() = (SELECT auth_id FROM customers WHERE id = customer_id));

-- Auto-update updated_at
CREATE TRIGGER trg_withdrawal_requests_updated
    BEFORE UPDATE ON withdrawal_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_safe_haven_tables_updated_at();

-- Add notification_preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    category        TEXT NOT NULL CHECK (category IN ('auth', 'financial', 'savings', 'loans', 'investments', 'verification')),
    in_app_enabled  BOOLEAN NOT NULL DEFAULT true,
    email_enabled   BOOLEAN NOT NULL DEFAULT true,
    sms_enabled     BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, category)
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notification preferences"
    ON notification_preferences FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences"
    ON notification_preferences FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification preferences"
    ON notification_preferences FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_notification_preferences_updated
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_safe_haven_tables_updated_at();

-- Add delivery tracking to notifications table
ALTER TABLE public.notifications 
    ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general',
    ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'delivered' CHECK (delivery_status IN ('queued', 'sent', 'delivered', 'failed', 'read')),
    ADD COLUMN IF NOT EXISTS delivery_attempts INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS related_entity_type TEXT,
    ADD COLUMN IF NOT EXISTS related_entity_id UUID;

-- Update the read column to use delivery_status='read' pattern
-- (We keep the 'read' boolean for backward compat but also track delivery_status)

-- Scheduled reports table
CREATE TABLE IF NOT EXISTS public.scheduled_reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_key      TEXT NOT NULL,
    schedule_type   TEXT NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'monthly', 'quarterly')),
    next_run_at     TIMESTAMPTZ NOT NULL,
    last_run_at     TIMESTAMPTZ,
    last_run_status TEXT CHECK (last_run_status IN ('success', 'failed', 'pending')),
    last_error      TEXT,
    parameters      JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by      UUID REFERENCES public.profiles(id),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scheduled_reports_next_run ON scheduled_reports(next_run_at) WHERE is_active = true;

ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage scheduled reports"
    ON scheduled_reports FOR ALL
    USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.auth_id = auth.uid() AND EXISTS (SELECT 1 FROM public.is_staff())));

CREATE TRIGGER trg_scheduled_reports_updated
    BEFORE UPDATE ON scheduled_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_safe_haven_tables_updated_at();
