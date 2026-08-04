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
  IntegrationError,
  Bank,
} from '../types';
import { SafeHavenClient } from './client';
import { SafeHavenConfig } from './factory';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

/**
 * Safe Haven Adapter — implements IBankingProvider.
 * 
 * Translates between our domain DTOs and Safe Haven's API shapes.
 * This is the ONLY place that knows about Safe Haven's API structure.
 * Domain modules never see Safe Haven's raw response objects.
 * 
 * Idempotency: Every call checks the idempotency_keys table before executing.
 * On retry (network timeout, mobile refresh), the stored result is returned.
 */

interface IdempotencyRecord {
  status: string;
  response: unknown;
}

export class SafeHavenAdapter implements IBankingProvider {
  private client: SafeHavenClient;
  private config: SafeHavenConfig;
  private supabase: any = null;

  constructor(config: SafeHavenConfig) {
    this.config = config;
    this.client = new SafeHavenClient({
      baseUrl: config.baseUrl,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    });
  }

  // ===========================================================================
  // Authentication
  // ===========================================================================

  async authenticate(): Promise<{ accessToken: string; expiresIn: number; ibsClientId: string }> {
    const token = await this.client.authenticate();
    return {
      accessToken: token.accessToken,
      expiresIn: Math.floor((token.expiresAt - Date.now()) / 1000),
      ibsClientId: token.ibsClientId,
    };
  }

  // ===========================================================================
  // Identity Verification (BVN/NIN)
  // ===========================================================================

  async initiateIdentityVerification(params: InitiateVerificationParams): Promise<InitiateVerificationResult> {
    const idempotencyKey = this.generateIdempotencyKey('initiate_verification', params.customerId, params);

    return this.withIdempotency(idempotencyKey, async () => {
      const response = await this.client.post('/identity/v2', {
        type: params.type,
        number: params.number,
        debitAccountNumber: params.debitAccountNumber,
        async: false,
      });

      const data = response.data as Record<string, unknown>;
      const identityId = data._id as string || data.identityId as string;

      if (!identityId) {
        throw new IntegrationError(
          'Safe Haven did not return an identity ID',
          'VERIFICATION_INITIATE_FAILED',
          true, // retryable
          response.status
        );
      }

      return { identityId, status: 'otp_sent' as const };
    });
  }

  async validateIdentityVerification(params: ValidateVerificationParams): Promise<ValidateVerificationResult> {
    const idempotencyKey = this.generateIdempotencyKey('validate_verification', params.customerId, params);

    return this.withIdempotency(idempotencyKey, async () => {
      const response = await this.client.post('/identity/v2/validate', {
        identityId: params.identityId,
        type: params.type,
        otp: params.otp,
      });

      const data = response.data as Record<string, unknown>;

      // Check if verification was successful
      // Safe Haven returns the verified identity details on success
      if (response.status === 200 && data) {
        return {
          verified: true,
          firstName: data.firstName as string | undefined,
          lastName: data.lastName as string | undefined,
          middleName: data.middleName as string | undefined,
          phoneNumber: data.phoneNumber as string | undefined,
          dateOfBirth: data.dateOfBirth as string | undefined,
          gender: data.gender as string | undefined,
        };
      }

      return { verified: false };
    });
  }

  // ===========================================================================
  // Sub Account (DVA) Creation
  // ===========================================================================

  async createSubAccount(params: CreateSubAccountParams): Promise<CreateSubAccountResult> {
    const idempotencyKey = this.generateIdempotencyKey('create_sub_account', params.identityVerificationId, params);

    return this.withIdempotency(idempotencyKey, async () => {
      const response = await this.client.post('/accounts/v2/subaccount', {
        firstName: params.firstName,
        lastName: params.lastName,
        email: params.email,
        phoneNumber: params.phoneNumber,
        bvn: params.bvn,
      });

      const data = response.data as Record<string, unknown>;
      
      // Safe Haven returns account details on success
      const accountData = (data.account || data.data || data) as Record<string, unknown>;

      return {
        accountId: accountData._id as string || accountData.id as string,
        accountNumber: accountData.accountNumber as string,
        accountName: accountData.accountName as string || params.customerName,
        bankName: 'Safe Haven MFB',
        bankCode: '999240',
      };
    });
  }

  // ===========================================================================
  // Account Balance
  // ===========================================================================

  async getAccountBalance(accountId: string): Promise<AccountBalanceResult> {
    // Balance queries are NOT idempotent (balance changes over time) — skip idempotency
    const response = await this.client.get(`/accounts/${accountId}`);

    const data = response.data as Record<string, unknown>;
    const accountData = (data.account || data.data || data) as Record<string, unknown>;

    return {
      accountId,
      accountNumber: accountData.accountNumber as string,
      balance: Number(accountData.balance || 0),
      currency: 'NGN',
      availableBalance: Number(accountData.availableBalance || accountData.balance || 0),
      ledgerBalance: Number(accountData.ledgerBalance || accountData.balance || 0),
      lastUpdated: new Date().toISOString(),
    };
  }

