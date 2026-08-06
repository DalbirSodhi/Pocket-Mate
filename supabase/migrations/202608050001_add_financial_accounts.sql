create table public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  account_type text not null,
  opening_balance_cents integer not null default 0,
  currency_code text not null default 'CAD',
  institution_name text,
  last_four text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_accounts_name_not_empty check (char_length(trim(name)) > 0),
  constraint financial_accounts_type_check check (
    account_type in ('checking', 'savings', 'cash', 'credit_card', 'loan', 'investment', 'other')
  ),
  constraint financial_accounts_opening_balance_non_negative check (opening_balance_cents >= 0),
  constraint financial_accounts_currency_code_length check (char_length(currency_code) = 3),
  constraint financial_accounts_last_four_check check (
    last_four is null or last_four ~ '^[0-9]{4}$'
  ),
  constraint financial_accounts_user_id_id_unique unique (user_id, id)
);

create table public.account_transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_account_id uuid not null,
  to_account_id uuid not null,
  amount_cents integer not null,
  transferred_on date not null,
  note text,
  credit_card_bill_id uuid,
  bill_payment_installment_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_transfers_amount_positive check (amount_cents > 0),
  constraint account_transfers_accounts_differ check (from_account_id <> to_account_id),
  constraint account_transfers_one_payment_source check (
    (credit_card_bill_id is not null)::integer +
    (bill_payment_installment_id is not null)::integer <= 1
  ),
  constraint account_transfers_from_owner_fk foreign key (user_id, from_account_id)
    references public.financial_accounts(user_id, id)
    on delete restrict,
  constraint account_transfers_to_owner_fk foreign key (user_id, to_account_id)
    references public.financial_accounts(user_id, id)
    on delete restrict
);

alter table public.income_entries
add column account_id uuid;

alter table public.income_entries
add constraint income_entries_account_owner_fk foreign key (user_id, account_id)
  references public.financial_accounts(user_id, id)
  on delete restrict;

alter table public.expenses
add column account_id uuid;

alter table public.expenses
add constraint expenses_account_owner_fk foreign key (user_id, account_id)
  references public.financial_accounts(user_id, id)
  on delete restrict;

alter table public.credit_cards
add column financial_account_id uuid,
add column tracking_mode text not null default 'statement';

alter table public.credit_cards
add constraint credit_cards_tracking_mode_check check (
  tracking_mode in ('statement', 'transactions')
);

insert into public.financial_accounts (
  user_id,
  name,
  account_type,
  opening_balance_cents,
  institution_name,
  last_four,
  is_active
)
select
  card.user_id,
  card.nickname,
  'credit_card',
  0,
  card.issuer,
  card.last_four,
  card.is_active
from public.credit_cards as card;

update public.credit_cards as card
set financial_account_id = account.id
from public.financial_accounts as account
where account.user_id = card.user_id
  and account.account_type = 'credit_card'
  and lower(account.name) = lower(card.nickname);

alter table public.credit_cards
alter column financial_account_id set not null;

alter table public.credit_cards
add constraint credit_cards_financial_account_owner_fk
foreign key (user_id, financial_account_id)
  references public.financial_accounts(user_id, id)
  on delete restrict;

alter table public.credit_cards
add constraint credit_cards_financial_account_unique unique (financial_account_id);

alter table public.credit_card_bills
add constraint credit_card_bills_user_id_id_unique unique (user_id, id);

alter table public.bill_payment_installments
add constraint bill_payment_installments_user_id_id_unique unique (user_id, id);

alter table public.account_transfers
add constraint account_transfers_card_bill_owner_fk
foreign key (user_id, credit_card_bill_id)
  references public.credit_card_bills(user_id, id)
  on delete cascade;

alter table public.account_transfers
add constraint account_transfers_installment_owner_fk
foreign key (user_id, bill_payment_installment_id)
  references public.bill_payment_installments(user_id, id)
  on delete cascade;

create unique index account_transfers_card_bill_unique
on public.account_transfers(credit_card_bill_id)
where credit_card_bill_id is not null;

