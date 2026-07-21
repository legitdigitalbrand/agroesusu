/**
 * Safe Haven MFB Payment Service Implementation
 *
 * Integrates with Safe Haven's Open API Banking product:
 * - Virtual account creation (permanent sub-accounts)
 * - Outward transfers (NIP and intra-bank)
 * - BVN/NIN verification (two-step OTP-based)
 * - Credit checks
 * - Bank list and name enquiry
 *
 * API Docs: https://safehavenmfb.readme.io/reference
 *
 * Environment variables needed:
 * - SAFEHAVEN_CLIENT_ID
 * - SAFEHAVEN_CLIENT_ASSERTION (signed JWT)
 * - SAFEHAVEN_WEBHOOK_SECRET
 *
 * Base URLs:
 * - Sandbox: https://api.sandbox.safehavenmfb.com
 * - Production: https://api.safehavenmfb.com
 *
 * Set PAYMENT_PROVIDER=safehaven to route through this service.
 */

import type {
  PaymentService,
  VirtualAccount,
  TransferResult,
  TransferRecipient,
  VerificationResult,
  CreditCheckResult,
  BankListResult,
  AccountResolution,
} from './payment-provider';

// Base URL — sandbox by default, production when SAFEHAVEN_ENV=production
const BASE_URL =
  process.env.SAFEHAVEN_ENV === 'production'
    ? 'https://api.safehavenmfb.com'
    : 'https://api.sandbox.safehavenmfb.com';

const CLIENT_ID = process.env.SAFEHAVEN_CLIENT_ID;
const CLIENT_ASSERTION = process.env.SAFEHAVEN_CLIENT_ASSERTION;

