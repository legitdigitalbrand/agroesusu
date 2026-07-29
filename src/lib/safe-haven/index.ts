// ============================================================================
// Safe Haven Banking API — Interface + Mock Implementation
// The real client will be swapped in when API credentials are provided.
// ============================================================================

export interface ISafeHavenClient {
  createCustomer(params: { firstName: string; lastName: string; email: string; phone: string; bvn?: string }): Promise<{ customerId: string }>;
  createWallet(params: { customerId: string; name: string }): Promise<{ accountNumber: string; accountName: string; bankName: string }>;
  createVirtualAccount(params: { customerId: string; name: string; amount?: number }): Promise<{ accountNumber: string; accountName: string; bankName: string }>;
  getAccountBalance(accountNumber: string): Promise<{ balance: number }>;
  getAccountTransactions(accountNumber: string): Promise<unknown[]>;
  verifyBVN(bvn: string): Promise<{ valid: boolean; firstName: string; lastName: string; phone: string; dob: string }>;
  transferFunds(params: { fromAccount: string; toAccount: string; amount: number; narration: string }): Promise<{ reference: string; status: string }>;
  disburseLoan(params: { toAccount: string; amount: number; narration: string }): Promise<{ reference: string; status: string }>;
  verifyWebhookSignature(_signature: string, _body: string): boolean;
}

// Mock implementation for development
export class MockSafeHavenClient implements ISafeHavenClient {
  async createCustomer(_params: { firstName: string; lastName: string; email: string; phone: string; bvn?: string }) {
    await this.delay();
    return { customerId: `SHC${Date.now()}` };
  }

  async createWallet(params: { customerId: string; name: string }) {
    await this.delay();
    return {
      accountNumber: String(Math.floor(1000000000 + Math.random() * 8999999999)),
      accountName: params.name,
      bankName: "Safe Haven MFB",
    };
  }

  async createVirtualAccount(params: { customerId: string; name: string; amount?: number }) {
    await this.delay();
    return {
      accountNumber: String(Math.floor(1000000000 + Math.random() * 8999999999)),
      accountName: params.name,
      bankName: "Safe Haven MFB",
    };
  }

  async getAccountBalance(_accountNumber: string) {
    await this.delay();
    return { balance: Math.floor(Math.random() * 1000000) };
  }

  async getAccountTransactions(_accountNumber: string) {
    await this.delay();
    return [];
  }

  async verifyBVN(bvn: string) {
    await this.delay();
    return {
      valid: bvn.length === 11,
      firstName: "John",
      lastName: "Doe",
      phone: "08012345678",
      dob: "1990-01-01",
    };
  }

  async transferFunds(_params: { fromAccount: string; toAccount: string; amount: number; narration: string }) {
    await this.delay();
    return { reference: `TXN${Date.now()}`, status: "success" };
  }

  async disburseLoan(_params: { toAccount: string; amount: number; narration: string }) {
    await this.delay();
    return { reference: `DBT${Date.now()}`, status: "success" };
  }

  verifyWebhookSignature(_signature: string, _body: string) {
    return true;
  }

  private delay(ms = 300): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Factory — returns mock client until live credentials are available
export function getSafeHavenClient(): ISafeHavenClient {
  const hasCredentials = process.env.SAFE_HAVEN_API_KEY && process.env.SAFE_HAVEN_SECRET_KEY;
  if (hasCredentials) {
    // TODO: return new SafeHavenClient(...) when credentials are available
    console.warn("[Safe Haven] Credentials detected but live client not yet implemented. Using mock.");
  }
  return new MockSafeHavenClient();
}
