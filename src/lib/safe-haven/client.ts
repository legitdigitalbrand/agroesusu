import * as crypto from 'crypto';
import {
  BvnVerificationResponse,
  CreateDvaRequest,
  CreateDvaResponse,
  TransactionHistoryResponse,
  TransferRequest,
  TransferResponse,
  TransferStatusResponse,
  BillPaymentRequest,
  BillPaymentResponse,
} from '../types/safe-haven';

export interface ISafeHavenClient {
  verifyBvn(bvn: string): Promise<BvnVerificationResponse>;
  createDVA(data: CreateDvaRequest): Promise<CreateDvaResponse>;
  getTransactionHistory(accountNumber: string): Promise<TransactionHistoryResponse>;
  initiateTransfer(data: TransferRequest): Promise<TransferResponse>;
  getTransferStatus(reference: string): Promise<TransferStatusResponse>;
  payBill(data: BillPaymentRequest): Promise<BillPaymentResponse>;
  verifyWebhookSignature(payload: string, signature: string): boolean;
}

export class SafeHavenClient implements ISafeHavenClient {
  private baseUrl: string;
  private apiKey: string | undefined;
  private secretKey: string | undefined;
  private env: string;
  private webhookSecret: string | undefined;

  constructor() {
    this.env = process.env.SAFE_HAVEN_ENV || 'sandbox';
    this.apiKey = process.env.SAFE_HAVEN_API_KEY;
    this.secretKey = process.env.SAFE_HAVEN_SECRET_KEY;
    this.webhookSecret = process.env.SAFE_HAVEN_WEBHOOK_SECRET;

    if (process.env.SAFE_HAVEN_BASE_URL) {
      this.baseUrl = process.env.SAFE_HAVEN_BASE_URL;
    } else {
      this.baseUrl = this.env === 'production'
        ? 'https://api.safehaven.com/v1'
        : 'https://api.sandbox.safehaven.com/v1';
    }
  }

  private ensureConfigured() {
    if (!this.apiKey) {
      throw new Error(
        'Safe Haven credentials not configured — set SAFE_HAVEN_API_KEY and SAFE_HAVEN_SECRET_KEY in environment'
      );
    }
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    this.ensureConfigured();
    const url = `${this.baseUrl}${path}`;
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        let errorData: any;
        try {
          errorData = await response.json();
        } catch {
          try {
            errorData = await response.text();
          } catch {
            errorData = 'Unknown error';
          }
        }
        throw new Error(
          `Safe Haven API error [${response.status}]: ${
            typeof errorData === 'object' ? JSON.stringify(errorData) : errorData
          }`
        );
      }

      return (await response.json()) as T;
    } catch (error: any) {
      if (error.message?.includes('Safe Haven credentials not configured')) {
        throw error;
      }
      throw new Error(`Safe Haven request failed: ${error.message}`);
    }
  }

  async verifyBvn(bvn: string): Promise<BvnVerificationResponse> {
    this.ensureConfigured();
    return this.request<BvnVerificationResponse>('/bvn/verify', {
      method: 'POST',
      body: JSON.stringify({ bvn }),
    });
  }

  async createDVA(data: CreateDvaRequest): Promise<CreateDvaResponse> {
    this.ensureConfigured();
    return this.request<CreateDvaResponse>('/accounts/dva', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getTransactionHistory(accountNumber: string): Promise<TransactionHistoryResponse> {
    this.ensureConfigured();
    return this.request<TransactionHistoryResponse>(`/accounts/${accountNumber}/transactions`, {
      method: 'GET',
    });
  }

  async initiateTransfer(data: TransferRequest): Promise<TransferResponse> {
    this.ensureConfigured();
    return this.request<TransferResponse>('/transfers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getTransferStatus(reference: string): Promise<TransferStatusResponse> {
    this.ensureConfigured();
    return this.request<TransferStatusResponse>(`/transfers/${reference}`, {
      method: 'GET',
    });
  }

  async payBill(data: BillPaymentRequest): Promise<BillPaymentResponse> {
    this.ensureConfigured();
    return this.request<BillPaymentResponse>('/bills/pay', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    // Webhook verification only needs the webhook secret, NOT the API key
    if (!this.webhookSecret) {
      // In development without a webhook secret, accept all (sandbox only)
      // In production this MUST be configured
      if (this.env === 'sandbox' && !this.apiKey) {
        return true;
      }
      throw new Error('Safe Haven webhook secret not configured — set SAFE_HAVEN_WEBHOOK_SECRET in environment');
    }
    const hmac = crypto.createHmac('sha256', this.webhookSecret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');

    if (expectedSignature.length !== signature.length) {
      return false;
    }
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'utf-8'),
      Buffer.from(signature, 'utf-8')
    );
  }
}

export const safeHavenClient = new SafeHavenClient();
