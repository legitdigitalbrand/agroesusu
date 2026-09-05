// ============================================================================
// DVA (Dedicated Virtual Account) Provisioning — single idempotent path
// (Gate 4 funding fix)
//
// One shared function, ensureCustomerDva, used by the wallet funding flow and
// the identity auto-repair flow. Guarantees:
//
//   1. A customer with an ACTIVE provider-backed DVA gets it returned — never
//      a duplicate (DB UNIQUE(customer_id) + active-status check).
//   2. Provisioning calls the REAL banking provider (the factory is
//      fail-closed: it throws instead of returning a mock when credentials
//      are missing, so a fabricated account number can never be persisted).
//   3. Concurrent provisioning attempts (retry spam, webhook + page load)
//      race on the UNIQUE(customer_id) constraint; the loser re-reads and
//      returns the winner's row — exactly one DVA per customer.
//   4. Provider failures return a safe error state — never fake data, never
//      a partially-provisioned "active" record.
//   5. The returned account is read back from the database — the
//      authoritative record, not the in-flight provider response.
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { getBankingProvider } from '@/modules/integrations';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export interface DvaCustomerInput {
  id: string;
  full_name: string | null;
  email?: string | null;
  phone?: string | null;
  bvn?: string | null;
  nin?: string | null;
}

export interface DvaAccountRecord {
  account_number: string;
  account_name: string;
  bank_name: string;
  bank_code: string | null;
}

export type EnsureDvaResult =
  | { status: 'existing'; account: DvaAccountRecord }
  | { status: 'provisioned'; account: DvaAccountRecord }
  | { status: 'verification_required'; message: string }
  | { status: 'error'; message: string; retryable: boolean };


/** Normalize a Nigerian phone number to the +234 format Safe Haven requires. */
export function toInternationalPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  let p = phone.replace(/[^\d+]/g, '');
  if (p.startsWith('+234')) return p;
  if (p.startsWith('234')) return '+' + p;
  if (p.startsWith('0')) return '+234' + p.slice(1);
  if (p.length === 10) return '+234' + p;
  return p.startsWith('+') ? p : '+' + p;
}

/** Read the customer's ACTIVE DVA record from the authoritative DB. */
export async function getActiveDva(
  customerId: string
): Promise<DvaAccountRecord | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('safe_haven_accounts')
    .select('account_number, account_name, bank_name, bank_code')
    .eq('customer_id', customerId)
    .eq('status', 'active')
    .maybeSingle();

  if (error || !data) return null;
  return {
    account_number: data.account_number as string,
    account_name: data.account_name as string,
    bank_name: data.bank_name as string,
    bank_code: (data.bank_code as string | null) ?? null,
  };
}

/**
 * Idempotently ensure the customer has an ACTIVE provider-backed DVA.
 *
 * - Existing active DVA → returned (no provider call, no duplicate).
 * - None → provision via the real provider, persist, copy to the customer's
 *   primary wallet, return the DB record.
 * - Any failure → safe error (retryable or not); NOTHING is faked.
 */
