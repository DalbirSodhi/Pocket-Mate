create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  currency_code text not null default 'CAD',
  pay_cycle text not null default 'monthly',
  pay_cycle_start_day integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_currency_code_length check (char_length(currency_code) = 3),
  constraint profiles_pay_cycle_check check (
    pay_cycle in ('weekly', 'bi_weekly', 'semi_monthly', 'monthly', 'custom')
  ),
  constraint profiles_pay_cycle_start_day_check check (
    pay_cycle_start_day is null
    or pay_cycle_start_day between 1 and 31
  )
);

create table public.income_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_cents integer not null,
  source text,
  received_on date not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint income_entries_amount_positive check (amount_cents > 0)
);

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text,
  icon text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expense_categories_name_not_empty check (char_length(trim(name)) > 0),
  constraint expense_categories_user_id_id_unique unique (user_id, id)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid,
  amount_cents integer not null,
  spent_on date not null,
  merchant text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_amount_positive check (amount_cents > 0),
  constraint expenses_category_owner_fk foreign key (user_id, category_id)
    references public.expense_categories(user_id, id)
    on delete restrict
);

create table public.budget_caps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null,
  amount_cents integer not null,
  period text not null default 'monthly',
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budget_caps_amount_positive check (amount_cents > 0),
  constraint budget_caps_period_check check (
    period in ('weekly', 'bi_weekly', 'semi_monthly', 'monthly', 'custom')
  ),
  constraint budget_caps_date_range_check check (
    starts_on is null
    or ends_on is null
    or starts_on <= ends_on
  ),
  constraint budget_caps_category_owner_fk foreign key (user_id, category_id)
    references public.expense_categories(user_id, id)
    on delete cascade
);

create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_amount_cents integer not null,
  current_amount_cents integer not null default 0,
  target_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint savings_goals_name_not_empty check (char_length(trim(name)) > 0),
  constraint savings_goals_target_positive check (target_amount_cents > 0),
  constraint savings_goals_current_non_negative check (current_amount_cents >= 0)
);

create unique index expense_categories_user_name_unique
on public.expense_categories(user_id, lower(name));

create index income_entries_user_received_on_idx
on public.income_entries(user_id, received_on);

create index expense_categories_user_id_idx
on public.expense_categories(user_id);

create index expenses_user_spent_on_idx
on public.expenses(user_id, spent_on);

create index expenses_user_category_spent_on_idx
on public.expenses(user_id, category_id, spent_on);

create index budget_caps_user_category_idx
on public.budget_caps(user_id, category_id);

create index savings_goals_user_active_idx
on public.savings_goals(user_id, is_active);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger income_entries_set_updated_at
before update on public.income_entries
for each row execute function public.set_updated_at();

create trigger expense_categories_set_updated_at
before update on public.expense_categories
for each row execute function public.set_updated_at();

create trigger expenses_set_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

create trigger budget_caps_set_updated_at
before update on public.budget_caps
for each row execute function public.set_updated_at();

create trigger savings_goals_set_updated_at
before update on public.savings_goals
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.income_entries enable row level security;
alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;
alter table public.budget_caps enable row level security;
alter table public.savings_goals enable row level security;

create policy "Users can view own profile"
on public.profiles for select
using (id = auth.uid());

create policy "Users can create own profile"
on public.profiles for insert
with check (id = auth.uid());

create policy "Users can update own profile"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "Users can delete own profile"
on public.profiles for delete
using (id = auth.uid());

create policy "Users can view own income entries"
on public.income_entries for select
using (user_id = auth.uid());

create policy "Users can create own income entries"
on public.income_entries for insert
with check (user_id = auth.uid());

create policy "Users can update own income entries"
on public.income_entries for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete own income entries"
on public.income_entries for delete
using (user_id = auth.uid());

create policy "Users can view own expense categories"
on public.expense_categories for select
using (user_id = auth.uid());

create policy "Users can create own expense categories"
on public.expense_categories for insert
with check (user_id = auth.uid());

create policy "Users can update own expense categories"
on public.expense_categories for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete own expense categories"
on public.expense_categories for delete
using (user_id = auth.uid());

create policy "Users can view own expenses"
on public.expenses for select
using (user_id = auth.uid());

create policy "Users can create own expenses"
on public.expenses for insert
with check (user_id = auth.uid());

create policy "Users can update own expenses"
on public.expenses for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete own expenses"
on public.expenses for delete
using (user_id = auth.uid());

create policy "Users can view own budget caps"
on public.budget_caps for select
using (user_id = auth.uid());

create policy "Users can create own budget caps"
on public.budget_caps for insert
with check (user_id = auth.uid());

create policy "Users can update own budget caps"
on public.budget_caps for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete own budget caps"
on public.budget_caps for delete
using (user_id = auth.uid());

create policy "Users can view own savings goals"
on public.savings_goals for select
using (user_id = auth.uid());

create policy "Users can create own savings goals"
on public.savings_goals for insert
with check (user_id = auth.uid());

create policy "Users can update own savings goals"
on public.savings_goals for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete own savings goals"
on public.savings_goals for delete
using (user_id = auth.uid());
