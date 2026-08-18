begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

insert into auth.users (id, email)
values
  ('f1000000-0000-0000-0000-000000000001', 'income-plan-one@example.com'),
  ('f2000000-0000-0000-0000-000000000002', 'income-plan-two@example.com');

insert into public.financial_accounts (
  id, user_id, name, account_type, opening_balance_cents
)
values (
  'f1100000-0000-0000-0000-000000000001',
  'f1000000-0000-0000-0000-000000000001',
  'Checking',
  'checking',
  0
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$
    select public.create_recurring_income_schedule(
      'Salary', 250000, 'f1100000-0000-0000-0000-000000000001',
      'monthly', '2026-01-31', null, 'Primary paycheck'
    )
  $$,
  'an owner can create a recurring income schedule'
);

select is(
  (select anchor_day from public.recurring_income_schedules where source = 'Salary'),
  31,
  'the original month-end anchor is stored'
);

select is(
  (select cadence from public.recurring_income_schedules where source = 'Salary'),
  'monthly',
  'the selected cadence is stored'
);

select set_config('request.jwt.claim.sub', 'f2000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"f2000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

select is(
  (select count(*) from public.recurring_income_schedules),
  0::bigint,
  'RLS hides another user income schedule'
);

select set_config('request.jwt.claim.sub', 'f1000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$
    select public.record_recurring_income_occurrence(
      (select id from public.recurring_income_schedules where source = 'Salary'),
      '2026-01-31',
      '2026-01-31'
    )
  $$,
  'recording an expected occurrence succeeds'
);

select is(
  (select count(*) from public.income_entries where source = 'Salary'),
  1::bigint,
  'recording creates one real income entry'
);

select is(
  (select count(*) from public.recurring_income_occurrences),
  1::bigint,
  'recording creates one occurrence audit row'
);

select is(
  (select next_expected_on from public.recurring_income_schedules where source = 'Salary'),
  '2026-02-28'::date,
  'a month-end schedule clamps to February'
);

select lives_ok(
  $$
    select public.record_recurring_income_occurrence(
      (select id from public.recurring_income_schedules where source = 'Salary'),
      '2026-01-31',
      '2026-01-31'
    )
  $$,
  'retrying the same occurrence is idempotent'
);

select is(
  (select count(*) from public.income_entries where source = 'Salary'),
  1::bigint,
  'an idempotent retry does not duplicate income'
);

select * from finish();

rollback;
