export interface BvnVerificationResponse {
  bvn: string;
  first_name: string;
  last_name: string;
  dob: string;
  gender: string;
  phone: string;
  photo_url: string;
  verified: boolean;
}

export interface CreateDvaRequest {
  account_name: string;
  bvn: string;
  email: string;
  phone: string;
}

export interface CreateDvaResponse {
  account_number: string;
  account_name: string;
  bank_name: string;
}

export interface TransferRequest {
  amount: number;
  recipient_account: string;
  recipient_bank: string;
  narration: string;
  reference: string;
}

export interface TransferResponse {
  status: string;
  reference: string;
  safe_haven_reference: string;
}

export interface Transaction {
  type: string;
  amount: number;
  status: string;
  reference: string;
  date: string;
}

export interface TransactionHistoryResponse {
  transactions: Transaction[];
}

export interface TransferStatusResponse {
  status: string;
  amount: number;
  recipient: string;
  date: string;
}

export interface BillPaymentRequest {
  category: string;
  vendor: string;
  amount: number;
  customer_id: string;
}

export interface BillPaymentResponse {
  status: string;
  reference: string;
}

export interface WebhookEvent {
  event_type: string;
  reference: string;
  amount: number;
  account_number: string;
  status: string;
  signature: string;
}