export async function ensureCustomerDva(
  customer: DvaCustomerInput
): Promise<EnsureDvaResult> {
  // 1. Existing ACTIVE DVA → reuse, never duplicate.
  const existing = await getActiveDva(customer.id);
  if (existing) {
    return { status: 'existing', account: existing };
  }

  const supabase = getServiceClient();

  // 2. Provision with the REAL provider. The factory throws (fail-closed) if
  //    credentials are missing — no silent mock, no fabricated numbers.
  let provider;
  try {
    provider = getBankingProvider();
  } catch (configError) {
    return {
      status: 'error',
      message:
        configError instanceof Error
          ? configError.message
          : 'Banking provider not configured',
      retryable: false,
    };
  }

  // ── Require a REAL, provider-validated identity before provisioning ──
  // Safe Haven's Create Sub Account requires the `_id` from their Identity
  // Verification endpoint. Fabricating one ("customer-<id>") produces a
  // provider rejection; mock-era verification rows are excluded.
  const { data: verifiedIdentity } = await supabase
    .from('safe_haven_identity_verifications')
    .select('identity_id, type')
    .eq('customer_id', customer.id)
    .eq('status', 'verified')
    .neq('identity_id', '') // no empty ids
    .order('verified_at', { ascending: false, nullsFirst: false })
    .limit(25);

  const realIdentity = (verifiedIdentity || []).find(
    (row) =>
      row.identity_id &&
      !row.identity_id.startsWith('mock-') &&
      row.identity_id !== `customer-${customer.id}`
  );

  if (!realIdentity) {
    return {
      status: 'verification_required',
      message:
        'Identity verification with Safe Haven is required before we can create your funding account. Please complete BVN verification, then return to your wallet.',
    };
  }

  const identityType = (realIdentity.type as 'BVN' | 'NIN') || 'BVN';
  const identityNumber =
    (identityType === 'NIN' ? customer.nin : customer.bvn) || '';

  if (!identityNumber) {
    return {
      status: 'verification_required',
      message:
        'Your verified identity details are incomplete. Please re-run BVN verification, then return to your wallet.',
    };
  }

  const phoneNumber = toInternationalPhone(customer.phone);
  const emailAddress = customer.email || '';
  if (!phoneNumber || !emailAddress) {
    return {
      status: 'error',
      message:
        'Your profile needs a phone number and email address before a funding account can be created. Please update your profile.',
      retryable: false,
    };
  }

  let subAccount;
  try {
    subAccount = await provider.createSubAccount({
      identityType,
      identityNumber,
      identityId: realIdentity.identity_id,
      phoneNumber,
      emailAddress,
      // Deterministic per customer → the adapter's idempotency layer and the
      // provider-side request are stable across retries/page loads.
      externalReference: `agriqcap-wallet-${customer.id}`,
      customerName: customer.full_name || undefined,
    });
  } catch (providerError) {
    return {
      status: 'error',
      message: `Funding account creation failed: ${
        providerError instanceof Error ? providerError.message : String(providerError)
      }`,
      retryable: true,
    };
  }

  // Basic sanity: a DVA without an account number is not a usable record.
  if (!subAccount?.accountNumber || !subAccount.accountId) {
    return {
      status: 'error',
      message: 'Provider returned an incomplete funding account. Nothing was saved.',
      retryable: true,
    };
  }

  // 3. Persist — UNIQUE(customer_id) makes concurrent provisions race-safe.
  const { error: insertError } = await supabase.from('safe_haven_accounts').insert({
    customer_id: customer.id,
    safe_haven_account_id: subAccount.accountId,
    account_number: subAccount.accountNumber,
    account_name: subAccount.accountName || customer.full_name || '',
    bank_name: subAccount.bankName,
    bank_code: subAccount.bankCode,
    status: 'active',
    created_at: new Date().toISOString(),
  });

  if (insertError) {
    // 23505 = unique_violation on customer_id → another concurrent request
    // provisioned first. Re-read and return THEIR record — one DVA, no dupes.
    if (insertError.code === '23505') {
      const winner = await getActiveDva(customer.id);
      if (winner) return { status: 'existing', account: winner };
      // Row inserted but not active (edge) — treat as transient, retry later.
      return {
        status: 'error',
        message: 'Funding account was being created concurrently. Please retry.',
        retryable: true,
      };
    }
    return {
      status: 'error',
      message: `Could not save your funding account: ${insertError.message}`,
      retryable: true,
    };
  }

  // 4. Copy the account details onto the customer's primary wallet so all
  //    surfaces (wallet card, statements) reflect the authoritative record.
  const { error: walletUpdateError } = await supabase
    .from('wallets')
    .update({
      account_number: subAccount.accountNumber,
      account_name: subAccount.accountName || customer.full_name || '',
      bank_name: subAccount.bankName,
      bank_code: subAccount.bankCode,
      dva_provisioned_at: new Date().toISOString(),
    })
    .eq('customer_id', customer.id)
    .eq('wallet_type', 'primary');

  if (walletUpdateError) {
    // Non-fatal: the authoritative record exists; the wallet copy is cosmetic.
    console.error('[DVA] Wallet account-number copy failed:', walletUpdateError.message);
  }

  // 5. Read back from the DATABASE — return the authoritative record.
  const persisted = await getActiveDva(customer.id);
  if (persisted) {
    return { status: 'provisioned', account: persisted };
  }

  return {
    status: 'error',
    message: 'Funding account was created but could not be read back. Please retry or contact support.',
    retryable: true,
  };
}
