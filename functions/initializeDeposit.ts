/**
 * AgroCycle — Initialize Deposit
 * 
 * Creates a Paystack payment session for a user deposit.
 * Frontend calls this → gets authorization URL → user pays → Paystack webhook confirms.
 * 
 * Required env vars:
 *   - PAYSTACK_SECRET_KEY
 *   - APP_BASE_URL (for callback)
 */

interface InitializeDepositPayload {
  user_id: string;
  amount: number;          // in kobo (1 naira = 100 kobo) — but we accept naira and convert
  account_id?: string;     // which savings account to credit (optional, defaults to flex)
  email: string;           // user email (Paystack requires this)
  callback_url?: string;   // override default callback
}

interface PaystackInitResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export default async function(payload: InitializeDepositPayload) {
  const { user_id, amount, account_id, email, callback_url } = payload;

  // ─── Validation ───────────────────────────────────────────
  if (!user_id || !email || !amount) {
    return {
      status: 400,
      data: { error: "Missing required fields: user_id, email, amount" }
    };
  }

  if (amount < 100) {
    return {
      status: 400,
      data: { error: "Minimum deposit is ₦100" }
    };
  }

  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
  if (!PAYSTACK_SECRET_KEY) {
    return {
      status: 500,
      data: { error: "Payment gateway not configured. Set PAYSTACK_SECRET_KEY." }
    };
  }

  // Convert naira to kobo (Paystack requires kobo)
  const amountInKobo = Math.round(amount * 100);

  // Generate unique reference
  const reference = `AGC_${Date.now()}_${user_id.substring(0, 8)}`;

  try {
    // ─── Create pending transaction record ─────────────────
    const base44 = (global as any).base44 || (globalThis as any).base44;
    
    if (base44?.entities?.Transaction) {
      await base44.entities.Transaction.create({
        user_id,
        account_id: account_id || null,
        type: "deposit",
        amount,
        payment_method: "card",
        payment_reference: reference,
        status: "pending",
        description: `Deposit of ₦${amount.toLocaleString()} to AgroCycle savings`,
        fee_amount: 0,
      });
    }

    // ─── Call Paystack Initialize Transaction API ──────────
    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: amountInKobo,
        reference,
        callback_url: callback_url || `${process.env.APP_BASE_URL || ""}/payment/callback`,
        metadata: {
          user_id,
          account_id: account_id || null,
          purpose: "agrocycle_deposit",
          custom_fields: [
            { display_name: "User ID", variable_name: "user_id", value: user_id },
            { display_name: "Account ID", variable_name: "account_id", value: account_id || "flex" },
          ],
        },
      }),
    });

    const paystackResponse: PaystackInitResponse = await response.json();

    if (!paystackResponse.status) {
      return {
        status: 400,
        data: { 
          error: "Payment initialization failed",
          details: paystackResponse.message 
        }
      };
    }

    return {
      status: 200,
      data: {
        authorization_url: paystackResponse.data.authorization_url,
        access_code: paystackResponse.data.access_code,
        reference: paystackResponse.data.reference,
        amount,
      }
    };

  } catch (error) {
    console.error("[initializeDeposit] Error:", error);
    return {
      status: 500,
      data: { error: "Failed to initialize payment. Please try again." }
    };
  }
}
