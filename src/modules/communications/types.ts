/**
 * Communications Domain Module - Types
 */

export type NotificationChannel = 'in_app' | 'email' | 'sms';

export type NotificationStatus = 'pending' | 'queued' | 'sent' | 'delivered' | 'failed' | 'read';

export type NotificationCategory =
  | 'auth'
  | 'financial'
  | 'savings'
  | 'loans'
  | 'investments'
  | 'verification';

// Auth Events
export type AuthNotificationEvent =
  | 'account_created'
  | 'password_reset'
  | 'security_event';

// Financial Events
export type FinancialNotificationEvent =
  | 'deposit_received'
  | 'withdrawal_initiated'
  | 'withdrawal_completed'
  | 'withdrawal_failed'
  | 'transfer_pending'
  | 'transfer_completed';

// Savings Events
export type SavingsNotificationEvent =
  | 'savings_created'
  | 'contribution_received'
  | 'savings_withdrawal'
  | 'savings_maturity';

// Loans Events
export type LoansNotificationEvent =
  | 'application_submitted'
  | 'loan_approved'
  | 'loan_rejected'
  | 'loan_disbursement'
  | 'repayment_due'
  | 'repayment_received'
  | 'loan_default';

// Investments Events
export type InvestmentsNotificationEvent =
  | 'subscription_created'
  | 'returns_received'
  | 'investment_maturity'
  | 'investment_redemption';

// Verification Events
export type VerificationNotificationEvent =
  | 'verification_started'
  | 'verification_completed'
  | 'verification_failed'
  | 'tier_upgraded';

export type NotificationEvent =
  | AuthNotificationEvent
  | FinancialNotificationEvent
  | SavingsNotificationEvent
  | LoansNotificationEvent
  | InvestmentsNotificationEvent
  | VerificationNotificationEvent;

export interface NotificationTemplate {
  title: string;
  message: string;
  category: NotificationCategory;
  defaultChannels: NotificationChannel[];
  channelPreferences?: NotificationChannel[];
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationEvent | string;
  title: string;
  message: string;
  read: boolean;
  metadata?: Record<string, any> | null;
  created_at: string;
  category?: string;
  delivery_status?: NotificationStatus;
  delivery_attempts?: number;
  delivered_at?: string | null;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
}

export interface CreateNotificationInput {
  user_id: string;
  type: NotificationEvent | string;
  title: string;
  message: string;
  read?: boolean;
  metadata?: Record<string, any>;
  category?: NotificationCategory | string;
  delivery_status?: NotificationStatus;
  delivery_attempts?: number;
  delivered_at?: string;
  related_entity_type?: string;
  related_entity_id?: string;
}

export interface GetNotificationsFilters {
  read?: boolean;
  type?: NotificationEvent | string;
  limit?: number;
  offset?: number;
}

export interface DispatchNotificationParams {
  userId: string;
  event: NotificationEvent;
  variables?: Record<string, string | number | boolean>;
  channels?: NotificationChannel[];
  metadata?: Record<string, any>;
}

export interface DispatchNotificationResult {
  success: boolean;
  notificationId?: string;
  channelsSent?: NotificationChannel[];
  error?: string;
}
