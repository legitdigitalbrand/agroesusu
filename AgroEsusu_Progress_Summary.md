# AgroEsusu — Full Build Summary
**As of:** July 8, 2026

## What it is
AgroEsusu is a savings + group-esusu app for agripreneurs, built as a web-first PWA. Personal savings pots are the core product; group esusu/emergency-fund pools are the social/viral growth layer. Credit scoring is explicitly out of scope for now.

**Live:** https://agroesusu.vercel.app
**Repo:** https://github.com/legitdigitalbrand/agroesusu
**Stack:** Next.js 16 + Tailwind CSS v4 + TypeScript, Supabase (Postgres + Auth), Paystack (payments/transfers), deployed on Vercel.

---

## Phase 1 — MVP
- Full auth (Supabase Auth, email/password), 8-table schema with Row-Level Security.
- Personal savings pots (Flex, Goal, Seasonal, Stash types) — create, track progress, view balance.
- Real deposits via Paystack Checkout, idempotent webhook verification and crediting.
- Transactions history, notifications, profile.
- Dashboard, Save, Deposit, Withdraw, Transactions, Groups (placeholder), Profile — all pages built and wired to real Supabase data (no more mock data).

## Phase 1.5 — Security hardening
- **Critical fix:** withdrawals were originally fake (client-side balance decrement only). Rebuilt as real Paystack Transfers — server validates balance/lock/KYC, creates a transfer recipient, initiates the transfer, deducts balance optimistically, auto-refunds via webhook if the transfer fails/reverses.
- **Critical fix:** RLS policies only checked record ownership, not value correctness — any user could have set their own balance via the client SDK. Added Postgres triggers blocking any non-service-role write to balance/total fields. Verified fail-closed.

## Phase 2 — Group features & real money flows
- **Round-up automation:** deposits can auto-credit spare change into a linked stash pot.
- **Real lock enforcement:** hard/soft/until-date locks now enforced server-side (previously client-only and bypassable).
- **Emergency Fund groups:** members request funds from a shared pool; group majority-vote approves/denies with automatic pool deduction and notifications.
- **Esusu groups — real contributions and payouts:** members pay into a cycle via Paystack Checkout (one contribution per member per cycle, DB-enforced); once everyone's paid, the current cycle's recipient claims a real Paystack Transfer payout; cycle advances automatically, pool zeroes, group marks "completed" after the final cycle.
- **Leaderboard + peer ratings:** reliability rating system (1–5 stars) feeding a ranked leaderboard with badges; cycle-completion report shown on finished groups.
- Webhook routes all payment types by reference prefix (deposits, group contributions, withdrawals, group payouts) so every money movement is traceable and idempotent.

## Revenue model — pivoted from "interest" to fees
Early UI promised per-pot "interest" (e.g. "5% interest") with no accrual engine behind it — a live, unfunded promise. That's been fully removed. Real monetization shipped instead:
- **Withdrawal fee:** flat ₦50, deducted from the pot alongside the withdrawal amount, disclosed in the withdraw form before submit.
- **Group facilitation fee:** 1.5% taken from an esusu group's pool before payout to the cycle recipient — the traditional "ajo collector" cut, automated.
- Both fees are enforced server-side, and both refund/rollback paths (failed transfers) correctly restore the full original amount including the fee.
- Real interest is still possible long-term, but needs a licensed banking/MFB partner to invest pooled float — a business development track, not a code change.

## UI/UX
- Full brand system: dark green (#001907 background / #014D15 nav / #04FB46 accent) + gold accent, custom Kuda-standard SVG icon set (no third-party icon libraries, no emoji).
- Dual theme (dark/light) via CSS variables with an anti-flash loading script and localStorage persistence.
- Consistent dark-green hero-header pattern applied across every route (Dashboard, Save, Groups, Transactions, Profile) so no page reads as "plain white" — card-based grid with soft shadows for depth.
- Desktop: dark-chrome sidebar with flat-pill active states. Mobile: bottom nav + curved hero-to-content transition.
- PWA fully configured: manifest, icon set, offline page, Android quick-action shortcuts, network-first service worker (prevents stale UI caching on mobile).
- Split-screen login/signup mockups (dark panel + brand-textured panel) explored and refined; latest direction blends a real photo into the green gradient rather than a flat color block.

## Bugs found & fixed this week
- Dashboard hero had visible white gutters on any viewport between ~448–1024px wide (narrowed browser windows, small laptops) — an outer `max-w-md` wrapper was capping the hero's own background, not just its content. Fixed to go edge-to-edge below desktop width, matching every other page.
- Confirmed (by reading source, not guessing) that the bottom-nav and hero/sidebar green are the exact same hex in both themes — no color mismatch in code.
- BVN verification was a dead end: Paystack's BVN lookup isn't activated on the account yet, so every attempt hard-failed with no way forward. Fixed to fall back to "submitted for manual review" instead of blocking the user outright.
- Manually verified your test account's KYC status in Supabase so you can fully test withdrawals today without waiting on Paystack activation.

## Known gaps / current limitations
- **Paystack Dedicated NUBAN (DVA) and BVN Verification** are both gated behind Paystack business-account activation — not something fixable in code. Alternatives identified if needed: Anchor/Monnify for virtual accounts, QoreID/Mono for BVN/KYC.
- Only one real user account has meaningfully used the app so far — the multi-member group contribution/payout flow is built and deployed but hasn't had a live end-to-end test with 2+ real members yet. Worth doing once the pilot group has more active members.
- No real interest-earning mechanism exists (by design, per the revenue pivot above) — copy has been scrubbed to reflect this honestly.

## What's next (suggested)
1. Get 2+ real pilot members into a group and run a full esusu cycle end-to-end (contribute → payout → next cycle).
2. Chase Paystack business account activation for DVA + BVN, or evaluate Monnify/QoreID as a faster path.
3. Decide on a real interest/banking partnership if that's still a priority for positioning against competitors.
