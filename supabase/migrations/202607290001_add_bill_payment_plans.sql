create table public.bill_payment_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credit_card_bill_id uuid references public.credit_card_bills(id) on delete cascade,
  recurring_expense_id uuid references public.recurring_expenses(id) on delete cascade,
  period_start date not null,
  title text not null,
  total_amount_cents integer not null,
  due_on date not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bill_payment_plans_one_source check (
    (credit_card_bill_id is not null)::integer +
    (recurring_expense_id is not null)::integer = 1
  ),
  constraint bill_payment_plans_period_start_check check (
    period_start = date_trunc('month', period_start)::date
  ),
  constraint bill_payment_plans_title_not_empty check (
    char_length(trim(title)) > 0
  ),
  constraint bill_payment_plans_amount_positive check (
    total_amount_cents > 0
  ),
  constraint bill_payment_plans_status_check check (
    status in ('active', 'completed')
  ),
  constraint bill_payment_plans_user_id_id_unique unique (user_id, id)
);

create table public.bill_payment_installments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  payment_plan_id uuid not null,
  amount_cents integer not null,
  planned_on date not null,
  paid_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bill_payment_installments_amount_positive check (
    amount_cents > 0
  ),
  constraint bill_payment_installments_plan_owner_fk
    foreign key (user_id, payment_plan_id)
    references public.bill_payment_plans(user_id, id)
    on delete cascade
);

create unique index bill_payment_plans_card_bill_unique
on public.bill_payment_plans(credit_card_bill_id)
where credit_card_bill_id is not null;

create unique index bill_payment_plans_recurring_period_unique
on public.bill_payment_plans(recurring_expense_id, period_start)
where recurring_expense_id is not null;

create index bill_payment_plans_user_status_idx
on public.bill_payment_plans(user_id, status);

create index bill_payment_installments_plan_date_idx
on public.bill_payment_installments(payment_plan_id, planned_on);

create trigger bill_payment_plans_set_updated_at
before update on public.bill_payment_plans
for each row execute function public.set_updated_at();

create trigger bill_payment_installments_set_updated_at
before update on public.bill_payment_installments
for each row execute function public.set_updated_at();

alter table public.bill_payment_plans enable row level security;
alter table public.bill_payment_installments enable row level security;

create policy "Users can view own bill payment plans"
on public.bill_payment_plans for select
using (user_id = auth.uid());

create policy "Users can view own bill payment installments"
on public.bill_payment_installments for select
using (user_id = auth.uid());

