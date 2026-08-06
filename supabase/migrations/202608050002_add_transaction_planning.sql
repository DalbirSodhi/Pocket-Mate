alter table public.expenses
add constraint expenses_user_id_id_unique unique (user_id, id);

create table public.expense_splits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expense_id uuid not null,
  category_id uuid not null,
  amount_cents integer not null,
  memo text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expense_splits_amount_positive check (amount_cents > 0),
  constraint expense_splits_sort_order_non_negative check (sort_order >= 0),
  constraint expense_splits_expense_owner_fk foreign key (user_id, expense_id)
    references public.expenses(user_id, id) on delete cascade,
  constraint expense_splits_category_owner_fk foreign key (user_id, category_id)
    references public.expense_categories(user_id, id) on delete restrict,
  constraint expense_splits_user_id_id_unique unique (user_id, id),
  constraint expense_splits_expense_order_unique unique (expense_id, sort_order),
  constraint expense_splits_expense_category_unique unique (expense_id, category_id)
);

create table public.expense_refunds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expense_id uuid not null,
  account_id uuid,
  amount_cents integer not null,
  refunded_on date not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expense_refunds_amount_positive check (amount_cents > 0),
  constraint expense_refunds_expense_owner_fk foreign key (user_id, expense_id)
    references public.expenses(user_id, id) on delete cascade,
  constraint expense_refunds_account_owner_fk foreign key (user_id, account_id)
    references public.financial_accounts(user_id, id) on delete restrict,
  constraint expense_refunds_user_id_id_unique unique (user_id, id)
);

create table public.budget_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null,
  default_amount_cents integer not null,
  rollover_mode text not null default 'none',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budget_templates_amount_positive check (default_amount_cents > 0),
  constraint budget_templates_rollover_mode_check check (
    rollover_mode in ('none', 'positive_only', 'full')
  ),
  constraint budget_templates_category_owner_fk foreign key (user_id, category_id)
    references public.expense_categories(user_id, id) on delete cascade,
  constraint budget_templates_user_category_unique unique (user_id, category_id),
  constraint budget_templates_user_id_id_unique unique (user_id, id)
);

create table public.budget_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month_start date not null,
  status text not null default 'open',
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budget_periods_month_start_check check (
    month_start = date_trunc('month', month_start)::date
  ),
  constraint budget_periods_status_check check (status in ('open', 'closed')),
  constraint budget_periods_closed_state_check check (
    (status = 'open' and closed_at is null)
    or (status = 'closed' and closed_at is not null)
  ),
  constraint budget_periods_user_month_unique unique (user_id, month_start),
  constraint budget_periods_user_id_id_unique unique (user_id, id)
);

create table public.budget_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  budget_period_id uuid not null,
  category_id uuid not null,
  planned_amount_cents integer not null,
  rollover_mode text not null default 'none',
  rollover_in_cents integer not null default 0,
  rollover_out_cents integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budget_allocations_amount_positive check (planned_amount_cents > 0),
  constraint budget_allocations_rollover_mode_check check (
    rollover_mode in ('none', 'positive_only', 'full')
  ),
  constraint budget_allocations_period_owner_fk foreign key (user_id, budget_period_id)
    references public.budget_periods(user_id, id) on delete cascade,
  constraint budget_allocations_category_owner_fk foreign key (user_id, category_id)
    references public.expense_categories(user_id, id) on delete cascade,
  constraint budget_allocations_period_category_unique unique (budget_period_id, category_id),
  constraint budget_allocations_user_id_id_unique unique (user_id, id)
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tags_name_not_empty check (char_length(trim(name)) > 0),
  constraint tags_user_name_unique unique (user_id, name),
  constraint tags_user_id_id_unique unique (user_id, id)
);

create table public.expense_tags (
  user_id uuid not null references auth.users(id) on delete cascade,
  expense_id uuid not null,
  tag_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (expense_id, tag_id),
  constraint expense_tags_expense_owner_fk foreign key (user_id, expense_id)
    references public.expenses(user_id, id) on delete cascade,
  constraint expense_tags_tag_owner_fk foreign key (user_id, tag_id)
    references public.tags(user_id, id) on delete cascade
);

create table public.categorization_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  priority integer not null default 100,
  match_field text not null,
  operator text not null,
  match_value text not null,
  category_id uuid not null,
  review_action text not null default 'approve',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categorization_rules_name_not_empty check (char_length(trim(name)) > 0),
  constraint categorization_rules_priority_non_negative check (priority >= 0),
  constraint categorization_rules_match_field_check check (match_field in ('merchant', 'note')),
  constraint categorization_rules_operator_check check (operator in ('exact', 'starts_with', 'contains')),
  constraint categorization_rules_match_value_not_empty check (char_length(trim(match_value)) > 0),
  constraint categorization_rules_review_action_check check (
    review_action in ('approve', 'needs_review')
  ),
  constraint categorization_rules_category_owner_fk foreign key (user_id, category_id)
    references public.expense_categories(user_id, id) on delete cascade,
  constraint categorization_rules_user_id_id_unique unique (user_id, id)
);

