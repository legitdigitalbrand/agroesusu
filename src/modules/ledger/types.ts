/**
 * Ledger Domain Module - Type Definitions
 * 
 * Bounded context for Double-entry accounting ledger.
 * This file defines the core TypeScript interfaces and types for Accounts,
 * Journal Entries, and Journal Lines, matching the Supabase database schema.
 * 
 * @module modules/ledger/types
 */

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
export type EntryType = 'debit' | 'credit';
export type JournalEntryStatus = 'draft' | 'posted' | 'reversed';

export interface Account {
  id: string;
  account_code: string;
  account_type: AccountType;
  account_category: string;
  name: string;
  owner_wallet_id: string | null;
  is_system_account: boolean;
  is_active: boolean;
}

export interface JournalLineInput {
  account_id: string;
  entry_type: EntryType;
  amount: number;
  description?: string;
}

export interface JournalEntry {
  id: string;
  entry_reference: string;
  status: JournalEntryStatus;
  description: string;
  transaction_id: string | null;
  posted_at: string | null;
  created_at: string;
}

export interface PostedJournalEntry {
  entry: JournalEntry;
  lines: JournalLineInput[];
}
