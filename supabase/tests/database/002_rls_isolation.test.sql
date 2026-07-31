begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

insert into auth.users (id, email)
values
  ('10000000-0000-0000-0000-000000000001', 'rls-user-one@example.com'),
  ('20000000-0000-0000-0000-000000000002', 'rls-user-two@example.com');

insert into public.profiles (id, display_name)
values
  ('10000000-0000-0000-0000-000000000001', 'User One'),
  ('20000000-0000-0000-0000-000000000002', 'User Two');

insert into public.expense_categories (id, user_id, name)
values
  (
    '11000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'User One Food'
  ),
  (
    '22000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    'User Two Food'
  );

insert into public.income_entries (user_id, amount_cents, received_on)
values
  ('10000000-0000-0000-0000-000000000001', 100000, current_date),
  ('20000000-0000-0000-0000-000000000002', 200000, current_date);

insert into public.expenses (user_id, category_id, amount_cents, spent_on)
values
  (
    '10000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001',
    1000,
    current_date
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '22000000-0000-0000-0000-000000000002',
    2000,
    current_date
  );

insert into public.budget_caps (user_id, category_id, amount_cents)
values
  (
    '10000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001',
    50000
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '22000000-0000-0000-0000-000000000002',
    60000
  );

insert into public.savings_goals (user_id, name, target_amount_cents)
values
  ('10000000-0000-0000-0000-000000000001', 'User One Goal', 500000),
  ('20000000-0000-0000-0000-000000000002', 'User Two Goal', 600000);

insert into public.recurring_expenses (
  id,
  user_id,
  category_id,
  name,
  amount_cents,
  charge_day
)
values
  (
    '13000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001',
    'User One Rent',
    80000,
    1
  ),
  (
    '23000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    '22000000-0000-0000-0000-000000000002',
    'User Two Rent',
    90000,
    1
  );

insert into public.credit_cards (id, user_id, nickname, last_four)
values
  (
    '14000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'User One Card',
    '1111'
  ),
  (
    '24000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    'User Two Card',
    '2222'
  );

insert into public.credit_card_bills (
  id,
  user_id,
  credit_card_id,
  amount_cents,
  statement_on,
  due_on
)
values
  (
    '15000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '14000000-0000-0000-0000-000000000001',
    10000,
    current_date,
    current_date + 30
  ),
  (
    '25000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    '24000000-0000-0000-0000-000000000002',
    20000,
    current_date,
    current_date + 30
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
values
  (
    '16000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000001',
    date_trunc('month', current_date)::date,
    'User One Plan',
    10000,
    current_date + 30
  ),
  (
    '26000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    '25000000-0000-0000-0000-000000000002',
    date_trunc('month', current_date)::date,
    'User Two Plan',
    20000,
    current_date + 30
  );

insert into public.bill_payment_installments (
  user_id,
  payment_plan_id,
  amount_cents,
  planned_on
)
values
  (
    '10000000-0000-0000-0000-000000000001',
    '16000000-0000-0000-0000-000000000001',
    10000,
    current_date + 10
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '26000000-0000-0000-0000-000000000002',
    20000,
    current_date + 10
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select is((select count(*) from public.profiles), 1::bigint, 'profiles are isolated');
select is((select count(*) from public.income_entries), 1::bigint, 'income is isolated');
select is((select count(*) from public.expense_categories), 1::bigint, 'categories are isolated');
select is((select count(*) from public.expenses), 1::bigint, 'expenses are isolated');
select is((select count(*) from public.budget_caps), 1::bigint, 'caps are isolated');
select is((select count(*) from public.savings_goals), 1::bigint, 'goals are isolated');
select is((select count(*) from public.recurring_expenses), 1::bigint, 'recurring expenses are isolated');
select is((select count(*) from public.credit_cards), 1::bigint, 'cards are isolated');
select is((select count(*) from public.credit_card_bills), 1::bigint, 'card bills are isolated');
select is((select count(*) from public.bill_payment_plans), 1::bigint, 'payment plans are isolated');
select is((select count(*) from public.bill_payment_installments), 1::bigint, 'installments are isolated');

select lives_ok(
  $$
    insert into public.income_entries (user_id, amount_cents, received_on)
    values ('10000000-0000-0000-0000-000000000001', 5000, current_date)
  $$,
  'a user can create an owned income row'
);

select throws_ok(
  $$
    insert into public.income_entries (user_id, amount_cents, received_on)
    values ('20000000-0000-0000-0000-000000000002', 5000, current_date)
  $$,
  '42501',
  'new row violates row-level security policy for table "income_entries"',
  'a user cannot create income for another user'
);

select results_eq(
  $$
    update public.savings_goals
    set name = 'Changed by User One'
    where user_id = '20000000-0000-0000-0000-000000000002'
    returning 1
  $$,
  $$select 1 where false$$,
  'a user cannot update another user goal'
);

select results_eq(
  $$
    delete from public.credit_cards
    where user_id = '20000000-0000-0000-0000-000000000002'
    returning 1
  $$,
  $$select 1 where false$$,
  'a user cannot delete another user card'
);

select throws_ok(
  $$
    insert into public.expenses (
      user_id,
      category_id,
      amount_cents,
      spent_on
    )
    values (
      '10000000-0000-0000-0000-000000000001',
      '22000000-0000-0000-0000-000000000002',
      1000,
      current_date
    )
  $$,
  '23503',
  'insert or update on table "expenses" violates foreign key constraint "expenses_category_owner_fk"',
  'ownership constraints reject another user category'
);

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);

select throws_ok(
  $$select count(*) from public.income_entries$$,
  '42501',
  'permission denied for table income_entries',
  'anonymous users cannot read finance data'
);

select * from finish();

rollback;
