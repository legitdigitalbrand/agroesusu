-- ============================================================================
-- Migration 00042: Support Tickets
--
-- Customer support ticket system for the Operations Platform.
-- ============================================================================

BEGIN;

CREATE TYPE ticket_status AS ENUM (
  'open',         -- New ticket, not yet assigned
  'assigned',     -- Assigned to a staff member
  'in_progress',  -- Being worked on
  'waiting_customer', -- Awaiting customer response
  'resolved',     -- Marked resolved by staff
  'closed',       -- Closed (auto after 7 days resolved or manual)
  'reopened'      -- Customer reopened a resolved ticket
);

CREATE TYPE ticket_priority AS ENUM (
  'low',
  'medium',
  'high',
  'urgent'
);

CREATE TYPE ticket_category AS ENUM (
  'general',
  'account',
  'transaction',
  'loan',
  'savings',
  'investment',
  'verification',
  'complaint',
  'fraud',
  'technical'
);

CREATE TABLE public.support_tickets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number   text NOT NULL UNIQUE DEFAULT ('TCK-' || upper(substr(md5(random()::text), 1, 8))),
  customer_id     uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name   text,
  customer_email  text,
  customer_phone  text,
  
  subject         text NOT NULL,
  description     text NOT NULL,
  category        ticket_category NOT NULL DEFAULT 'general',
  priority        ticket_priority NOT NULL DEFAULT 'medium',
  status          ticket_status NOT NULL DEFAULT 'open',
  
  assigned_to     uuid REFERENCES auth.users(id),
  assigned_name  text,
  
  tags            text[] DEFAULT '{}',
  metadata        jsonb DEFAULT '{}'::jsonb,
  
  first_response_at  timestamptz,
  resolved_at        timestamptz,
  closed_at          timestamptz,
  reopened_count     integer NOT NULL DEFAULT 0,
  
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_st_customer ON public.support_tickets(customer_id);
CREATE INDEX idx_st_status ON public.support_tickets(status);
CREATE INDEX st_priority ON public.support_tickets(priority);
CREATE INDEX idx_st_assigned ON public.support_tickets(assigned_to);
CREATE INDEX idx_st_created ON public.support_tickets(created_at);

-- Ticket messages (conversation thread)
CREATE TABLE public.support_ticket_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  
  sender_type     text NOT NULL CHECK (sender_type IN ('customer', 'staff', 'system')),
  sender_id       uuid REFERENCES auth.users(id),
  sender_name     text NOT NULL,
  
  message         text NOT NULL,
  attachments     jsonb DEFAULT '[]'::jsonb,
  is_internal_note boolean NOT NULL DEFAULT false,
  
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_stm_ticket ON public.support_ticket_messages(ticket_id);
CREATE INDEX idx_stm_created ON public.support_ticket_messages(created_at);

-- RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

-- Staff can read all tickets
CREATE POLICY st_staff_read ON public.support_tickets
  FOR SELECT TO authenticated
  USING (public.has_role('super_admin') OR public.has_permission('wallet.read'));

-- Staff can write tickets
CREATE POLICY st_staff_write ON public.support_tickets
  FOR ALL TO authenticated
  USING (public.has_role('super_admin') OR public.has_permission('wallet.read'))
  WITH CHECK (public.has_role('super_admin') OR public.has_permission('wallet.read'));

-- Customers can read own tickets
CREATE POLICY st_customer_read ON public.support_tickets
  FOR SELECT TO authenticated
  USING (customer_id IN (SELECT c.id FROM public.customers c WHERE c.auth_id = auth.uid()));

-- Customers can create tickets
CREATE POLICY st_customer_insert ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (customer_id IN (SELECT c.id FROM public.customers c WHERE c.auth_id = auth.uid()));

-- Ticket messages: staff can read all
CREATE POLICY stm_staff_read ON public.support_ticket_messages
  FOR SELECT TO authenticated
  USING (
    public.has_role('super_admin') OR public.has_permission('wallet.read')
    OR EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id
      AND t.customer_id IN (SELECT c.id FROM public.customers c WHERE c.auth_id = auth.uid())
    )
  );

-- Staff can insert messages
CREATE POLICY stm_staff_insert ON public.support_ticket_messages
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role('super_admin') OR public.has_permission('wallet.read'));

-- Customers can insert messages on own tickets
CREATE POLICY stm_customer_insert ON public.support_ticket_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_type = 'customer'
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id
      AND t.customer_id IN (SELECT c.id FROM public.customers c WHERE c.auth_id = auth.uid())
    )
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_support_tickets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_support_tickets_updated
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_support_tickets_updated_at();

COMMIT;
