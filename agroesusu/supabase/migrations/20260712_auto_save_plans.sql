-- Auto-save plans table
-- Stores recurring card-charge plans for each user's savings pot.
-- Authorization codes are encrypted at rest by Supabase (column-level encryption
-- should be added in production; for now the table is RLS-protected).

create table if not exists auto_save_plans (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),

  user_id         uuid not null references auth.users(id) on delete cascade,
  account_id      uuid not null references savings_accounts(id) on delete cascade,

  amount          numeric(12,2) not null check (amount >= 100),
  frequency       text not null check (frequency in ('daily', 'weekly', 'monthly')),

  -- Paystack tokenization
  setup_reference     text,         -- reference used for the first/setup charge
  authorization_code  text,         -- Paystack reusable auth code (set after first charge)
  email               text,         -- user email at time of auth (required by Paystack)

  status          text not null default 'pending_auth'
                    check (status in ('pending_auth', 'active', 'paused', 'cancelled', 'failed')),
  failure_reason  text,

  -- Scheduling
  next_charge_at  timestamptz,
  last_charged_at timestamptz,

  -- Stats
  total_charged   numeric(12,2) default 0,
  charge_count    int default 0
);

-- RLS: users can only see/modify their own plans
alter table auto_save_plans enable row level security;

create policy "Users can view own plans"
  on auto_save_plans for select
  using (auth.uid() = user_id);

create policy "Users can insert own plans"
  on auto_save_plans for insert
  with check (auth.uid() = user_id);

create policy "Users can update own plans"
  on auto_save_plans for update
  using (auth.uid() = user_id);

-- Index for the cron job query (finds due active plans efficiently)
create index if not exists idx_auto_save_plans_due
  on auto_save_plans (status, next_charge_at)
  where status = 'active';

-- Auto-update updated_at
create or replace function update_auto_save_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger auto_save_plans_updated_at
  before update on auto_save_plans
  for each row execute function update_auto_save_updated_at();
