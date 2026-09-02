import { NextRequest, NextResponse } from 'next/server';

// POST /api/admin/apply-migrations
// Temporary endpoint to apply Gate 2 SQL migrations directly to the database.
// SECURED with CRON_SECRET — DELETE AFTER USE.
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedKey = `Bearer ${process.env.CRON_SECRET}`;
  if (authHeader !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check for any database connection strings in env
  const dbEnvVars = Object.keys(process.env).filter(k => 
    k.includes('DATABASE') || k.includes('POSTGRES') || k.includes('DB_URL') || k.includes('DB_PASSWORD') || k.includes('SUPABASE_DB')
  );

  const results: string[] = [];

  // Try to find a usable connection string
  let connectionString = process.env.DATABASE_URL || 
                         process.env.POSTGRES_URL || 
                         process.env.POSTGRES_URL_NON_POOLING ||
                         process.env.SUPABASE_DB_URL ||
                         '';

  results.push(`DB env vars found: ${dbEnvVars.join(', ') || 'none'}`);

  if (!connectionString) {
    // Try constructing from known Supabase project info
    const projectRef = 'vhzsnsovfjnztawzuueo';
    const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD || '';
    
    if (dbPassword) {
      connectionString = `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`;
      results.push(`Constructed connection string from DB password`);
    } else {
      results.push('No database connection string or password found in environment');
      results.push(`Available env var keys (DB-related): ${dbEnvVars.join(', ') || 'none'}`);
      
      // List ALL env var keys (not values) to help debug
      const allKeys = Object.keys(process.env).filter(k => !k.includes('SECRET') && !k.includes('KEY') && !k.includes('TOKEN') && !k.includes('PASSWORD'));
      results.push(`All non-secret env keys: ${allKeys.join(', ')}`);
      
      return NextResponse.json({ 
        error: 'No database connection available',
        details: results,
      }, { status: 500 });
    }
  }

  try {
    const { Pool } = await import('pg');
    
    const pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    });

    const body = await request.json();
    const sql = body.sql as string;

    if (!sql) {
      await pool.end();
      return NextResponse.json({ error: 'Missing SQL in request body' }, { status: 400 });
    }

    const result = await pool.query(sql);
    await pool.end();

    return NextResponse.json({ 
      success: true, 
      rowCount: result.rowCount,
      details: results,
    });
  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Migration failed',
      details: results,
    }, { status: 500 });
  }
}
