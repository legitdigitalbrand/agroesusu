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
    account_id?: string;
    account_name?: string;
    group_id?: string;
    cycle_number?: number;
    contribution_id?: string;
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

export async function initiateTransfer(params: {
  amount: number; // in Naira
  recipient_code: string;
  reference: string;
  reason: string;
}): Promise<any> {
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

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.message || "Paystack transfer failed");
  }
  return json;
}

export interface PaystackBank {
  name: string;
  code: string;
  slug: string;
}

export async function listBanks(): Promise<PaystackBank[]> {
  const response = await fetch(
    `${PAYSTACK_BASE_URL}/bank?country=nigeria&currency=NGN`,
    {
      headers: { Authorization: `Bearer ${SECRET_KEY}` },
    }
  );
  const json = await response.json();
  if (!response.ok || !json.status) {
    throw new Error(json.message || "Failed to fetch bank list");
  }
  return (json.data || []).map((b: any) => ({
    name: b.name,
    code: b.code,
    slug: b.slug,
  }));
}

export async function resolveAccountNumber(
  account_number: string,
  bank_code: string
): Promise<{ account_number: string; account_name: string }> {
  const response = await fetch(
    `${PAYSTACK_BASE_URL}/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`,
    {
      headers: { Authorization: `Bearer ${SECRET_KEY}` },
    }
  );
  const json = await response.json();
  if (!response.ok || !json.status) {
    throw new Error(json.message || "Could not resolve account number");
  }
  return json.data;
}

export async function createTransferRecipient(params: {
  name: string;
  account_number: string;
  bank_code: string;
}): Promise<{ recipient_code: string }> {
  const response = await fetch(`${PAYSTACK_BASE_URL}/transferrecipient`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "nuban",
      name: params.name,
      account_number: params.account_number,
      bank_code: params.bank_code,
      currency: "NGN",
    }),
  });

  const json = await response.json();
  if (!response.ok || !json.status) {
    throw new Error(json.message || "Failed to create transfer recipient");
  }
  return { recipient_code: json.data.recipient_code };
}

export function generateReference(prefix: string = "AGC"): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000000)
    .toString()
    .padStart(6, "0");
  return `${prefix}_${timestamp}_${random}`;
}
