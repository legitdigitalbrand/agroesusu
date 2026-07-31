import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// POST /api/verification/tier
// Updates the customer's verification tier after they submit KYC data.
// This is a LOCAL update (not Safe Haven verification).
// Safe Haven BVN/NIN verification is handled by /api/provisioning/identity.
//
// Request body:
//   { tier: 1|2|3, data: { bvn?, nin?, address?, state?, lga?, occupation?, farm_type?, ... } }
//
// Tier 0: Account created (automatic)
// Tier 1: BVN + NIN provided (local; Safe Haven verification via /api/provisioning/identity)
// Tier 2: Address + occupation + LGA (enhanced KYC)
// Tier 3: Farm/business details + next of kin (full KYC)

const TIER_FIELDS: Record<number, string[]> = {
  1: ['bvn', 'nin'],
  2: ['residential_address', 'state', 'lga', 'occupation'],
  3: ['farm_type', 'primary_produce', 'nok_name', 'nok_phone', 'nok_relationship'],
};

const TIER_LABELS: Record<number, string> = {
  0: 'tier_0',
  1: 'tier_1',
  2: 'tier_2',
  3: 'tier_3',
};

const TIER_BENEFITS: Record<number, { name: string; max_deposit: string; features: string[] }> = {
  0: { name: 'Basic', max_deposit: '₦50,000', features: ['Wallet', 'Savings (basic)', 'Cooperative membership'] },
  1: { name: 'Identity', max_deposit: '₦200,000', features: ['Higher deposit limits', 'Loan applications (basic)'] },
  2: { name: 'Address', max_deposit: '₦1,000,000', features: ['Loan applications (all products)', 'Investments', 'Higher withdrawal limits'] },
  3: { name: 'Full', max_deposit: 'Unlimited', features: ['All features unlocked', 'Priority support', 'Maximum loan amounts'] },
};

export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: customer } = await supabase
      .from('customers')
      .select('id, bvn, nin, status')
      .eq('auth_id', user.id)
      .maybeSingle();

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('kyc_tier, residential_address, state, lga, occupation, farm_type, primary_produce, nok_name, nok_phone, nok_relationship')
      .eq('id', user.id)
      .maybeSingle();

    const kycTier = (profile as { kyc_tier?: string } | null)?.kyc_tier || 'tier_0';
    const tierNum = parseInt(kycTier.replace('tier_', '')) || 0;

    // Determine what's missing for next tier
    const nextTier = tierNum + 1;
    const missingFields: string[] = [];
    if (nextTier <= 3) {
      const required = TIER_FIELDS[nextTier] || [];
      const profileData: Record<string, unknown> = { ...customer, ...(profile || {}) };
      for (const field of required) {
        if (!profileData[field]) {
          missingFields.push(field);
        }
      }
    }

    return NextResponse.json({
      current_tier: tierNum,
      current_tier_label: kycTier,
      next_tier: nextTier <= 3 ? nextTier : null,
      missing_fields: missingFields,
      benefits: TIER_BENEFITS[tierNum],
      next_tier_benefits: nextTier <= 3 ? TIER_BENEFITS[nextTier] : null,
    });

  } catch (error) {
    console.error('[API:verification-tier] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const limited = applyRateLimit(request, "/api/verification/tier", RATE_LIMITS.VERIFICATION);
  if (limited) return limited;
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { tier, data: kycData } = body;

    if (!tier || tier < 1 || tier > 3) {
      return NextResponse.json({ error: 'Tier must be 1, 2, or 3' }, { status: 400 });
    }

    // Validate required fields for this tier
    const required = TIER_FIELDS[tier] || [];
    const missing = required.filter(f => !kycData[f]);
    if (missing.length > 0) {
      return NextResponse.json({
        error: `Missing required fields for tier ${tier}: ${missing.join(', ')}`,
        missing_fields: missing,
      }, { status: 400 });
    }

    // Build update data for profiles table
    const profileUpdate: Record<string, unknown> = {
      kyc_tier: TIER_LABELS[tier],
    };
    if (tier >= 1) {
      profileUpdate.bvn = kycData.bvn || null;
      profileUpdate.nin = kycData.nin || null;
    }
    if (tier >= 2) {
      profileUpdate.residential_address = kycData.residential_address;
      profileUpdate.state = kycData.state;
      profileUpdate.lga = kycData.lga;
      profileUpdate.occupation = kycData.occupation;
    }
    if (tier >= 3) {
      profileUpdate.farm_type = kycData.farm_type;
      profileUpdate.primary_produce = kycData.primary_produce;
      profileUpdate.nok_name = kycData.nok_name;
      profileUpdate.nok_phone = kycData.nok_phone;
      profileUpdate.nok_relationship = kycData.nok_relationship;
    }

    // Update profiles table
    const { error: profileError } = await supabase
      .from('profiles')
      .update(profileUpdate)
      .eq('id', user.id);

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    // Update customer status for tier 2+
    if (tier >= 2) {
      const serviceClient = createServiceClient();
      await serviceClient
        .from('customers')
        .update({ status: 'active' })
        .eq('auth_id', user.id);
    }

    return NextResponse.json({
      success: true,
      current_tier: tier,
      tier_label: TIER_LABELS[tier],
      benefits: TIER_BENEFITS[tier],
      message: `Verification upgraded to Tier ${tier} — ${TIER_BENEFITS[tier].name}`,
    });

  } catch (error) {
    console.error('[API:verification-tier] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
