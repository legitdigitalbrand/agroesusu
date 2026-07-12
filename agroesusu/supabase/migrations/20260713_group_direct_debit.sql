-- ============================================================
-- Group Cooperative Direct Debit Plans
-- ============================================================
-- Stores recurring card-charge authorizations per group member.
-- When a member sets up direct debit for their group, we store
-- their Paystack authorization_code so the daily cron can
-- automatically charge them on each contribution due date.
-- ============================================================

create table if not exists group_direct_debit_plans (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),

  user_id             uuid not null references auth.users(id) on delete cascade,
  group_id            uuid not null references savings_groups(id) on delete cascade,

  -- Paystack tokenization
  setup_reference     text,           -- reference used for the setup charge
  authorization_code  text,           -- Paystack reusable auth code
  email               text not null,  -- user email at time of auth (required by Paystack)

  status              text not null default 'pending_auth'
                        check (status in ('pending_auth', 'active', 'paused', 'cancelled', 'failed')),
  failure_reason      text,

  -- Scheduling — next_charge_at is set to the group's next contribution date
  next_charge_at      timestamptz,
  last_charged_at     timestamptz,

  -- Stats
  total_charged       numeric(12,2) default 0,
  charge_count        int default 0,

  -- One active plan per member per group
  unique (user_id, group_id)
);

-- RLS
alter table group_direct_debit_plans enable row level security;

create policy "Users can view own group dd plans"
  on group_direct_debit_plans for select
  using (auth.uid() = user_id);

create policy "Users can insert own group dd plans"
  on group_direct_debit_plans for insert
  with check (auth.uid() = user_id);

create policy "Users can update own group dd plans"
  on group_direct_debit_plans for update
  using (auth.uid() = user_id);

-- Efficient cron index: find all active plans due for charging
create index if not exists idx_group_dd_plans_due
  on group_direct_debit_plans (status, next_charge_at)
  where status = 'active';

-- Auto-update updated_at
create or replace function update_group_dd_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_group_dd_updated_at on group_direct_debit_plans;
create trigger trg_group_dd_updated_at
  before update on group_direct_debit_plans
  for each row execute function update_group_dd_updated_at();

-- ============================================================
-- Add next_contribution_date to savings_groups so the cron
-- knows when to fire each group's charge
-- ============================================================
alter table savings_groups
  add column if not exists next_contribution_date timestamptz,
  add column if not exists contribution_frequency  text
    check (contribution_frequency in ('daily', 'weekly', 'monthly'));
