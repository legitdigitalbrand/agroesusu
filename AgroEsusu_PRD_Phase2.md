# AgroEsusu — Phase 2 PRD
## Real Money Movement + Social/Gamification Layer

**Document Owner:** Chinedu Okonkwo
**Date:** July 6, 2026
**Status:** Approved for Build
**Excludes:** Credit scoring (explicitly parked per owner instruction)

---

## Overview

Phase 1.5 shipped trust/virality features (group invites, DVA/BVN scaffolding, deposit reliability). During QA of the withdrawal flow, we found withdrawals are **simulated only** — no real money leaves Paystack, and lock enforcement is client-side (bypassable). This is a correctness/trust gap that must close before real users deposit real money.

Phase 2 closes that gap, then adds the social/gamification layer from the original roadmap (round-up automation, hard-lock penalty interest, emergency fund groups, leaderboard, peer ratings, cycle reports).

---

## Feature 0: Real Withdrawals via Paystack Transfer (P0 — Critical)

### Problem
`/withdraw` currently: decrements `savings_accounts.current_amount` directly from the client, marks a transaction `completed`, shows "money sent to your bank" — but no Paystack Transfer API call ever happens. Lock enforcement (`lock_type`/`unlock_date`) is a client-side `if` check only, trivially bypassed via direct Supabase calls. Real user money would be trapped with no way to actually get it out.

### Solution
- **Bank account collection at withdrawal time** (not stored as a linked payment method — same spirit as card checkout: fresh entry per transaction, consistent with the "no stored bank account numbers" principle applied to deposits).
- `GET /api/withdraw/banks` — list Nigerian banks (Paystack `/bank` endpoint) for a dropdown.
- `POST /api/withdraw/resolve-account` — verify account name via Paystack `/bank/resolve` before submitting (shows "JOHN DOE" confirmation, catches typos).
- `POST /api/withdraw/init` — server-side route that:
  1. Re-validates balance and lock status **server-side** (never trust client) using the service-role Supabase client.
  2. Creates a pending transaction (status `pending`, negative-flow marker).
  3. Deducts `current_amount` immediately (optimistic deduction, held in a "pending withdrawal" state) to prevent double-withdraw race conditions.
  4. Creates a Paystack Transfer Recipient, then initiates a Transfer.
  5. Returns a friendly pending state to the client.
- Webhook additions: handle `transfer.success` (mark completed, notify), `transfer.failed` / `transfer.reversed` (refund balance back to account, notify user of failure — never silently lose funds).

### Acceptance Criteria
- [ ] Withdrawal requires bank account number + bank selection, with account name resolution shown before confirm
- [ ] Lock status and balance are validated server-side, not just client-side
- [ ] A real Paystack Transfer is initiated (test mode) on withdrawal submit
- [ ] Balance is only permanently deducted on `transfer.success`; reversed/failed transfers restore the balance
- [ ] User gets a notification on transfer success and on transfer failure
- [ ] Direct API/Supabase calls bypassing the UI cannot withdraw from a locked pot or over-withdraw balance

---

## Feature 1: Round-Up Savings Automation (P0)

### Problem
No automated "save the change" mechanism exists — a proven low-friction savings habit builder.

### Solution
- On every successful deposit, if the user has a **Stash** pot with round-up enabled, compute the round-up: `ceil(deposit_amount / 100) * 100 - deposit_amount`.
- Credit the round-up amount to the designated Stash pot as a separate `interest`-adjacent transaction type (`round_up`), funded from the same completed deposit (not an extra charge — it's an allocation split, not new money, OR treated as a rounding "top-up" tracked for transparency; for MVP we track it as a bookkeeping entry, not a second real charge, since introducing a second real debit per deposit adds unnecessary payment complexity for a "spare change" feature).
- Toggle in Stash account settings: "Round up my deposits."

### Acceptance Criteria
- [ ] User can enable round-up on a Stash pot
- [ ] Each completed deposit triggers a round-up allocation shown in transaction history as its own line item
- [ ] Round-up total is visible on the Stash pot card

---

## Feature 2: Hard-Lock Goals with Penalty Interest (P1)

### Problem
`lock_type` exists in schema (`none` / `until_date` / `until_amount`) but there's no distinction between **soft** (early withdrawal allowed with penalty) and **hard** (blocked until date) locks, and no penalty interest logic.

### Solution
- Extend `lock_type` enum: `none`, `soft` (early withdrawal allowed, forfeits accrued interest), `hard` (blocked until `unlock_date`, enforced server-side in the withdrawal route from Feature 0).
- On early soft-lock withdrawal: zero out any accrued interest on that pot before crediting, log the forfeiture in the transaction description.

### Acceptance Criteria
- [ ] Hard-locked pots reject withdrawal attempts server-side until `unlock_date`
- [ ] Soft-locked pots allow withdrawal but forfeit accrued interest, clearly disclosed before confirm

---

## Feature 3: Emergency Fund Groups (P1)

### Problem
Only rotating-cycle (esusu) groups exist. No shared safety-net pool for a group.

### Solution
- New `savings_groups.type = 'emergency'`.
- Members contribute to a shared pool (tracked via `group_contributions`, same as esusu).
- Any member can submit a **request** (amount + reason) against the pool.
- Other members vote (approve/deny); simple majority approves.
- On approval, admin (or system, if threshold met) marks it disbursed and deducts from the pool total.

### Acceptance Criteria
- [ ] Group creation supports "Emergency Fund" type
- [ ] Member can submit a withdrawal request with a reason
- [ ] Other members can vote; request auto-resolves at majority
- [ ] Approved requests deduct from pool total and are logged

---

## Feature 4: Group Leaderboard & Gamification (P1)

### Solution
- Leaderboard tab on group page: ranks members by on-time contribution rate (verified contributions / cycles elapsed).
- Simple badge system: "Perfect record" (100% on-time), "Reliable" (>80%).

### Acceptance Criteria
- [ ] Leaderboard visible on group detail page, sorted by reliability
- [ ] Badges shown next to qualifying members

---

## Feature 5: Peer Rating System (P2)

### Solution
- After a cycle completes (or a member receives payout), other members can rate them 1-5 on reliability.
- Average feeds `group_members.reliability_rating`.

### Acceptance Criteria
- [ ] Members can rate each other post-cycle
- [ ] `reliability_rating` updates as the average of received ratings

---

## Feature 6: Cycle Completion Reports (P2)

### Solution
- When `current_cycle > total_cycles` or admin marks a group `completed`, generate a summary: total pooled, on-time rate, per-member contribution history.
- Simple in-app report page, no PDF export for MVP.

### Acceptance Criteria
- [ ] Completed groups show a summary report page
- [ ] Report includes total saved, on-time %, and payout history per member

---

## Build Order

1. **Feature 0 (Real Withdrawals)** — blocking, ships first, alone.
2. **Feature 1 (Round-up)** — small, independent, ships next.
3. **Feature 2 (Hard-lock penalty)** — extends Feature 0's withdrawal route.
4. **Feature 3 (Emergency funds)** — larger, new group type.
5. **Feature 4 (Leaderboard)** — small, reads existing data.
6. **Feature 5 (Peer ratings)** — small, new UI + column update.
7. **Feature 6 (Cycle reports)** — small, reads existing data.

Explicitly excluded from Phase 2: credit scoring (parked per owner instruction).