  // ===========================================================================
  // Transfers
  // ===========================================================================


  async listBanks(): Promise<Bank[]> {
    const response = await this.client.get('/transfers/banks');
    const data = response.data as Array<Record<string, unknown>>;
    return (data || []).map((bank) => ({
      bankCode: bank.bankCode as string,
      bankName: bank.bankName as string,
      logoUrl: bank.logoUrl as string | undefined,
    }));
  }

  async nameEnquiry(params: NameEnquiryParams): Promise<NameEnquiryResult> {
    const response = await this.client.post('/transfers/name-enquiry', {
      accountNumber: params.accountNumber,
      bankCode: params.bankCode,
    });

    const data = response.data as Record<string, unknown>;

    return {
      sessionId: data.sessionId as string || data.sessionReference as string,
      accountName: data.accountName as string,
      accountNumber: params.accountNumber,
      bankCode: params.bankCode,
      bankName: data.bankName as string || 'Unknown',
    };
  }

  async transfer(params: TransferParams): Promise<TransferResult> {
    const idempotencyKey = this.generateIdempotencyKey('transfer', params.paymentReference, params);

    return this.withIdempotency(idempotencyKey, async () => {
      const response = await this.client.post('/transfers', {
        nameEnquiryReference: params.nameEnquiryReference,
        debitAccountNumber: params.debitAccountNumber,
        beneficiaryBankCode: params.beneficiaryBankCode,
        beneficiaryAccountNumber: params.beneficiaryAccountNumber,
        amount: params.amount,
        narration: params.narration,
        paymentReference: params.paymentReference,
        saveBeneficiary: params.saveBeneficiary ?? false,
      });

      const data = response.data as Record<string, unknown>;

      return {
        reference: (data.reference as string) || params.paymentReference,
        status: data.status === 'success' ? 'success' : data.status === 'pending' ? 'pending' : 'failed',
        message: data.message as string | undefined,
      };
    });
  }

  async getTransferStatus(reference: string): Promise<TransferResult> {
    const response = await this.client.post('/transfers/status', {
      paymentReference: reference,
    });

    const data = response.data as Record<string, unknown>;

    return {
      reference,
      status: data.status === 'success' ? 'success' : data.status === 'pending' ? 'pending' : 'failed',
      message: data.message as string | undefined,
    };
  }

  // ===========================================================================
  // Webhook Signature Verification
  // ===========================================================================

  verifyWebhookSignature(signature: string, body: string): boolean {
    if (!this.config.webhookSecret) {
      console.warn('[SafeHavenAdapter] No webhook secret configured — rejecting');
      return false;
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.config.webhookSecret)
        .update(body)
        .digest('hex');

      if (signature.length !== expectedSignature.length) {
        return false;
      }

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch {
      return false;
    }
  }

  // ===========================================================================
  // Idempotency
  // ===========================================================================

  private generateIdempotencyKey(operation: string, entityId: string, params: unknown): string {
    const requestHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(params))
      .digest('hex')
      .substring(0, 16);

    return `${operation}:${entityId}:${requestHash}`;
  }

  private async withIdempotency<T>(
    key: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const supabase = this.getSupabase();

    // Check for existing result
    const { data: existing } = await supabase
      .from('idempotency_keys')
      .select('status, response')
      .eq('key', key)
      .maybeSingle();

    const existingRecord = existing as IdempotencyRecord | null;

    if (existingRecord) {
      if (existingRecord.status === 'completed') {
        // Return stored result — no duplicate execution
        return existingRecord.response as T;
      }
      if (existingRecord.status === 'in_progress') {
        throw new IntegrationError(
          'Operation already in progress',
          'IDEMPOTENCY_IN_PROGRESS',
          true,
        );
      }
      if (existingRecord.status === 'failed') {
        // Previous attempt failed — allow retry by deleting old key
        await supabase.from('idempotency_keys').delete().eq('key', key);
      }
    }

    // Insert in_progress marker
    await supabase.from('idempotency_keys').insert({
      key,
      operation_type: key.split(':')[0],
      entity_id: key.split(':')[1],
      request_hash: key.split(':')[2],
      status: 'in_progress',
    } as Record<string, unknown>);

    // Execute the operation
    try {
      const result = await operation();

      // Store the result
      await supabase
        .from('idempotency_keys')
        .update({
          status: 'completed',
          response: result as Record<string, unknown>,
          completed_at: new Date().toISOString(),
        } as Record<string, unknown>)
        .eq('key', key);

      return result;

    } catch (error) {
      // Mark as failed
      await supabase
        .from('idempotency_keys')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
        } as Record<string, unknown>)
        .eq('key', key);

      throw error;
    }
  }

  // ===========================================================================
  // Supabase client
  // ===========================================================================

  private getSupabase(): any {
    if (!this.supabase) {
      const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
      
      if (!url || !key) {
        throw new IntegrationError(
          'Missing Supabase configuration for idempotency storage',
          'CONFIG_ERROR',
          false,
        );
      }

      this.supabase = createClient(url, key);
    }

    return this.supabase;
  }
}
