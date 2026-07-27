create table public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null,
  name text not null,
  amount_cents integer not null,
  cadence text not null default 'monthly',
  charge_day integer not null,
  starts_on date not null default current_date,
  ends_on date,
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_expenses_name_not_empty check (char_length(trim(name)) > 0),
  constraint recurring_expenses_amount_positive check (amount_cents > 0),
  constraint recurring_expenses_cadence_check check (
    cadence in ('weekly', 'bi_weekly', 'monthly', 'yearly')
  ),
  constraint recurring_expenses_charge_day_check check (charge_day between 1 and 31),
  constraint recurring_expenses_date_range_check check (
    ends_on is null or starts_on <= ends_on
  ),
  constraint recurring_expenses_category_owner_fk foreign key (user_id, category_id)
    references public.expense_categories(user_id, id)
    on delete restrict
);

create table public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null,
  issuer text,
  last_four text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint credit_cards_nickname_not_empty check (char_length(trim(nickname)) > 0),
  constraint credit_cards_last_four_check check (
    last_four is null or last_four ~ '^[0-9]{4}$'
  ),
  constraint credit_cards_user_id_id_unique unique (user_id, id)
);

create table public.credit_card_bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credit_card_id uuid not null,
  amount_cents integer not null,
  statement_on date not null,
  due_on date not null,
  paid_on date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint credit_card_bills_amount_positive check (amount_cents > 0),
  constraint credit_card_bills_due_date_check check (statement_on <= due_on),
  constraint credit_card_bills_card_owner_fk foreign key (user_id, credit_card_id)
    references public.credit_cards(user_id, id)
    on delete restrict,
  constraint credit_card_bills_user_card_statement_unique
    unique (user_id, credit_card_id, statement_on)
);

create unique index credit_cards_user_nickname_unique
on public.credit_cards(user_id, lower(nickname));

create index recurring_expenses_user_active_dates_idx
on public.recurring_expenses(user_id, is_active, starts_on, ends_on);

create index credit_cards_user_active_idx
on public.credit_cards(user_id, is_active);

create index credit_card_bills_user_due_on_idx
on public.credit_card_bills(user_id, due_on);

create index credit_card_bills_user_card_idx
on public.credit_card_bills(user_id, credit_card_id);

create trigger recurring_expenses_set_updated_at
before update on public.recurring_expenses
for each row execute function public.set_updated_at();

create trigger credit_cards_set_updated_at
before update on public.credit_cards
for each row execute function public.set_updated_at();

create trigger credit_card_bills_set_updated_at
before update on public.credit_card_bills
for each row execute function public.set_updated_at();

alter table public.recurring_expenses enable row level security;
alter table public.credit_cards enable row level security;
alter table public.credit_card_bills enable row level security;

create policy "Users can view own recurring expenses"
on public.recurring_expenses for select
using (user_id = auth.uid());

create policy "Users can create own recurring expenses"
on public.recurring_expenses for insert
with check (user_id = auth.uid());

create policy "Users can update own recurring expenses"
on public.recurring_expenses for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete own recurring expenses"
on public.recurring_expenses for delete
using (user_id = auth.uid());

create policy "Users can view own credit cards"
on public.credit_cards for select
using (user_id = auth.uid());

create policy "Users can create own credit cards"
on public.credit_cards for insert
with check (user_id = auth.uid());

create policy "Users can update own credit cards"
on public.credit_cards for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete own credit cards"
on public.credit_cards for delete
using (user_id = auth.uid());

create policy "Users can view own credit card bills"
on public.credit_card_bills for select
using (user_id = auth.uid());

create policy "Users can create own credit card bills"
on public.credit_card_bills for insert
with check (user_id = auth.uid());

create policy "Users can update own credit card bills"
on public.credit_card_bills for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete own credit card bills"
on public.credit_card_bills for delete
using (user_id = auth.uid());

grant select, insert, update, delete on table
  public.recurring_expenses,
  public.credit_cards,
  public.credit_card_bills
to authenticated, service_role;

revoke all on table
  public.recurring_expenses,
  public.credit_cards,
  public.credit_card_bills
from anon;
