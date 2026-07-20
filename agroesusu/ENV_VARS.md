# AgroEsusu — Environment Variables

## Existing (Paystack + Supabase)
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
PAYSTACK_SECRET_KEY=your_paystack_secret_key
CRON_SECRET=your_cron_secret_for_vercel
NEXT_PUBLIC_APP_URL=https://agroesusu.vercel.app
```

## New — Payment Provider Migration (Safe Haven)
```
# Feature flag — which payment provider to use
# Options: 'paystack' (default) or 'safehaven'
PAYMENT_PROVIDER=paystack

# Safe Haven MFB credentials
SAFEHAVEN_CLIENT_ID=your_safehaven_client_id
SAFEHAVEN_CLIENT_ASSERTION=your_signed_jwt_client_assertion
SAFEHAVEN_WEBHOOK_SECRET=your_webhook_signing_secret
SAFEHAVEN_ENV=sandbox  # or 'production' for live

# Safe Haven settlement account (for outward transfers)
SAFEHAVEN_SETTLEMENT_ACCOUNT=your_settlement_account_number
```

## New — Loan Integration
```
# Already in code as a const, but can be overridden via env
# LOANS_LIVE_MODE defaults to false — do NOT enable until licensing is confirmed
```

## Vercel Cron Secrets
The cron endpoints verify `Authorization: Bearer ${CRON_SECRET}`.
Set `CRON_SECRET` in Vercel env vars and configure the cron jobs in vercel.json.
