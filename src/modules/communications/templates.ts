/**
 * Communications Domain Module - Notification Templates
 */

import { NotificationEvent, NotificationTemplate } from './types';

export const TEMPLATES: Record<NotificationEvent, NotificationTemplate> = {
  // Auth Templates
  account_created: {
    title: 'Welcome to Agriqcap',
    message: 'Hello $name, your account has been successfully created.',
    category: 'auth',
    defaultChannels: ['in_app', 'email'],
    channelPreferences: ['in_app', 'email'],
  },
  password_reset: {
    title: 'Password Reset Request',
    message: 'A password reset request was initiated for your account at $time.',
    category: 'auth',
    defaultChannels: ['in_app', 'email'],
    channelPreferences: ['in_app', 'email'],
  },
  security_event: {
    title: 'Security Alert',
    message: 'Security alert on your account: $details.',
    category: 'auth',
    defaultChannels: ['in_app', 'email', 'sms'],
    channelPreferences: ['in_app', 'email', 'sms'],
  },

  // Financial Templates
  deposit_received: {
    title: 'Deposit Received',
    message: 'Your deposit of $amount has been received into account $accountNumber.',
    category: 'financial',
    defaultChannels: ['in_app', 'email', 'sms'],
    channelPreferences: ['in_app', 'email', 'sms'],
  },
  withdrawal_initiated: {
    title: 'Withdrawal Initiated',
    message: 'A withdrawal of $amount to $destination has been initiated.',
    category: 'financial',
    defaultChannels: ['in_app', 'email'],
    channelPreferences: ['in_app', 'email'],
  },
  withdrawal_completed: {
    title: 'Withdrawal Completed',
    message: 'Your withdrawal of $amount has been processed successfully.',
    category: 'financial',
    defaultChannels: ['in_app', 'email', 'sms'],
    channelPreferences: ['in_app', 'email', 'sms'],
  },
  withdrawal_failed: {
    title: 'Withdrawal Failed',
    message: 'Your withdrawal request of $amount failed. Reason: $reason.',
    category: 'financial',
    defaultChannels: ['in_app', 'email'],
    channelPreferences: ['in_app', 'email'],
  },
  transfer_pending: {
    title: 'Transfer Pending',
    message: 'Your transfer of $amount to $recipient is pending processing.',
    category: 'financial',
    defaultChannels: ['in_app'],
    channelPreferences: ['in_app'],
  },
  transfer_completed: {
    title: 'Transfer Completed',
    message: 'Your transfer of $amount to $recipient was completed successfully.',
    category: 'financial',
    defaultChannels: ['in_app', 'email'],
    channelPreferences: ['in_app', 'email'],
  },

  // Savings Templates
  savings_created: {
    title: 'Savings Plan Created',
    message: 'Your savings plan $planName with target $goalAmount has been created.',
    category: 'savings',
    defaultChannels: ['in_app', 'email'],
    channelPreferences: ['in_app', 'email'],
  },
  contribution_received: {
    title: 'Savings Contribution Received',
    message: 'A contribution of $amount was received for savings plan $planName.',
    category: 'savings',
    defaultChannels: ['in_app'],
    channelPreferences: ['in_app'],
  },
  savings_withdrawal: {
    title: 'Savings Withdrawal',
    message: 'A withdrawal of $amount was processed from savings plan $planName.',
    category: 'savings',
    defaultChannels: ['in_app', 'email'],
    channelPreferences: ['in_app', 'email'],
  },
  savings_maturity: {
    title: 'Savings Plan Matured',
    message: 'Your savings plan $planName has reached maturity with balance $totalAmount.',
    category: 'savings',
    defaultChannels: ['in_app', 'email', 'sms'],
    channelPreferences: ['in_app', 'email', 'sms'],
  },

  // Loans Templates
  application_submitted: {
    title: 'Loan Application Submitted',
    message: 'Your loan application for $amount ($loanType) was submitted and is under review.',
    category: 'loans',
    defaultChannels: ['in_app', 'email'],
    channelPreferences: ['in_app', 'email'],
  },
  loan_approved: {
    title: 'Loan Approved',
    message: 'Congratulations! Your loan application for $amount has been approved.',
    category: 'loans',
    defaultChannels: ['in_app', 'email', 'sms'],
    channelPreferences: ['in_app', 'email', 'sms'],
  },
  loan_rejected: {
    title: 'Loan Application Update',
    message: 'Your loan application for $amount was not approved. Reason: $reason.',
    category: 'loans',
    defaultChannels: ['in_app', 'email'],
    channelPreferences: ['in_app', 'email'],
  },
  loan_disbursement: {
    title: 'Loan Disbursed',
    message: 'Loan disbursement of $amount has been deposited into your account.',
    category: 'loans',
    defaultChannels: ['in_app', 'email', 'sms'],
    channelPreferences: ['in_app', 'email', 'sms'],
  },
  repayment_due: {
    title: 'Loan Repayment Due',
    message: 'Reminder: Loan repayment of $amount is due on $dueDate.',
    category: 'loans',
    defaultChannels: ['in_app', 'email', 'sms'],
    channelPreferences: ['in_app', 'email', 'sms'],
  },
  repayment_received: {
    title: 'Loan Repayment Received',
    message: 'We received your loan repayment of $amount. Balance remaining: $remainingBalance.',
    category: 'loans',
    defaultChannels: ['in_app', 'email'],
    channelPreferences: ['in_app', 'email'],
  },
  loan_default: {
    title: 'Loan Payment Overdue',
    message: 'Notice: Your loan repayment of $amount is overdue by $daysOverdue days.',
    category: 'loans',
    defaultChannels: ['in_app', 'email', 'sms'],
    channelPreferences: ['in_app', 'email', 'sms'],
  },

  // Investments Templates
  subscription_created: {
    title: 'Investment Subscription Created',
    message: 'You subscribed $amount to $opportunityName.',
    category: 'investments',
    defaultChannels: ['in_app', 'email'],
    channelPreferences: ['in_app', 'email'],
  },
  returns_received: {
    title: 'Investment Returns Paid',
    message: 'You received investment returns of $amount for $opportunityName.',
    category: 'investments',
    defaultChannels: ['in_app', 'email'],
    channelPreferences: ['in_app', 'email'],
  },
  investment_maturity: {
    title: 'Investment Matured',
    message: 'Your investment in $opportunityName has matured with payout of $payoutAmount.',
    category: 'investments',
    defaultChannels: ['in_app', 'email', 'sms'],
    channelPreferences: ['in_app', 'email', 'sms'],
  },
  investment_redemption: {
    title: 'Investment Redemption',
    message: 'Redemption of $amount for $opportunityName has been processed.',
    category: 'investments',
    defaultChannels: ['in_app', 'email'],
    channelPreferences: ['in_app', 'email'],
  },

  // Verification Templates
  verification_started: {
    title: 'Verification Started',
    message: 'Verification process for tier $tier has been initiated.',
    category: 'verification',
    defaultChannels: ['in_app'],
    channelPreferences: ['in_app'],
  },
  verification_completed: {
    title: 'Verification Successful',
    message: 'Your identity verification for tier $tier was successful.',
    category: 'verification',
    defaultChannels: ['in_app', 'email'],
    channelPreferences: ['in_app', 'email'],
  },
  verification_failed: {
    title: 'Verification Failed',
    message: 'Verification failed for tier $tier. Reason: $reason.',
    category: 'verification',
    defaultChannels: ['in_app', 'email'],
    channelPreferences: ['in_app', 'email'],
  },
  tier_upgraded: {
    title: 'Tier Upgraded',
    message: 'Congratulations! Your account tier has been upgraded to $tier.',
    category: 'verification',
    defaultChannels: ['in_app', 'email', 'sms'],
    channelPreferences: ['in_app', 'email', 'sms'],
  },
};

/**
 * Interpolates dollar-sign-variables (e.g. $amount, $name) in template strings.
 */
export function interpolateTemplate(
  template: string,
  variables: Record<string, string | number | boolean> = {}
): string {
  if (!template) return '';
  return template.replace(/\$([a-zA-Z0-9_]+)/g, (match, varName) => {
    if (Object.prototype.hasOwnProperty.call(variables, varName)) {
      const value = variables[varName];
      return value !== undefined && value !== null ? String(value) : match;
    }
    return match;
  });
}

/**
 * Get notification template for event type
 */
export function getTemplate(event: NotificationEvent): NotificationTemplate | undefined {
  return TEMPLATES[event];
}
