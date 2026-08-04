import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getBankingProvider } from '@/modules/integrations';

// GET /api/transfers/[reference]/status — check transfer status
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { reference } = await params;

    // Get the transfer record
    const { data: transfer } = await supabase
      .from('transfers')
      .select('*')
      .eq('reference', reference)
      .maybeSingle();

    if (!transfer) {
      return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });
    }

    // Check status with provider
    const provider = getBankingProvider();
    const result = await provider.getTransferStatus(transfer.payment_reference || reference);

    // Update status if changed
    if (result.status !== transfer.status) {
      const serviceClient = (await import('@/lib/supabase/service')).createServiceClient();
      await serviceClient
        .from('transfers')
        .update({ status: result.status, provider_response: result })
        .eq('id', transfer.id);
    }

    return NextResponse.json({
      reference: transfer.reference,
      status: result.status,
      message: result.message,
      amount: transfer.amount,
      beneficiary_account_name: transfer.beneficiary_account_name,
      beneficiary_bank_name: transfer.beneficiary_bank_name,
    });

  } catch (error) {
    console.error('[API:transfer-status] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check status' },
      { status: 500 }
    );
  }
}
