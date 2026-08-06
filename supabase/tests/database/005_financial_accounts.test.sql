begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

insert into auth.users (id, email)
values
  ('60000000-0000-0000-0000-000000000006', 'accounts-one@example.com'),
  ('70000000-0000-0000-0000-000000000007', 'accounts-two@example.com');

insert into public.financial_accounts (
  id,
  user_id,
  name,
  account_type,
  opening_balance_cents
)
values
  ('61000000-0000-0000-0000-000000000006', '60000000-0000-0000-0000-000000000006', 'Checking', 'checking', 100000),
  ('62000000-0000-0000-0000-000000000006', '60000000-0000-0000-0000-000000000006', 'Savings', 'savings', 50000),
  ('71000000-0000-0000-0000-000000000007', '70000000-0000-0000-0000-000000000007', 'Other checking', 'checking', 200000);

insert into public.account_transfers (
  user_id,
  from_account_id,
  to_account_id,
  amount_cents,
  transferred_on
)
values (
  '60000000-0000-0000-0000-000000000006',
  '61000000-0000-0000-0000-000000000006',
  '62000000-0000-0000-0000-000000000006',
  10000,
  current_date
);

insert into public.credit_cards (id, user_id, nickname, last_four)
values (
  '63000000-0000-0000-0000-000000000006',
  '60000000-0000-0000-0000-000000000006',
  'Travel card',
  '4242'
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
  '64000000-0000-0000-0000-000000000006',
  '60000000-0000-0000-0000-000000000006',
  '63000000-0000-0000-0000-000000000006',
  25000,
  current_date,
  current_date + 20
);

select is(
  (
    select account_type
    from public.financial_accounts
    where id = (
      select financial_account_id
      from public.credit_cards
      where id = '63000000-0000-0000-0000-000000000006'
    )
  ),
  'credit_card',
  'creating a credit card creates its linked financial account'
);

select is(
  (select tracking_mode from public.credit_cards where id = '63000000-0000-0000-0000-000000000006'),
  'statement',
  'existing behavior defaults to statement tracking'
);

select throws_ok(
  $$
    insert into public.account_transfers (
      user_id, from_account_id, to_account_id, amount_cents, transferred_on
    ) values (
      '60000000-0000-0000-0000-000000000006',
      '61000000-0000-0000-0000-000000000006',
      '61000000-0000-0000-0000-000000000006',
      100,
      current_date
    )
  $$,
  '23514',
  null,
  'a transfer cannot use the same source and destination'
);

select throws_ok(
  $$
    insert into public.account_transfers (
      user_id, from_account_id, to_account_id, amount_cents, transferred_on
    ) values (
      '60000000-0000-0000-0000-000000000006',
      '61000000-0000-0000-0000-000000000006',
      '71000000-0000-0000-0000-000000000007',
      100,
      current_date
    )
  $$,
  '23503',
  null,
  'composite foreign keys prevent cross-owner transfers'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '60000000-0000-0000-0000-000000000006', true);
select set_config('request.jwt.claims', '{"sub":"60000000-0000-0000-0000-000000000006","role":"authenticated"}', true);

select lives_ok(
  $$
    select public.set_credit_card_bill_paid_with_account(
      '64000000-0000-0000-0000-000000000006',
      current_date,
      '61000000-0000-0000-0000-000000000006'
    )
  $$,
  'marking a statement paid reconciles its account transfer'
);

select is(
  (
    select count(*)
    from public.account_transfers
    where credit_card_bill_id = '64000000-0000-0000-0000-000000000006'
  ),
  1::bigint,
  'a reconciled card payment creates exactly one transfer'
);

select ok(
  (
    select paid_on = current_date
    from public.credit_card_bills
    where id = '64000000-0000-0000-0000-000000000006'
  ),
  'the statement receives its payment date'
);

select lives_ok(
  $$
    select public.set_credit_card_bill_paid_with_account(
      '64000000-0000-0000-0000-000000000006',
      null,
      null
    )
  $$,
  'a statement payment can be reversed'
);

select ok(
  (
    select paid_on is null
    from public.credit_card_bills
    where id = '64000000-0000-0000-0000-000000000006'
  )
  and not exists (
    select 1
    from public.account_transfers
    where credit_card_bill_id = '64000000-0000-0000-0000-000000000006'
  ),
  'reversing a statement payment removes its linked transfer'
);

select is((select count(*) from public.financial_accounts), 3::bigint, 'users only see their own accounts');
select is((select count(*) from public.account_transfers), 1::bigint, 'users only see their own transfers');

select lives_ok(
  $$
    insert into public.income_entries (
      user_id, account_id, amount_cents, received_on
    ) values (
      '60000000-0000-0000-0000-000000000006',
      '61000000-0000-0000-0000-000000000006',
      5000,
      current_date
    )
  $$,
  'income can be assigned to an owned account'
);

select throws_ok(
  $$
    insert into public.income_entries (
      user_id, account_id, amount_cents, received_on
    ) values (
      '60000000-0000-0000-0000-000000000006',
      '71000000-0000-0000-0000-000000000007',
      5000,
      current_date
    )
  $$,
  '23503',
  null,
  'income cannot be assigned to another user account'
);

select results_eq(
  $$
    update public.financial_accounts
    set name = 'Not allowed'
    where id = '71000000-0000-0000-0000-000000000007'
    returning 1
  $$,
  $$select 1 where false$$,
  'RLS prevents updating another user account'
);

select * from finish();

rollback;