create table public.review_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expense_id uuid not null,
  reason text not null,
  status text not null default 'pending',
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint review_items_reason_not_empty check (char_length(trim(reason)) > 0),
  constraint review_items_status_check check (status in ('pending', 'approved', 'ignored')),
  constraint review_items_reviewed_state_check check (
    (status = 'pending' and reviewed_at is null)
    or (status <> 'pending' and reviewed_at is not null)
  ),
  constraint review_items_expense_owner_fk foreign key (user_id, expense_id)
    references public.expenses(user_id, id) on delete cascade,
  constraint review_items_expense_unique unique (expense_id),
  constraint review_items_user_id_id_unique unique (user_id, id)
);

create index expense_splits_expense_idx on public.expense_splits(expense_id, sort_order);
create index expense_refunds_user_date_idx on public.expense_refunds(user_id, refunded_on desc);
create index budget_periods_user_month_idx on public.budget_periods(user_id, month_start desc);
create index budget_allocations_category_idx on public.budget_allocations(user_id, category_id);
create index categorization_rules_user_order_idx on public.categorization_rules(user_id, is_active, priority, created_at);
create index review_items_user_status_idx on public.review_items(user_id, status, created_at desc);

create trigger expense_splits_set_updated_at before update on public.expense_splits
for each row execute function public.set_updated_at();
create trigger expense_refunds_set_updated_at before update on public.expense_refunds
for each row execute function public.set_updated_at();
create trigger budget_templates_set_updated_at before update on public.budget_templates
for each row execute function public.set_updated_at();
create trigger budget_periods_set_updated_at before update on public.budget_periods
for each row execute function public.set_updated_at();
create trigger budget_allocations_set_updated_at before update on public.budget_allocations
for each row execute function public.set_updated_at();
create trigger tags_set_updated_at before update on public.tags
for each row execute function public.set_updated_at();
create trigger categorization_rules_set_updated_at before update on public.categorization_rules
for each row execute function public.set_updated_at();
create trigger review_items_set_updated_at before update on public.review_items
for each row execute function public.set_updated_at();

alter table public.expense_splits enable row level security;
alter table public.expense_refunds enable row level security;
alter table public.budget_templates enable row level security;
alter table public.budget_periods enable row level security;
alter table public.budget_allocations enable row level security;
alter table public.tags enable row level security;
alter table public.expense_tags enable row level security;
alter table public.categorization_rules enable row level security;
alter table public.review_items enable row level security;

create policy "Users can view own expense splits" on public.expense_splits for select using (user_id = auth.uid());
create policy "Users can view own expense refunds" on public.expense_refunds for select using (user_id = auth.uid());

create policy "Users can manage own budget templates" on public.budget_templates for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users can manage own budget periods" on public.budget_periods for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users can manage own budget allocations" on public.budget_allocations for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users can manage own tags" on public.tags for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users can manage own expense tags" on public.expense_tags for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users can manage own categorization rules" on public.categorization_rules for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users can manage own review items" on public.review_items for all using (user_id = auth.uid()) with check (user_id = auth.uid());

insert into public.budget_templates (
  user_id,
  category_id,
  default_amount_cents,
  rollover_mode,
  is_active
)
select distinct on (cap.user_id, cap.category_id)
  cap.user_id,
  cap.category_id,
  cap.amount_cents,
  'none',
  true
from public.budget_caps as cap
where cap.period = 'monthly'
order by cap.user_id, cap.category_id, cap.updated_at desc;

