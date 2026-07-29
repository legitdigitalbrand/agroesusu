# Cooperative Governance & Group Savings

## Overview

Phase 7 makes cooperatives real. Memberships, elected leadership, committees, meetings, and resolutions — plus the mechanics of pooled/rotating group savings (Esusu, Equal Share, Common Pool, Seasonal, Emergency Funds). It also closes the loop with Phase 6 by supplying real cooperative-participation data to the loan eligibility engine.

**Key principle:** All pooled-fund payouts/distributions go through the Orchestrator. Governance actions are immutable. The cooperative-participation signal matches Phase 6's contract exactly.

---

## Membership Engine

### Cooperative Entity

Cooperatives are configurable entities with their own governance parameters (voting quorum, pass percentage, meeting frequency, self-join rules).

**Seeded Example:** Agriqcap Farmers Cooperative (COOP-0001) — agricultural cooperative with 4 executive positions: President, Vice President, Secretary, Treasurer.

### Membership Lifecycle

```
pending → active → (suspended) → left
                   ↘ revoked
```

Each customer has one membership per cooperative. Memberships track join date, role (member/executive/admin), and cooperative-specific metadata.

### Executive Positions

Configurable per cooperative — not a fixed global list. Each cooperative defines its own positions (President, Secretary, Treasurer, etc.) with sort ordering. Positions are filled via elections or direct appointment.

---

## Governance

### Elections

```
draft → open → closed
              ↘ cancelled
```

- Elections have a defined voting period (opens_at → closes_at)
- Members cast votes (yes/no/abstain) for candidates
- When closed, the candidate with the most votes wins
- Winner is appointed to the associated executive position

### Resolutions

```
proposed → voting → passed/failed
                    ↘ withdrawn
```

Resolutions are decisions that require a vote. They can be proposed at meetings or independently. Voting period is configurable.

### Meetings

Meetings are scheduled events with attendance tracking. Minutes can be recorded. Attendance feeds into the participation signal.

### Governance Audit Trail

The `governance_audit_log` table is:
- **Append-only** — no UPDATE or DELETE (enforced by triggers)
- **Hash-chained** — each record contains `previous_hash` and `event_hash` (SHA-256)
- **Separate from financial audit** — governance events don't appear in the Ledger

Every governance action (election created, vote cast, resolution passed, member joined) is logged with the actor, timestamp, and full event data.

---

## Group Savings Products

### Seeded Products

| Code | Name | Type | Min Contribution | Members | Payout | Interest |
|---|---|---|---|---|---|---|
| EQUAL-SHARE | Equal Share Savings | equal_share | ₦5,000 (fixed) | 2-20 | Equal split at cycle end | 0% |
| COMMON-POOL | Common Pool Savings | common_pool | ₦500 | 3-30 | Proportional | 2% |
| SEASONAL | Seasonal Savings | seasonal | ₦500 | 3-50 | Equal split at cycle end | 5% |
| EMERGENCY-FUND | Emergency Fund | emergency_fund | ₦200 | 5-100 | On demand | 1% |

### Pool Accounting

Each group savings account gets its own liability ledger account under parent 2005 (Group Savings Pools).

| Transaction | Debit | Credit |
|---|---|---|
| Contribution | Wallet (2000.{wallet}) | Group Pool (2005.{group}) |
| Payout | Group Pool (2005.{group}) | Wallet (2000.{wallet}) |

Pool balance is derived from the Ledger — never written directly.

---

## Esusu Rotation Logic

### How Esusu Works

1. N members join an Esusu group
2. Each member contributes a fixed amount per cycle (e.g., ₦50,000/month)
3. Each cycle, one member receives the full pool (N × contribution_amount)
4. The rotation order determines who gets paid when
5. After N cycles, the rotation is complete

### Configuration

Each Esusu group has configurable:
- **contribution_amount** — fixed per member per cycle
- **cycle_length_days** — how often contributions are due (default: 30)
- **total_cycles** — = number of members (each gets one payout)
- **rotation_order** — array of membership IDs in payout order
- **missed_policy** — what happens when a member misses a contribution:
  - `skip_turn` — member loses their turn
  - `penalty` — member keeps their turn but pays a penalty
  - `group_vote` — group votes on what to do
  - `exclude_member` — member is removed from the rotation
- **missed_penalty_rate** — % penalty per missed contribution

### Worked Example: Full Esusu Rotation Payout

**Setup:** 5 members, ₦50,000/month contribution, 30-day cycles.
Member at position 1 is due for payout in cycle 1.

