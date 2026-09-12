// Wallet module public API
export {
  processIncomingCredit,
  resolveUnmatchedCredit,
  reverseUnmatchedCredit,
} from './incoming-credit';
export type { IncomingCreditPayload, IncomingCreditResult } from './incoming-credit';

// Existing wallet processing (Phase 3)
export { processEvent, processEventBatch } from './processor';

// Existing wallet reconciliation (Phase 3)
export { reconcileWallet, reconcileAllWallets } from './reconciliation';

export type {
  ProviderFeeInput,
  ProviderFeeResult,
  ProviderFeeStatus,
  BackfillReport,
} from './provider-fees';
export {
  extractProviderFee,
  extractProviderAccountId,
  postProviderFee,
  resolveWalletForProviderEvent,
  linkWalletToProviderAccount,
  mirrorProviderFeeForEvent,
  backfillProviderFees,
} from './provider-fees';
