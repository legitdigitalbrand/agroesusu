-- Fix RLS policies with USING (true) on cooperative tables
-- Part B of UX/IA audit: scope governance reads to cooperative members

-- Helper: check if current user is an active member of a given cooperative
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

-- Fix: cooperative_committee_members — needs to join through cooperative_committees
DROP POLICY IF EXISTS cm_read_all ON public.cooperative_committee_members;
CREATE POLICY cm_read_self_or_staff ON public.cooperative_committee_members
  FOR SELECT TO authenticated
  USING (
    public.is_coop_member(
      (SELECT cooperative_id FROM public.cooperative_committees WHERE id = committee_id)
    )
    OR public.is_staff()
  );

-- Fix: cooperative_meetings — has cooperative_id directly
DROP POLICY IF EXISTS meetings_read_all ON public.cooperative_meetings;
CREATE POLICY meetings_read_self_or_staff ON public.cooperative_meetings
  FOR SELECT TO authenticated
  USING (public.is_coop_member(cooperative_id) OR public.is_staff());

-- Fix: cooperative_meeting_attendance — needs to join through cooperative_meetings
DROP POLICY IF EXISTS ma_read_all ON public.cooperative_meeting_attendance;
CREATE POLICY ma_read_self_or_staff ON public.cooperative_meeting_attendance
  FOR SELECT TO authenticated
  USING (
    public.is_coop_member(
      (SELECT cooperative_id FROM public.cooperative_meetings WHERE id = meeting_id)
    )
    OR public.is_staff()
  );

-- Fix: cooperative_resolutions — has cooperative_id directly
DROP POLICY IF EXISTS res_read_all ON public.cooperative_resolutions;
CREATE POLICY res_read_self_or_staff ON public.cooperative_resolutions
  FOR SELECT TO authenticated
  USING (public.is_coop_member(cooperative_id) OR public.is_staff());

-- Fix: governance_audit_log — has cooperative_id directly
DROP POLICY IF EXISTS gal_read_all ON public.governance_audit_log;
CREATE POLICY gal_read_self_or_staff ON public.governance_audit_log
  FOR SELECT TO authenticated
  USING (public.is_coop_member(cooperative_id) OR public.is_staff());

-- Fix: cooperative_executive_positions — has cooperative_id directly
DROP POLICY IF EXISTS ep_read_all ON public.cooperative_executive_positions;
CREATE POLICY ep_read_self_or_staff ON public.cooperative_executive_positions
  FOR SELECT TO authenticated
  USING (public.is_coop_member(cooperative_id) OR public.is_staff());
