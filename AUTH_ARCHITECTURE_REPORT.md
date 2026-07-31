# Agriqcap Authentication Architecture Report
## Critical Architecture Correction — Complete

**Date:** July 31, 2026  
**Status:** ✅ COMPLETE — Email/Password + Mandatory PIN authentication live in production  
**Supersedes:** OTP-First Authentication (ADR-040/041) → Email/Password + PIN (ADR-043)

---

## 1. Architecture Migration Summary

### Previous Architecture (REJECTED)
```
Login → Enter Email → Send OTP → Enter OTP Code → Dashboard
```

### Current Architecture (APPROVED)
```
Signup → Email/Password → Account Created → Email Verification (if required) → PIN Setup → Dashboard
Login (new device) → Email/Password → Dashboard (if PIN exists) or PIN Setup
Login (trusted device) → PIN → Dashboard
```

---

## 2. Authentication Chain (End-to-End)

### Signup Flow
1. User visits `/signup`
2. Enters: First Name, Last Name, Email, Phone, Password, Confirm Password, Terms acceptance
3. Client-side password validation (8+ chars, uppercase, lowercase, number)
4. `supabase.auth.signUp({ email, password })` — creates account in Supabase auth.users
5. Customer record + wallet auto-bootstrapped via `/api/bootstrap`
6. If email confirmation required → `/verify-email` (polls for session)
7. If auto-confirm (sandbox) → `/set-pin` (mandatory PIN setup)

### First Login (New Device)
1. User visits `/login`
2. Enters Email + Password → `supabase.auth.signInWithPassword()`
3. POST `/api/auth/post-login` — checks if user has any device PINs
4. If `needsPinSetup: true` → redirect to `/set-pin`
5. If PIN exists → set `pin_verified` cookie → redirect to `/dashboard`

### PIN Setup (Mandatory)
1. User on `/set-pin` enters 4-digit PIN → confirms
2. POST `/api/auth/pin-setup` with `{ pin }`
3. Server generates `device_id` (crypto.randomUUID — NOT client-provided)
4. PIN hashed with PBKDF2 (10,000 iterations, SHA-256, 16-byte salt)
5. `device_pins` record inserted (user_id, device_id, pin_hash, pin_salt)
6. `agriqcap_device` cookie set (httpOnly, 1-year maxAge)
7. `agriqcap_pin_verified` cookie set (httpOnly, session-scoped)
8. Redirect to `/dashboard`

### Returning User (Trusted Device)
1. User visits `/login`
2. Middleware detects valid session + device cookie → PIN mode
3. User enters 4-digit PIN
4. POST `/api/auth/pin-verify` with `{ pin }`
5. Server reads `device_id` from httpOnly cookie (NOT request body)
6. Looks up `device_pins` record by user_id + device_id
7. Verifies: `PBKDF2(pin, salt) === pin_hash`
8. Correct → reset failed_attempts, refresh session, set pin_verified cookie → `/dashboard`
9. Wrong → increment failed_attempts, return remaining count
10. 5 failed attempts → `locked_at` set, return `{ code: "locked" }` → force password

### Password Fallback
1. PIN login screen shows "Use password instead" link
2. Switches to Email/Password mode
3. Standard `signInWithPassword` flow

### Forgot PIN
1. User visits `/forgot-pin`
2. Enters Email + Password → `signInWithPassword()`
3. On success → New PIN step
4. POST `/api/auth/pin-setup` with new PIN → Dashboard

### Change PIN (Settings)
1. User visits `/settings/security`
2. Enters Current PIN, New PIN, Confirm PIN
3. POST `/api/auth/pin-change` — verifies current PIN, sets new hash+salt
4. Failed attempts reset

### Forgot Password
1. User visits `/forgot-password` → enters email
2. `supabase.auth.resetPasswordForEmail()` sends recovery link
3. User clicks link → `/reset-password` → enters new password
4. `supabase.auth.updateUser({ password })` → redirect to `/login`

### Logout
1. `supabase.auth.signOut()` → destroys session
2. Client-side state cleared
3. `agriqcap_pin_verified` cookie expires (session-scoped, no maxAge)
4. `agriqcap_device` cookie preserved (device stays trusted)
5. Next visit: PIN login available

---

## 3. File Inventory

