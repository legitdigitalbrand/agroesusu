/**
 * Paystack Payment Service Adapter
 *
 * Wraps the existing src/lib/paystack.ts functions to conform to the
 * unified PaymentService interface. This is NOT a rewrite — it's a
 * thin adapter so the rest of the app can use either provider.
 */

import {
  initializeTransaction as paystackInit,
  verifyTransaction as paystackVerify,
  initiateTransfer as paystackTransfer,
  listBanks as paystackListBanks,
  resolveAccountNumber as paystackResolve,
  createTransferRecipient as paystackCreateRecipient,
  chargeAuthorization as paystackCharge,
  generateReference,
} from './paystack';
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

const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

export class PaystackService implements PaymentService {
  provider = 'paystack' as const;

  async createVirtualAccount(params: {
    email: string;
    full_name: string;
    user_id: string;
  }): Promise<VirtualAccount> {
    // Paystack Dedicated Virtual Account (DVA) creation
    // Note: This requires Paystack business account activation
    const response = await fetch(`${PAYSTACK_BASE_URL}/dedicated_account`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: params.email,
        first_name: params.full_name.split(' ')[0],
        last_name: params.full_name.split(' ').slice(1).join(' ') || params.full_name.split(' ')[0],
        preferred_bank: 'wema-bank',
      }),
    });

    const json = await response.json();

    if (!response.ok || !json.status) {
      // DVA not available (Paystack business account not activated)
      // Fall back to a manual review state
      throw new Error(json.message || 'Paystack DVA creation not available. Paystack business account activation required.');
    }

    return {
      account_number: json.data.account_number,
      bank_name: json.data.bank?.name || 'Wema Bank',
      bank_code: json.data.bank?.slug,
      account_name: json.data.account_name || params.full_name,
      provider: 'paystack',
      raw: json.data,
    };
  }

  async createTransferRecipient(params: {
    name: string;
    account_number: string;
    bank_code: string;
  }): Promise<TransferRecipient> {
    const result = await paystackCreateRecipient(params);
    return { recipient_code: result.recipient_code, provider: 'paystack' };
  }

  async initiateTransfer(params: {
    amount: number;
    recipient_code: string;
    reference: string;
    reason: string;
  }): Promise<TransferResult> {
    try {
      const result = await paystackTransfer(params);
      return {
        reference: params.reference,
        status: result.status ? 'pending' : 'failed',
        provider: 'paystack',
        raw: result,
      };
    } catch (err: any) {
      return {
        reference: params.reference,
        status: 'failed',
        provider: 'paystack',
        raw: { error: err.message },
      };
    }
  }

  async listBanks(): Promise<BankListResult[]> {
    const banks = await paystackListBanks();
    return banks.map(b => ({ name: b.name, code: b.code, slug: b.slug }));
  }

  async resolveAccountNumber(account_number: string, bank_code: string): Promise<AccountResolution> {
    return paystackResolve(account_number, bank_code);
  }

  async verifyBVN(bvn: string): Promise<VerificationResult> {
    const response = await fetch(`${PAYSTACK_BASE_URL}/bank/resolve_bvn/${bvn}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    const isFeatureUnavailable =
      response.status === 401 ||
      response.status === 403 ||
      /not available|not enabled|not permitted|unauthorized/i.test(data.message || '');

    if (isFeatureUnavailable) {
      return {
        status: 'pending_review',
        provider: 'paystack',
        raw: data,
      };
    }

    if (!response.ok || !data.status) {
      return {
        status: 'failed',
        provider: 'paystack',
        raw: data,
      };
    }

    return {
      status: 'verified',
      first_name: data.data?.first_name,
      last_name: data.data?.last_name,
      provider: 'paystack',
      raw: data.data,
    };
  }

  async checkCredit(_params: { bvn: string; user_id: string }): Promise<CreditCheckResult> {
    // Paystack does not offer credit checks
    return {
      score: 0,
      status: 'no_data',
      provider: 'paystack',
    };
  }

  async initializeTransaction(params: {
    email: string;
    amount: number;
    reference: string;
    callback_url: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ authorization_url: string; reference: string }> {
    const result = await paystackInit({
      email: params.email,
      amount: params.amount,
      reference: params.reference,
      callback_url: params.callback_url,
      metadata: params.metadata as any,
    });
    return {
      authorization_url: result.data.authorization_url,
      reference: result.data.reference,
    };
  }

  async chargeAuthorization(params: {
    authorization_code: string;
    email: string;
    amount: number;
    reference: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ status: boolean; reference: string }> {
    const result = await paystackCharge(params);
    return { status: result.status, reference: result.data.reference };
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
    const result = await paystackVerify(reference);
    return {
      status: result.data.status === 'success',
      amount: result.data.amount / 100, // convert kobo to naira
      reference: result.data.reference,
      fees: result.data.fees / 100,
      customer_email: result.data.customer.email,
      metadata: result.data.metadata,
      raw: result.data,
    };
  }
}
