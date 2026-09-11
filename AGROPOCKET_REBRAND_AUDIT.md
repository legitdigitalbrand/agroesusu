# AGROPOCKET REBRAND AUDIT
**Date:** 2026-09-11 · **Mode:** READ-ONLY (no files were modified for this audit)
**Rebrand:** AgriQCap → **AgroPocket** (product) · **Agro Pocket Limited** (registered legal name)

---

## 1. Current Application Identity

| Identity layer | Current value | Notes |
|---|---|---|
| Product name (code) | `Agriqcap` | Canonical spelling in `src/config/brand.ts` |
| Central brand config | `src/config/brand.ts` (`BRAND` object) | Most UI surfaces import from here |
| Legal name (config) | `legalName: "Agriqcap"` | No registered business name currently used |
| Domain | `agriqcap.vercel.app` | **LIVE PRODUCTION DOMAIN** — Vercel deployment |
| Supabase project | `vhzsnsovfjnztawzuueo` (project_id `agriqcap`) | Hand-built schema; migration history seeded to 00057 on 2026-09-11 |
| Repository | `github.com/legitdigitalbrand/agroesusu` | Repo name does not contain brand |
| Package name | `agriqcap` (`package.json`) | Internal only |
| Emails | `support@ / info@ / careers@agriqcap.com` | Used in footer, contact, careers, Resend sender fallback |
| Sender (email) | `RESEND_FROM_EMAIL` env, fallback `Agriqcap <noreply@agriqcap.com>` | Env var overrides at deploy time |
| App URL fallback | `https://agriqcap.vercel.app` (`resend.ts`, Safe Haven issuer) | **Must stay while the domain is live** |
| PWA | `manifest.json` name/short_name `Agriqcap` | |
| Favicons | `public/favicon.svg` / `.ico` | Geometric mark — **no brand text baked into assets** |

---

## 2. Reference Inventory (all case-insensitive `agriqcap` matches)

### CATEGORY A — Customer-facing brand (→ change to **AgroPocket**)

| Location | Current | Recommended change | Risk |
|---|---|---|---|
| `src/config/brand.ts` | `name/shortName/pwaName/ogTitle/copyright/description` = Agriqcap | AgroPocket (keep tagline unless directed) | Low — single source of truth |
| `src/app/(marketing)/page.tsx`, `about`, `careers`, `contact`, `features`, `blog`, `faqs`, `savings-plans`, `loan-plans` | "Agriqcap" in copy, FAQ Q&A text, testimonials | AgroPocket | Low |
| `src/components/marketing/header.tsx`, `footer.tsx` | Logo text "Agriqcap", footer copyright | AgroPocket; copyright `© Agro Pocket Limited` | Low |
| `src/components/auth/AuthLogo.tsx`, `RightPanel.tsx` | Login screen logo + testimonial text | AgroPocket | Low |
| `src/components/yield/desktop-shell.tsx`, `mobile-shell.tsx`, `display.tsx` | Shell logo text, `aria-label "Agriqcap logo"` | AgroPocket | Low |
| `src/components/app/welcome-banner.tsx` | Copy text "all Agriqcap features" (dismiss key is technical — see C) | AgroPocket | Low |
| `src/app/(auth)/welcome/page.tsx`, `onboarding/page.tsx` | Auth/onboarding copy | AgroPocket | Low |
| `src/app/(app)/dashboard/page.tsx` | DVA fallback `account_name \|\| "Agriqcap MFB"` | `"AgroPocket"` (fallback label only — DVA account names are Safe Haven data, preserved) | Low |
| `src/app/(app)/wallet/page.tsx` | Fallback `"Agriqcap Digital Wallet"` | `"AgroPocket Digital Wallet"` | Low |
| `src/app/(app)/wallet/deposit/page.tsx` | Share text "Fund my Agriqcap wallet" | AgroPocket | Low |
| `src/app/(app)/wallet/transfer/page.tsx` | Transfer copy | AgroPocket | Low |
| `src/app/(app)/loans/apply/page.tsx` | Copy incl. "AgriQCap wallet" (inconsistent casing in live copy) | AgroPocket | Low |
| `src/app/(app)/statements/page.tsx` | CSV filename `agriqcap-statement-*.csv` | `agropocket-statement-*` (download filename only; no financial data dependency) | Low |
| `src/app/(app)/settings/page.tsx` | Settings copy | AgroPocket | Low |
| `src/app/terms/page.tsx`, `privacy/page.tsx`, `help/page.tsx` | Page metadata descriptions | AgroPocket; legal name → Agro Pocket Limited | Low |
| `src/modules/communications/templates.ts` | `Welcome to Agriqcap` notification title | AgroPocket | Low |
| `src/modules/communications/dispatcher.ts` | Notification subject suffix `— Agriqcap` | `— AgroPocket` | Low |
| `src/lib/email/resend.ts` | FROM_EMAIL fallback **display name** "Agriqcap" | "AgroPocket" (keep `noreply@agriqcap.com` address until new email domain is verified) | Low–Medium (email deliverability) |
| `src/app/dev/dashboard/page.tsx`, `dev/layout.tsx` | Staff ops panel branding | AgroPocket | Low (staff-facing, still brand) |
| `public/manifest.json` | `name`/`short_name` "Agriqcap" | AgroPocket | Low |

