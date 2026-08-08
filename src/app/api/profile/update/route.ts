import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { ensureProfileRow } from '@/lib/supabase/ensure-profile';

// PATCH /api/profile/update
// Allows customers to update their extended profile fields (Tier 2 & 3 data)
// directly from the profile page without going through the onboarding flow.
//
// Updatable fields:
//   residential_address, state, lga, occupation,
//   farm_type, primary_produce, nok_name, nok_phone, nok_relationship
//
// BVN and NIN are NOT updatable here — those require Safe Haven OTP verification.
// Full name, email, and phone are managed through auth/customers tables separately.

const ALLOWED_FIELDS = [
  'residential_address',
  'state',
  'lga',
  'occupation',
  'farm_type',
  'primary_produce',
  'nok_name',
  'nok_phone',
  'nok_relationship',
] as const;

export async function PATCH(request: NextRequest) {
  const limited = applyRateLimit(request, '/api/profile/update', RATE_LIMITS.AUTH);
  if (limited) return limited;

  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Filter to only allowed fields and strip nulls/empty strings to null
    const updateData: Record<string, string | null> = {};
    for (const field of ALLOWED_FIELDS) {
      if (field in body) {
        const value = body[field];
        updateData[field] = (typeof value === 'string' && value.trim()) ? value.trim() : null;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
    }

    // Ensure profiles row exists (may be missing if trigger was dropped)
    await ensureProfileRow({
      userId: user.id,
      fullName: (user.user_metadata as { full_name?: string })?.full_name || 'New User',
      email: user.email,
    });

    // Update profiles table
    const { error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id);

    if (updateError) {
      console.error('[API:profile-update] DB error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Auto-advance KYC tier based on filled fields
    const { data: profile } = await supabase
      .from('profiles')
      .select('kyc_tier, residential_address, state, lga, occupation, farm_type, primary_produce, nok_name, nok_phone, nok_relationship')
      .eq('id', user.id)
      .maybeSingle();

    if (profile) {
      const currentTier = (profile as { kyc_tier?: string }).kyc_tier || 'tier_0';
      const tierLevel = currentTier === 'tier_3' ? 3 : currentTier === 'tier_2' ? 2 : currentTier === 'tier_1' ? 1 : 0;
      const p = profile as Record<string, string | null>;

      // Auto-advance to tier_2 if all Tier 2 fields are filled
      if (tierLevel < 2 && p.residential_address && p.state && p.occupation) {
        await supabase
          .from('profiles')
          .update({ kyc_tier: 'tier_2' })
          .eq('id', user.id);
      }

      // Auto-advance to tier_3 if all Tier 3 fields are filled
      if (tierLevel < 3 && p.farm_type && p.primary_produce && p.nok_name && p.nok_phone && p.nok_relationship) {
        await supabase
          .from('profiles')
          .update({ kyc_tier: 'tier_3' })
          .eq('id', user.id);
      }
    }

    return NextResponse.json({ success: true, message: 'Profile updated' });
  } catch (error) {
    console.error('[API:profile-update] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