create unique index account_transfers_installment_unique
on public.account_transfers(bill_payment_installment_id)
where bill_payment_installment_id is not null;

create index financial_accounts_user_active_idx
on public.financial_accounts(user_id, is_active, account_type);

create index account_transfers_user_date_idx
on public.account_transfers(user_id, transferred_on desc);

create index account_transfers_from_account_idx
on public.account_transfers(from_account_id, transferred_on desc);

create index account_transfers_to_account_idx
on public.account_transfers(to_account_id, transferred_on desc);

create index income_entries_account_idx
on public.income_entries(account_id, received_on desc)
where account_id is not null;

create index expenses_account_idx
on public.expenses(account_id, spent_on desc)
where account_id is not null;

create trigger financial_accounts_set_updated_at
before update on public.financial_accounts
for each row execute function public.set_updated_at();

create trigger account_transfers_set_updated_at
before update on public.account_transfers
for each row execute function public.set_updated_at();

create function public.ensure_credit_card_financial_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.financial_account_id is null then
    insert into public.financial_accounts (
      user_id,
      name,
      account_type,
      institution_name,
      last_four,
      is_active
    )
    values (
      new.user_id,
      new.nickname,
      'credit_card',
      new.issuer,
      new.last_four,
      new.is_active
    )
    returning id into new.financial_account_id;
  end if;

  return new;
end;
$$;

create trigger credit_cards_ensure_financial_account
before insert on public.credit_cards
for each row execute function public.ensure_credit_card_financial_account();

create function public.sync_credit_card_financial_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.financial_accounts
  set
    name = new.nickname,
    institution_name = new.issuer,
    last_four = new.last_four,
    is_active = new.is_active
  where id = new.financial_account_id
    and user_id = new.user_id;

  return new;
end;
$$;

create trigger credit_cards_sync_financial_account
after update of nickname, issuer, last_four, is_active on public.credit_cards
for each row execute function public.sync_credit_card_financial_account();