create or replace function public.save_bill_payment_plan(
  p_credit_card_bill_id uuid,
  p_recurring_expense_id uuid,
  p_period_start date,
  p_installments jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan_id uuid;
  v_title text;
  v_total_amount_cents integer;
  v_due_on date;
  v_schedule_end date;
  v_installment_count integer;
  v_installment_total bigint;
  v_paid_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  if (
    (p_credit_card_bill_id is not null)::integer +
    (p_recurring_expense_id is not null)::integer
  ) <> 1 then
    raise exception 'Choose exactly one bill source.';
  end if;

  if (
    p_period_start is null
    or p_period_start <> date_trunc('month', p_period_start)::date
  ) then
    raise exception 'Payment plan period must start on the first of the month.';
  end if;

  if p_credit_card_bill_id is not null then
    select
      concat(
        card.nickname,
        case
          when card.last_four is null then ''
          else concat(' • ', card.last_four)
        end
      ),
      bill.amount_cents,
      bill.due_on
    into v_title, v_total_amount_cents, v_due_on
    from public.credit_card_bills as bill
    join public.credit_cards as card
      on card.id = bill.credit_card_id
      and card.user_id = bill.user_id
    where bill.id = p_credit_card_bill_id
      and bill.user_id = v_user_id
      and bill.paid_on is null;
  else
    select
      expense.name,
      expense.amount_cents,
      (
        p_period_start +
        (
          least(
            expense.charge_day,
            extract(
              day from (
                p_period_start + interval '1 month - 1 day'
              )
            )::integer
          ) - 1
        )
      )::date
    into v_title, v_total_amount_cents, v_due_on
    from public.recurring_expenses as expense
    where expense.id = p_recurring_expense_id
      and expense.user_id = v_user_id
      and expense.is_active = true
      and expense.starts_on <= (p_period_start + interval '1 month - 1 day')::date
      and (expense.ends_on is null or expense.ends_on >= p_period_start);
  end if;

  if v_total_amount_cents is null then
    raise exception 'This bill is unavailable or already paid.';
  end if;

  if jsonb_typeof(p_installments) <> 'array' then
    raise exception 'Installments must be an array.';
  end if;

  v_installment_count := jsonb_array_length(p_installments);

  if v_installment_count < 2 or v_installment_count > 8 then
    raise exception 'Use between 2 and 8 installments.';
  end if;

  select
    coalesce(sum((item->>'amountCents')::integer), 0)
  into v_installment_total
  from jsonb_array_elements(p_installments) as item;

  if exists (
    select 1
    from jsonb_array_elements(p_installments) as item
    where
      item->>'amountCents' is null
      or item->>'plannedOn' is null
      or (item->>'amountCents')::integer <= 0
      or (item->>'plannedOn')::date < current_date
  ) then
    raise exception 'Each installment needs a future date and positive amount.';
  end if;

  v_schedule_end := greatest(
    v_due_on,
    (date_trunc('month', current_date) + interval '1 month - 1 day')::date
  );

  if exists (
    select 1
    from jsonb_array_elements(p_installments) as item
    where (item->>'plannedOn')::date > v_schedule_end
  ) then
    raise exception 'Installments must be scheduled by the plan end date.';
  end if;

  if v_installment_total <> v_total_amount_cents then
    raise exception 'Installment amounts must equal the bill total.';
  end if;

  select plan.id
  into v_plan_id
  from public.bill_payment_plans as plan
  where plan.user_id = v_user_id
    and (
      (p_credit_card_bill_id is not null and plan.credit_card_bill_id = p_credit_card_bill_id)
      or (
        p_recurring_expense_id is not null
        and plan.recurring_expense_id = p_recurring_expense_id
        and plan.period_start = p_period_start
      )
    );

  if v_plan_id is not null then
    select count(*)
    into v_paid_count
    from public.bill_payment_installments
    where payment_plan_id = v_plan_id
      and user_id = v_user_id
      and paid_on is not null;

    if v_paid_count > 0 then
      raise exception 'A plan with completed payments cannot be rescheduled.';
    end if;

    update public.bill_payment_plans
    set
      title = v_title,
      total_amount_cents = v_total_amount_cents,
      due_on = v_due_on,
      status = 'active'
    where id = v_plan_id
      and user_id = v_user_id;

    delete from public.bill_payment_installments
    where payment_plan_id = v_plan_id
      and user_id = v_user_id;
  else
    insert into public.bill_payment_plans (
      user_id,
      credit_card_bill_id,
      recurring_expense_id,
      period_start,
      title,
      total_amount_cents,
      due_on
    )
    values (
      v_user_id,
      p_credit_card_bill_id,
      p_recurring_expense_id,
      p_period_start,
      v_title,
      v_total_amount_cents,
      v_due_on
    )
    returning id into v_plan_id;
  end if;

  insert into public.bill_payment_installments (
    user_id,
    payment_plan_id,
    amount_cents,
    planned_on
  )
  select
    v_user_id,
    v_plan_id,
    (item->>'amountCents')::integer,
    (item->>'plannedOn')::date
  from jsonb_array_elements(p_installments) as item
  order by (item->>'plannedOn')::date;

  return v_plan_id;
end;
$$;

create or replace function public.set_bill_payment_installment_paid(
  p_installment_id uuid,
  p_is_paid boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan_id uuid;
  v_credit_card_bill_id uuid;
  v_is_complete boolean;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  update public.bill_payment_installments
  set paid_on = case when p_is_paid then current_date else null end
  where id = p_installment_id
    and user_id = v_user_id
  returning payment_plan_id into v_plan_id;

  if v_plan_id is null then
    raise exception 'Payment installment was not found.';
  end if;

  v_is_complete := not exists (
    select 1
    from public.bill_payment_installments as installment
    where installment.payment_plan_id = v_plan_id
      and installment.user_id = v_user_id
      and installment.paid_on is null
  );

  update public.bill_payment_plans as plan
  set status = case when v_is_complete then 'completed' else 'active' end
  where plan.id = v_plan_id
    and plan.user_id = v_user_id
  returning plan.credit_card_bill_id into v_credit_card_bill_id;

  if v_credit_card_bill_id is not null then
    update public.credit_card_bills
    set paid_on = case when v_is_complete then current_date else null end
    where id = v_credit_card_bill_id
      and user_id = v_user_id;
  end if;
end;
$$;

revoke all on table
  public.bill_payment_plans,
  public.bill_payment_installments
from anon, authenticated;

grant select on table
  public.bill_payment_plans,
  public.bill_payment_installments
to authenticated, service_role;

grant all on table
  public.bill_payment_plans,
  public.bill_payment_installments
to service_role;

revoke all on function public.save_bill_payment_plan(uuid, uuid, date, jsonb)
from public, anon;

revoke all on function public.set_bill_payment_installment_paid(uuid, boolean)
from public, anon;

grant execute on function public.save_bill_payment_plan(uuid, uuid, date, jsonb)
to authenticated, service_role;

grant execute on function public.set_bill_payment_installment_paid(uuid, boolean)
to authenticated, service_role;
