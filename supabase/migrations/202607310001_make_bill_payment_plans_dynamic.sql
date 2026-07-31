drop function if exists public.save_bill_payment_plan(uuid, uuid, date, jsonb);

create function public.save_bill_payment_plan(
  p_credit_card_bill_id uuid,
  p_recurring_expense_id uuid,
  p_period_start date,
  p_total_amount_cents integer,
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
  v_due_on date;
  v_schedule_end date := (current_date + interval '12 months')::date;
  v_new_installment_count integer;
  v_total_installment_count integer;
  v_new_installment_total bigint;
  v_paid_count integer := 0;
  v_paid_total bigint := 0;
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

  if p_total_amount_cents is null or p_total_amount_cents <= 0 then
    raise exception 'Enter a positive bill total.';
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
      bill.due_on
    into v_title, v_due_on
    from public.credit_card_bills as bill
    join public.credit_cards as card
      on card.id = bill.credit_card_id
      and card.user_id = bill.user_id
    where bill.id = p_credit_card_bill_id
      and bill.user_id = v_user_id;
  else
    select
      expense.name,
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
    into v_title, v_due_on
    from public.recurring_expenses as expense
    where expense.id = p_recurring_expense_id
      and expense.user_id = v_user_id
      and expense.is_active = true
      and expense.starts_on <= (p_period_start + interval '1 month - 1 day')::date
      and (expense.ends_on is null or expense.ends_on >= p_period_start);
  end if;

  if v_title is null or v_due_on is null then
    raise exception 'This bill is unavailable.';
  end if;

  select plan.id
  into v_plan_id
  from public.bill_payment_plans as plan
  where plan.user_id = v_user_id
    and (
      (
        p_credit_card_bill_id is not null
        and plan.credit_card_bill_id = p_credit_card_bill_id
      )
      or (
        p_recurring_expense_id is not null
        and plan.recurring_expense_id = p_recurring_expense_id
        and plan.period_start = p_period_start
      )
    );

  if v_plan_id is not null then
    select
      count(*),
      coalesce(sum(installment.amount_cents), 0)
    into v_paid_count, v_paid_total
    from public.bill_payment_installments as installment
    where installment.payment_plan_id = v_plan_id
      and installment.user_id = v_user_id
      and installment.paid_on is not null;
  end if;

  if p_total_amount_cents <= v_paid_total then
    raise exception 'Bill total must be greater than completed payments.';
  end if;

  if jsonb_typeof(p_installments) <> 'array' then
    raise exception 'Installments must be an array.';
  end if;

  v_new_installment_count := jsonb_array_length(p_installments);
  v_total_installment_count := v_paid_count + v_new_installment_count;

  if v_new_installment_count < 1 then
    raise exception 'Add at least one remaining payment.';
  end if;

  if v_total_installment_count < 2 or v_total_installment_count > 8 then
    raise exception 'Use between 2 and 8 installments.';
  end if;

  select coalesce(sum((item->>'amountCents')::integer), 0)
  into v_new_installment_total
  from jsonb_array_elements(p_installments) as item;

  if exists (
    select 1
    from jsonb_array_elements(p_installments) as item
    where
      item->>'amountCents' is null
      or item->>'plannedOn' is null
      or (item->>'amountCents')::integer <= 0
      or (item->>'plannedOn')::date < current_date
      or (item->>'plannedOn')::date > v_schedule_end
  ) then
    raise exception 'Each remaining payment needs a valid date and positive amount.';
  end if;

  if v_paid_total + v_new_installment_total <> p_total_amount_cents then
    raise exception 'Installment amounts must equal the bill total.';
  end if;

  if p_credit_card_bill_id is not null then
    update public.credit_card_bills
    set amount_cents = p_total_amount_cents
    where id = p_credit_card_bill_id
      and user_id = v_user_id;
  end if;

  if v_plan_id is not null then
    update public.bill_payment_plans
    set
      title = v_title,
      total_amount_cents = p_total_amount_cents,
      due_on = v_due_on,
      status = 'active'
    where id = v_plan_id
      and user_id = v_user_id;

    delete from public.bill_payment_installments
    where payment_plan_id = v_plan_id
      and user_id = v_user_id
      and paid_on is null;
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
      p_total_amount_cents,
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

revoke all on function public.save_bill_payment_plan(
  uuid,
  uuid,
  date,
  integer,
  jsonb
) from public, anon;

grant execute on function public.save_bill_payment_plan(
  uuid,
  uuid,
  date,
  integer,
  jsonb
) to authenticated, service_role;