create function public.set_credit_card_bill_paid_with_account(
  p_bill_id uuid,
  p_paid_on date,
  p_from_account_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_amount_cents integer;
  v_to_account_id uuid;
begin
  select bill.amount_cents, card.financial_account_id
  into v_amount_cents, v_to_account_id
  from public.credit_card_bills as bill
  join public.credit_cards as card
    on card.id = bill.credit_card_id
    and card.user_id = bill.user_id
  where bill.id = p_bill_id
    and bill.user_id = v_user_id;

  if v_amount_cents is null then
    raise exception using errcode = 'P0002', message = 'Card bill was not found.';
  end if;

  if p_paid_on is not null and p_from_account_id is not null then
    insert into public.account_transfers (
      user_id,
      from_account_id,
      to_account_id,
      amount_cents,
      transferred_on,
      note,
      credit_card_bill_id
    )
    values (
      v_user_id,
      p_from_account_id,
      v_to_account_id,
      v_amount_cents,
      p_paid_on,
      'Credit card statement payment',
      p_bill_id
    )
    on conflict (credit_card_bill_id) where credit_card_bill_id is not null
    do update set
      from_account_id = excluded.from_account_id,
      to_account_id = excluded.to_account_id,
      amount_cents = excluded.amount_cents,
      transferred_on = excluded.transferred_on;
  elsif p_paid_on is null then
    delete from public.account_transfers
    where user_id = v_user_id
      and credit_card_bill_id = p_bill_id;
  end if;

  update public.credit_card_bills
  set paid_on = p_paid_on
  where id = p_bill_id
    and user_id = v_user_id;
end;
$$;

create function public.set_bill_payment_installment_paid_from_account(
  p_installment_id uuid,
  p_is_paid boolean,
  p_from_account_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_amount_cents integer;
  v_credit_card_bill_id uuid;
  v_to_account_id uuid;
begin
  select
    installment.amount_cents,
    plan.credit_card_bill_id,
    card.financial_account_id
  into v_amount_cents, v_credit_card_bill_id, v_to_account_id
  from public.bill_payment_installments as installment
  join public.bill_payment_plans as plan
    on plan.id = installment.payment_plan_id
    and plan.user_id = installment.user_id
  left join public.credit_card_bills as bill
    on bill.id = plan.credit_card_bill_id
    and bill.user_id = plan.user_id
  left join public.credit_cards as card
    on card.id = bill.credit_card_id
    and card.user_id = bill.user_id
  where installment.id = p_installment_id
    and installment.user_id = v_user_id;

  if v_amount_cents is null then
    raise exception using errcode = 'P0002', message = 'Payment installment was not found.';
  end if;

  if p_is_paid and v_credit_card_bill_id is not null and p_from_account_id is not null then
    insert into public.account_transfers (
      user_id,
      from_account_id,
      to_account_id,
      amount_cents,
      transferred_on,
      note,
      bill_payment_installment_id
    )
    values (
      v_user_id,
      p_from_account_id,
      v_to_account_id,
      v_amount_cents,
      current_date,
      'Credit card installment payment',
      p_installment_id
    )
    on conflict (bill_payment_installment_id)
      where bill_payment_installment_id is not null
    do update set
      from_account_id = excluded.from_account_id,
      to_account_id = excluded.to_account_id,
      amount_cents = excluded.amount_cents,
      transferred_on = excluded.transferred_on;
  elsif not p_is_paid then
    delete from public.account_transfers
    where user_id = v_user_id
      and bill_payment_installment_id = p_installment_id;
  end if;

  perform public.set_bill_payment_installment_paid(p_installment_id, p_is_paid);
end;
$$;

alter table public.financial_accounts enable row level security;
alter table public.account_transfers enable row level security;

create policy "Users can view own financial accounts"
on public.financial_accounts for select
using (user_id = auth.uid());

create policy "Users can create own financial accounts"
on public.financial_accounts for insert
with check (user_id = auth.uid());

create policy "Users can update own financial accounts"
on public.financial_accounts for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete own financial accounts"
on public.financial_accounts for delete
using (user_id = auth.uid());

create policy "Users can view own account transfers"
on public.account_transfers for select
using (user_id = auth.uid());

create policy "Users can create own account transfers"
on public.account_transfers for insert
with check (user_id = auth.uid());

create policy "Users can update own account transfers"
on public.account_transfers for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete own account transfers"
on public.account_transfers for delete
using (user_id = auth.uid());

grant select, insert, update, delete on table
  public.financial_accounts,
  public.account_transfers
to authenticated, service_role;

revoke all on table
  public.financial_accounts,
  public.account_transfers
from anon;

revoke all on function public.ensure_credit_card_financial_account() from public;
revoke all on function public.sync_credit_card_financial_account() from public;
revoke all on function public.set_credit_card_bill_paid_with_account(uuid, date, uuid) from public, anon;
revoke all on function public.set_bill_payment_installment_paid_from_account(uuid, boolean, uuid) from public, anon;
grant execute on function public.set_credit_card_bill_paid_with_account(uuid, date, uuid) to authenticated, service_role;
grant execute on function public.set_bill_payment_installment_paid_from_account(uuid, boolean, uuid) to authenticated, service_role;

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  delete from public.account_transfers where user_id = v_user_id;
  delete from public.bill_payment_installments where user_id = v_user_id;
  delete from public.bill_payment_plans where user_id = v_user_id;
  delete from public.credit_card_bills where user_id = v_user_id;
  delete from public.credit_cards where user_id = v_user_id;
  delete from public.recurring_expenses where user_id = v_user_id;
  delete from public.budget_caps where user_id = v_user_id;
  delete from public.expenses where user_id = v_user_id;
  delete from public.expense_categories where user_id = v_user_id;
  delete from public.savings_goals where user_id = v_user_id;
  delete from public.income_entries where user_id = v_user_id;
  delete from public.financial_accounts where user_id = v_user_id;
  delete from public.profiles where id = v_user_id;
  delete from auth.users where id = v_user_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'Account was not found.';
  end if;
end;
$$;
