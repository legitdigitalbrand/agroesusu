import { ISafeHavenClient } from './client';
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

const NIGERIAN_NAMES = [
  { first_name: 'Chioma', last_name: 'Nwachukwu', gender: 'female' },
  { first_name: 'Babajide', last_name: 'Oyewole', gender: 'male' },
  { first_name: 'Aisha', last_name: 'Bello', gender: 'female' },
  { first_name: 'Abubakar', last_name: 'Ibrahim', gender: 'male' },
  { first_name: 'Yetunde', last_name: 'Adebayo', gender: 'female' },
  { first_name: 'Chukwudi', last_name: 'Okafor', gender: 'male' },
  { first_name: 'Amara', last_name: 'Eze', gender: 'female' },
  { first_name: 'Olumide', last_name: 'Balogun', gender: 'male' },
];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class MockSafeHavenClient implements ISafeHavenClient {
  async verifyBvn(bvn: string): Promise<BvnVerificationResponse> {
    await delay(600 + Math.random() * 400); // realistic delay: 600ms - 1000ms
    const isValidBvn = /^\d{11}$/.test(bvn);
    const randomName = NIGERIAN_NAMES[Math.floor(Math.random() * NIGERIAN_NAMES.length)];

    return {
      bvn,
      first_name: isValidBvn ? randomName.first_name : 'Unknown',
      last_name: isValidBvn ? randomName.last_name : 'Unknown',
      dob: isValidBvn ? '1992-08-24' : '',
      gender: isValidBvn ? randomName.gender : 'unknown',
      phone: isValidBvn ? `+23480${Math.floor(10000000 + Math.random() * 90000000)}` : '',
      photo_url: isValidBvn ? 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=120' : '',
      verified: isValidBvn,
    };
  }

  async createDVA(data: CreateDvaRequest): Promise<CreateDvaResponse> {
    await delay(800 + Math.random() * 500); // realistic delay: 800ms - 1300ms
    const accountNumber = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    return {
      account_number: accountNumber,
      account_name: data.account_name,
      bank_name: 'Agroesusu Savings Bank',
    };
  }

  async getTransactionHistory(accountNumber: string): Promise<TransactionHistoryResponse> {
    await delay(1000 + Math.random() * 600); // realistic delay: 1000ms - 1600ms
    const count = Math.floor(Math.random() * 3) + 3; // returns 3-5 mock transactions
    const transactions = Array.from({ length: count }, (_, i) => {
      const isCredit = Math.random() > 0.4;
      const amount = Math.floor(5000 + Math.random() * 45000);
      return {
        type: isCredit ? 'credit' : 'debit',
        amount,
        status: 'success',
        reference: `TXN_${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        date: new Date(Date.now() - i * 24 * 60 * 60 * 1000 - Math.random() * 12 * 60 * 60 * 1000).toISOString(),
      };
    });

    return {
      transactions,
    };
  }

  async initiateTransfer(data: TransferRequest): Promise<TransferResponse> {
    await delay(1200 + Math.random() * 800); // realistic delay: 1200ms - 2000ms
    return {
      status: 'success',
      reference: data.reference,
      safe_haven_reference: `SH_TXF_${Math.random().toString(36).substring(2, 12).toUpperCase()}`,
    };
  }

  async getTransferStatus(reference: string): Promise<TransferStatusResponse> {
    await delay(500 + Math.random() * 300); // realistic delay: 500ms - 800ms
    return {
      status: 'success',
      amount: 25000,
      recipient: 'Tunde Bakare (0123456789 - Agroesusu Savings Bank)',
      date: new Date().toISOString(),
    };
  }

  async payBill(data: BillPaymentRequest): Promise<BillPaymentResponse> {
    await delay(900 + Math.random() * 400); // realistic delay: 900ms - 1300ms
    return {
      status: 'success',
      reference: `BILL_PAY_${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
    };
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    // Returns true in mock mode as requested
    return true;
  }
}

export const mockSafeHavenClient = new MockSafeHavenClient();
