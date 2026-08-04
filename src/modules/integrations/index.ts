/**
 * Integration Domain Module
 * 
 * The Anti-Corruption Layer between our domain and external providers.
 * 
 * Public API: IBankingProvider, getBankingProvider, and domain DTOs.
 * Domain modules import from HERE, never from safe-haven/ directly.
 * 
 * Phase 2: Safe Haven MFB integration (customer creation, DVA, BVN verification, webhooks).
 */

// Domain-facing types (DTOs)
export type {
  IdentityType,
  Bank,
  VerificationStatus,
  InitiateVerificationParams,
  InitiateVerificationResult,
  ValidateVerificationParams,
  ValidateVerificationResult,
  CreateSubAccountParams,
  CreateSubAccountResult,
  AccountBalanceResult,
  NameEnquiryParams,
  NameEnquiryResult,
  TransferParams,
  TransferResult,
  WebhookEvent,
  IBankingProvider,
  IntegrationError,
} from './types';

// Factory
export { getBankingProvider } from './safe-haven/factory';

// Re-export types module for direct access
export * from './types';
