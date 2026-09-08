import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getSafeHavenAuthService } from '@/modules/integrations/safe-haven/auth';

export async function GET(request: NextRequest) {
  const limited = applyRateLimit(request, '/api/admin/safe-haven', RATE_LIMITS.ADMIN);
  if (limited) return limited;

  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: staff } = await supabase
      .from('staff_users')
      .select('id')
      .eq('auth_id', user.id)
      .eq('employment_status', 'active')
      .maybeSingle();
    if (!staff) return NextResponse.json({ error: 'Staff access required' }, { status: 403 });

    const serviceClient = createServiceClient();
    const { searchParams } = new URL(request.url);
    const viewType = searchParams.get('type') || 'all';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const skip = parseInt(searchParams.get('skip') || '0');

    const result: Record<string, unknown> = {};

    if (viewType === 'all' || viewType === 'accounts') {
      const { data: accounts, error: accountsError, count: accountsCount } = await serviceClient
        .from('safe_haven_accounts')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(skip, skip + limit - 1);

      if (accountsError) throw new Error(accountsError.message);

      // Enrich with customer names
      const enrichedAccounts = await Promise.all((accounts || []).map(async (a) => {
        const { data: customer } = await serviceClient
          .from('customers')
          .select('full_name, customer_number, email, phone, status')
          .eq('id', a.customer_id)
          .maybeSingle();
        return { ...a, customer: customer || null };
      }));

      result.accounts = enrichedAccounts;
      result.accounts_total = accountsCount || 0;
    }

    if (viewType === 'all' || viewType === 'verifications') {
      const { data: verifications, error: verError, count: verCount } = await serviceClient
        .from('safe_haven_identity_verifications')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(skip, skip + limit - 1);

      if (verError) throw new Error(verError.message);

      const enrichedVerifications = await Promise.all((verifications || []).map(async (v) => {
        const { data: customer } = await serviceClient
          .from('customers')
          .select('full_name, customer_number, email, phone')
          .eq('id', v.customer_id)
          .maybeSingle();
        return { ...v, customer: customer || null };
      }));

      result.verifications = enrichedVerifications;
      result.verifications_total = verCount || 0;
    }

    if (viewType === 'purse') {
      // Live purse (fee/settlement debit account) balance from the provider.
      // Staff-only (auth checked above). Never returns tokens or credentials.
      const authService = getSafeHavenAuthService();
      const apiUrl = process.env.SAFEHAVEN_API_URL || 'https://api.sandbox.safehavenmfb.com';
      const debitAccount = process.env.SAFE_HAVEN_DEBIT_ACCOUNT || '';
      const accessToken = await authService.getAccessToken();
      const ibsClientId = authService.getIbsClientId();

      const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      if (ibsClientId) headers['ClientID'] = ibsClientId;

      const response = await fetch(`${apiUrl}/accounts`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(15000),
      });

      const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      const accounts = (Array.isArray(body?.data) ? body!.data : []) as Record<string, unknown>[];

      const purse = accounts.find(
        (a) => String(a.accountNumber ?? '') === debitAccount || String(a.accountNumber ?? '') === debitAccount.replace(/\D/g, '')
      );

      if (!response.ok) {
        return NextResponse.json(
          { error: `Safe Haven GET /accounts returned HTTP ${response.status}` },
          { status: 502 }
        );
      }

      if (!purse) {
        return NextResponse.json({
          purse: null,
          debit_account_number: debitAccount,
          account_count: accounts.length,
          message: 'Debit account not found in the provider account list',
        });
      }

      result.purse = {
        account_id: purse._id ?? null,
        account_number: purse.accountNumber ?? debitAccount,
        account_name: purse.name ?? purse.accountName ?? null,
        currency: purse.currency ?? 'NGN',
        balance: Number(purse.balance ?? 0),
        available_balance: Number(purse.availableBalance ?? purse.balance ?? 0),
        ledger_balance: Number(purse.ledgerBalance ?? purse.balance ?? 0),
        retrieved_at: new Date().toISOString(),
      };
    }

    if (viewType === 'all' || viewType === 'api_calls') {
      const { data: apiCalls, error: apiError, count: apiCount } = await serviceClient
        .from('safe_haven_api_calls')
        .select('id, endpoint, method, status_code, duration_ms, created_at, request_id', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(skip, skip + limit - 1);

      if (apiError) throw new Error(apiError.message);

      result.api_calls = apiCalls || [];
      result.api_calls_total = apiCount || 0;

      // Summary stats
      const { data: successCount } = await serviceClient
        .from('safe_haven_api_calls')
        .select('*', { count: 'exact', head: true })
        .lt('status_code', 400);

      const { data: errorCount } = await serviceClient
        .from('safe_haven_api_calls')
        .select('*', { count: 'exact', head: true })
        .gte('status_code', 400);

      result.api_stats = {
        total: apiCount || 0,
        successful: successCount?.length || 0,
        errors: errorCount?.length || 0,
        error_rate: apiCount ? (((errorCount?.length || 0) / apiCount) * 100).toFixed(1) : '0',
      };
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
