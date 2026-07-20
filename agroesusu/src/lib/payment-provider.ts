/**
 * AgroEsusu — Payment Provider Abstraction Layer
 *
 * This module abstracts the underlying payment/banking provider so the app
 * can route through either Paystack or Safe Haven MFB based on a feature flag.
 *
 * Set PAYMENT_PROVIDER environment variable to 'paystack' or 'safehaven'.
 * Defaults to 'paystack' for backward compatibility.
 *
 * This allows parallel-running both providers during migration without
 * code changes — just flip the env var.
 */

export type PaymentProvider = 'paystack' | 'safehaven';

export const PAYMENT_PROVIDER: PaymentProvider =
  (process.env.PAYMENT_PROVIDER as PaymentProvider) || 'paystack';

export interface VirtualAccount {
  account_number: string;
  bank_name: string;
  bank_code?: string;
  account_name: string;
  provider: PaymentProvider;
  raw?: any;
}

export interface TransferResult {
  reference: string;
  status: 'success' | 'pending' | 'failed';
  provider: PaymentProvider;
  raw?: any;
}

export interface TransferRecipient {
  recipient_code: string;
  provider: PaymentProvider;
}

export interface VerificationResult {
  status: 'verified' | 'pending_review' | 'failed';
  first_name?: string;
  last_name?: string;
  raw?: any;
  provider: PaymentProvider;
}

export interface CreditCheckResult {
  score: number;
  status: 'good' | 'fair' | 'poor' | 'no_data';
  details?: any;
  provider: PaymentProvider;
}

export interface BankListResult {
  name: string;
  code: string;
  slug?: string;
}

export interface AccountResolution {
  account_number: string;
  account_name: string;
}

/**
 * Unified payment service interface.
 * Both Paystack and Safe Haven implementations must conform to this.
 */
export interface PaymentService {
  provider: PaymentProvider;

  // Virtual account creation
  createVirtualAccount(params: {
    email: string;
    full_name: string;
    user_id: string;
  }): Promise<VirtualAccount>;

  // Transfers (withdrawals, payouts, disbursements)
  createTransferRecipient(params: {
    name: string;
    account_number: string;
    bank_code: string;
  }): Promise<TransferRecipient>;

  initiateTransfer(params: {
    amount: number; // in Naira
    recipient_code: string;
    reference: string;
    reason: string;
  }): Promise<TransferResult>;

  listBanks(): Promise<BankListResult[]>;

  resolveAccountNumber(
    account_number: string,
    bank_code: string
  ): Promise<AccountResolution>;

  // Identity verification
  verifyBVN(bvn: string): Promise<VerificationResult>;

  // Credit check (Safe Haven only — Paystack returns no_data)
  checkCredit(params: {
    bvn: string;
    user_id: string;
  }): Promise<CreditCheckResult>;

  // Transaction initialization (for card deposits if supported)
  initializeTransaction(params: {
    email: string;
    amount: number; // in Naira
    reference: string;
    callback_url: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ authorization_url: string; reference: string }>;

  // Charge saved card authorization
  chargeAuthorization(params: {
    authorization_code: string;
    email: string;
    amount: number;
    reference: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ status: boolean; reference: string }>;

  // Verify a transaction by reference
  verifyTransaction(reference: string): Promise<{
    status: boolean;
    amount: number;
    reference: string;
    fees: number;
    customer_email: string;
    metadata: any;
    raw: any;
  }>;
}

/**
 * Get the active payment service based on the feature flag.
 */
export async function getPaymentService(): Promise<PaymentService> {
  if (PAYMENT_PROVIDER === 'safehaven') {
    const { SafeHavenService } = await import('./safehaven');
    return new SafeHavenService();
  }

  const { PaystackService } = await import('./paystack-adapter');
  return new PaystackService();
}

/**
 * Generate a reference with the appropriate prefix.
 * Prefixes are provider-agnostic (AGC_*) so webhooks can route regardless.
 */
export function generatePaymentReference(prefix: string = 'AGC'): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000000)
    .toString()
    .padStart(6, '0');
  return `${prefix}_${timestamp}_${random}`;
}
