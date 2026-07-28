# Safe Haven Integration Guide

## Overview

Safe Haven MFB provides the banking infrastructure behind our Anti-Corruption Layer (ACL). Our platform never calls Safe Haven directly from business logic — all calls flow through the `/src/modules/integrations/safe-haven/` adapter.

## Architecture

```
Domain Module (e.g., Identity)
    ↓ calls
IBankingProvider interface (our domain-facing contract)
    ↓ implemented by
SafeHavenAdapter (translates our DTOs → Safe Haven API calls)
    ↓ uses
SafeHavenClient (low-level HTTP client with auth, logging, retries)
    ↓ calls
Safe Haven MFB API (sandbox or production)
```

**Key rule:** Domain modules import from `/src/modules/integrations/index.ts` only. They never import Safe Haven-specific code directly.

## Safe Haven API Flow (Key Discovery)

### BVN/NIN Verification is OTP-Based and Interactive

This is the most important discovery from reading Safe Haven's actual API docs:

1. **Initiate Verification** (`POST /identity/v2`):
   - Send `type` (BVN/NIN), `number` (the BVN or NIN), `debitAccountNumber`, `async: false`
   - Safe Haven sends an OTP to the phone number registered against the BVN/NIN
   - Returns an `identityId` for the next step

2. **Validate Verification** (`POST /identity/v2/validate`):
   - Send `identityId` (from step 1), `type`, `otp` (the customer-entered OTP)
   - Returns verification result (name, phone, DOB if successful)

**Implication for our domain model:**
- Our onboarding flow MUST include an OTP entry step
- The customer must be present and have access to the phone number registered with their BVN
- The verification state machine: `not_started → initiate_pending → otp_sent → validate_pending → verified / rejected`

### Sub Account (DVA) Creation Requires Identity Verification

You cannot create a Sub Account (our DVA) without first completing identity verification. The flow is:

1. Create our Customer record (status: `prospective`)
2. Initiate BVN verification → customer enters OTP → validate
3. On successful verification, create Sub Account (`POST /accounts/v2/subaccount`)
4. Store the account details in our `wallets` table
5. Update customer status to `identity_verified`

**Implication:** Wallet/DVA provisioning is gated on identity verification completion. The wallet lifecycle starts at `created` state and transitions to `pending_activation` when the Safe Haven call is initiated, then `active` when the Sub Account is provisioned.

### Authentication Uses JWT Client Assertion (Not Simple API Keys)

Safe Haven uses OAuth2 with client credentials flow:
1. Generate a JWT signed with your RSA private key (client assertion)
2. Exchange it for an access token via `POST /oauth2/token`
3. Use the access token for API calls
4. Refresh when it expires
5. The response includes an `ibs_client_id` that must be passed as a header on subsequent calls

### Transfer Requires Name Enquiry First (CBN Regulation)

Before calling the Transfer endpoint, you must:
1. Call Name Enquiry (`POST /transfers/name-enquiry`) with the beneficiary's account number and bank code
2. Get the `sessionId` from the response
3. Use that `sessionId` as `nameEnquiryReference` in the Transfer call

This is a CBN (Central Bank of Nigeria) regulation — you cannot transfer to an unverified account.

## Environment Variables

```env
# Required for live mode
SAFE_HAVEN_ENV=sandbox                    # 'mock', 'sandbox', or 'production'
SAFE_HAVEN_API_KEY=your_client_id         # OAuth Client ID from Safe Haven dashboard
SAFE_HAVEN_SECRET_KEY=your_private_key     # RSA private key for JWT signing
SAFE_HAVEN_IBS_CLIENT_ID=your_ibs_id       # Returned from auth token exchange
SAFE_HAVEN_WEBHOOK_SECRET=your_webhook_secret  # For webhook signature verification

# If SAFE_HAVEN_ENV=mock or credentials are missing, the system uses MockBankingProvider
```

## Sandbox Setup

