create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reminders_enabled boolean not null default false,
  remind_card_bills boolean not null default true,
  remind_recurring_bills boolean not null default true,
  remind_paydays boolean not null default false,
  reminder_hour integer not null default 9,
  lead_days integer[] not null default array[1, 3],
  dashboard_density text not null default 'comfortable',
  hide_amounts boolean not null default false,
  high_contrast boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_preferences_hour_check check (reminder_hour between 0 and 23),
  constraint user_preferences_lead_days_check check (
    cardinality(lead_days) between 1 and 5
    and lead_days <@ array[0, 1, 3, 7, 14]
  ),
  constraint user_preferences_density_check check (
    dashboard_density in ('comfortable', 'compact')
  )
);

create trigger user_preferences_set_updated_at
before update on public.user_preferences
for each row execute function public.set_updated_at();

alter table public.user_preferences enable row level security;

create policy "Users can manage own preferences"
on public.user_preferences for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant select, insert, update, delete on table public.user_preferences
to authenticated, service_role;
revoke all on table public.user_preferences from anon;

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

  delete from public.user_preferences where user_id = v_user_id;
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
