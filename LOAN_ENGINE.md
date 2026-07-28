# Loan Engine

## Overview

The Loan Engine implements the "Savings First" lending philosophy. A customer's savings behavior (captured in Phase 5) becomes the basis for loan access. Every eligibility decision is explainable and logged. All financial movements go through the Orchestrator.

**Key principle:** No loan disbursement or repayment bypasses the Orchestrator. Every eligibility decision (automated or admin-overridden) is logged with its rationale. Defaults are a state, not a deletion.

---

## Product Configuration

### Seeded Products (Phase 6)

| Code | Name | Type | Interest | Term | Savings Multiplier | Min Tenure | Min Credit Score |
|---|---|---|---|---|---|---|---|
| SAL | Salary Loan | salary | 15% flat | 3-6 months | 3.0× | 90 days | 500 |
| AGR | Agricultural Loan | agricultural | 18% reducing balance | 6-12 months | 2.5× | 180 days | 550 |

### Config Fields

Each product defines:
- **Interest**: method (flat/reducing_balance), rate
- **Term**: min/max/default months
- **Savings-First rules**: savings multiplier, min tenure, min consistency/stability scores, min credit score
- **Amount limits**: min/max loan amount
- **Fees**: origination fee rate, processing fee
- **Penalties**: late payment penalty rate, grace period days
- **Default rules**: max consecutive missed installments before default
- **Cooperative**: requires cooperative membership (boolean)

All parameters are admin-configurable — no code deploy needed.

---

## Eligibility Engine

The core of "Savings First" lending. Reads Phase 5's `savings_history_signals` + customer risk profile + loan product config to produce a defensible eligibility decision.

### Factors Checked (per product config)

| Factor | Source | Threshold | Weight |
|---|---|---|---|
| savings_multiplier | savings_history_signals.total_savings_balance × product.multiplier | ≥ requested amount | 40% |
| savings_tenure | savings_history_signals.savings_tenure_days | ≥ product.min_savings_tenure_days | 20% |
| consistency_score | savings_history_signals.consistency_score | ≥ product.min_consistency_score | 15% |
| stability_score | savings_history_signals.stability_score | ≥ product.min_stability_score | 10% |
| credit_score | computed from signals + risk profile | ≥ product.min_credit_score | 10% |
| risk_level | customer_risk_profiles.risk_level | ≠ 'restricted' | 5% |
| cooperative_membership | Phase 7 (STUB) | 'verified' if required | 5% |
| min_amount | requested_amount | ≥ product.min_amount | — |

### Internal Credit Score (300-850)

```
Base: 300
+ tenure_score × 2.0 (max +200)
+ consistency_score × 1.5 (max +150)
+ stability_score × 1.0 (max +100)
- defaulted_loans × 100
- late_repayments × 10
Clamped to 300-850
```

### Decision Outcomes

- **approved**: All factors passed, approved at requested amount
- **amount_adjusted**: Savings multiplier check failed, but max_eligible_amount ≥ min_amount → approved at lower amount
- **denied**: One or more factors failed

### Worked Example: Approval

Customer applies for ₦100,000 Salary Loan (3× multiplier, 90-day tenure required).

Savings signal: balance ₦50,000, tenure 120 days, consistency 65, stability 70, tenure score 33.

```
Factors:
1. savings_multiplier: ₦50,000 × 3.0 = ₦150,000 ≥ ₦100,000 ✓
2. savings_tenure: 120 days ≥ 90 days ✓
3. consistency_score: 65 ≥ 50 ✓
4. stability_score: 70 ≥ 40 ✓
5. credit_score: 300 + (33×2) + (65×1.5) + (70×1) = 300+66+97.5+70 = 534 ≥ 500 ✓
6. risk_level: 'low' ≠ 'restricted' ✓
7. min_amount: ₦100,000 ≥ ₦5,000 ✓

Decision: APPROVED for ₦100,000
Rationale: "Loan approved for ₦100,000. All 7 eligibility checks passed. Credit score: 534."
```

### Worked Example: Denial

Customer applies for ₦200,000 Agricultural Loan (2.5× multiplier, 180-day tenure required).

Savings signal: balance ₦20,000, tenure 60 days, consistency 40, stability 30, tenure score 16.

```
Factors:
1. savings_multiplier: ₦20,000 × 2.5 = ₦50,000 < ₦200,000 ✗
   (max eligible: ₦50,000 — below min_amount ₦10,000? No, ≥ ₦10,000 → amount_adjusted possible)
2. savings_tenure: 60 days < 180 days ✗
3. consistency_score: 40 < 60 ✗
4. stability_score: 30 < 50 ✗
5. credit_score: 300 + (16×2) + (40×1.5) + (30×1) = 300+32+60+30 = 422 < 550 ✗

Decision: DENIED
Rationale: "Loan denied. Failed checks: savings_multiplier, savings_tenure, consistency_score, stability_score, credit_score."
```

### Audit Trail

Every decision is stored in `loan_eligibility_decisions` with:
- All factors checked (JSON array: factor, value, threshold, passed, contribution)
- Credit score, savings balance, max eligible amount
- Source: 'automated' or 'admin_override'
- Override reason and approver (if admin override)

---

## Loan Lifecycle

```
applied → approved → disbursed → active → closed
         ↘ denied              ↘ defaulted
```

| State | Entry Condition |
|---|---|
| `applied` | Customer submits application |
| `approved` | Eligibility check passed |
| `denied` | Eligibility check failed |
| `disbursed` | Funds disbursed (alias: `active`) |
| `active` | Loan is in repayment |
| `closed` | All installments paid |
| `defaulted` | N consecutive missed installments |

---

## Disbursement Flow

