/**
 * Ledger Domain Module
 * 
 * The system of financial record. Double-entry accounting with immutable entries.
 * 
 * Public API:
 *   - Account management: getAccountByCode, getWalletAccountId, getAccountBalance, getSystemAccount
 *   - Journal: createJournalEntry, addJournalLines, postJournalEntry, reverseJournalEntry
 *   - Balance: refreshWalletBalanceCache
 * 
 * The Orchestrator is the ONLY module that calls journal functions directly.
 * Other modules access the Ledger through the Orchestrator's calling contract.
 */

export { getAccountByCode, getWalletAccountId, getAccountBalance, getSystemAccount, refreshWalletBalanceCache } from './accounts';
export { createJournalEntry, addJournalLines, postJournalEntry, reverseJournalEntry, getJournalEntryWithLines } from './journal';
export type { AccountType, EntryType, JournalEntryStatus, Account, JournalLineInput, JournalEntry, PostedJournalEntry } from './types';
