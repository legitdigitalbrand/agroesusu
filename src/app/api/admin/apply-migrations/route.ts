import { NextRequest, NextResponse } from 'next/server';

// POST /api/admin/apply-migrations
// Temporary endpoint to apply Gate 2 SQL migrations.
// SECURED — accepts Supabase service role key. DELETE AFTER USE.
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  
  if (authHeader !== `Bearer ${serviceKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const sql = body.sql as string;

  if (!sql) {
    return NextResponse.json({ error: 'Missing sql in request body' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vhzsnsovfjnztawzuueo.supabase.co';
  const results: string[] = [];

  // Strategy 1: Try the Supabase /pg endpoint (some projects support this)
  try {
    const pgResponse = await fetch(`${supabaseUrl}/pg`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
      },
      body: JSON.stringify({ query: sql }),
      signal: AbortSignal.timeout(10000),
    });
    
    if (pgResponse.ok) {
      const pgData = await pgResponse.json();
      results.push('Strategy 1 (Supabase /pg): SUCCESS');
      return NextResponse.json({ success: true, strategy: 'supabase-pg', data: pgData, details: results });
    } else {
      results.push(`Strategy 1 (Supabase /pg): ${pgResponse.status} ${pgResponse.statusText}`);
    }
  } catch (e) {
    results.push(`Strategy 1 (Supabase /pg): ${e instanceof Error ? e.message : 'failed'}`);
  }

  // Strategy 2: Try the Supabase /rest/v1/rpc endpoint with a dynamic SQL function
  // First, try to create a temporary function via the /rest/v1 endpoint
  try {
    // Try calling pgrst directly to see if there's a way to execute SQL
    const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({ query: sql }),
      signal: AbortSignal.timeout(10000),
    });
    results.push(`Strategy 2 (PostgREST rpc): ${rpcResponse.status}`);
  } catch (e) {
    results.push(`Strategy 2 (PostgREST rpc): ${e instanceof Error ? e.message : 'failed'}`);
  }

  // Strategy 3: Try connecting via pg library using the pooler with the service role key as password
  // The pooler URL format: postgresql://postgres.{ref}:{key}@aws-0-{region}.pooler.supabase.com:6543/postgres
  try {
    const { Pool } = await import('pg');
    const projectRef = 'vhzsnsovfjnztawzuueo';
    
    // Try using the service role key as the password (unlikely but worth trying)
    const connStr = `postgresql://postgres.${projectRef}:${serviceKey}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`;
    
    const pool = new Pool({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    });
    
    const result = await pool.query(sql);
    await pool.end();
    results.push('Strategy 3 (pg pooler with service key): SUCCESS');
    return NextResponse.json({ success: true, strategy: 'pg-pooler', rowCount: result.rowCount, rows: result.rows?.slice(0, 5), details: results });
  } catch (e) {
    results.push(`Strategy 3 (pg pooler): ${e instanceof Error ? e.message.slice(0, 200) : 'failed'}`);
  }

  // Strategy 4: Try the direct database URL with service role key
  try {
    const { Pool } = await import('pg');
    const connStr = `postgresql://postgres:${serviceKey}@db.vhzsnsovfjnztawzuueo.supabase.co:5432/postgres`;
    
    const pool = new Pool({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    });
    
    const result = await pool.query(sql);
    await pool.end();
    results.push('Strategy 4 (direct DB with service key): SUCCESS');
    return NextResponse.json({ success: true, strategy: 'direct-db', rowCount: result.rowCount, rows: result.rows?.slice(0, 5), details: results });
  } catch (e) {
    results.push(`Strategy 4 (direct DB): ${e instanceof Error ? e.message.slice(0, 200) : 'failed'}`);
  }

  return NextResponse.json({ 
    error: 'All strategies failed. No direct database access available.',
    details: results,
  }, { status: 500 });
}
