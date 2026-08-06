begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

select ok(
  not has_function_privilege(
    'anon',
    'public.delete_own_account()',
    'EXECUTE'
  ),
  'anonymous users cannot delete accounts'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.delete_own_account()',
    'EXECUTE'
  ),
  'authenticated users can execute account deletion'
);

insert into auth.users (id, email)
values
  ('50000000-0000-0000-0000-000000000005', 'delete-user@example.com'),
  ('60000000-0000-0000-0000-000000000006', 'keep-user@example.com');

insert into public.profiles (id, display_name)
values
  ('50000000-0000-0000-0000-000000000005', 'Delete User'),
  ('60000000-0000-0000-0000-000000000006', 'Keep User');

insert into public.expense_categories (id, user_id, name)
values (
  '51000000-0000-0000-0000-000000000005',
  '50000000-0000-0000-0000-000000000005',
  'Delete Category'
);

insert into public.financial_accounts (
  id, user_id, name, account_type, opening_balance_cents
)
values (
  '56000000-0000-0000-0000-000000000005',
  '50000000-0000-0000-0000-000000000005',
  'Delete checking',
  'checking',
  100000
);

insert into public.income_entries (user_id, amount_cents, received_on)
values ('50000000-0000-0000-0000-000000000005', 100000, current_date);

insert into public.expenses (
  id,
  user_id,
  category_id,
  amount_cents,
  spent_on
)
values (
  '57000000-0000-0000-0000-000000000005',
  '50000000-0000-0000-0000-000000000005',
  '51000000-0000-0000-0000-000000000005',
  2500,
  current_date
);

insert into public.expense_splits (
  user_id, expense_id, category_id, amount_cents, sort_order
)
values (
  '50000000-0000-0000-0000-000000000005',
  '57000000-0000-0000-0000-000000000005',
  '51000000-0000-0000-0000-000000000005',
  2500,
  0
);

insert into public.expense_refunds (
  user_id, expense_id, account_id, amount_cents, refunded_on
)
values (
  '50000000-0000-0000-0000-000000000005',
  '57000000-0000-0000-0000-000000000005',
  '56000000-0000-0000-0000-000000000005',
  500,
  current_date
);

insert into public.tags (id, user_id, name)
values (
  '58000000-0000-0000-0000-000000000005',
  '50000000-0000-0000-0000-000000000005',
  'Delete tag'
);

insert into public.expense_tags (user_id, expense_id, tag_id)
values (
  '50000000-0000-0000-0000-000000000005',
  '57000000-0000-0000-0000-000000000005',
  '58000000-0000-0000-0000-000000000005'
);

insert into public.categorization_rules (
  user_id, name, match_field, operator, match_value, category_id
)
values (
  '50000000-0000-0000-0000-000000000005',
  'Delete rule',
  'merchant',
  'contains',
  'delete',
  '51000000-0000-0000-0000-000000000005'
);

insert into public.review_items (user_id, expense_id, reason)
values (
  '50000000-0000-0000-0000-000000000005',
  '57000000-0000-0000-0000-000000000005',
  'Delete review'
);

insert into public.budget_templates (
  user_id, category_id, default_amount_cents, rollover_mode
)
values (
  '50000000-0000-0000-0000-000000000005',
  '51000000-0000-0000-0000-000000000005',
  50000,
  'positive_only'
);

insert into public.budget_periods (id, user_id, month_start)
values (
  '59000000-0000-0000-0000-000000000005',
  '50000000-0000-0000-0000-000000000005',
  date_trunc('month', current_date)::date
);

insert into public.budget_allocations (
  user_id, budget_period_id, category_id, planned_amount_cents, rollover_mode
)
values (
  '50000000-0000-0000-0000-000000000005',
  '59000000-0000-0000-0000-000000000005',
  '51000000-0000-0000-0000-000000000005',
  50000,
  'positive_only'
);

insert into public.budget_caps (user_id, category_id, amount_cents)
values (
  '50000000-0000-0000-0000-000000000005',
  '51000000-0000-0000-0000-000000000005',
  50000
);

insert into public.savings_goals (user_id, name, target_amount_cents)
values (
  '50000000-0000-0000-0000-000000000005',
  'Delete Goal',
  200000
);

insert into public.recurring_expenses (
  id,
  user_id,
  category_id,
  name,
  amount_cents,
  charge_day
)
values (
  '52000000-0000-0000-0000-000000000005',
  '50000000-0000-0000-0000-000000000005',
  '51000000-0000-0000-0000-000000000005',
  'Delete Rent',
  80000,
  1
);

