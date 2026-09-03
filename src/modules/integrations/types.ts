// Identity Verification
export type IdentityType = 'BVN' | 'NIN';
export type VerificationStatus = 'not_started' | 'initiate_pending' | 'otp_sent' | 'validate_pending' | 'verified' | 'rejected';

export interface InitiateVerificationParams {
  type: IdentityType;
  number: string;  // BVN (11 digits) or NIN (11 digits)
  debitAccountNumber: string;  // Safe Haven requires this
  customerId: string;  // Our customer ID (for correlation)
}

export interface InitiateVerificationResult {
  identityId: string;  // Safe Haven's identity ID for the validate step
  status: 'otp_sent';
}

export interface ValidateVerificationParams {
  identityId: string;
  type: IdentityType;
  otp: string;
  customerId: string;
}

export interface ValidateVerificationResult {
  verified: boolean;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  gender?: string;
}

// Sub Account (DVA) Creation
export interface CreateSubAccountParams {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;  // +234 format
  bvn: string;
  identityVerificationId: string;  // From the validation step
  customerName: string;  // Account name
}

export interface CreateSubAccountResult {
  accountId: string;  // Safe Haven account ID
  accountNumber: string;  // The DVA account number (10 digits)
  accountName: string;
  bankName: string;
  bankCode: string;
}

// Account Balance
export interface AccountBalanceResult {
  accountId: string;
  accountNumber: string;
  balance: number;
  currency: string;  // 'NGN'
  availableBalance: number;
  ledgerBalance: number;
  lastUpdated: string;  // ISO timestamp
}

// Transfer
export interface NameEnquiryParams {
  accountNumber: string;
  bankCode: string;
}

export interface NameEnquiryResult {
  sessionId: string;  // Used for the transfer call
  accountName: string;
  accountNumber: string;
  bankCode: string;
  bankName: string;
}

export interface TransferParams {
  nameEnquiryReference: string;  // sessionId from name enquiry
  debitAccountNumber: string;
  beneficiaryBankCode: string;
  beneficiaryAccountNumber: string;
  amount: number;
  narration: string;
  paymentReference: string;
  saveBeneficiary?: boolean;
}

export interface TransferResult {
  reference: string;
  status: 'success' | 'pending' | 'failed';
  message?: string;
  /**
   * Raw provider status string (e.g. 'success', 'pending', 'failed',
   * 'reversed', 'REVERSED'), when the provider response exposes one.
   * Used by reconciliation to distinguish a REVERSAL (funds returned by the
   * provider) from a plain failure — both release our escrow, but they are
   * different auditable outcomes.
   */
  rawStatus?: string;
}


// Banks
export interface Bank {
  bankCode: string;
  bankName: string;
  logoUrl?: string;
}

// Webhook
export interface WebhookEvent {
  eventType: string;
  eventData: Record<string, unknown>;
  rawPayload: string;
  signature: string;
  timestamp: string;
}

// Banking Provider Interface
export interface IBankingProvider {
  authenticate(): Promise<{ accessToken: string; expiresIn: number; ibsClientId: string }>;
  initiateIdentityVerification(params: InitiateVerificationParams): Promise<InitiateVerificationResult>;
  validateIdentityVerification(params: ValidateVerificationParams): Promise<ValidateVerificationResult>;
  createSubAccount(params: CreateSubAccountParams): Promise<CreateSubAccountResult>;
  getAccountBalance(accountId: string): Promise<AccountBalanceResult>;
  listBanks(): Promise<Bank[]>;
  nameEnquiry(params: NameEnquiryParams): Promise<NameEnquiryResult>;
  transfer(params: TransferParams): Promise<TransferResult>;
  getTransferStatus(reference: string): Promise<TransferResult>;
  verifyWebhookSignature(signature: string, body: string): boolean;
}

// Integration Error Class
export class IntegrationError extends Error {
  code: string;
  retryable: boolean;
  statusCode?: number;
  rawError?: any;

  constructor(message: string, code: string, retryable: boolean = false, statusCode?: number, rawError?: any) {
    super(message);
    this.name = 'IntegrationError';
    this.code = code;
    this.retryable = retryable;
    this.statusCode = statusCode;
    this.rawError = rawError;
  }
}
