# AGROPOCKET REBRAND PLAN
**Date:** 2026-09-11 · Builds on `AGROPOCKET_REBRAND_AUDIT.md`
**Product:** AgroPocket · **Legal:** Agro Pocket Limited

---

## SAFE CHANGES (Phase 4–6 — implement now)

1. **`src/config/brand.ts`** — single source of truth:
   - `name/shortName/pwaName/pwaShortName`: `AgroPocket`
   - `ogTitle`: `AgroPocket — Save. Borrow. Grow Together.`
   - `copyright`: `© <year> Agro Pocket Limited. All rights reserved.`
   - `legalName`: `Agro Pocket Limited`
   - `description`: "AgroPocket is a digital finance platform…"
   - **Keep `support@/info@/careers@agriqcap.com`** until the agropocket.com domain is verified (EMAIL DOMAIN MIGRATION REQUIRED — flagged, not done here).
2. **Marketing pages** (home, about, careers, contact, features, blog, faqs, savings-plans, loan-plans): all copy → AgroPocket.
3. **Marketing header/footer**: logo text → AgroPocket; footer copyright → Agro Pocket Limited.
4. **Auth screens** (AuthLogo, RightPanel, welcome, onboarding, login/register copy): → AgroPocket. No auth logic touched.
5. **App shell** (yield desktop/mobile shell, welcome banner copy, dev ops panel): → AgroPocket.
6. **Dashboard / wallet / deposit / transfer / loans / statements / settings copy**: → AgroPocket; CSV prefix → `agropocket-statement-*`; DVA fallback label → "AgroPocket".
7. **Metadata/SEO/PWA**: terms/privacy/help metadata, `public/manifest.json` → AgroPocket.
8. **Notifications & email display identity**: `templates.ts` welcome title, `dispatcher.ts` subject suffix, `resend.ts` FROM display name → AgroPocket. **Email addresses preserved.**
9. **Legal pages**: product = AgroPocket, operator = "AgroPocket is operated by Agro Pocket Limited." Mark **LEGAL INFORMATION REQUIRED** where CAC number / address / licences are absent — none invented.
10. **Active docs**: SETUP.md, docs/DEV_PORTAL_ACCESS.md, LAUNCH-CHECKLIST.md brand mentions (keep live URLs).
11. **`package.json` name** → `agropocket` (internal only; lockfile `name` field regenerated via `npm install --package-lock-only`).
12. **Code comments in files touched**: updated to AgroPocket where the file header names the product.

## CONTROLLED CHANGES

1. **Migration 00058 (new, forward-only)**: update seeded brand data — cooperative name `'Agriqcap Farmers Cooperative'` → `'AgroPocket Farmers Cooperative'`; investment product `'Cooperative Growth Fund — Agriqcap'` → `'Cooperative Growth Fund — AgroPocket'` (+ its description). Same statement applied directly to prod DB after migration-file creation. **Data text only — no schema, no IDs, no references.** Historical migrations 00024/00029 stay untouched.
2. **Statement CSV download prefix** (statements page): `agriqcap-statement-*` → `agropocket-statement-*`.

## HIGH-RISK CHANGES — NOT PERFORMED (documented for later, each needs explicit approval)

1. **Domain migration** `agriqcap.vercel.app` → new domain (DNS, SSL, Safe Haven webhook re-registration, Safe Haven JWT issuer, OAuth callbacks, email SPF/DKIM, redirects). Until done, every live-domain URL in code stays `agriqcap.vercel.app`.
2. **Email domain** — `agropocket.com` must be purchased/verified before any `@agropocket.com` address appears in the app. Until then, `@agriqcap.com` addresses are correct and preserved.
3. **Supabase project rename** (`agriqcap` project_id) — optional infra change, separate effort.
4. **Safe Haven external reference format** (`agriqcap-wallet-*`) — kept for backward compatibility; may be revised in a future, separately tested change.

## PRESERVED REFERENCES (no changes, ever, in this rebrand)

- Safe Haven JWT issuer `https://agriqcap.vercel.app` + all Safe Haven client logic, credentials, factory, webhook verification.
- Webhook URL and webhook-security test URLs (they exercise the live domain).
- Auth cookie names (`agriqcap_otp_*`, `agriqcap_pin_v`, `agriqcap_device`, `agriqcap_last_activity`) and hash prefix — session continuity.
- `agriqcap_welcome_dismissed` localStorage key.
- OTP fallback secret `agriqcap-otp-fallback`.
- `supabase/config.toml` project_id.
- All existing migrations 00001–00057 verbatim.
- QA scripts (qa-*.js) and QA email domains (`@agriqcap-test.com`).
- Historical report .md files (audit trail).
- All env var names and values.
- All financial identifiers, transaction IDs, idempotency keys, ledger/wallet/escrow architecture.

## DATABASE

**No tables, columns, RPCs, triggers, RLS policies, or views renamed. Zero schema changes.** The only DB action is the 00058 brand-text data update (two text fields of seeded rows), applied via normal migration + prod push.

## TESTING & VERIFICATION (Phase 8–10)

1. `npx tsc --noEmit` — zero errors.
2. Lint — zero new warnings.
3. `npm test` — all passing (pre-existing failures documented if any).
4. `npm run build` — production build succeeds.
5. Full-repo grep for `agriqcap` — every remaining match classified (see completion report).
6. Post-deploy: `/api/health` returns 200; spot-check login page + dashboard via the live URL.