// ─── Token Management ───
// Safe Haven access tokens expire. We cache and refresh as needed.
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < tokenExpiry - 60000) {
    return cachedToken;
  }

  if (!CLIENT_ID || !CLIENT_ASSERTION) {
    throw new Error('Safe Haven credentials not configured. Set SAFEHAVEN_CLIENT_ID and SAFEHAVEN_CLIENT_ASSERTION.');
  }

  const response = await fetch(`${BASE_URL}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_assertion: CLIENT_ASSERTION,
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Safe Haven auth failed: ${error}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;

  // Tokens typically last 1 hour; use expires_in if provided
  const expiresIn = data.expires_in || 3600;
  tokenExpiry = Date.now() + expiresIn * 1000;

  return cachedToken!;
}

async function safeHavenRequest(
  path: string,
  method: 'GET' | 'POST' = 'POST',
  body?: any
): Promise<any> {
  const token = await getAccessToken();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // Safe Haven requires ClientID header on some endpoints
  if (CLIENT_ID) {
    headers['ClientID'] = CLIENT_ID;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(json.message || json.error || `Safe Haven API error: ${response.status}`);
  }

  return json;
}

export class SafeHavenService implements PaymentService {
  provider = 'safehaven' as const;

  // ─── Virtual Account Creation ───
  // Uses "Create Sub Account (Individual)" for permanent accounts
  // (virtual-accounts endpoint creates time-based accounts that expire)
  async createVirtualAccount(params: {
    email: string;
    full_name: string;
    user_id: string;
  }): Promise<VirtualAccount> {
    const nameParts = params.full_name.split(' ');
    const firstName = nameParts[0] || params.full_name;
    const lastName = nameParts.slice(1).join(' ') || firstName;

    const result = await safeHavenRequest('/accounts', 'POST', {
      firstName,
      lastName,
      email: params.email,
      externalReference: params.user_id,
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://agroesusu.vercel.app'}/api/safehaven/webhook`,
    });

    return {
      account_number: result.accountNumber || result.data?.accountNumber,
      bank_name: 'Safe Haven MFB',
      bank_code: '090290',
      account_name: params.full_name,
      provider: 'safehaven',
      raw: result,
    };
  }

  // ─── Transfers ───
  async createTransferRecipient(params: {
    name: string;
    account_number: string;
    bank_code: string;
  }): Promise<TransferRecipient> {
    // Safe Haven doesn't use the "transfer recipient" pattern like Paystack.
    // Instead, transfers are made directly with account number + bank code.
    // We return a synthetic recipient code that encodes the account details.
    const code = Buffer.from(
      JSON.stringify({ name: params.name, account_number: params.account_number, bank_code: params.bank_code })
    ).toString('base64');

    return { recipient_code: code, provider: 'safehaven' };
  }

  async initiateTransfer(params: {
    amount: number;
    recipient_code: string;
    reference: string;
    reason: string;
  }): Promise<TransferResult> {
    // Decode recipient code back to account details
    let recipientData: { name: string; account_number: string; bank_code: string };
    try {
      recipientData = JSON.parse(Buffer.from(params.recipient_code, 'base64').toString());
    } catch {
      return {
        reference: params.reference,
        status: 'failed',
        provider: 'safehaven',
        raw: { error: 'Invalid recipient code' },
      };
    }

    try {
      // Name enquiry first (verify the account)
      const enquiry = await safeHavenRequest('/transfers/name-enquiry', 'POST', {
        destinationBankCode: recipientData.bank_code,
        destinationAccountNumber: recipientData.account_number,
      });

      const accountName = enquiry.data?.accountName || enquiry.accountName || recipientData.name;

      // Execute transfer (amount in kobo/cent — Safe Haven uses Naira * 100)
      const result = await safeHavenRequest('/transfers', 'POST', {
        sourceAccountNumber: process.env.SAFEHAVEN_SETTLEMENT_ACCOUNT || '',
        destinationBankCode: recipientData.bank_code,
        destinationAccountNumber: recipientData.account_number,
        destinationAccountName: accountName,
        amount: Math.round(params.amount * 100), // convert to kobo
        narration: params.reason,
        externalReference: params.reference,
      });

      return {
        reference: params.reference,
        status: result.data?.status === 'SUCCESS' ? 'pending' : result.data?.status === 'FAILED' ? 'failed' : 'pending',
        provider: 'safehaven',
        raw: result,
      };
    } catch (err: any) {
      return {
        reference: params.reference,
        status: 'failed',
        provider: 'safehaven',
        raw: { error: err.message },
      };
    }
  }

  async listBanks(): Promise<BankListResult[]> {
    const result = await safeHavenRequest('/transfers/banks', 'GET');
    const banks = result.data || result || [];
    return banks.map((b: any) => ({
      name: b.name,
      code: b.code || b.bankCode,
      slug: b.slug,
    }));
  }

  async resolveAccountNumber(account_number: string, bank_code: string): Promise<AccountResolution> {
    const result = await safeHavenRequest('/transfers/name-enquiry', 'POST', {
      destinationBankCode: bank_code,
      destinationAccountNumber: account_number,
    });

    return {
      account_number,
      account_name: result.data?.accountName || result.accountName || '',
    };
  }

  // ─── BVN/NIN Verification (two-step OTP-based) ───
  async verifyBVN(bvn: string): Promise<VerificationResult> {
    // Step 1: Initiate verification — sends OTP to the customer's phone
    const result = await safeHavenRequest('/identity/v2/initiate', 'POST', {
      type: 'BVN',
      number: bvn,
    });

    // The response includes an identityId that's needed for the validate step.
    // Since this is a two-step flow, we return 'pending_review' and store
    // the identityId for the validate step.
    return {
      status: 'pending_review',
      first_name: result.data?.firstName,
      last_name: result.data?.lastName,
      provider: 'safehaven',
      raw: { ...result, identityId: result.data?._id || result._id, needsOtp: true },
    };
  }

  /**
   * Step 2 of BVN verification — validate with OTP.
   * This is called after the user receives the OTP and enters it.
   */
  async validateBVN(identityId: string, otp: string): Promise<VerificationResult> {
    const result = await safeHavenRequest('/identity/v2/validate', 'POST', {
      identityId,
      type: 'BVN',
      otp,
    });

    return {
      status: result.data?.status === 'SUCCESS' ? 'verified' : 'failed',
      first_name: result.data?.firstName,
      last_name: result.data?.lastName,
      provider: 'safehaven',
      raw: result,
    };
  }

  // ─── Credit Check ───
  async checkCredit(params: { bvn: string; user_id: string }): Promise<CreditCheckResult> {
    try {
      // Safe Haven's Identity and Credit Check API provides credit information
      const result = await safeHavenRequest('/identity/v2/initiate', 'POST', {
        type: 'BVN',
        number: params.bvn,
        creditCheck: true,
      });

      // The credit check result comes back with the verification data
      const creditScore = result.data?.creditScore || result.data?.creditBureauScore || 0;
      const creditStatus = result.data?.creditStatus || result.data?.status;

      let status: CreditCheckResult['status'] = 'no_data';
      if (creditScore >= 700) status = 'good';
      else if (creditScore >= 500) status = 'fair';
      else if (creditScore > 0) status = 'poor';

      return {
        score: creditScore,
        status,
        details: result.data,
        provider: 'safehaven',
      };
    } catch (err: any) {
      return {
        score: 0,
        status: 'no_data',
        provider: 'safehaven',
        details: { error: err.message },
      };
    }
  }

  // ─── Transaction Initialization (card deposits) ───
  async initializeTransaction(params: {
    email: string;
    amount: number;
    reference: string;
    callback_url: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ authorization_url: string; reference: string }> {
    // Safe Haven has a Checkout.js flow for card payments.
    // This differs from Paystack's hosted checkout.
    // The checkout URL is constructed with the transaction reference.
    const checkoutUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/checkout?ref=${params.reference}`;

    // Create a virtual account for this transaction (time-based, 15 min)
    const va = await safeHavenRequest('/virtual-accounts', 'POST', {
      validFor: 900, // 15 minutes
      callbackUrl: params.callback_url,
      amount: Math.round(params.amount * 100),
      amountControl: 'Fixed',
      externalReference: params.reference,
    });

    return {
      authorization_url: checkoutUrl,
      reference: params.reference,
    };
  }

  async chargeAuthorization(_params: {
    authorization_code: string;
    email: string;
    amount: number;
    reference: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ status: boolean; reference: string }> {
    // Safe Haven doesn't have a card authorization charge equivalent.
    // Recurring payments would use their virtual account + transfer flow.
    // For now, return a virtual-account-based approach.
    // This is a limitation to document for the auto-save feature.
    throw new Error('Safe Haven does not support card authorization charges. Recurring payments need a different approach — use virtual account deposits or scheduled transfers.');
  }

  async verifyTransaction(reference: string): Promise<{
    status: boolean;
    amount: number;
    reference: string;
    fees: number;
    customer_email: string;
    metadata: any;
    raw: any;
  }> {
    // Check virtual account transfer status
    const result = await safeHavenRequest('/virtual-accounts/transfer-status', 'POST', {
      externalReference: reference,
    });

    const data = result.data || result;
    return {
      status: data.status === 'SUCCESS' || data.settled === true,
      amount: (data.amount || 0) / 100, // convert from kobo
      reference,
      fees: 0, // Safe Haven fees may differ — confirm from their docs
      customer_email: data.customer?.email || '',
      metadata: data.metadata || {},
      raw: data,
    };
  }
}

// ─── Webhook Signature Verification ───
export function verifySafeHavenWebhook(
  signature: string,
  payload: string
): boolean {
  // Safe Haven uses HMAC signing for webhooks.
  // The exact algorithm needs to be confirmed from their docs.
  const crypto = require('crypto');
  const secret = process.env.SAFEHAVEN_WEBHOOK_SECRET;

  if (!secret) {
    console.error('SAFEHAVEN_WEBHOOK_SECRET not configured');
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return signature === expectedSignature;
}

// ─── VAS (Value-Added Services) ───
// Safe Haven VAS API for airtime, data, cable TV, and utility bill payments.
// These are Safe Haven-specific — not part of the PaymentService interface.

export interface VASService {
  _id: string;
  name: string;
  identifier: string;
  description: string;
}

export interface VASCategory {
  _id: string;
  name: string;
  description?: string;
  type?: string;
}

export interface VASProduct {
  _id: string;
  name: string;
  bundleCode?: string;
  amount?: number;
  description?: string;
  duration?: string;
}

export interface VASTransaction {
  id: string;
  reference: string;
  status: string;
  amount: number;
  serviceCategoryId: string;
}

// Get all VAS services (Airtime, Data, Cable TV, Utility Bills)
export async function getVASServices(): Promise<VASService[]> {
  const result = await safeHavenRequest('/vas/services', 'GET');
  return result.data || result || [];
}

// Get categories for a specific VAS service (e.g. MTN, Glo, Airtel for airtime)
export async function getVASServiceCategories(serviceId: string): Promise<VASCategory[]> {
  const result = await safeHavenRequest(`/vas/services/${serviceId}/categories`, 'GET');
  return result.data || result || [];
}

// Get products/bundles for a specific category (e.g. data plans for MTN)
export async function getVASCategoryProducts(categoryId: string): Promise<VASProduct[]> {
  const result = await safeHavenRequest(`/vas/categories/${categoryId}/products`, 'GET');
  return result.data || result || [];
}

// Verify a meter number (electricity) or smart card number (cable TV)
export async function verifyVASAccount(params: {
  type: 'electricity' | 'cable';
  accountNumber: string;  // meter number or card number
  serviceCategoryId: string;
}): Promise<{ valid: boolean; vendType?: string; accountName?: string; message?: string }> {
  try {
    const result = await safeHavenRequest('/vas/verify', 'POST', {
      type: params.type,
      accountNumber: params.accountNumber,
      serviceCategoryId: params.serviceCategoryId,
    });
    return {
      valid: result.data?.status === 'success' || result.statusCode === 200,
      vendType: result.data?.vendType,
      accountName: result.data?.accountName,
      message: result.data?.message || result.message,
    };
  } catch (err: any) {
    return { valid: false, message: err.message };
  }
}

// Purchase airtime
export async function purchaseAirtime(params: {
  serviceCategoryId: string;
  amount: number;           // in Naira
  debitAccountNumber: string;
  phoneNumber: string;
  externalReference?: string;
}): Promise<VASTransaction> {
  const result = await safeHavenRequest('/vas/pay/airtime', 'POST', {
    serviceCategoryId: params.serviceCategoryId,
    amount: Math.round(params.amount * 100), // convert to kobo
    channel: 'WEB',
    debitAccountNumber: params.debitAccountNumber,
    phoneNumber: params.phoneNumber,
    externalReference: params.externalReference,
  });
  return {
    id: result.data?.id || '',
    reference: result.data?.reference || '',
    status: result.data?.status || 'pending',
    amount: params.amount,
    serviceCategoryId: params.serviceCategoryId,
  };
}

// Purchase a data bundle
export async function purchaseDataBundle(params: {
  serviceCategoryId: string;
  bundleCode: string;
  amount: number;           // in Naira
  debitAccountNumber: string;
  phoneNumber: string;
  externalReference?: string;
}): Promise<VASTransaction> {
  const result = await safeHavenRequest('/vas/pay/data', 'POST', {
    serviceCategoryId: params.serviceCategoryId,
    bundleCode: params.bundleCode,
    amount: Math.round(params.amount * 100), // convert to kobo
    channel: 'WEB',
    debitAccountNumber: params.debitAccountNumber,
    phoneNumber: params.phoneNumber,
    externalReference: params.externalReference,
  });
  return {
    id: result.data?.id || '',
    reference: result.data?.reference || '',
    status: result.data?.status || 'pending',
    amount: params.amount,
    serviceCategoryId: params.serviceCategoryId,
  };
}

// Purchase a cable TV subscription
export async function purchaseCableTV(params: {
  serviceCategoryId: string;
  bundleCode: string;
  amount: number;
  debitAccountNumber: string;
  cardNumber: string;       // smart card number
  externalReference?: string;
}): Promise<VASTransaction> {
  const result = await safeHavenRequest('/vas/pay/cable-tv', 'POST', {
    serviceCategoryId: params.serviceCategoryId,
    bundleCode: params.bundleCode,
    amount: Math.round(params.amount * 100),
    channel: 'WEB',
    debitAccountNumber: params.debitAccountNumber,
    cardNumber: params.cardNumber,
    externalReference: params.externalReference,
  });
  return {
    id: result.data?.id || '',
    reference: result.data?.reference || '',
    status: result.data?.status || 'pending',
    amount: params.amount,
    serviceCategoryId: params.serviceCategoryId,
  };
}

// Pay a utility bill (electricity)
export async function payUtilityBill(params: {
  serviceCategoryId: string;
  amount: number;
  debitAccountNumber: string;
  meterNumber: string;
  vendType: string;         // returned from verifyVASAccount
  externalReference?: string;
}): Promise<VASTransaction> {
  const result = await safeHavenRequest('/vas/pay/utility', 'POST', {
    serviceCategoryId: params.serviceCategoryId,
    amount: Math.round(params.amount * 100),
    channel: 'WEB',
    debitAccountNumber: params.debitAccountNumber,
    meterNumber: params.meterNumber,
    vendType: params.vendType,
    externalReference: params.externalReference,
  });
  return {
    id: result.data?.id || '',
    reference: result.data?.reference || '',
    status: result.data?.status || 'pending',
    amount: params.amount,
    serviceCategoryId: params.serviceCategoryId,
  };
}

// ─── KYC Tier / Verification Level ───
// Fetch the user's current KYC tier from Safe Haven
export interface KYCTierResult {
  level: number;
  label: string;
  description: string;
  benefits: string[];
}

export async function getKYCTier(accountId?: string): Promise<KYCTierResult | null> {
  try {
    // Safe Haven doesn't have a dedicated "KYC tier" endpoint,
    // but account details include verification status.
    // We infer tier from the account verification status.
    if (!accountId) return null;

    const result = await safeHavenRequest(`/accounts/${accountId}`, 'GET');
    const verificationStatus = result.data?.verificationStatus || result.verificationStatus || 'pending';

    // Map Safe Haven verification levels to AgroEsusu tiers
    const tiers: Record<string, KYCTierResult> = {
      verified: {
        level: 3,
        label: 'Verified',
        description: 'Full KYC verified',
        benefits: ['Higher loan limits (up to ₦500K)', 'Longer HarvestLock terms', 'Faster disbursements'],
      },
      pending: {
        level: 2,
        label: 'Pending Verification',
        description: 'Verification in progress',
        benefits: ['Moderate loan limits (up to ₦150K)', 'Standard HarvestLock terms'],
      },
      unverified: {
        level: 1,
        label: 'Basic',
        description: 'BVN verified, full KYC pending',
        benefits: ['Starter loan limits (up to ₦30K)', 'AgroFlex and AgroGoal savings'],
      },
    };

    return tiers[verificationStatus] || tiers.unverified;
  } catch {
    return null;
  }
}
