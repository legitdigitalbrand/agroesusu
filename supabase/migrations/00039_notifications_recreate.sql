-- ═══════════════════════════════════════════════════════════════
-- Migration 00039: Recreate notifications table
--
-- The notifications table and notification_type enum were dropped in
-- migration 00002 and never recreated. This migration recreates them
-- with the full Phase 14 schema including categories, delivery status,
-- and related entity tracking.
-- ═══════════════════════════════════════════════════════════════

-- Create the notification_type enum (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
    CREATE TYPE public.notification_type AS ENUM (
      'account_created',
      'password_reset',
      'security_event',
      'deposit_received',
      'withdrawal_initiated',
      'withdrawal_completed',
      'withdrawal_failed',
      'transfer_pending',
      'transfer_completed',
      'savings_created',
      'contribution_received',
      'savings_withdrawal',
      'savings_maturity',
      'loan_application_submitted',
      'loan_approved',
      'loan_rejected',
      'loan_disbursed',
      'loan_repayment_due',
      'loan_repayment_received',
      'loan_overdue',
      'investment_subscribed',
      'investment_matured',
      'investment_returns',
      'investment_redeemed',
      'verification_pending',
      'verification_approved',
      'verification_rejected',
      'general'
    );
  END IF;
END
$$;

-- Create notification_category enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_category') THEN
    CREATE TYPE public.notification_category AS ENUM (
      'auth', 'financial', 'savings', 'loans', 'investments', 'verification', 'general'
    );
  END IF;
END
$$;

-- Create delivery_status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_status') THEN
    CREATE TYPE public.notification_status AS ENUM (
      'pending', 'queued', 'sent', 'delivered', 'failed', 'read'
    );
  END IF;
END
$$;

-- Create the notifications table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  read boolean DEFAULT false,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),

  -- Phase 14 extensions
  category notification_category DEFAULT 'general',
  delivery_status notification_status DEFAULT 'pending',
  related_entity_type text,
  related_entity_id uuid,
  read_at timestamptz
);

-- Index for user's notifications (most common query)
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

-- Index for unread count query
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON public.notifications (user_id, read)
  WHERE read = false;

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see their own notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

-- Users can update their own notifications (mark as read)
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Service role can insert (notifications are created by the system)
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;
CREATE POLICY "Service role can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- Service role can delete (for cleanup)
DROP POLICY IF EXISTS "Service role can delete notifications" ON public.notifications;
CREATE POLICY "Service role can delete notifications"
  ON public.notifications FOR DELETE
  USING (true);

-- Grant permissions
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO service_role;
