# AgroCycle — Personal Savings Platform for Agripreneurs
## Product Proposal (Godmode Edition)
**Date:** July 3, 2026  
**Concept Origin:** Financial Inclusion for Agro-Innovation Members  
**Model:** Personal savings (core) + Group savings cycles (feature) + Credit history (moat)

---

## 1. THE THESIS

**One sentence:** AgroCycle is a personal savings app for agripreneurs that helps them build capital on their own terms — with group savings cycles (esusu) as a social booster, and a credit history that unlocks formal finance.

**Why personal savings as core, not group?**

The PDF centers on group contribution pools. But here's the problem with making groups the whole product:
- You can't save alone — you need 9 other people to start. Friction.
- Group dynamics are messy — one defaulter sinks the cycle.
- Customer acquisition is group-by-group, slow and manual.
- Revenue is tied to group activity (sporadic, not recurring).

**Personal savings solves all of that:**
- One person signs up and starts saving immediately. Zero friction.
- You control your own money. No dependency on others.
- Customer acquisition is one user at a time — scalable, viral.
- Revenue is recurring (transaction fees on every deposit/withdrawal, subscription tiers).

**Group savings becomes the growth hack** — the feature that makes personal savings more exciting, more committed, more social. It's the multiplayer mode. But the single-player game has to be great first.

---

## 2. THE PROBLEM (Verified from the PDF)

Agripreneurs need:
1. **Lump-sum capital** at predictable times (planting, harvest)
2. **Discipline** to save consistently (cash in hand gets spent)
3. **Trust** that saved money is safe and accessible
4. **Credit history** to access formal loans later
5. **Community** — the social accountability that keeps them saving

Traditional esusu solves 1, 3, and 5 but fails on 2 (inflexible) and 4 (no records). Banks solve 3 but fail on 1 (minimum balance requirements), 2 (no lock mechanism), and 5 (no community).

**AgroCycle solves all five.**

---

## 3. PRODUCT OVERVIEW

### Three Layers

```
┌─────────────────────────────────────────────┐
│         CREDIT LAYER (The Moat)              │
│   Credit score from savings behavior         │
│   MFI/bank partnerships for loan access      │
│   Portable credit history                    │
├─────────────────────────────────────────────┤
│      GROUP SAVINGS (The Feature)             │
│   Rotating cycles (esusu)                    │
│   Group savings challenges                   │
│   Peer accountability & social pressure      │
├─────────────────────────────────────────────┤
│      PERSONAL SAVINGS (The Core)             │
│   Goal-based savings plans                   │
│   Automated contributions                    │
│   Flexible vs locked savings                 │
│   Season-aware planning                      │
└─────────────────────────────────────────────┘
```

---

## 4. LAYER 1 — PERSONAL SAVINGS (CORE PRODUCT)

### 4.1 Savings Products

#### A. Flex Savings
- Deposit and withdraw anytime
- No minimum balance
- Small interest (2-4% annually, from partner bank float)
- Purpose: emergency fund, working capital buffer
- Analogy: your everyday wallet, but it earns something

#### B. Goal Savings (The flagship product)
- User creates a specific goal: "Planting Season Inputs" ₦150,000 by September
- Choose a plan:
  - **Fixed amount** — ₦10,000/month automatically
  - **Round-up** — round up every transaction to nearest ₦100, save the change
  - **Percentage** — save 10% of every inflow automatically
- Lock options:
  - **Soft lock** — can withdraw early but lose accrued interest
  - **Hard lock** — cannot withdraw until goal date (maximum discipline)
- Visual progress tracker — see your farm goal filling up
- Bonus interest on completion (incentivize finishing)

#### C. Seasonal Vaults (Agro-specific)
- Pre-built savings templates tied to agricultural cycles:
  - **Planting Vault** — save Jan-Mar, unlock April for seeds/fertilizer
  - **Growing Vault** — save Apr-Jul, unlock August for inputs
  - **Harvest Vault** — save during harvest, unlock post-season for equipment/reinvestment