### CATEGORY B — Legal business references (→ **Agro Pocket Limited**)

| Location | Current | Recommended | Risk |
|---|---|---|---|
| Footer copyright (`marketing/footer.tsx`) | `© 2026 Agriqcap. All rights reserved.` | `© 2026 Agro Pocket Limited. All rights reserved.` | Low |
| `BRAND.legalName` | "Agriqcap" | "Agro Pocket Limited" | Low |
| Terms / Privacy bodies | Currently reference "Agriqcap" as platform | Product: AgroPocket; operator: "Agro Pocket Limited". **LEGAL INFORMATION REQUIRED:** registration number (CAC/RC), registered address, licences — none exist in the codebase; do not invent. | Low |

### CATEGORY C — Technical internal identifiers (→ evaluate individually)

| Identifier | Location | Decision | Rationale |
|---|---|---|---|
| Cookie names: `agriqcap_otp_verified`, `agriqcap_otp_pending`, `agriqcap_last_activity`, `agriqcap_device`, `agriqcap_pin_v` | `src/lib/auth/device.ts`, `login-pin.ts`, `middleware.ts`, `api/auth/sign-out/route.ts` | **PRESERVE** | Renaming signs every user out and drops device-trust state. Zero customer value, real session risk. |
| Cookie hashing prefix `agriqcap-pin-cookie-v1:` | `login-pin.ts` | **PRESERVE** | Paired with the cookie above. |
| `agriqcap_welcome_dismissed` localStorage key | `welcome-banner.tsx` | **PRESERVE** | Cosmetic churn only; renaming re-shows dismissed banner (harmless but pointless). |
| `agriqcap-wallet-${customer.id}` externalReference sent to Safe Haven on DVA provisioning | `src/modules/wallet/dva.ts:183`, `src/app/api/provisioning/identity/validate/route.ts:218`, adapter-identity tests | **PRESERVE FORMAT** | Opaque provider reference; historical references already exist at Safe Haven under this format. Backward-compat cost of changing > cosmetic gain. (§16: format `agriqcap-wallet-{uuid}`, generated at provisioning only.) |
| OTP signing fallback `'agriqcap-otp-fallback'` | `src/lib/auth/otp.ts:29` | **PRESERVE** | Only active when OTP_SECRET env unset; renaming is churn. |
| `package.json` `name: "agriqcap"` | package.json, package-lock.json | **CHANGE → `agropocket`** | Internal identifier, no deploy dependency. |
| `supabase/config.toml` `project_id = "agriqcap"` | supabase/config.toml | **PRESERVE** | Ties CLI to the existing project metadata; renaming risks CLI re-init/linking confusion. Optional infra change, separate effort. |
| `agriqcap.com` email addresses in `BRAND` config | `brand.ts` | **PRESERVE UNTIL DOMAIN VERIFIED** | `agropocket.com` is not confirmed owned/verified; changing support email to a dead domain loses customer contact. **EMAIL DOMAIN MIGRATION REQUIRED** (see §19 of plan). |
| Statement CSV filename prefix | statements page | **CHANGE** | Pure download filename; no historical lookup depends on it. |

### CATEGORY D — External integrations & infrastructure (→ DO NOT MODIFY)

