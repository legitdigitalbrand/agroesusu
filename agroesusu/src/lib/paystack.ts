/**
 * Paystack Payment Integration
 * Handles transaction initialization, verification, and transfers
 */

const PAYSTACK_BASE_URL = "https://api.paystack.co";
const SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

interface InitializeTxnParams {
  email: string;
  amount: number; // in kobo (1 Naira = 100 kobo)
  reference: string;
  callback_url: string;
  metadata?: {
    user_id: string;
    account_id: string;
    account_name: string;
  };
}

interface InitializeTxnResponse {
  status: boolean;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

interface VerifyTxnResponse {
  status: boolean;
  data: {
    id: number;
    reference: string;
    amount: number; // in kobo
    status: "success" | "failed" | "abandoned" | "pending";
    gateway_response: string;
    channel: string;
    currency: string;
    customer: {
      email: string;
      customer_code?: string;
      id?: number;
    };
    metadata: {
      user_id?: string;
      account_id?: string;
      account_name?: string;
    };
    fees: number;
    created_at: string;
    paid_at: string;
  };
}

export async function initializeTransaction(
  params: InitializeTxnParams
): Promise<InitializeTxnResponse> {
  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      amount: Math.round(params.amount * 100), // Convert to kobo
      reference: params.reference,
      callback_url: params.callback_url,
      metadata: params.metadata,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Paystack init failed: ${error}`);
  }

  return response.json();
}

export async function verifyTransaction(
  reference: string
): Promise<VerifyTxnResponse> {
  const response = await fetch(
    `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Paystack verify failed: ${error}`);
  }

  return response.json();
}

export async function initiateTransfer(
  params: {
    amount: number; // in Naira
    recipient_code: string;
    reference: string;
    reason: string;
  }
): Promise<any> {
  const response = await fetch(`${PAYSTACK_BASE_URL}/transfer`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source: "balance",
      amount: Math.round(params.amount * 100), // Convert to kobo
      recipient: params.recipient_code,
      reference: params.reference,
      reason: params.reason,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Paystack transfer failed: ${error}`);
  }

  return response.json();
}

export function generateReference(prefix: string = "AGC"): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000000)
    .toString()
    .padStart(6, "0");
  return `${prefix}_${timestamp}_${random}`;
}
