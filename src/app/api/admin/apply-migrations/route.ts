import { NextRequest, NextResponse } from 'next/server';

// POST /api/admin/apply-migrations
// Temporary endpoint to apply Gate 2 SQL migrations directly to the database.
// SECURED — accepts CRON_SECRET or Supabase service role key. DELETE AFTER USE.
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || '';
  
  // Accept either CRON_SECRET or SUPABASE_SERVICE_ROLE_KEY
  const cronKey = `Bearer ${process.env.CRON_SECRET}`;
  const serviceKey = `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`;
  
  if (authHeader !== cronKey && authHeader !== serviceKey) {
    return NextResponse.json({ error: 'Unauthorized', hint: 'Use CRON_SECRET or service role key' }, { status: 401 });
  }

  const results: string[] = [];

  // Check for database connection strings in env
  const dbEnvVars = Object.keys(process.env).filter(k => 
    k.includes('DATABASE') || k.includes('POSTGRES') || k.includes('DB_URL') || k.includes('DB_PASSWORD') || k.includes('SUPABASE_DB')
  );
  results.push(`DB env vars found: ${dbEnvVars.join(', ') || 'none'}`);

  // Try to find a usable connection string
  let connectionString = process.env.DATABASE_URL || 
                         process.env.POSTGRES_URL || 
                         process.env.POSTGRES_URL_NON_POOLING ||
                         process.env.SUPABASE_DB_URL ||
                         '';

  if (!connectionString) {
    // List ALL env var names (not values) to help find connection info
    const allKeys = Object.keys(process.env).filter(k => 
      !k.includes('SECRET') && !k.includes('TOKEN') && !k.includes('PASSWORD') && !k.includes('PRIVATE')
    );
    results.push(`Available non-secret env keys: ${allKeys.join(', ')}`);
    
    // Also check for any key that might have a postgres URL pattern
    const pgKeys = Object.keys(process.env).filter(k => {
      const v = process.env[k] || '';
      return v.startsWith('postgres') || v.startsWith('postgresql');
    });
    results.push(`Keys with postgres URL value: ${pgKeys.join(', ') || 'none'}`);
    
    if (pgKeys.length > 0) {
      connectionString = process.env[pgKeys[0]] || '';
      results.push(`Using connection from: ${pgKeys[0]}`);
    }
  }

  if (!connectionString) {
    return NextResponse.json({ 
      error: 'No database connection available',
      details: results,
    }, { status: 500 });
  }

  try {
    const { Pool } = await import('pg');
    
    const pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
    });

    const body = await request.json().catch(() => ({}));
    const sql = body.sql as string;

    if (!sql) {
      await pool.end();
      return NextResponse.json({ 
        error: 'Missing sql in request body',
        details: results,
      }, { status: 400 });
    }

    const result = await pool.query(sql);
    await pool.end();

    return NextResponse.json({ 
      success: true, 
      rowCount: result.rowCount,
      rows: result.rows?.slice(0, 10),
      details: results,
    });
  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Migration failed',
      details: results,
    }, { status: 500 });
  }
}
