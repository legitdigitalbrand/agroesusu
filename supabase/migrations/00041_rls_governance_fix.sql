-- ───────────────────────────────────────────────────────────
-- Fix RLS policies with USING (true) on cooperative tables
-- Part B of UX/IA audit: scope governance reads to cooperative members
-- ───────────────────────────────────────────────────────────

-- Helper: check if current user is an active member of a given cooperative
-- Used by the governance table RLS policies below
CREATE OR REPLACE FUNCTION public.is_coop_member(coop_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cooperative_memberships m
    JOIN public.customers c ON c.id = m.customer_id
    WHERE c.auth_id = auth.uid()
      AND m.cooperative_id = $1
      AND m.status = 'active'
  );
$$;

-- Fix: cooperative_committee_members — scope to coop members
DROP POLICY IF EXISTS cm_read_all ON public.cooperative_committee_members;
CREATE POLICY cm_read_self_or_staff ON public.cooperative_committee_members
  FOR SELECT TO authenticated
  USING (
    public.is_coop_member(cooperative_id)
    OR public.is_admin()
  );

-- Fix: cooperative_meetings — scope to coop members
DROP POLICY IF EXISTS meetings_read_all ON public.cooperative_meetings;
CREATE POLICY meetings_read_self_or_staff ON public.cooperative_meetings
  FOR SELECT TO authenticated
  USING (
    public.is_coop_member(cooperative_id)
    OR public.is_admin()
  );

-- Fix: cooperative_meeting_attendance — scope to coop members
DROP POLICY IF EXISTS ma_read_all ON public.cooperative_meeting_attendance;
CREATE POLICY ma_read_self_or_staff ON public.cooperative_meeting_attendance
  FOR SELECT TO authenticated
  USING (
    public.is_coop_member(cooperative_id)
    OR public.is_admin()
  );

-- Fix: cooperative_resolutions — scope to coop members
DROP POLICY IF EXISTS res_read_all ON public.cooperative_resolutions;
CREATE POLICY res_read_self_or_staff ON public.cooperative_resolutions
  FOR SELECT TO authenticated
  USING (
    public.is_coop_member(cooperative_id)
    OR public.is_admin()
  );

-- Fix: governance_audit_log — scope to coop members
DROP POLICY IF EXISTS gal_read_all ON public.governance_audit_log;
CREATE POLICY gal_read_self_or_staff ON public.governance_audit_log
  FOR SELECT TO authenticated
  USING (
    public.is_coop_member(cooperative_id)
    OR public.is_admin()
  );

-- Fix: cooperative_executive_positions — scope to coop members (was USING (true))
DROP POLICY IF EXISTS ep_read_all ON public.cooperative_executive_positions;
CREATE POLICY ep_read_self_or_staff ON public.cooperative_executive_positions
  FOR SELECT TO authenticated
  USING (
    public.is_coop_member(cooperative_id)
    OR public.is_admin()
  );

-- Note: investment_nav_history USING (true) is acceptable — it's product-level
-- reference data (NAV history), not customer-specific records.
-- Note: notifications DELETE USING (true) is acceptable — service_role only.
