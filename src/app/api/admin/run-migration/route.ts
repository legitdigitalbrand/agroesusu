import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

// Temporary route — DELETE after migration is complete
export async function POST(request: NextRequest) {
  const errors: string[] = [];
  try {
    const { dbPassword } = await request.json();
    if (!dbPassword) {
      return NextResponse.json({ error: 'dbPassword is required' }, { status: 400 });
    }

    const ref = 'vhzsnsovfjnztawzuueo';
    const migrationSql = `
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
  FOR SELECT TO authenticated USING (public.is_coop_member(cooperative_id) OR public.is_admin());

DROP POLICY IF EXISTS meetings_read_all ON public.cooperative_meetings;
CREATE POLICY meetings_read_self_or_staff ON public.cooperative_meetings
  FOR SELECT TO authenticated USING (public.is_coop_member(cooperative_id) OR public.is_admin());

DROP POLICY IF EXISTS ma_read_all ON public.cooperative_meeting_attendance;
CREATE POLICY ma_read_self_or_staff ON public.cooperative_meeting_attendance
  FOR SELECT TO authenticated USING (public.is_coop_member(cooperative_id) OR public.is_admin());

DROP POLICY IF EXISTS res_read_all ON public.cooperative_resolutions;
CREATE POLICY res_read_self_or_staff ON public.cooperative_resolutions
  FOR SELECT TO authenticated USING (public.is_coop_member(cooperative_id) OR public.is_admin());

DROP POLICY IF EXISTS gal_read_all ON public.governance_audit_log;
CREATE POLICY gal_read_self_or_staff ON public.governance_audit_log
  FOR SELECT TO authenticated USING (public.is_coop_member(cooperative_id) OR public.is_admin());

DROP POLICY IF EXISTS ep_read_all ON public.cooperative_executive_positions;
CREATE POLICY ep_read_self_or_staff ON public.cooperative_executive_positions
  FOR SELECT TO authenticated USING (public.is_coop_member(cooperative_id) OR public.is_admin());
`;

    const encodedPass = encodeURIComponent(dbPassword);
    const connectionConfigs = [
      {
        name: 'direct-5432',
        connectionString: `postgresql://postgres:${encodedPass}@db.${ref}.supabase.co:5432/postgres`,
        ssl: { rejectUnauthorized: false },
      },
      {
        name: 'pooler-6543-us-east-1',
        connectionString: `postgresql://postgres.${ref}:${encodedPass}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
        ssl: { rejectUnauthorized: false },
      },
      {
        name: 'pooler-5432-us-east-1',
        connectionString: `postgresql://postgres.${ref}:${encodedPass}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`,
        ssl: { rejectUnauthorized: false },
      },
      {
        name: 'pooler-6543-us-west-1',
        connectionString: `postgresql://postgres.${ref}:${encodedPass}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`,
        ssl: { rejectUnauthorized: false },
      },
      {
        name: 'pooler-6543-eu-west-1',
        connectionString: `postgresql://postgres.${ref}:${encodedPass}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`,
        ssl: { rejectUnauthorized: false },
      },
      {
        name: 'pooler-6543-ap-southeast-1',
        connectionString: `postgresql://postgres.${ref}:${encodedPass}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`,
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
          await client.query(migrationSql);
          const verify = await client.query(`SELECT proname FROM pg_proc WHERE proname = 'is_coop_member'`);
          await pool.end();
          return NextResponse.json({
            success: true,
            connection: config.name,
            message: 'Migration executed successfully',
            verified: verify.rows.length > 0,
          });
        } finally {
          client.release();
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${config.name}: ${msg.substring(0, 150)}`);
        continue;
      }
    }

    return NextResponse.json({ error: 'All connection attempts failed', details: errors }, { status: 500 });
  } catch (err) {
    return NextResponse.json({ error: 'Unexpected error', details: err instanceof Error ? err.message : String(err), connectionErrors: errors }, { status: 500 });
  }
}
