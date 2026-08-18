begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (id, email)
values
  ('e1000000-0000-0000-0000-000000000001', 'adjust-one@example.com'),
  ('e2000000-0000-0000-0000-000000000002', 'adjust-two@example.com');

insert into public.financial_accounts (
  id, user_id, name, account_type, opening_balance_cents
)
values
  ('e1100000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'Checking', 'checking', 100000),
  ('e2100000-0000-0000-0000-000000000002', 'e2000000-0000-0000-0000-000000000002', 'Other checking', 'checking', 50000);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$
    insert into public.account_balance_adjustments (
      user_id, account_id, amount_delta_cents, resulting_balance_cents, adjusted_on, note
    ) values (
      'e1000000-0000-0000-0000-000000000001',
      'e1100000-0000-0000-0000-000000000001',
      -2500,
      97500,
      current_date,
      'Statement correction'
    )
  $$,
  'an owner can record a signed balance correction'
);

select is(
  (select amount_delta_cents from public.account_balance_adjustments),
  -2500,
  'the signed correction amount is preserved'
);

select throws_ok(
  $$
    insert into public.account_balance_adjustments (
      user_id, account_id, amount_delta_cents, resulting_balance_cents, adjusted_on
    ) values (
      'e1000000-0000-0000-0000-000000000001',
      'e1100000-0000-0000-0000-000000000001',
      0,
      97500,
      current_date
    )
  $$,
  '23514',
  null,
  'a zero-value correction is rejected'
);

select throws_ok(
  $$
    insert into public.account_balance_adjustments (
      user_id, account_id, amount_delta_cents, resulting_balance_cents, adjusted_on
    ) values (
      'e1000000-0000-0000-0000-000000000001',
      'e2100000-0000-0000-0000-000000000002',
      100,
      50100,
      current_date
    )
  $$,
  '23503',
  null,
  'composite ownership prevents adjusting another user account'
);

select set_config('request.jwt.claim.sub', 'e2000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"e2000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

select is(
  (select count(*) from public.account_balance_adjustments),
  0::bigint,
  'RLS hides another user balance corrections'
);

select results_eq(
  $$
    update public.account_balance_adjustments
    set note = 'Not allowed'
    returning 1
  $$,
  $$select 1 where false$$,
  'RLS prevents changing another user correction'
);

select set_config('request.jwt.claim.sub', 'e1000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$delete from public.account_balance_adjustments$$,
  'an owner can undo a balance correction'
);

select is(
  (select count(*) from public.account_balance_adjustments),
  0::bigint,
  'undo removes the correction row'
);

select * from finish();

rollback;