| Reference | Location | Decision |
|---|---|---|
| **Safe Haven JWT issuer** `https://agriqcap.vercel.app` | `src/modules/integrations/safe-haven/auth.ts:95` | **PRESERVE — CRITICAL.** The issuer must match the live domain. Changing breaks Safe Haven token issuance. |
| Webhook URL `https://agriqcap.vercel.app/api/webhooks/safe-haven` | `webhook-security.ts` docs, tests, Safe Haven docs | **PRESERVE** — this is the URL Safe Haven calls in production. |
| `APP_URL` fallback `https://agriqcap.vercel.app` | `resend.ts:27` | **PRESERVE** until domain migration (env var `NEXT_PUBLIC_APP_URL` controls at runtime). |
| Supabase project ref/env vars | `.env.example`, Vercel env | **PRESERVE** |
| Vercel domain `agriqcap.vercel.app` | Everywhere | **PRESERVE — DOMAIN MIGRATION REQUIRED** (separate plan: DNS, SSL, OAuth callbacks, Safe Haven webhook re-registration, email SPF/DKIM). |
| Safe Haven account names (e.g. DVA `account_name` data like `CROPXCHANGEAFRI`) | DB data / API responses | **PRESERVE** — provider-side data. |
| QA test emails `*@agriqcap-test.com` | test files, DB test data | **PRESERVE** — seeded data identifiers in tests. |

### Historical / documentation (→ classify, mostly preserve)

| Location | Classification |
|---|---|
| `supabase/migrations/00001, 00024, 00029, 00033` | **Migration history — never rewrite.** BUT 00024 seeds `'Agriqcap Farmers Cooperative'` and 00029 seeds investment product `'Cooperative Growth Fund — Agriqcap'` — these are **live customer-visible data rows in prod**. Requires a NEW migration (00058) + prod data update. See plan. |
| `FINAL_PROJECT_REPORT.md`, `AUTH_ARCHITECTURE_REPORT.md`, `PHASE*_REPORT.md`, `AUDIT_*.md`, `GATE_4_AUDIT.md`, `INVESTMENT_MODULE.md`, `COOPERATIVE_GOVERNANCE.md`, `ARCHITECTURE_DECISIONS.md`, `APPLY_GATE2_MIGRATIONS.sql`, `SAFE_HAVEN_INTEGRATION_MAP.md` | Historical records — preserve as-is (audit trail accuracy). |
| `SETUP.md`, `docs/DEV_PORTAL_ACCESS.md`, `LAUNCH-CHECKLIST.md` | Active docs — update brand mentions; keep live-domain URLs. |
| `qa-responsive.js`, `qa-lean.js` | Internal QA scripts against the live domain — preserve (they exercise `agriqcap.vercel.app`, still live). |
| `.github/workflows/health-guard.yml` | Active CI — keep `agriqcap.vercel.app` health URL (live domain); no brand text. |
| Code comments ("Agriqcap — ..." headers) | Non-functional — update opportunistically in touched files only. |

---

## 3. Brand Assets

| Asset | Status |
|---|---|
| `public/favicon.svg` | Geometric mark (green circles), **no text** — no change needed |
| `public/favicon.ico` | Same mark — no change needed |
| `public/manifest.json` | Contains brand NAME strings → update (Category A) |
| Logo rendering | Text-based (`font-display` "Agriqcap" spans) — changes with code, no image assets |
| OG/social images | None found in repo |
| Email logos | Templates render text/BRAND config — no image assets |

**No new logo generation required** (per instruction: do not invent). Existing geometric favicon carries over.

---

## 4. Technical Risk Assessment

| Area | Risk | Mitigation |
|---|---|---|
| Safe Haven JWT issuer | **HIGH if changed** — token issuance breaks | Preserved; tied to domain migration later |
| Webhook URL / signature | **HIGH if changed** — deposits stop being credited | Preserved; domain migration handles later |
| Auth cookies / sessions | Medium if renamed — mass logout | Preserved verbatim |
| DB tables / RPCs | Zero — **no schema renames performed at all** | N/A |
| Seeded brand data (cooperative, investment product) | Medium — customer-visible legacy name stays if untouched | New migration 00058 + direct prod update |
| Email addresses / sender | Medium if pointed at unverified domain | Display name rebranded; address preserved until `agropocket.com` verified |
| Statement CSV prefix | Low — filename only | Changed |
| External reference format `agriqcap-wallet-*` | Low if changed, zero gain | Preserved (§16 backward compatibility) |
| PWA manifest | Low | Name changed; icons unchanged |
| Production deploy | Medium — deploys straight to prod from `main` | Full test suite + build before push; `/api/health` guard active |

---

## 5. Variants found

Only two spellings exist in the codebase: `Agriqcap` (canonical, from brand config rule) and rare `AgriQCap` (in live copy on the loans apply page). No `AGRIQCAP`, `Agri-QCap`, `Agri QCap` variants exist in code. Historical report files use mixed casing — untouched.