create function public.save_expense_splits(
  p_expense_id uuid,
  p_splits jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_expense_amount integer;
  v_split_total bigint;
begin
  select amount_cents into v_expense_amount
  from public.expenses
  where id = p_expense_id and user_id = v_user_id
  for update;

  if v_expense_amount is null then
    raise exception using errcode = 'P0002', message = 'Expense was not found.';
  end if;

  if jsonb_typeof(p_splits) <> 'array'
    or jsonb_array_length(p_splits) < 2
    or jsonb_array_length(p_splits) > 8
  then
    raise exception using errcode = '22023', message = 'Use between two and eight split categories.';
  end if;

  select coalesce(sum((item->>'amountCents')::integer), 0)
  into v_split_total
  from jsonb_array_elements(p_splits) as item;

  if v_split_total <> v_expense_amount then
    raise exception using errcode = '22023', message = 'Split amounts must equal the expense total.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_splits) as item
    left join public.expense_categories as category
      on category.id = (item->>'categoryId')::uuid
      and category.user_id = v_user_id
    where
      category.id is null
      or (item->>'amountCents')::integer <= 0
  ) then
    raise exception using errcode = '22023', message = 'Every split needs an owned category and positive amount.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_splits) as item
    group by item->>'categoryId'
    having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'Each split category can only be used once.';
  end if;

  delete from public.expense_splits
  where expense_id = p_expense_id and user_id = v_user_id;

  insert into public.expense_splits (
    user_id,
    expense_id,
    category_id,
    amount_cents,
    memo,
    sort_order
  )
  select
    v_user_id,
    p_expense_id,
    (split.item->>'categoryId')::uuid,
    (split.item->>'amountCents')::integer,
    nullif(trim(split.item->>'memo'), ''),
    (split.position - 1)::integer
  from jsonb_array_elements(p_splits) with ordinality as split(item, position);
end;
$$;

