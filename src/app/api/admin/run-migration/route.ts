import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

// Temporary route — DELETE after migration is complete
export async function POST(request: NextRequest) {
  try {
    const { dbPassword } = await request.json();

    if (!dbPassword) {
      return NextResponse.json({ error: 'dbPassword is required' }, { status: 400 });
    }

    const ref = 'vhzsnsovfjnztawzuueo';
    const migrationSql = `
-- Migration: 00041_rls_governance_fix.sql
-- Fix RLS policies with USING (true) on cooperative tables

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

DROP POLICY IF EXISTS cm_read_all ON public.cooperative_committee_members;
CREATE POLICY cm_read_self_or_staff ON public.cooperative_committee_members
  FOR SELECT TO authenticated
  USING (
    public.is_coop_member(cooperative_id)
    OR public.is_admin()
  );

DROP POLICY IF EXISTS meetings_read_all ON public.cooperative_meetings;
CREATE POLICY meetings_read_self_or_staff ON public.cooperative_meetings
  FOR SELECT TO authenticated
  USING (
    public.is_coop_member(cooperative_id)
    OR public.is_admin()
  );

DROP POLICY IF EXISTS ma_read_all ON public.cooperative_meeting_attendance;
CREATE POLICY ma_read_self_or_staff ON public.cooperative_meeting_attendance
  FOR SELECT TO authenticated
  USING (
    public.is_coop_member(cooperative_id)
    OR public.is_admin()
  );

DROP POLICY IF EXISTS res_read_all ON public.cooperative_resolutions;
CREATE POLICY res_read_self_or_staff ON public.cooperative_resolutions
  FOR SELECT TO authenticated
  USING (
    public.is_coop_member(cooperative_id)
    OR public.is_admin()
  );

DROP POLICY IF EXISTS gal_read_all ON public.governance_audit_log;
CREATE POLICY gal_read_self_or_staff ON public.governance_audit_log
  FOR SELECT TO authenticated
  USING (
    public.is_coop_member(cooperative_id)
    OR public.is_admin()
  );

DROP POLICY IF EXISTS ep_read_all ON public.cooperative_executive_positions;
CREATE POLICY ep_read_self_or_staff ON public.cooperative_executive_positions
  FOR SELECT TO authenticated
  USING (
    public.is_coop_member(cooperative_id)
    OR public.is_admin()
  );
`;

    // Try direct connection (Vercel has full network access)
    const connectionConfigs = [
      {
        name: 'direct',
        connectionString: `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${ref}.supabase.co:5432/postgres`,
        ssl: { rejectUnauthorized: false },
      },
      {
        name: 'pooler-us-east-1',
        connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(dbPassword)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
        ssl: { rejectUnauthorized: false },
      },
    ];

    for (const config of connectionConfigs) {
      try {
        const pool = new Pool({
          connectionString: config.connectionString,
          ssl: config.ssl,
          connectionTimeoutMillis: 15000,
        });

        const client = await pool.connect();
        try {
          await client.query('SELECT 1');
          console.log(`Connected via ${config.name}`);

          await client.query(migrationSql);
          console.log('Migration executed successfully');

          const verify = await client.query(`SELECT proname FROM pg_proc WHERE proname = 'is_coop_member'`);
          await pool.end();
          return NextResponse.json({
            success: true,
            connection: config.name,
            message: 'Migration 00041_rls_governance_fix.sql executed successfully',
            verified: verify.rows.length > 0,
          });
        } finally {
          client.release();
        }
      } catch (err) {
        console.error(`${config.name} failed:`, err instanceof Error ? err.message : String(err));
        continue;
      }
    }

    return NextResponse.json({ error: 'All connection attempts failed' }, { status: 500 });
  } catch (err) {
    return NextResponse.json({ error: 'Unexpected error', details: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
