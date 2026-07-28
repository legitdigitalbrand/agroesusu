/**
 * Wallet Domain Module
 * 
 * Phase 3: Transaction history read model + balance cache maintenance.
 * 
 * Public API:
 *   - processEventBatch() — process received inbound events
 *   - reconcileWallet() / reconcileAllWallets() — reconciliation
 * 
 * Not exported (internal):
 *   - The processor and reconciliation modules use the service_role client
 *     and are only callable from server-side code (API routes, cron endpoints).
 */

export { processEvent, processEventBatch } from './processor';
export { reconcileWallet, reconcileAllWallets } from './reconciliation';
export type {
  WalletTxStatus,
  WalletTxDirection,
  WalletTransaction,
  WalletBalance,
  Pagination,
  PaginatedTransactions,
  ProcessEventResult,
  ProcessBatchResult,
  ReconciliationResult,
  ReconciliationFlag,
  ReconciliationStatus,
} from './types';