1. Go to [Safe Haven Sandbox Dashboard](https://online.sandbox.safehavenmfb.com)
2. Create an account and an application
3. Note your **Client ID** and generate an **RSA key pair**
4. Sign your client assertion JWT with the private key
5. Exchange for access token via the OAuth2 endpoint
6. Register your webhook URL: `https://your-domain.com/api/webhooks/safe-haven`

## API Base URLs

| Environment | Base URL |
|---|---|
| Sandbox | `https://api.sandbox.safehavenmfb.com` |
| Production | `https://api.safehavenmfb.com` |

## Webhook Registration

1. In the Safe Haven dashboard, go to Webhooks settings
2. Set the callback URL to: `https://your-domain.com/api/webhooks/safe-haven`
3. Note the webhook secret (used for signature verification)
4. Set `SAFE_HAVEN_WEBHOOK_SECRET` in your environment

## Database Tables (Phase 2)

| Table | Purpose |
|---|---|
| `wallets` | Customer wallet + DVA details. Balance is a CACHE, not source of truth. |
| `inbound_events` | Append-only landing zone for webhook events. Status: received → processed. |
| `safe_haven_api_calls` | Every outbound API call logged (request + response, minus secrets). |
| `idempotency_keys` | Deduplication for outbound calls. Prevents duplicate wallets/DVAs/transfers. |

## Idempotency Strategy

Every outbound Safe Haven call generates a deterministic idempotency key:

```
Format: <operation>:<entityId>:<sha256(requestParams)>
Example: create_sub_account:cus-uuid:abc123...
```

Before making a call:
1. Check `idempotency_keys` for an existing entry with this key
2. If found and status=completed → return stored result (no duplicate execution)
3. If found and status=in_progress → return "in progress" (caller should retry)
4. If not found → insert key (in_progress), make the call, update with result

Keys expire after 24 hours. Expired keys are cleaned up by a scheduled job.

## Retry Strategy

- **Retriable errors:** 5xx responses, timeouts, network errors
- **Non-retriable errors:** 4xx responses (client errors, validation failures)
- **Retry policy:** Exponential backoff: 1s, 2s, 4s, 8s, 16s (max 5 retries)
- **Dead-letter:** After exhausting retries, the call is marked as failed in `safe_haven_api_calls` and the idempotency key is marked as `failed`. Manual intervention required.

## Known API Quirks / Gotchas

1. **Sandbox URL has a typo in their docs:** The actual sandbox URL is `https://api.sandbox.safehavenmfb.com` (not `api.sanbox.safehavenmfb.com` as sometimes appears)
2. **ibs_client_id header:** Every API call (except auth) requires the `ClientID` header set to the `ibs_client_id` returned from the token exchange
3. **BVN verification debitAccountNumber:** The Initiate Verification call requires a `debitAccountNumber` — this is your Safe Haven master account number (provided when you set up your app), not the customer's DVA
4. **Virtual Accounts vs Sub Accounts:** Virtual Accounts (`POST /virtual-accounts`) are temporary (expire after `validFor` seconds). Sub Accounts (`POST /accounts/v2/subaccount`) are permanent (our DVAs). We use Sub Accounts.
5. **Webhook payload format:** Safe Haven's webhook payload format is not fully documented in their public docs. The webhook handler is defensive — it stores the raw payload and maps event types with fallbacks.
6. **Transfer requires nameEnquiryReference:** You cannot skip the name enquiry step. The `sessionId` from name enquiry must be included in the transfer request.

## Files

| File | Purpose |
|---|---|
| `/src/modules/integrations/types.ts` | Domain-facing DTOs and IBankingProvider interface |
| `/src/modules/integrations/safe-haven/client.ts` | Low-level HTTP client (auth, logging, retries) |
| `/src/modules/integrations/safe-haven/adapter.ts` | Translates our DTOs → Safe Haven API calls |
| `/src/modules/integrations/safe-haven/mock.ts` | Mock implementation for dev without credentials |
| `/src/modules/integrations/safe-haven/factory.ts` | Provider factory (mock vs live) |
| `/src/modules/integrations/safe-haven/index.ts` | Re-exports |
| `/src/modules/integrations/index.ts` | Module public API |
| `/src/app/api/webhooks/safe-haven/route.ts` | Webhook endpoint handler |
