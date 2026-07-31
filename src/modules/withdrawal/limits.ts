import { createClient } from '@supabase/supabase-js';
import type { WithdrawalLimits, WithdrawalValidationResult } from './types';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Get withdrawal limits for a customer based on their verification tier.
 * ALL limits are server-side. The frontend NEVER provides or overrides these.
 */
export async function getWithdrawalLimits(customerId: string): Promise<WithdrawalLimits> {
  const supabase = getServiceClient();

  // Get customer's KYC tier
  const { data: customer } = await supabase
    .from('customers')
    .select('id, bvn, nin, status, auth_id')
    .eq('id', customerId)
    .maybeSingle();

  // Get profile KYC tier
  const { data: profile } = await supabase
      .from('profiles')
      .select('kyc_tier')
      .eq('id', customer?.auth_id)
      .maybeSingle() as { data: { kyc_tier?: string } | null };

  const kycTier = profile?.kyc_tier || 'tier_0';
  const tierNum = parseInt(kycTier.replace('tier_', '')) || 0;

  // Tier-based limits (server-side, hardcoded — never client-provided)
  const tierLimits: Record<number, WithdrawalLimits> = {
    0: { minWithdrawal: 1000, maxPerTransaction: 50000, maxDaily: 100000, maxMonthly: 500000 },
    1: { minWithdrawal: 1000, maxPerTransaction: 200000, maxDaily: 500000, maxMonthly: 2000000 },
    2: { minWithdrawal: 1000, maxPerTransaction: 1000000, maxDaily: 2000000, maxMonthly: 10000000 },
    3: { minWithdrawal: 1000, maxPerTransaction: 5000000, maxDaily: 5000000, maxMonthly: 50000000 },
  };

  return tierLimits[tierNum] || tierLimits[0];
}

/**
 * Validate a withdrawal request against all server-side rules.
 */
export async function validateWithdrawal(
  customerId: string,
  walletId: string,
  amount: number
): Promise<WithdrawalValidationResult> {
  const supabase = getServiceClient();
  const errors: string[] = [];

  // 1. Get limits
  const limits = await getWithdrawalLimits(customerId);

  // 2. Get wallet balance
  const { data: wallet } = await supabase
    .from('wallets')
    .select('id, balance, available_balance, status')
    .eq('id', walletId)
    .maybeSingle();

  if (!wallet) {
    errors.push('Wallet not found');
    return { valid: false, errors, limits, availableBalance: 0, tier: 0 };
  }

  if (wallet.status !== 'active') {
    errors.push(`Wallet is ${wallet.status} — withdrawals not available`);
  }

  // 3. Get profile KYC tier
  const { data: customer } = await supabase
    .from('customers')
    .select('auth_id')
    .eq('id', customerId)
    .maybeSingle();

  const { data: profile } = await supabase
      .from('profiles')
      .select('kyc_tier')
      .eq('id', customer?.auth_id)
      .maybeSingle() as { data: { kyc_tier?: string } | null };

  const kycTier = profile?.kyc_tier || 'tier_0';
  const tierNum = parseInt(kycTier.replace('tier_', '')) || 0;

  // 4. Check amount against limits
  const availableBalance = Number(wallet.available_balance || wallet.balance || 0);

  if (amount < limits.minWithdrawal) {
    errors.push(`Minimum withdrawal is ₦${limits.minWithdrawal.toLocaleString()}`);
  }
  if (amount > limits.maxPerTransaction) {
    errors.push(`Maximum per transaction is ₦${limits.maxPerTransaction.toLocaleString()}`);
  }
  if (amount > availableBalance) {
    errors.push(`Insufficient balance. Available: ₦${availableBalance.toLocaleString()}`);
  }

  // 5. Check daily limit
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { data: todayWithdrawals } = await supabase
    .from('withdrawal_requests')
    .select('amount')
    .eq('customer_id', customerId)
    .in('status', ['completed', 'pending', 'transfer_submitted', 'reserved'])
    .gte('initiated_at', today.toISOString());

  const dailyTotal = (todayWithdrawals || []).reduce((sum: number, w: { amount: string }) => sum + Number(w.amount), 0);
  if (dailyTotal + amount > limits.maxDaily) {
    errors.push(`Daily limit exceeded. Used today: ₦${dailyTotal.toLocaleString()}, limit: ₦${limits.maxDaily.toLocaleString()}`);
  }

  // 6. Check monthly limit
  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);
  const { data: monthWithdrawals } = await supabase
    .from('withdrawal_requests')
    .select('amount')
    .eq('customer_id', customerId)
    .in('status', ['completed', 'pending', 'transfer_submitted', 'reserved'])
    .gte('initiated_at', monthAgo.toISOString());

  const monthlyTotal = (monthWithdrawals || []).reduce((sum: number, w: { amount: string }) => sum + Number(w.amount), 0);
  if (monthlyTotal + amount > limits.maxMonthly) {
    errors.push(`Monthly limit exceeded. Used this month: ₦${monthlyTotal.toLocaleString()}, limit: ₦${limits.maxMonthly.toLocaleString()}`);
  }

  // 7. Check wallet restrictions
  const { data: isStaff } = await supabase.rpc('is_staff');
  if (!isStaff && wallet.status === 'frozen') {
    errors.push('Wallet is frozen — contact support');
  }

  // 8. Risk check — check if customer has defaulted loans
  const { data: defaultedLoans } = await supabase
    .from('loans')
    .select('id')
    .eq('customer_id', customerId)
    .eq('status', 'defaulted')
    .limit(1)
    .maybeSingle();

  if (defaultedLoans) {
    errors.push('Account has a defaulted loan — withdrawals restricted. Please contact support.');
  }

  return {
    valid: errors.length === 0,
    errors,
    limits,
    availableBalance,
    tier: tierNum,
  };
}