```
Approved loan + agreement accepted
  ↓
Loan module looks up loan's ledger account (1002.{loan_number})
  ↓
Calls Orchestrator.initiate({ transaction_type: 'loan_disbursement', ... })
  ↓
Orchestrator posts:
  Debit  Loan Receivable (1002.{loan})     — asset increases (customer owes us)
  Credit Wallet (2000.{wallet})             — liability increases (wallet grows)
  ↓
Loan status → active, repayment schedule generated
  ↓
Risk profile updated (active_loans += 1)
```

### Worked Example: Disbursement

₦100,000 Salary Loan, 3 months, 15% flat.

1. Interest = ₦100,000 × 15% × 3/12 = ₦3,750
2. Total payable = ₦100,000 + ₦3,750 = ₦103,750
3. Orchestrator posts: Debit Loan Receivable ₦100,000, Credit Wallet ₦100,000
4. Schedule generated: 3 monthly installments of ₦34,583.33
5. Loan status → active, next_due_date = +1 month

---

## Repayment Processing

```
Customer makes a repayment
  ↓
Loan module finds the next due installment
  ↓
Splits repayment into principal + interest
  ↓
Calls Orchestrator for principal: Debit Wallet, Credit Loan Receivable
Calls Orchestrator for interest: Debit Wallet, Credit Interest Revenue (4001)
  ↓
Installment record updated (amount_paid, status)
  ↓
Loan totals updated (total_repaid, total_interest_paid)
  ↓
If all installments paid → loan status → closed
  ↓
Risk profile updated (repayment count, on_time/late)
```

### Worked Example: On-Time Repayment

Installment 1: ₦34,583.33 (₦33,333.33 principal + ₦1,250 interest).

1. Customer repays ₦34,583.33 on due date
2. Split: ₦33,333.33 principal, ₦1,250 interest
3. Orchestrator posts principal: Debit Wallet ₦33,333.33, Credit Loan Receivable ₦33,333.33
4. Orchestrator posts interest: Debit Wallet ₦1,250, Credit Interest Revenue ₦1,250
5. Installment 1 → status: 'paid', paid_at: now
6. Loan: total_repaid = ₦33,333.33, total_interest_paid = ₦1,250
7. Risk profile: on_time_repayments += 1

### Worked Example: Late Repayment

Installment 2 is 10 days late (grace period was 3 days).

1. Collections job marks installment as 'late' (10 days late)
2. Penalty: ₦34,583.33 × 2% × ceil(10/7) weeks = ₦34,583.33 × 2% × 2 = ₦1,383.33
3. Orchestrator posts penalty: Debit Loan Receivable ₦1,383.33, Credit Fee Revenue ₦1,383.33
4. Customer repays ₦34,583.33 + ₦1,383.33 (penalty)
5. Installment 2 → status: 'paid'
6. Risk profile: late_repayments += 1

---

## Collections & Default

Daily cron at 6 AM checks all active loans:

1. For each installment past due date + grace period: mark as 'late', apply penalty
2. Count consecutive missed installments
3. If consecutive missed ≥ product.max_missed_installments → loan → 'defaulted'
4. On default: update risk profile (defaulted_loans += 1, risk_level → 'high' or 'restricted')

### Worked Example: Default

Salary Loan with max_missed_installments = 3. Customer misses 3 consecutive installments.

1. Collections job detects 3 consecutive late installments
2. Loan status → 'defaulted', defaulted_at = now
3. Remaining installments → status: 'defaulted'
4. Risk profile: defaulted_loans += 1, active_loans -= 1, risk_level → 'high'
5. If this is the 2nd default: risk_level → 'restricted' (cannot apply for new loans)
6. **Loan record and all history remain fully traceable — nothing is deleted**

---

## Cooperative Participation (STUB)

The eligibility engine checks cooperative membership for products that require it. Since Phase 7 hasn't been built yet, this is a stub that returns `status: 'not_available'`.

### Interface Phase 7 Must Supply

```typescript
interface CooperativeParticipation {
  status: 'verified' | 'not_member' | 'not_available';
  cooperative_id?: string;
  membership_tenure_days?: number;
  participation_score?: number;  // 0-100
}
```

Phase 7 must implement a function that, given a `customer_id`, returns this object. The eligibility engine calls it during evaluation and uses `status === 'verified'` as the pass criterion.

---

## API Endpoints

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/loans/products` | GET | Authenticated | List active loan products |
| `/api/loans` | POST | Customer or staff | Apply for a loan |
| `/api/loans` | GET | Customer or staff | List loans |
| `/api/loans/[loanId]` | GET | Owner or staff | Loan details + schedule |
| `/api/loans/[loanId]` | POST | Owner | Accept loan agreement |
| `/api/loans/[loanId]/repay` | POST | Owner or staff | Make a repayment |
| `/api/loans/[loanId]/disburse` | POST | Staff only | Disburse approved loan |
| `/api/cron/check-overdue` | POST | CRON_SECRET | Daily collections check (6 AM) |

---

## Chart of Accounts Extension

| Account | Type | Purpose |
|---|---|---|
| 1002 | asset (parent) | Loan Receivables — each loan gets a child: 1002.{loan_number} |
| 4000 | revenue | Fee Revenue — penalties posted here |
| 4001 | revenue | Interest Revenue — loan interest posted here |

### Loan Accounting Entries

| Transaction | Debit | Credit |
|---|---|---|
| Disbursement | Loan Receivable (1002.{loan}) | Wallet (2000.{wallet}) |
| Repayment (principal) | Wallet (2000.{wallet}) | Loan Receivable (1002.{loan}) |
| Repayment (interest) | Wallet (2000.{wallet}) | Interest Revenue (4001) |
| Penalty | Loan Receivable (1002.{loan}) | Fee Revenue (4000) |