1. All 5 members contribute ₦50,000 each → pool = ₦250,000
2. Each contribution: Orchestrator posts Debit Wallet ₦50,000, Credit Group Pool ₦50,000
3. Pool balance (from Ledger) = ₦250,000
4. Daily cron triggers `processNextPayout()`:
   - Recipient = rotation_order[0] (position 1)
   - Pool amount = ₦250,000
   - No missed contributions → penalty = ₦0
   - Payout amount = ₦250,000
5. Orchestrator posts: Debit Group Pool ₦250,000, Credit Recipient Wallet ₦250,000
6. Payout record: status = 'completed', financial_transaction_id = FT reference
7. Esusu advances: current_cycle = 1, current_position = 1 (next recipient)

**Accounting impact:**
- Group Pool (2005.GRP-...) decreased by ₦250,000 (debit)
- Recipient Wallet (2000.WAL-...) increased by ₦250,000 (credit)
- All 5 contributions (₦250,000 total) fully distributed — pool returns to ₦0

---

## Cooperative-Participation Signal (Phase 6 Contract Fulfillment)

### Contract Match: ✅ CONFIRMED

Phase 6 defined:
```typescript
interface CooperativeParticipation {
  status: 'verified' | 'not_member' | 'not_available';
  cooperative_id?: string;
  membership_tenure_days?: number;
  participation_score?: number; // 0-100
}
```

Phase 7 implements exactly this interface via `getCooperativeParticipation(customerId)` in the cooperative module, which is now wired into Phase 6's `eligibility.ts` (replacing the stub).

### Participation Score (0-100)

| Component | Max Points | Calculation |
|---|---|---|
| Base (being a member) | 20 | Flat |
| Tenure | 30 | min(30, tenure_days / 365 × 30) |
| Meeting attendance | 20 | attendance_rate × 20 |
| Voting participation | 15 | voting_rate × 15 |
| Group savings consistency | 10 | consistency_rate × 10 |
| Executive position | 5 | If held |
| **Total** | **100** | |

### Signal Storage

Daily snapshots stored in `cooperative_participation_signals` table (one row per customer per day). Phase 6 reads the latest: `SELECT * FROM cooperative_participation_signals WHERE customer_id = ? ORDER BY snapshot_date DESC LIMIT 1`

### End-to-End Flow

```
Customer joins cooperative (Phase 7)
  ↓
Customer attends meetings, votes in elections, contributes to group savings
  ↓
Daily cron computes participation signal → cooperative_participation_signals
  ↓
Customer applies for loan (Phase 6)
  ↓
Eligibility engine calls getCooperativeParticipation(customerId)
  ↓
Returns: { status: 'verified', cooperative_id, membership_tenure_days, participation_score }
  ↓
If product requires cooperative membership: factor checked → pass/fail logged
```

---

## API Endpoints

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/cooperatives` | GET | Authenticated | List active cooperatives |
| `/api/cooperatives/[coopId]` | GET | Authenticated | Cooperative details + positions |
| `/api/cooperatives/[coopId]/join` | POST | Customer | Join cooperative |
| `/api/cooperatives/[coopId]/elections` | GET | Member | List elections |
| `/api/cooperatives/[coopId]/elections/[electionId]/vote` | POST | Member | Cast a vote |
| `/api/cooperatives/[coopId]/resolutions` | GET | Member | List resolutions |
| `/api/cooperatives/[coopId]/meetings` | GET | Member | List meetings |
| `/api/group-savings/products` | GET | Authenticated | List group savings products |
| `/api/group-savings/accounts` | POST | Authenticated | Create group savings account |
| `/api/group-savings/accounts/[accountId]` | GET | Member | Account details + members |
| `/api/group-savings/accounts/[accountId]/contribute` | POST | Member | Contribute to pool |
| `/api/group-savings/accounts/[accountId]/join` | POST | Customer | Join group savings |
| `/api/esusu/[groupId]` | GET | Member | Esusu group details |
| `/api/cron/process-esusu-payouts` | POST | CRON_SECRET | Daily Esusu payout (8 AM) |

---

## Chart of Accounts Extension

| Account | Type | Purpose |
|---|---|---|
| 2005 | liability (parent) | Group Savings Pools — each group gets a child: 2005.{account_number} |

### Group Savings Accounting Entries

| Transaction | Debit | Credit |
|---|---|---|
| Contribution | Wallet (2000.{wallet}) | Group Pool (2005.{group}) |
| Payout/Esusu | Group Pool (2005.{group}) | Wallet (2000.{wallet}) |

---

## What Phase 7 Is NOT

- ❌ Investment products (Phase 8)
- ❌ Cross-cooperative federation logic
- ❌ Advanced reporting/analytics dashboards (Phase 9)
- ❌ Settlement negotiation or legal escalation for defaulted group members
