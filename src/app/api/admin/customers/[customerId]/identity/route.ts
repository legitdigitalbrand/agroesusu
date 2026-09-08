import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { logAdminAction } from '@/modules/administration';
import { PII_ENCRYPTION_KEY } from '@/lib/config/pii-key';

// PATCH /api/admin/customers/[customerId]/identity
//
// Staff-only identity management. Two actions:
//
//  - reset  : revoke the customer's identity verification entirely. Old
//             verification rows are marked 'revoked' (kept for audit —
//             migration 00051), stored BVN/NIN + verification status are
//             cleared, kyc_tier drops to tier_0. The customer then re-runs
//             verification from /verify. Required because Safe Haven's OTP
//             is one-time: a verification whose OTP was consumed under the
//             old flow can never provision a DVA — a fresh session is the
//             only path.
//  - update : staff-corrected BVN or NIN value (typo fixes). Changes the
//             stored number only — never the tier or verified status.
//
// Guard rails (both actions are audited via logAdminAction):
//  - reset is refused while the customer has an ACTIVE DVA or a non-zero
//    wallet balance — a live funded account is never broken by an admin reset.
//  - BVN/NIN values are masked (last 4 digits) in all responses and audit logs.

const maskId = (num: string | null | undefined): string | null => {
  if (!num) return null;
  return `*****${String(num).slice(-4)}`;
};

export async function PATCH(
  request: NextRequest,
  context: { params: { customerId: string } }
) {
  const limited = applyRateLimit(request, '/api/admin/identity', RATE_LIMITS.ADMIN);
  if (limited) return limited;

  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: staff } = await supabase
      .from('staff_users')
      .select('id, role')
      .eq('auth_id', user.id)
      .eq('employment_status', 'active')
      .maybeSingle();
    if (!staff) return NextResponse.json({ error: 'Staff access required' }, { status: 403 });

    const body = await request.json();
    const { action, type, number, reason } = body as {
      action?: string;
      type?: 'BVN' | 'NIN';
      number?: string;
      reason?: string;
    };

    if (!reason || typeof reason !== 'string' || reason.trim().length < 4) {
      return NextResponse.json({ error: 'A reason is required and will be recorded in the audit log.' }, { status: 400 });
    }

    const serviceClient = createServiceClient();
    const customerId = context.params.customerId;

    const { data: customer } = await serviceClient
      .from('customers')
      .select('id, auth_id, full_name, email, status, bvn, nin, identity_verification_id, identity_verification_status, identity_type, identity_verified_at')
      .eq('id', customerId)
      .maybeSingle();
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    const beforeState = {
      bvn: maskId(customer.bvn),
      nin: maskId(customer.nin),
      identity_verification_status: customer.identity_verification_status || null,
      identity_type: customer.identity_type || null,
    };

    if (action === 'reset') {
      // ── Guard rails: never break a live funded account ──
      const { data: activeDva } = await serviceClient
        .from('safe_haven_accounts')
        .select('id, account_number')
        .eq('customer_id', customer.id)
        .eq('status', 'active')
        .maybeSingle();
      if (activeDva) {
        return NextResponse.json({
          error: 'Refused: customer has an active funding account (DVA). Deactivate the DVA first before resetting identity.',
        }, { status: 409 });
      }

      const { data: walletsWithBalance } = await serviceClient
        .from('wallets')
        .select('id, cached_balance')
        .eq('customer_id', customer.id)
        .neq('cached_balance', 0)
        .limit(1);
      if ((walletsWithBalance || []).length > 0) {
        return NextResponse.json({
          error: 'Refused: customer has a non-zero wallet balance. Settle the balance before resetting identity.',
        }, { status: 409 });
      }

      // ── Reset ──
      const nowIso = new Date().toISOString();

      // Prior verification rows are REVOKED, never deleted (provider-side
      // history + audit trail preserved). Requires migration 00051.
      const { error: revokeError } = await serviceClient
        .from('safe_haven_identity_verifications')
        .update({ status: 'revoked', updated_at: nowIso })
        .eq('customer_id', customer.id)
        .eq('status', 'verified');
      if (revokeError) throw new Error(revokeError.message);

      const { error: custError } = await serviceClient
        .from('customers')
        .update({
          bvn: null,
          nin: null,
          bvn_encrypted: null,
          nin_encrypted: null,
          identity_verification_id: null,
          identity_verification_status: null,
          identity_type: null,
          identity_verified_at: null,
        })
        .eq('id', customer.id);
      if (custError) throw new Error(custError.message);

      // Tier drop — service-role client bypasses the profile protection trigger
      const { data: profileBefore } = await serviceClient
        .from('profiles')
        .select('kyc_tier')
        .eq('id', customer.auth_id)
        .maybeSingle();
      const tierBefore = (profileBefore as { kyc_tier?: string } | null)?.kyc_tier || 'tier_0';

      if (tierBefore !== 'tier_0') {
        const { error: tierError } = await serviceClient
          .from('profiles')
          .update({ kyc_tier: 'tier_0' })
          .eq('id', customer.auth_id);
        if (tierError) throw new Error(tierError.message);
      }

      await logAdminAction({
        admin_user_id: staff.id,
        admin_role: (staff as { role?: string }).role || 'staff',
        action: 'identity_reset',
        action_category: 'identity_management',
        entity_type: 'customer',
        entity_id: customerId,
        before_state: { ...beforeState, kyc_tier: tierBefore },
        after_state: { bvn: null, nin: null, identity_verification_status: null, kyc_tier: 'tier_0' },
        metadata: { reason },
      });

      return NextResponse.json({
        success: true,
        action: 'reset',
        after_state: { bvn: null, nin: null, identity_verification_status: null, kyc_tier: 'tier_0' },
      });
    }

    if (action === 'update') {
      // ── Staff-corrected BVN/NIN value ──
      if (!type || !['BVN', 'NIN'].includes(type)) {
        return NextResponse.json({ error: 'type must be BVN or NIN' }, { status: 400 });
      }
      if (!number || !/^\d{11}$/.test(number)) {
        return NextResponse.json({ error: 'number must be exactly 11 digits' }, { status: 400 });
      }

      const updateData: Record<string, unknown> =
        type === 'BVN' ? { bvn: number } : { nin: number };

      if (PII_ENCRYPTION_KEY) {
        const { data: encrypted } = await serviceClient.rpc('encrypt_pii', {
          plaintext: number,
          key: PII_ENCRYPTION_KEY,
        });
        if (encrypted) {
          updateData[type === 'BVN' ? 'bvn_encrypted' : 'nin_encrypted'] = encrypted;
        }
      }

      const { error: updateError } = await serviceClient
        .from('customers')
        .update(updateData)
        .eq('id', customer.id);
      if (updateError) throw new Error(updateError.message);

      await logAdminAction({
        admin_user_id: staff.id,
        admin_role: (staff as { role?: string }).role || 'staff',
        action: 'identity_number_update',
        action_category: 'identity_management',
        entity_type: 'customer',
        entity_id: customerId,
        before_state: beforeState,
        after_state: type === 'BVN' ? { bvn: maskId(number) } : { nin: maskId(number) },
        metadata: { reason, type },
      });

      return NextResponse.json({
        success: true,
        action: 'update',
        after_state: type === 'BVN' ? { bvn: maskId(number) } : { nin: maskId(number) },
      });
    }

    return NextResponse.json({ error: 'action must be reset or update' }, { status: 400 });
  } catch (error) {
    console.error('[API:admin-identity] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
