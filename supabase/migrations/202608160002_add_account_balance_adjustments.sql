create table public.account_balance_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null,
  amount_delta_cents integer not null,
  resulting_balance_cents integer not null,
  adjusted_on date not null,
  note text,
  created_at timestamptz not null default now(),
  constraint account_balance_adjustments_delta_non_zero check (amount_delta_cents <> 0),
  constraint account_balance_adjustments_account_owner_fk foreign key (user_id, account_id)
    references public.financial_accounts(user_id, id) on delete cascade,
  constraint account_balance_adjustments_user_id_id_unique unique (user_id, id)
);

create index account_balance_adjustments_user_date_idx
on public.account_balance_adjustments(user_id, adjusted_on desc, created_at desc);

create index account_balance_adjustments_account_idx
on public.account_balance_adjustments(account_id, adjusted_on desc, created_at desc);

alter table public.account_balance_adjustments enable row level security;

create policy "Users can manage own account balance adjustments"
on public.account_balance_adjustments
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

revoke all on table public.account_balance_adjustments from public, anon;
grant select, insert, update, delete on table public.account_balance_adjustments
to authenticated, service_role;