### Auth Pages (12)
| Route | File | Purpose |
|-------|------|---------|
| `/login` | `src/app/(auth)/login/page.tsx` | Email/Password + PIN dual-mode login |
| `/signup` | `src/app/(auth)/signup/page.tsx` | Conventional credential signup |
| `/verify-email` | `src/app/(auth)/verify-email/page.tsx` | Email verification link (not OTP login) |
| `/set-pin` | `src/app/(auth)/set-pin/page.tsx` | Mandatory 4-digit PIN setup |
| `/pin-login` | `src/app/(auth)/pin-login/page.tsx` | PIN-based login for trusted devices |
| `/forgot-pin` | `src/app/(auth)/forgot-pin/page.tsx` | Email/Password → New PIN recovery |
| `/forgot-password` | `src/app/(auth)/forgot-password/page.tsx` | Password reset link via Supabase |
| `/reset-password` | `src/app/(auth)/reset-password/page.tsx` | Set new password |
| `/verify-phone` | `src/app/(auth)/verify-phone/page.tsx` | Redirects to /login (OTP-first removed) |
| `/onboarding` | `src/app/(auth)/onboarding/page.tsx` | Progressive KYC verification (optional) |
| `/welcome` | `src/app/(auth)/welcome/page.tsx` | Landing page with Create/Sign in CTAs |
| `/settings/security` | `src/app/(app)/settings/security/page.tsx` | Change PIN + trusted device management |

### Auth API Routes (6)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/pin-setup` | POST | Create device PIN (server-generated device_id, PBKDF2 hash) |
| `/api/auth/pin-verify` | POST | Verify PIN (httpOnly cookie device_id, 5-attempt lockout) |
| `/api/auth/pin-change` | POST | Change PIN (requires current PIN verification) |
| `/api/auth/pin-status` | GET | Check if user has any device PINs |
| `/api/auth/pin-remove` | POST | Revoke a trusted device |
| `/api/auth/post-login` | POST | Post-password-login: set pin_verified cookie, check PIN status |

### Auth Libraries (1)
| File | Purpose |
|------|---------|
| `src/lib/auth/device.ts` | Cookie constants, client-side device ID reader, server-side cookie options |

### Auth Components (12)
| Component | Purpose |
|-----------|---------|
| `AuthLayout` | Split-screen layout (form + branded right panel) |
| `AuthLogo` | Agriqcap logo mark |
| `AuthInput` | Standard text input with label |
| `PasswordInput` | Password input with show/hide toggle + hint link |
| `PrimaryButton` | Submit button with loading state |
| `SwitchAuthLink` | "No account? Create one" link |
| `PinInput` | 4-digit PIN input with secure dots |
| `LoginRightPanel` | Branded animation panel for login |
| `SignupRightPanel` | Branded animation panel for signup |
| `RightPanel` | Shared right panel renderer |

### Middleware
| File | Purpose |
|------|---------|
| `src/middleware.ts` | Session refresh, route protection, PIN gate, admin RBAC |

### Database
| Table | Migration | Purpose |
|-------|-----------|---------|
| `device_pins` | 00034, 00035 | Trusted device registry + hashed PINs |

---

## 4. Security Architecture

### PIN Security
- **Hashing:** PBKDF2 with SHA-256, 10,000 iterations, 16-byte per-row salt
- **Storage:** Only `pin_hash` + `pin_salt` in `device_pins` table — never plaintext
- **Transport:** PIN sent over HTTPS to API, verified server-side, never returned
- **Client:** PIN never stored in localStorage, sessionStorage, or client-readable cookies
- **Logging:** PIN never logged, never included in analytics
- **API:** PIN never returned by any API endpoint

### Device Trust
- **Device ID:** Server-generated `crypto.randomUUID()` — not client-provided
- **Cookie:** `agriqcap_device` — httpOnly, secure (production), sameSite=lax, 1-year maxAge
- **Binding:** Each PIN is bound to a specific device_id + user_id (UNIQUE constraint)
- **New device protection:** PIN from device A cannot authenticate on device B
  (device_id comes from httpOnly cookie, not request body)

### Session Management
- **Supabase Auth:** Session via secure cookies (sb-access-token, sb-refresh-token)
- **PIN Verified:** `agriqcap_pin_verified` — httpOnly, session-scoped (no maxAge)
- **Refresh:** `supabase.auth.refreshSession()` on successful PIN verify
- **Logout:** `signOut()` destroys session; pin_verified cookie expires on browser close

### PIN Lockout
- **Max attempts:** 5
- **Lock mechanism:** `failed_attempts >= 5` → `locked_at = now()`
- **Recovery:** User must authenticate with Email/Password
- **No account lock:** Wrong PIN never locks the Supabase account — only the device PIN

