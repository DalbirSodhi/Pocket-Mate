begin;

create extension if not exists pgtap with schema extensions;

select plan(19);

insert into auth.users (id, email)
values
  ('d1000000-0000-0000-0000-000000000001', 'savings-one@example.com'),
  ('d2000000-0000-0000-0000-000000000002', 'savings-two@example.com');

insert into public.financial_accounts (
  id,
  user_id,
  name,
  account_type,
  opening_balance_cents,
  is_active
)
values
  ('d1100000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'Checking', 'checking', 100000, true),
  ('d1200000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'Cash', 'cash', 10000, true),
  ('d1300000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'Savings', 'savings', 20000, true),
  ('d2100000-0000-0000-0000-000000000002', 'd2000000-0000-0000-0000-000000000002', 'Other checking', 'checking', 50000, true),
  ('d2300000-0000-0000-0000-000000000002', 'd2000000-0000-0000-0000-000000000002', 'Other savings', 'savings', 50000, true);

insert into public.savings_goals (
  id,
  user_id,
  name,
  target_amount_cents,
  current_amount_cents
)
values
  ('d1400000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'Emergency fund', 100000, 10000),
  ('d2400000-0000-0000-0000-000000000002', 'd2000000-0000-0000-0000-000000000002', 'Other goal', 100000, 10000);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd1000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select throws_ok(
  $$
    update public.savings_goals
    set current_amount_cents = 12000
    where id = 'd1400000-0000-0000-0000-000000000001'
  $$,
  '55000',
  'Use an account-backed savings contribution while accounts exist.',
  'manual savings progress is blocked after accounts exist'
);

select lives_ok(
  $$
    select public.record_savings_goal_contribution(
      'd1400000-0000-0000-0000-000000000001',
      'd1100000-0000-0000-0000-000000000001',
      'd1300000-0000-0000-0000-000000000001',
      25000,
      '2026-08-13'
    )
  $$,
  'an owned checking-to-savings contribution is recorded'
);

select is(
  (select count(*) from public.savings_goal_contributions),
  1::bigint,
  'recording a contribution creates exactly one contribution row'
);

select is(
  (select count(*) from public.account_transfers),
  1::bigint,
  'recording a contribution creates exactly one account transfer'
);

select is(
  (select current_amount_cents from public.savings_goals where id = 'd1400000-0000-0000-0000-000000000001'),
  35000,
  'recording a contribution increments goal progress once'
);

select is(
  (
    select transfer.amount_cents
    from public.account_transfers as transfer
    join public.savings_goal_contributions as contribution
      on contribution.account_transfer_id = transfer.id
  ),
  25000,
  'the contribution transfer amount matches the goal progress amount'
);

select throws_ok(
  $$
    select public.record_savings_goal_contribution(
      'd1400000-0000-0000-0000-000000000001',
      'd2100000-0000-0000-0000-000000000002',
      'd1300000-0000-0000-0000-000000000001',
      100,
      '2026-08-13'
    )
  $$,
  'P0002',
  'An active checking or cash source account was not found.',
  'a user cannot contribute from another user account'
);

select throws_ok(
  $$
    select public.record_savings_goal_contribution(
      'd1400000-0000-0000-0000-000000000001',
      'd1100000-0000-0000-0000-000000000001',
      'd2100000-0000-0000-0000-000000000002',
      100,
      '2026-08-13'
    )
  $$,
  'P0002',
  'An active savings destination account was not found.',
  'a user cannot contribute into another user savings account'
);

select throws_ok(
  $$
    select public.record_savings_goal_contribution(
      'd1400000-0000-0000-0000-000000000001',
      'd1100000-0000-0000-0000-000000000001',
      'd1300000-0000-0000-0000-000000000001',
      75001,
      '2026-08-13'
    )
  $$,
  '22023',
  'Contribution cannot exceed the remaining goal amount.',
  'a contribution cannot exceed the goal target'
);

select throws_ok(
  $$
    update public.account_transfers
    set amount_cents = 1
    where id = (select account_transfer_id from public.savings_goal_contributions)
  $$,
  '55000',
  'Savings contribution transfers can only be reversed through the contribution flow.',
  'linked transfer amounts cannot be changed directly'
);

select throws_ok(
  $$
    delete from public.account_transfers
    where id = (select account_transfer_id from public.savings_goal_contributions)
  $$,
  '55000',
  'Savings contribution transfers can only be reversed through the contribution flow.',
  'linked transfers cannot be deleted directly'
);

select lives_ok(
  $$
    select public.undo_savings_goal_contribution(
      (select id from public.savings_goal_contributions)
    )
  $$,
  'an owned contribution can be undone atomically'
);

select is(
  (select count(*) from public.savings_goal_contributions),
  0::bigint,
  'undo removes the contribution history row'
);

select is(
  (select count(*) from public.account_transfers),
  0::bigint,
  'undo removes the linked transfer'
);

select is(
  (select current_amount_cents from public.savings_goals where id = 'd1400000-0000-0000-0000-000000000001'),
  10000,
  'undo restores the prior goal progress'
);

select throws_ok(
  $$select public.undo_savings_goal_contribution('d1500000-0000-0000-0000-000000000001')$$,
  'P0002',
  'Savings contribution was not found.',
  'an unknown contribution cannot be undone'
);

select lives_ok(
  $$
    select public.record_savings_goal_contribution(
      'd1400000-0000-0000-0000-000000000001',
      'd1200000-0000-0000-0000-000000000001',
      'd1300000-0000-0000-0000-000000000001',
      5000,
      '2026-08-13'
    )
  $$,
  'a cash source account is accepted'
);

select set_config(
  'app.test_savings_contribution_id',
  (select id::text from public.savings_goal_contributions),
  true
);

select set_config('request.jwt.claim.sub', 'd2000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"d2000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

select is(
  (select count(*) from public.savings_goal_contributions),
  0::bigint,
  'RLS hides another user contribution history'
);

select throws_ok(
  $$
    select public.undo_savings_goal_contribution(
      current_setting('app.test_savings_contribution_id')::uuid
    )
  $$,
  'P0002',
  'Savings contribution was not found.',
  'a user cannot undo another user contribution'
);

select * from finish();

rollback;