insert into public.credit_cards (id, user_id, nickname, last_four)
values (
  '53000000-0000-0000-0000-000000000005',
  '50000000-0000-0000-0000-000000000005',
  'Delete Card',
  '5005'
);

insert into public.credit_card_bills (
  id,
  user_id,
  credit_card_id,
  amount_cents,
  statement_on,
  due_on
)
values (
  '54000000-0000-0000-0000-000000000005',
  '50000000-0000-0000-0000-000000000005',
  '53000000-0000-0000-0000-000000000005',
  30000,
  current_date,
  current_date + 15
);

insert into public.bill_payment_plans (
  id,
  user_id,
  credit_card_bill_id,
  period_start,
  title,
  total_amount_cents,
  due_on
)
values (
  '55000000-0000-0000-0000-000000000005',
  '50000000-0000-0000-0000-000000000005',
  '54000000-0000-0000-0000-000000000005',
  date_trunc('month', current_date)::date,
  'Delete Plan',
  30000,
  current_date + 15
);

insert into public.bill_payment_installments (
  user_id,
  payment_plan_id,
  amount_cents,
  planned_on
)
values (
  '50000000-0000-0000-0000-000000000005',
  '55000000-0000-0000-0000-000000000005',
  30000,
  current_date + 10
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '50000000-0000-0000-0000-000000000005',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"50000000-0000-0000-0000-000000000005","role":"authenticated"}',
  true
);

select lives_ok(
  $$select public.delete_own_account()$$,
  'an authenticated user can delete their own account'
);

reset role;

select is(
  (
    select count(*)
    from auth.users
    where id = '50000000-0000-0000-0000-000000000005'
  ),
  0::bigint,
  'the authenticated auth user is deleted'
);

select is(
  (
    select count(*)
    from auth.users
    where id = '60000000-0000-0000-0000-000000000006'
  ),
  1::bigint,
  'another auth user is preserved'
);

select is(
  (
    select
      (select count(*) from public.profiles where id = '50000000-0000-0000-0000-000000000005')
      + (select count(*) from public.income_entries where user_id = '50000000-0000-0000-0000-000000000005')
      + (select count(*) from public.expense_categories where user_id = '50000000-0000-0000-0000-000000000005')
      + (select count(*) from public.expenses where user_id = '50000000-0000-0000-0000-000000000005')
      + (select count(*) from public.budget_caps where user_id = '50000000-0000-0000-0000-000000000005')
      + (select count(*) from public.savings_goals where user_id = '50000000-0000-0000-0000-000000000005')
      + (select count(*) from public.recurring_expenses where user_id = '50000000-0000-0000-0000-000000000005')
      + (select count(*) from public.credit_cards where user_id = '50000000-0000-0000-0000-000000000005')
      + (select count(*) from public.credit_card_bills where user_id = '50000000-0000-0000-0000-000000000005')
      + (select count(*) from public.bill_payment_plans where user_id = '50000000-0000-0000-0000-000000000005')
      + (select count(*) from public.bill_payment_installments where user_id = '50000000-0000-0000-0000-000000000005')
      + (select count(*) from public.financial_accounts where user_id = '50000000-0000-0000-0000-000000000005')
      + (select count(*) from public.account_transfers where user_id = '50000000-0000-0000-0000-000000000005')
      + (select count(*) from public.expense_splits where user_id = '50000000-0000-0000-0000-000000000005')
      + (select count(*) from public.expense_refunds where user_id = '50000000-0000-0000-0000-000000000005')
      + (select count(*) from public.budget_templates where user_id = '50000000-0000-0000-0000-000000000005')
      + (select count(*) from public.budget_periods where user_id = '50000000-0000-0000-0000-000000000005')
      + (select count(*) from public.budget_allocations where user_id = '50000000-0000-0000-0000-000000000005')
      + (select count(*) from public.tags where user_id = '50000000-0000-0000-0000-000000000005')
      + (select count(*) from public.expense_tags where user_id = '50000000-0000-0000-0000-000000000005')
      + (select count(*) from public.categorization_rules where user_id = '50000000-0000-0000-0000-000000000005')
      + (select count(*) from public.review_items where user_id = '50000000-0000-0000-0000-000000000005')
  ),
  0::bigint,
  'all finance data owned by the deleted user is removed'
);

select is(
  (
    select count(*)
    from public.profiles
    where id = '60000000-0000-0000-0000-000000000006'
  ),
  1::bigint,
  'another user profile is preserved'
);

select * from finish();

rollback;