### Route Protection
- **Public:** `/`, `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`, `/set-pin`, `/forgot-pin`, marketing pages
- **Authenticated:** `/dashboard`, `/wallet/*`, `/savings/*`, `/loans/*`, `/investments/*`, `/cooperatives`, `/settings/*`, `/profile`, `/notifications`
- **Admin-only:** `/dev/*` (staff check via `is_staff` RPC)
- **PIN Gate:** Authenticated users without `pin_verified` cookie → `/set-pin` or `/pin-login`
- **Enforcement:** Middleware (server-side), not client-side UI hiding

---

## 5. OTP Usage (Corrected Role)

OTP is NOT the default login method. It is retained for:

| Use Case | Mechanism | Status |
|----------|-----------|--------|
| Email verification | Supabase verification link | ✅ Active |
| Password recovery | Supabase reset email link | ✅ Active |
| PIN recovery | Email + Password authentication | ✅ Active |
| New device verification | Email + Password (device gets its own PIN) | ✅ Active |
| Safe Haven bank verification | External OTP (bank API, not app login) | ✅ Correct (integration module) |

---

## 6. Acceptance Criteria Checklist

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Email/password authentication works | ✅ | `signInWithPassword()` in login page |
| 2 | Passwords are actually used | ✅ | Supabase auth.users password column active |
| 3 | New users must establish 4-digit PIN | ✅ | `/set-pin` mandatory redirect in post-login + middleware |
| 4 | Trusted-device PIN login | ✅ | `/pin-login` + `/api/auth/pin-verify` |
| 5 | Password fallback available | ✅ | "Use password instead" link on login + pin-login |
| 6 | OTP not default login | ✅ | No `signInWithOtp` anywhere; verify-phone redirects to /login |
| 7 | PIN never stored in plaintext | ✅ | PBKDF2 hash with salt in device_pins |
| 8 | PIN lockout works | ✅ | 5 attempts → locked_at → force password |
| 9 | Forgot PIN works | ✅ | `/forgot-pin` → Email/Password → new PIN |
| 10 | New-device protection | ✅ | Device ID from httpOnly cookie, not request body |
| 11 | Staff/admin auth works | ✅ | Same Email/Password + PIN model; is_staff RPC |
| 12 | Protected routes actually protected | ✅ | Middleware redirects unauthenticated → /login (307) |
| 13 | Dashboard accessible after auth | ✅ | Post-login redirect to /dashboard |
| 14 | Existing user data preserved | ✅ | auth.users unchanged, no data migration needed |
| 15 | Supabase Auth correctly integrated | ✅ | signUp, signInWithPassword, resetPasswordForEmail, updateUser |
| 16 | No duplicate auth systems | ✅ | Single Supabase Auth + device_pins table |
| 17 | No TS/runtime/API/deploy errors | ✅ | Type check passes, build succeeds, production live |

---

## 7. Production Verification

### Routes (July 31, 2026)
| Path | HTTP | Behavior |
|------|------|---------|
| `/` | 200 | Public landing |
| `/login` | 200 | Email/Password + PIN dual-mode |
| `/signup` | 200 | Conventional credential signup |
| `/forgot-password` | 200 | Password reset link |
| `/reset-password` | 200 | Set new password |
| `/verify-email` | 200 | Email verification polling |
| `/forgot-pin` | 200 | PIN recovery via password |
| `/set-pin` | 200 | Mandatory PIN setup |
| `/pin-login` | 307 | Protected (redirects to /login when no session) |
| `/dashboard` | 307 | Protected (redirects to /login) |
| `/settings` | 307 | Protected |
| `/settings/security` | 307 | Protected (new page) |
| `/dev` | 307 | Admin-only (redirects to /login) |
| `/admin` | 307 | Redirects to /dev |

### Safe Haven Integration
- Status: ✅ Connected
- Accounts API: ✅ HTTP 200

### Database
- `device_pins` table: ✅ Exists with RLS
- `is_staff` RPC: ✅ Exists
- All 4 RPC functions (migration 00036): ✅ Confirmed present

---

## 8. Architecture Decisions

- **ADR-043:** Email/Password + Mandatory PIN supersedes ADR-040/041 (OTP-First)
- PIN is device-bound (server-generated device_id in httpOnly cookie)
- PIN is PBKDF2-hashed (10K iterations, SHA-256, 16-byte salt)
- 5 failed PIN attempts → lockout → force password authentication
- PIN alone cannot authenticate on a new device
- Staff/admin use same authentication model
- No "Skip PIN" option — PIN setup is mandatory
- OTP retained only for email verification, password recovery, step-up verification

---

*Authentication architecture correction: COMPLETE.*
