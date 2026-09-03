import {
  IBankingProvider,
  InitiateVerificationParams,
  InitiateVerificationResult,
  ValidateVerificationParams,
  ValidateVerificationResult,
  CreateSubAccountParams,
  CreateSubAccountResult,
  AccountBalanceResult,
  NameEnquiryParams,
  NameEnquiryResult,
  TransferParams,
  TransferResult,
  Bank,
} from '../types';

/**
 * Mock Banking Provider — for development without Safe Haven credentials.
 * Returns deterministic, realistic responses. No actual API calls are made.
 * 
 * Set SAFE_HAVEN_ENV=mock (or omit credentials) to use this provider.
 */
export class MockBankingProvider implements IBankingProvider {
  private identities = new Map<string, { type: string; number: string; otp: string }>();

  async authenticate(): Promise<{ accessToken: string; expiresIn: number; ibsClientId: string }> {
    await this.delay(100);
    return {
      accessToken: 'mock-access-token-' + Date.now(),
      expiresIn: 3600,
      ibsClientId: 'mock-ibs-client-id',
    };
  }

  async initiateIdentityVerification(params: InitiateVerificationParams): Promise<InitiateVerificationResult> {
    await this.delay(500);
    const identityId = 'mock-identity-' + Date.now();
    // Store for validation step — mock OTP is always "123456"
    this.identities.set(identityId, {
      type: params.type,
      number: params.number,
      otp: '123456',
    });
    return { identityId, status: 'otp_sent' };
  }

  async validateIdentityVerification(params: ValidateVerificationParams): Promise<ValidateVerificationResult> {
    await this.delay(500);
    // ── MOCK MODE: stateless validation ──
    // The in-memory `identities` Map does NOT survive Vercel serverless cold starts,
    // so we cannot rely on it to validate the OTP. Instead, mock mode accepts:
    //   1. The documented test code "123456", OR
    //   2. Any 6-digit numeric code
    // This makes mock mode fully testable regardless of server instance.
    // In production (SAFE_HAVEN_ENV=sandbox), the real Safe Haven API validates the OTP.
    if (!params.otp || !/^\d{6}$/.test(params.otp)) {
      return { verified: false };
    }
    return {
      verified: true,
      firstName: 'John',
      lastName: 'Doe',
      middleName: 'A',
      phoneNumber: '+2348012345678',
      dateOfBirth: '1990-01-15',
      gender: 'male',
    };
  }

  async createSubAccount(params: CreateSubAccountParams): Promise<CreateSubAccountResult> {
    await this.delay(800);
    const accountNumber = String(1000000000 + Math.floor(Math.random() * 8999999999));
    return {
      accountId: 'mock-account-' + Date.now(),
      accountNumber,
      accountName: params.customerName,
      bankName: 'Safe Haven MFB',
      bankCode: '999240',
    };
  }

  async getAccountBalance(accountId: string): Promise<AccountBalanceResult> {
    await this.delay(300);
    return {
      accountId,
      accountNumber: '0000000000',
      balance: 0,
      currency: 'NGN',
      availableBalance: 0,
      ledgerBalance: 0,
      lastUpdated: new Date().toISOString(),
    };
  }


  async listBanks(): Promise<Bank[]> {
    await this.delay(200);
    return [
      { bankCode: '999240', bankName: 'Safe Haven MFB', logoUrl: undefined },
      { bankCode: '058', bankName: 'GTBank', logoUrl: undefined },
      { bankCode: '057', bankName: 'Zenith Bank', logoUrl: undefined },
      { bankCode: '033', bankName: 'United Bank for Africa (UBA)', logoUrl: undefined },
      { bankCode: '011', bankName: 'First Bank of Nigeria', logoUrl: undefined },
      { bankCode: '070', bankName: 'Fidelity Bank', logoUrl: undefined },
      { bankCode: '035', bankName: 'Wema Bank', logoUrl: undefined },
      { bankCode: '082', bankName: 'Keystone Bank', logoUrl: undefined },
      { bankCode: '076', bankName: 'Polaris Bank', logoUrl: undefined },
      { bankCode: '030', bankName: 'Heritage Bank', logoUrl: undefined },
      { bankCode: '221', bankName: 'Stanbic IBTC Bank', logoUrl: undefined },
      { bankCode: '032', bankName: 'Union Bank', logoUrl: undefined },
      { bankCode: '215', bankName: 'Unity Bank', logoUrl: undefined },
      { bankCode: '044', bankName: 'Access Bank', logoUrl: undefined },
      { bankCode: '502', bankName: 'Kuda Microfinance Bank', logoUrl: undefined },
      { bankCode: '560', bankName: 'Opay', logoUrl: undefined },
      { bankCode: '512', bankName: 'PalmPay', logoUrl: undefined },
      { bankCode: '322', bankName: 'Titan Trust Bank', logoUrl: undefined },
      { bankCode: '401', bankName: ' Providus Bank', logoUrl: undefined },
      { bankCode: '090', bankName: 'Moniepoint MFB', logoUrl: undefined },
    ];
  }

  async nameEnquiry(params: NameEnquiryParams): Promise<NameEnquiryResult> {
    await this.delay(400);
    return {
      sessionId: 'mock-session-' + Date.now(),
      accountName: 'Test Account',
      accountNumber: params.accountNumber,
      bankCode: params.bankCode,
      bankName: 'Safe Haven MFB',
    };
  }

  async transfer(params: TransferParams): Promise<TransferResult> {
    await this.delay(600);
    return {
      reference: params.paymentReference || 'mock-txn-' + Date.now(),
      status: 'success',
      message: 'Mock transfer successful',
    };
  }

  async getTransferStatus(reference: string): Promise<TransferResult> {
    await this.delay(200);
    return {
      reference,
      status: 'success',
      rawStatus: 'success',
      message: 'Transfer completed (mock)',
    };
  }

  verifyWebhookSignature(_signature: string, _body: string): boolean {
    // Mock mode: always accept
    return true;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