- User picks their crop type, we auto-suggest the right vault timing
- This is the product feature that no generic savings app has

#### D. Stash (Micro-savings)
- Spin on Flex Savings — daily micro-deposits (₦100-₦500/day)
- Frictionless: auto-debit via Paystack mandate or manual tap
- Target: the "I don't have money to save" user — prove them wrong with ₦200/day

### 4.2 How Money Moves (Personal Savings)

```
User bank account ──→ Paystack/Flutterwave ──→ Partner bank escrow (NDIC-insured)
                                                    │
                                              AgroCycle tracks:
                                              - deposit amount
                                              - deposit date
                                              - which goal/vault
                                              - interest accrual
                                              - withdrawal requests
                                                    │
User requests withdrawal ──→ AgroCycle verifies ──→ Partner bank disburses ──→ User bank account
```

**Critical architecture decision:** We partner with a licensed bank or microfinance bank as the **custodian** of funds. AgroCycle is the software layer — we manage UX, goals, automation, tracking. The partner bank holds the money in an NDIC-insured escrow. This means:
- User funds are insured (trust)
- We don't need a banking license (speed)
- We earn revenue from float interest sharing with the partner bank
- Regulatory risk is minimal (we're a tech partner, not a deposit-taker)

**Partner candidates:** Providus Bank (API-friendly), Sterling Bank (agri-focused), or any CBN-licensed MFB. Start conversations early — this is the single most important partnership.

### 4.3 Automation Engine

| Trigger | Action |
|---|---|
| User sets up auto-save | Generate Paystack recurring payment mandate |
| Scheduled save date arrives | Auto-debit via mandate, credit user's goal |
| Mandate fails (insufficient funds) | Retry in 2 days + SMS/WhatsApp notification |
| Goal reached | Celebration notification + bonus interest + suggest next goal |
| Goal date reached (hard lock) | Auto-unlock funds + payout to user's bank |
| User withdraws from soft-lock goal | Deduct accrued interest + log early withdrawal |
| Round-up transaction detected | Calculate change, debit, credit to stash |

---

## 5. LAYER 2 — GROUP SAVINGS (THE FEATURE)

### 5.1 Group Savings Types

#### A. Rotating Cycle (Traditional Esusu — Digital)
- Admin creates cycle: amount, frequency, member count, payout method
- Members join via invite link, agree to terms
- Each period: members pay directly to the current recipient via payment link
- AgroCycle tracks who's paid, who's next, sends reminders
- Payout order options: fixed rotation, priority-by-need (group vote), or smart rotation (by savings reliability score)

#### B. Group Challenge (New concept — competitive savings)
- Group sets a collective goal: "10 farmers save ₦50,000 each in 3 months"
- Each member saves individually into their own goal
- Group dashboard shows everyone's progress (anonymized or named — group choice)
- Social pressure + gamification: leaderboard, milestones, group chat
- At the end: everyone who hit the goal gets a bonus (from AgroCycle or sponsor)
- This is NOT a rotating pool — it's parallel personal savings with social accountability
- **This is the viral feature.** People invite friends to challenges. Growth loop.

#### C. Emergency Fund (Group safety net)
- Group members contribute small amounts to a shared emergency pool
- Any member can request from the pool in emergencies (medical, crop failure, etc.)
- Group votes to approve/deny requests
- Pool earns interest while idle
- Builds on the community trust model from the PDF

### 5.2 How Group Money Moves (Fund-Free Model)

For rotating cycles, we keep the **fund-free approach** from the original concept:
- Payment links redirect members to Paystack checkout → money goes directly to recipient's bank
- AgroCycle never holds group money
- We only store transaction metadata for tracking and audit

For group challenges and emergency funds:
- Each member's contribution goes to their personal AgroCycle savings (custodian bank holds it)
- Emergency pool is held by the partner bank in a designated sub-account
- No money touches AgroCycle's accounts

### 5.3 Group Features

| Feature | Description |
|---|---|
| **Group Dashboard** | See all members' contribution status, cycle progress, payout schedule |
| **Auto-Reminders** | SMS + WhatsApp + in-app before each contribution due date |
| **Payout Tracker** | Visual wheel showing rotation position — who's received, who's next |
| **Dispute Resolution** | Flag missing/wrong payment, admin reviews with full audit log |
| **Group Chat** | Lightweight in-app or WhatsApp group integration for communication |
| **Leaderboard** | For group challenges — who's saving the most consistently |
| **Member Ratings** | After each cycle, members rate each other on reliability → feeds credit score |
| **Cycle Completion Report** | Summary at cycle end: total saved, on-time rate, defaults, payouts |

---

## 6. LAYER 3 — CREDIT LAYER (THE MOAT)

### 6.1 AgroCycle Credit Score

Every user builds a credit score from their savings behavior — both personal and group:

| Factor | Weight | Data Source |
|---|---|---|
| Savings consistency (on-time deposits) | 30% | Personal savings automation history |
| Goal completion rate | 20% | How often goals are fully reached |
| Group cycle completion | 20% | Did they finish cycles without defaulting |
| Peer ratings | 15% | Group members rate reliability after each cycle |
| Account age & volume | 10% | How long they've been saving + total volume |
| Financial literacy engagement | 5% | Completed lessons/modules in the app |

**Score range:** 300-850 (familiar format, portable to formal credit systems)

### 6.2 What the Score Unlocks

| Score | What You Get |
|---|---|
| 300-499 | Basic savings only. No group participation (risk). |
| 500-599 | Can join group cycles. Can access small emergency pool. |
| 600-699 | Eligible for MFI loan referrals (partner MFIs see your history). |
| 700-799 | Preferential loan terms from partner MFIs. Higher cycle slots. |
| 800+ | Premium: lowest loan rates, group admin eligibility, white-glove support. |

### 6.3 MFI/Bank Partnership Layer

- AgroCycle partners with 2-3 MFIs or banks
- When a user with good credit score needs a loan, AgroCycle generates a **credit report** from their savings history
- Report is shared (with user consent) with partner MFI
- MFI makes lending decision — AgroCycle earns referral commission
- This is the data moat: we own the savings behavior data that no one else has on these users

### 6.4 Long-term: Direct Lending (Phase 3)
Once we have enough data and capital:
- Apply for a finance company license or partner with a bank for co-lending
- Offer direct loans to high-score savers
- Use savings as quasi-collateral (auto-deduct from savings for repayment)
- This is where the real money is — but only after we've built the data and trust

---

## 7. COMPLETE FEATURE ROADMAP

### MVP (Phase 1 — 6-8 weeks)
**Goal: Validate that agripreneurs will save digitally**

| # | Feature | Priority |
|---|---|---|
| 1 | User registration (phone OTP + BVN + selfie) | P0 |
| 2 | Flex Savings (deposit, withdraw, balance) | P0 |
| 3 | Goal Savings (create goal, auto-save, progress tracker) | P0 |
| 4 | Paystack integration (one-time + recurring mandates) | P0 |
| 5 | Partner bank escrow setup | P0 |
| 6 | Automated reminders (SMS) | P0 |
| 7 | Basic dashboard (total saved, goals overview) | P0 |
| 8 | Transaction history & receipts | P0 |
| 9 | Seasonal Vault templates (3 pre-built) | P1 |
| 10 | Stash micro-savings (manual daily deposit) | P1 |
| 11 | Basic group cycle (create, join, track, payout rotation) | P1 |
| 12 | WhatsApp notifications | P1 |

### Phase 2 (Month 3-6)
**Goal: Add social layer and credit building**

| # | Feature | Priority |
|---|---|---|
| 13 | Group savings challenges (the viral feature) | P0 |
| 14 | AgroCycle Credit Score (v1) | P0 |
| 15 | Round-up savings automation | P0 |
| 16 | Hard-lock goals with penalty interest | P1 |
| 17 | Emergency fund groups | P1 |
| 18 | Financial literacy modules (bite-sized) | P1 |
| 19 | Group leaderboard & gamification | P1 |
| 20 | Peer rating system | P2 |
| 21 | Cycle completion reports | P2 |

### Phase 3 (Month 6-12)
**Goal: Monetize credit data and build ecosystem**

| # | Feature | Priority |
|---|---|---|
| 22 | MFI partnership integration (credit report generation) | P0 |
| 23 | Agro marketplace (pay directly to input suppliers from savings) | P1 |
| 24 | Crop insurance bundling | P1 |
| 25 | Cooperative registration assistance | P2 |
| 26 | USSD interface (feature phone access) | P2 |
| 27 | White-label for associations/cooperatives | P2 |
| 28 | Direct lending (if licensed/partnered) | P3 |

---

## 8. TECHNICAL ARCHITECTURE

### Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Frontend (Web)** | React + Next.js + Tailwind | Fast, responsive, large talent pool |
| **Frontend (Mobile)** | PWA first → React Native Phase 3 | Don't over-build mobile too early |
| **Backend** | Node.js + Express OR Base44 platform | Base44 for MVP speed, custom Node for scale |
| **Database** | PostgreSQL (primary) + Redis (caching/queues) | Relational data is core (transactions, users, groups) |
| **Payments** | Paystack (primary) + Flutterwave (fallback) | Nigeria's best processors; mandates for auto-save |
| **Custodian Bank** | Providus Bank / Sterling Bank / MFB partner | Holds user funds in escrow, provides float interest |
| **Notifications** | Twilio (SMS) + WhatsApp Business API + SendPulse (email) | Multi-channel for low-connectivity users |
| **File Storage** | AWS S3 or Base44 storage | KYC docs, profile photos, receipts |
| **Auth** | Phone OTP (primary) + BVN verification via VerifyMe/SmileID | Frictionless but secure |
| **Hosting** | Vercel (frontend) + Railway/Render (backend) or Base44 managed | Start lean, scale up |
| **Analytics** | Mixpanel + Posthog | User behavior tracking from day 1 |

### Architecture Diagram

```
                        ┌──────────────┐
                        │   User App   │
                        │  (Web/PWA)   │
                        └──────┬───────┘
                               │
                        ┌──────▼───────┐
                        │  API Gateway │
                        │  (Node.js)   │
                        └──────┬───────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
     ┌────────▼──────┐ ┌──────▼───────┐ ┌──────▼───────┐
     │  Auth Service  │ │ Savings Svc  │ │  Group Svc   │
     │ (OTP + BVN)    │ │ (Goals, Flex)│ │ (Cycles, etc)│
     └────────┬──────┘ └──────┬───────┘ └──────┬───────┘
              │                │                │
     ┌────────▼──────┐ ┌──────▼───────┐ ┌──────▼───────┐
     │ Identity/KYC  │ │ Payment Svc  │ │  Credit Svc  │
     │ (VerifyMe)    │ │ (Paystack)   │ │ (Score Engine)│
     └───────────────┘ └──────┬───────┘ └──────────────┘
                              │
                      ┌───────▼────────┐
                      │ Partner Bank   │
                      │ (Escrow/Float) │
                      └────────────────┘

     ┌──────────────────────────────────────────┐
     │         Notification Service              │
     │  (SMS + WhatsApp + Email + In-app)        │
     └──────────────────────────────────────────┘

     ┌──────────────────────────────────────────┐
     │         Audit & Logging Service           │
     │  (Every transaction, every state change)  │
     └──────────────────────────────────────────┘
```

### Data Model (Core Entities)

```
USER
  id, phone, full_name, bvn_hash, selfie_url, credit_score,
  tier (basic/premium), created_date, updated_date

SAVINGS_ACCOUNT
  id, user_id, type (flex/goal/vault/stash), name, 
  target_amount, current_amount, interest_rate, 
  lock_type (none/soft/hard), unlock_date, 
  auto_save_config (amount, frequency, method), status

TRANSACTION
  id, user_id, account_id, type (deposit/withdrawal/interest/fee),
  amount, payment_reference, payment_method, status, 
  created_date, completed_date

SAVINGS_GROUP
  id, name, admin_id, type (cycle/challenge/emergency),
  contribution_amount, frequency, member_count, 
  payout_method, start_date, end_date, status

GROUP_MEMBER
  id, group_id, user_id, slot_position, 
  reliability_rating, status, joined_date

GROUP_CONTRIBUTION
  id, group_id, user_id, cycle_number, amount,
  payment_reference, status, paid_date, verified_date

GROUP_PAYOUT
  id, group_id, recipient_id, cycle_number, 
  amount, status, completed_date

CREDIT_EVENT
  id, user_id, event_type, score_delta, 
  description, created_date

NOTIFICATION
  id, user_id, type, channel, content, status, sent_date

AUDIT_LOG
  id, entity_type, entity_id, actor_id, action, 
  details, timestamp
```

---

## 9. BUSINESS MODEL

### Revenue Streams

| Stream | How | When | Est. Revenue |
|---|---|---|---|
| **Transaction fees** | 1% on withdrawals (waived for first 3 free withdrawals/month) | MVP | ₦50-100 per user/month |
| **Float interest share** | Split interest earned on escrow float with partner bank | MVP | 2-4% annual on AUM |
| **Premium subscription** | ₦500/month: unlimited withdrawals, higher interest, advanced analytics, priority support | Phase 2 | ₦500/user/month |
| **MFI referral commission** | 1-3% of loan amount when user gets loan via AgroCycle credit report | Phase 3 | ₦5,000-15,000 per referral |
| **Group cycle fee** | 1-2% of each payout in rotating cycles (charged to recipient) | Phase 2 | ₦2,000-5,000 per group/month |
| **Marketplace commission** | 2-5% on agro input purchases routed through platform | Phase 3 | Varies |
| **Insurance commission** | Commission on crop/equipment insurance sold through platform | Phase 3 | 10-15% of premium |
| **White-label licensing** | Monthly license fee for associations/cooperatives using platform | Phase 3 | ₦50,000-200,000/month per org |

### Unit Economics (Personal Savings User)

| Metric | Estimate |
|---|---|
| Average savings balance | ₦30,000-50,000 |
| Monthly deposits | ₦15,000-25,000 |
| Monthly withdrawals | 1-3 |
| Transaction fee revenue | ₦50-100/month |
| Float interest revenue (share) | ₦50-100/month (on ₦50k at 3%) |
| Total revenue per user | ₦100-200/month |
| Premium conversion rate | 10-15% of active users |
| Premium revenue | ₦500/user/month × 12% = ₦60/user/month avg |
| **Blended ARPU** | **₦160-260/user/month** |
| CAC target | ₦1,500-3,000 (digital ads + referrals) |
| **Payback period** | **6-18 months** |
| Gross margin | 70-80% (software business, low marginal cost) |

### Scale Projections

| Milestone | Users | Monthly Revenue | Annual Revenue |
|---|---|---|---|
| Pilot (Month 3) | 500 | ₦100,000 | — |
| Beta (Month 6) | 5,000 | ₦1,000,000 | ₦12M |
| Year 1 | 50,000 | ₦10,000,000 | ₦120M |
| Year 2 | 300,000 | ₦60,000,000 | ₦720M |
| Year 3 | 1,000,000 | ₦200,000,000 | ₦2.4B |

*These are optimistic but not unreasonable for a fintech savings platform in Nigeria. Piggyvest hit 5M users in ~6 years. We're targeting a niche (agripreneurs) which is smaller but more underserved.*

### Funding Strategy

| Stage | Amount | Use | When |
|---|---|---|---|
| Pre-seed (own/friends) | ₦5-10M | MVP build, pilot, legal setup | Now |
| Seed | ₦50-100M | Team, marketing, partner integrations | After 5,000 users |
| Series A | ₦500M-1B | Scale, USSD, marketplace, insurance | After 50,000 users |

**Investor pitch angle:** "We're building the credit infrastructure for the 40 million Nigerian agripreneurs that banks have ignored. We start with savings (low risk, high frequency) and graduate them to credit (high value, high margin). The data moat is behavioral savings data that no bank or MFI has."

---

## 10. REGULATORY STRATEGY

### Current Model (MVP — Phase 1-2)
- **What we are:** A software platform + savings management tool
- **What we're NOT:** A bank, MFB, or deposit-taking institution
- **Key compliance:**
  - NDPR (data protection) — user consent, data retention, privacy policy
  - Partner bank handles all deposit-taking regulation (they're already licensed)
  - Paystack/Flutterwave handles payment processing regulation
  - We operate as their tech partner, not as a regulated financial entity
- **Licenses needed:** None (we ride on partner bank's license)

### If We Add Direct Lending (Phase 3)
- Need a **finance company license** from CBN, OR
- Partner with a licensed MFB for co-lending (they hold the loan, we source & service)
- State moneylender licenses as a fallback (state-by-state)
- **Recommendation:** Co-lending with MFB partner first. License later if volume justifies.

### Key Regulatory Bodies to Engage
- **CBN** — for any future lending license, and to stay ahead of fintech regulations
- **NDIC** — ensure partner bank's escrow is insured
- **NITDA** — data protection compliance
- **SEC** — only if we add investment products (not in current scope)

### Regulatory Risk: Fund Holding
If we ever hold user funds directly (not through partner bank), we'd need:
- A banking license or MFB license (expensive, slow, capital-intensive)
- Full CBN compliance (capital adequacy, risk management, reporting)
- NDIC insurance directly

**Recommendation:** Never hold funds directly. Always use the partner bank model. The tech partner approach is how Paystack, Piggyvest, and most Nigerian fintechs started.

---

## 11. GO-TO-MARKET STRATEGY

### Phase 1: Pilot (Month 1-3)

**Target:** 500 users from a specific agro association
**Approach:**
- Partner with one agro-innovation association (the one from the PDF?)
- Onboard their members manually (in-person demo sessions)
- Run a pilot savings challenge: "Save ₦20,000 in 8 weeks for planting season"
- Collect feedback obsessively — what's confusing, what's missing, what do they love
- Measure: signup rate, deposit frequency, retention, withdrawal behavior

**Success criteria:**
- 300+ active savers (60% of target)
- Average balance > ₦15,000
- 70% make at least 2 deposits per month
- 20% create a goal-based savings plan

### Phase 2: Growth (Month 4-9)

**Channels:**
1. **Referral engine** — "Invite 3 friends, get ₦500 bonus interest" (built into the app)
2. **Group challenges as growth** — each challenge brings in new users organically
3. **WhatsApp** — target users live on WhatsApp. Build a lightweight WhatsApp bot for deposits/balance checks
4. **Agro association partnerships** — onboard associations wholesale (50-200 members at a time)
5. **Radio** — rural radio is still huge in Nigeria. Short ads in local languages
6. **Agro cooperatives** — position as their digital management tool

**CAC target:** ₦1,500-3,000 per user (referral-driven = lower CAC)

### Phase 3: Scale (Month 10+)

- USSD for feature phone users (unlocks true rural market)
- White-label for larger cooperatives and associations
- MFI partnerships go live → loan referrals become a growth channel
- Marketplace launches → users save AND buy inputs in one place
- Content marketing: financial literacy content for agripreneurs (YouTube, WhatsApp status, radio)

### Viral Loop (The Growth Engine)

```
User saves toward a goal
     │
     ├─ Hits a milestone → shares progress in group challenge
     │                              │
     │                    Friends see it → "I want to save too"
     │                              │
     │                    Friend signs up via referral link
     │                              │
     │                    Both get bonus interest
     │                              │
     └─ User invites friends to a group challenge
                                    │
                    5 friends join → each starts personal savings
                                    │
                    Each friend can start their own challenge → cycle continues
```

**This is why personal savings is the core and group is the feature.** The group mechanism drives personal savings adoption. Each group challenge is a customer acquisition event.

---

## 12. COMPETITIVE LANDSCAPE

| Player | What They Do | Their Weakness | Our Edge |
|---|---|---|---|
| **Piggyvest** | Individual + group savings, investment | Urban-focused, generic, not agro-aware | Agro-specific vaults, rural-friendly, credit building |
| **Cowrywise** | Individual savings + investment | Urban, middle-class, not community-focused | Community/group layer, agro niche |
| **ALAT (Wema)** | Digital banking + savings | Bank app, not savings-focused, complex | Simpler, savings-first, agro-aware |
| **Kolo** | Simple group savings | Basic, no personal savings, no credit | Full-stack: personal + group + credit |
| **Traditional Esusu** | Manual rotating savings | Cash, disputes, no records, limited scale | Digital, transparent, scalable, builds credit |
| **Microfinance Banks** | Loans | High interest, collateral requirements | Save first, earn credit, then access loans on better terms |
| **Opay/PalmPay** | Digital wallet + some savings | Generic, not savings-focused, not agro | Purpose-built for agripreneurs |

**Our defensibility (the moat):**
1. **Agro-specific design** — seasonal vaults, crop-aware planning, input marketplace. Generic apps won't build this.
2. **Credit data** — behavioral savings data that no one else has on this demographic. Becomes more valuable over time.
3. **Association distribution** — onboarding through existing agro groups creates a channel competitors can't easily replicate.
4. **Community/network effects** — group challenges create viral loops that compound over time.
5. **Offline resilience** — SMS + WhatsApp + USSD means we reach users that app-only competitors can't.

---

## 13. RISK MATRIX

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Partner bank relationship falls through** | Medium | Critical | Have 2-3 bank conversations in parallel. Don't launch without a signed partnership. |
| **Low adoption — users don't trust digital savings** | High | Critical | Start with associations where trust exists. Use pilot results as social proof. NDIC insurance messaging builds trust. |
| **Defaults in group cycles** | Medium | High | Credit score gating, guarantor system, social accountability, default protection pool. |
| **Paystack mandate failures** | Medium | Medium | Auto-retry logic, manual payment fallback, Flutterwave as backup processor. |
| **Regulatory change — CBN cracks down on fintech savings** | Low-Medium | High | Stay in tech partner model. Don't hold funds. Engage CBN proactively. |
| **Internet/connectivity issues for rural users** | High | Medium | SMS fallback (Phase 1), WhatsApp bot, USSD (Phase 2). Don't build app-only. |
| **Competition from Piggyvest/copycats** | Medium | Medium | Niche focus (agro) creates a segment they won't chase. Speed to market. |
| **Fraud — fake accounts, BVN manipulation** | Medium | High | BVN uniqueness check, selfie verification (SmileID), transaction limits for new users. |
| **Team/build risk — can't ship fast enough** | Medium | High | Start with Base44 for MVP (fast build). Hire core team by Phase 2. |

---

## 14. MVP BUILD PLAN

### Option A: Build on Base44 (Recommended for MVP)
**Timeline:** 4-6 weeks

| Week | Deliverable |
|---|---|
| 1 | User auth (phone OTP), BVN verification, basic profile |
| 2 | Flex savings (deposit/withdraw via Paystack), transaction history |
| 3 | Goal savings (create goal, auto-save mandate, progress tracker) |
| 4 | Basic dashboard, SMS reminders, seasonal vault templates |
| 5 | Basic group cycle (create/join/track), payout rotation |
| 6 | Testing, bug fixes, pilot onboarding prep |

**Why Base44 for MVP:**
- Managed backend (entities, automations, backend functions)
- Fast iteration — change schema, deploy functions in minutes
- Built-in auth, file storage, notification system
- Focus on product, not infrastructure

### Option B: Custom Build (If we have engineering team)
**Timeline:** 8-12 weeks
- React + Node.js + PostgreSQL + Paystack
- Full control, better for scale, slower to launch
- Recommended for Phase 2 migration

### What to NOT Build in MVP
- Credit score (needs data first)
- MFI integration (needs partnerships)
- Marketplace (needs vendor network)
- USSD (expensive, validate demand first)
- Insurance products (needs partnerships)
- White-label (needs market validation)

### MVP Success Metrics

| Metric | Target (3 months) |
|---|---|
| Active savers | 500+ |
| Monthly active rate | 60%+ |
| Average savings balance | ₦15,000+ |
| Auto-save mandate setup | 40% of users |
| Goal creation rate | 30% of users |
| Group cycle participation | 20% of users |
| Day-30 retention | 50%+ |
| NPS | 40+ |

---

## 15. TEAM REQUIREMENTS

### MVP Phase (Lean)
| Role | Commitment | Cost (monthly) |
|---|---|---|
| Product/Tech lead (you + me) | Full-time | — |
| Backend developer | Full-time or contract | ₦300-500k |
| Frontend developer | Full-time or contract | ₦300-500k |
| Product designer (part-time) | Contract | ₦150-250k |
| Compliance/legal advisor | Part-time | ₦100-200k |
| Community/ops lead (pilot) | Part-time | ₦100-200k |

**Total MVP burn:** ₦1-1.5M/month (excluding your time)

### Phase 2 (Growth)
Add: Marketing/growth lead, customer support, data analyst, devops engineer
**Burn:** ₦3-5M/month

### Phase 3 (Scale)
Full team: 15-25 people across engineering, product, growth, ops, compliance, partnerships
**Burn:** ₦10-20M/month

---

## 16. THE DECISION FRAMEWORK

### Should we build this?

**YES, if:**
- You have access to an agro association or farmer group for pilot (the PDF suggests you do)
- You can secure a partner bank conversation within 30 days
- You can fund 3-6 months of MVP burn (₦3-9M)
- You're willing to start small (500 users) and iterate

**MAYBE, if:**
- You don't have the association access but believe you can build it
- Funding is tight but you can bootstrap with a smaller team
- You want to validate the concept before committing fully

**NO, if:**
- You want to build everything (marketplace, insurance, lending, USSD) before launching
- You don't have any path to a partner bank
- You're not ready to do the manual work of pilot onboarding

### My Assessment

This is worth building. Here's why:
1. **The market is real** — 40M+ Nigerian agripreneurs, most financially excluded
2. **The model is proven** — esusu has worked for centuries; digital savings apps (Piggyvest) have proven digital savings works in Nigeria
3. **The niche is open** — no one is building specifically for agripreneurs
4. **The moat compounds** — credit data becomes more valuable every day
5. **The revenue model works** — transaction fees + float + subscriptions + referrals = multiple income streams
6. **The MVP is buildable** — 4-6 weeks on Base44, no regulatory blockers for v1

**The risk is execution, not concept.** The idea is sound. The question is whether you can ship fast, onboard real users, and iterate based on their behavior.

---

## NEXT STEPS

1. **Confirm the pilot association** — which group from the PDF do you have access to?
2. **Start partner bank conversations** — Providus, Sterling, or any MFB
3. **Decide build approach** — Base44 MVP or custom build?
4. **If yes, I start building the MVP next week**

---

*This proposal is a living document. It will evolve as we validate assumptions and learn from users. The goal is not to be right on paper — it's to be right in practice. Build small, learn fast, adjust.*

**— Superagent, SaaS/Fintech Analysis Mode**