create function public.create_expense_refund(
  p_expense_id uuid,
  p_amount_cents integer,
  p_refunded_on date,
  p_account_id uuid default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_expense_amount integer;
  v_refunded_amount bigint;
  v_refund_id uuid;
begin
  select amount_cents into v_expense_amount
  from public.expenses
  where id = p_expense_id and user_id = v_user_id
  for update;

  if v_expense_amount is null then
    raise exception using errcode = 'P0002', message = 'Expense was not found.';
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 or p_refunded_on is null then
    raise exception using errcode = '22023', message = 'Refund amount and date are required.';
  end if;

  select coalesce(sum(amount_cents), 0) into v_refunded_amount
  from public.expense_refunds
  where expense_id = p_expense_id and user_id = v_user_id;

  if v_refunded_amount + p_amount_cents > v_expense_amount then
    raise exception using errcode = '22023', message = 'Refunds cannot exceed the original expense.';
  end if;

  insert into public.expense_refunds (
    user_id, expense_id, account_id, amount_cents, refunded_on, note
  ) values (
    v_user_id, p_expense_id, p_account_id, p_amount_cents, p_refunded_on, nullif(trim(p_note), '')
  ) returning id into v_refund_id;

  return v_refund_id;
end;
$$;

create function public.update_expense_entry(
  p_expense_id uuid,
  p_account_id uuid,
  p_category_id uuid,
  p_amount_cents integer,
  p_spent_on date,
  p_merchant text default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_previous_amount integer;
  v_refunded_amount bigint;
begin
  select amount_cents into v_previous_amount
  from public.expenses
  where id = p_expense_id and user_id = v_user_id
  for update;

  if v_previous_amount is null then
    raise exception using errcode = 'P0002', message = 'Expense was not found.';
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 or p_spent_on is null then
    raise exception using errcode = '22023', message = 'Expense amount and date are required.';
  end if;

  select coalesce(sum(amount_cents), 0) into v_refunded_amount
  from public.expense_refunds
  where expense_id = p_expense_id and user_id = v_user_id;

  if v_refunded_amount > p_amount_cents then
    raise exception using errcode = '22023', message = 'Expense total cannot be lower than its refunds.';
  end if;

  if p_amount_cents <> v_previous_amount then
    delete from public.expense_splits
    where expense_id = p_expense_id and user_id = v_user_id;
  end if;

  update public.expenses
  set
    account_id = p_account_id,
    category_id = p_category_id,
    amount_cents = p_amount_cents,
    spent_on = p_spent_on,
    merchant = nullif(trim(p_merchant), ''),
    note = nullif(trim(p_note), '')
  where id = p_expense_id and user_id = v_user_id;
end;
$$;

create function public.ensure_budget_period(p_month_start date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_period_id uuid;
begin
  if p_month_start is null or p_month_start <> date_trunc('month', p_month_start)::date then
    raise exception using errcode = '22023', message = 'Budget month must start on the first day.';
  end if;

  insert into public.budget_periods (user_id, month_start)
  values (v_user_id, p_month_start)
  on conflict (user_id, month_start)
  do update set month_start = excluded.month_start
  returning id into v_period_id;

  insert into public.budget_allocations (
    user_id,
    budget_period_id,
    category_id,
    planned_amount_cents,
    rollover_mode
  )
  select
    template.user_id,
    v_period_id,
    template.category_id,
    template.default_amount_cents,
    template.rollover_mode
  from public.budget_templates as template
  where template.user_id = v_user_id and template.is_active = true
  on conflict (budget_period_id, category_id) do nothing;

  return v_period_id;
end;
$$;

create function public.save_budget_allocation(
  p_month_start date,
  p_category_id uuid,
  p_amount_cents integer,
  p_rollover_mode text,
  p_apply_to_future boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_period_id uuid;
  v_allocation_id uuid;
begin
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception using errcode = '22023', message = 'Budget amount must be positive.';
  end if;

  if p_rollover_mode not in ('none', 'positive_only', 'full') then
    raise exception using errcode = '22023', message = 'Budget rollover mode is invalid.';
  end if;

  if not exists (
    select 1 from public.expense_categories
    where id = p_category_id and user_id = v_user_id
  ) then
    raise exception using errcode = 'P0002', message = 'Category was not found.';
  end if;

  v_period_id := public.ensure_budget_period(p_month_start);

  insert into public.budget_allocations (
    user_id, budget_period_id, category_id, planned_amount_cents, rollover_mode
  ) values (
    v_user_id, v_period_id, p_category_id, p_amount_cents, p_rollover_mode
  )
  on conflict (budget_period_id, category_id)
  do update set
    planned_amount_cents = excluded.planned_amount_cents,
    rollover_mode = excluded.rollover_mode
  returning id into v_allocation_id;

  if p_apply_to_future then
    insert into public.budget_templates (
      user_id, category_id, default_amount_cents, rollover_mode, is_active
    ) values (
      v_user_id, p_category_id, p_amount_cents, p_rollover_mode, true
    )
    on conflict (user_id, category_id)
    do update set
      default_amount_cents = excluded.default_amount_cents,
      rollover_mode = excluded.rollover_mode,
      is_active = true;
  end if;

  return v_allocation_id;
end;
$$;

create function public.remove_budget_allocation(
  p_month_start date,
  p_category_id uuid,
  p_remove_future boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  delete from public.budget_allocations as allocation
  using public.budget_periods as period
  where allocation.budget_period_id = period.id
    and allocation.user_id = v_user_id
    and period.user_id = v_user_id
    and period.month_start = p_month_start
    and allocation.category_id = p_category_id;

  if p_remove_future then
    update public.budget_templates
    set is_active = false
    where user_id = v_user_id and category_id = p_category_id;
  end if;
end;
$$;

revoke all on table public.expense_splits, public.expense_refunds from anon, authenticated;
grant select on table public.expense_splits, public.expense_refunds to authenticated, service_role;
grant all on table public.expense_splits, public.expense_refunds to service_role;

grant select, insert, update, delete on table
  public.budget_templates,
  public.budget_periods,
  public.budget_allocations,
  public.tags,
  public.expense_tags,
  public.categorization_rules,
  public.review_items
to authenticated, service_role;

revoke all on table
  public.budget_templates,
  public.budget_periods,
  public.budget_allocations,
  public.tags,
  public.expense_tags,
  public.categorization_rules,
  public.review_items
from anon;

revoke all on function public.save_expense_splits(uuid, jsonb) from public, anon;
revoke all on function public.create_expense_refund(uuid, integer, date, uuid, text) from public, anon;
revoke all on function public.update_expense_entry(uuid, uuid, uuid, integer, date, text, text) from public, anon;
revoke all on function public.ensure_budget_period(date) from public, anon;
revoke all on function public.save_budget_allocation(date, uuid, integer, text, boolean) from public, anon;
revoke all on function public.remove_budget_allocation(date, uuid, boolean) from public, anon;
grant execute on function public.save_expense_splits(uuid, jsonb) to authenticated, service_role;
grant execute on function public.create_expense_refund(uuid, integer, date, uuid, text) to authenticated, service_role;
grant execute on function public.update_expense_entry(uuid, uuid, uuid, integer, date, text, text) to authenticated, service_role;
grant execute on function public.ensure_budget_period(date) to authenticated, service_role;
grant execute on function public.save_budget_allocation(date, uuid, integer, text, boolean) to authenticated, service_role;
grant execute on function public.remove_budget_allocation(date, uuid, boolean) to authenticated, service_role;

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

  delete from public.expense_tags where user_id = v_user_id;
  delete from public.tags where user_id = v_user_id;
  delete from public.review_items where user_id = v_user_id;
  delete from public.categorization_rules where user_id = v_user_id;
  delete from public.expense_splits where user_id = v_user_id;
  delete from public.expense_refunds where user_id = v_user_id;
  delete from public.budget_allocations where user_id = v_user_id;
  delete from public.budget_periods where user_id = v_user_id;
  delete from public.budget_templates where user_id = v_user_id;
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
