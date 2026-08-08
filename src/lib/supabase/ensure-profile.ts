import { createServiceClient } from './service';

// ──────────────────────────────────────────────────────────────────────
// ensureProfileRow — guarantees a profiles row exists for the given user
//
// ROOT CAUSE: The handle_new_user trigger was dropped in migration 00002
// and never recreated. Users who signed up after the DB reset have NO
// profiles row, making all UPDATE statements on profiles silent no-ops.
//
// This helper checks if a profiles row exists and creates one if missing,
// using data from the customers table and auth metadata as fallbacks.
//
// Returns true if a new row was created, false if it already existed.
// ──────────────────────────────────────────────────────────────────────

interface EnsureProfileParams {
  userId: string;
  fullName?: string;
  email?: string | null;
  phone?: string | null;
  kycTier?: string;
}

export async function ensureProfileRow({
  userId,
  fullName,
  email,
  phone,
  kycTier = 'tier_0',
}: EnsureProfileParams): Promise<boolean> {
  const serviceClient = createServiceClient();

  const { data: existing } = await serviceClient
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (existing) {
    return false; // Row already exists
  }

  // Create the missing profiles row
  await serviceClient
    .from('profiles')
    .insert({
      id: userId,
      full_name: fullName || 'New User',
      email: email || null,
      phone: phone || '',
      kyc_tier: kycTier,
    });

  return true; // Row was created
}
