-- ================================================================
-- AgroEsusu — Full Migration Script
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ================================================================

-- ============================================================
-- MIGRATION 1: Auto-save plans (personal recurring savings)
-- ============================================================

create table if not exists auto_save_plans (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  account_id      uuid not null references savings_accounts(id) on delete cascade,
  amount          numeric(12,2) not null check (amount >= 100),
  frequency       text not null check (frequency in ('daily', 'weekly', 'monthly')),
  setup_reference     text,
  authorization_code  text,
  email               text,
  status          text not null default 'pending_auth'
                    check (status in ('pending_auth', 'active', 'paused', 'cancelled', 'failed')),
  failure_reason  text,
  next_charge_at  timestamptz,
  last_charged_at timestamptz,
  total_charged   numeric(12,2) default 0,
  charge_count    int default 0
);

alter table auto_save_plans enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'auto_save_plans' and policyname = 'Users can view own plans') then
    create policy "Users can view own plans" on auto_save_plans for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'auto_save_plans' and policyname = 'Users can insert own plans') then
    create policy "Users can insert own plans" on auto_save_plans for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'auto_save_plans' and policyname = 'Users can update own plans') then
    create policy "Users can update own plans" on auto_save_plans for update using (auth.uid() = user_id);
  end if;
end $$;

create index if not exists idx_auto_save_plans_due on auto_save_plans (status, next_charge_at) where status = 'active';

create or replace function update_auto_save_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists auto_save_plans_updated_at on auto_save_plans;
create trigger auto_save_plans_updated_at before update on auto_save_plans for each row execute function update_auto_save_updated_at();

-- ============================================================
-- MIGRATION 2: Group direct debit plans (cooperative auto-charge)
-- ============================================================

create table if not exists group_direct_debit_plans (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  group_id            uuid not null references savings_groups(id) on delete cascade,
  setup_reference     text,
  authorization_code  text,
  email               text not null,
  status              text not null default 'pending_auth'
                        check (status in ('pending_auth', 'active', 'paused', 'cancelled', 'failed')),
  failure_reason      text,
  next_charge_at      timestamptz,
  last_charged_at     timestamptz,
  total_charged       numeric(12,2) default 0,
  charge_count        int default 0,
  unique (user_id, group_id)
);

alter table group_direct_debit_plans enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'group_direct_debit_plans' and policyname = 'Users can view own group dd plans') then
    create policy "Users can view own group dd plans" on group_direct_debit_plans for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'group_direct_debit_plans' and policyname = 'Users can insert own group dd plans') then
    create policy "Users can insert own group dd plans" on group_direct_debit_plans for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'group_direct_debit_plans' and policyname = 'Users can update own group dd plans') then
    create policy "Users can update own group dd plans" on group_direct_debit_plans for update using (auth.uid() = user_id);
  end if;
end $$;

create index if not exists idx_group_dd_plans_due on group_direct_debit_plans (status, next_charge_at) where status = 'active';

create or replace function update_group_dd_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_group_dd_updated_at on group_direct_debit_plans;
create trigger trg_group_dd_updated_at before update on group_direct_debit_plans for each row execute function update_group_dd_updated_at();

-- ============================================================
-- MIGRATION 3: Add scheduling columns to savings_groups
-- ============================================================

alter table savings_groups
  add column if not exists next_contribution_date timestamptz,
  add column if not exists contribution_frequency  text
    check (contribution_frequency in ('daily', 'weekly', 'monthly'));

-- ================================================================
-- Done. Verify with:
-- select table_name from information_schema.tables where table_schema = 'public' and table_name in ('auto_save_plans', 'group_direct_debit_plans');
-- ================================================================
