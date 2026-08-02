begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

insert into auth.users (id, email)
values
  ('30000000-0000-0000-0000-000000000003', 'function-user-one@example.com'),
  ('40000000-0000-0000-0000-000000000004', 'function-user-two@example.com');

insert into public.credit_cards (id, user_id, nickname, last_four)
values
  (
    '31000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000003',
    'Existing Plan Card',
    '3001'
  ),
  (
    '31000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000003',
    'New Plan Card',
    '3002'
  ),
  (
    '41000000-0000-0000-0000-000000000004',
    '40000000-0000-0000-0000-000000000004',
    'Other User Card',
    '4004'
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
    '32000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000003',
    '31000000-0000-0000-0000-000000000001',
    10000,
    current_date,
    current_date + 30
  ),
  (
    '32000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000003',
    '31000000-0000-0000-0000-000000000002',
    12000,
    current_date,
    current_date + 30
  ),
  (
    '42000000-0000-0000-0000-000000000004',
    '40000000-0000-0000-0000-000000000004',
    '41000000-0000-0000-0000-000000000004',
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
values (
  '33000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000003',
  '32000000-0000-0000-0000-000000000001',
  date_trunc('month', current_date)::date,
  'Existing Plan',
  10000,
  current_date + 30
);

insert into public.bill_payment_installments (
  id,
  user_id,
  payment_plan_id,
  amount_cents,
  planned_on
)
values
  (
    '34000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000003',
    '33000000-0000-0000-0000-000000000001',
    5000,
    current_date + 5
  ),
  (
    '34000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000003',
    '33000000-0000-0000-0000-000000000001',
    5000,
    current_date + 10
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '30000000-0000-0000-0000-000000000003',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);

select throws_ok(
  $$
    select public.save_bill_payment_plan(
      '42000000-0000-0000-0000-000000000004',
      null,
      date_trunc('month', current_date)::date,
      20000,
      jsonb_build_array(
        jsonb_build_object('amountCents', 10000, 'plannedOn', current_date + 5),
        jsonb_build_object('amountCents', 10000, 'plannedOn', current_date + 10)
      )
    )
  $$,
  'P0001',
  'This bill is unavailable.',
  'a user cannot create a plan for another user bill'
);

select lives_ok(
  $$
    select public.save_bill_payment_plan(
      '32000000-0000-0000-0000-000000000002',
      null,
      date_trunc('month', current_date)::date,
      12000,
      jsonb_build_array(
        jsonb_build_object('amountCents', 6000, 'plannedOn', current_date + 5),
        jsonb_build_object('amountCents', 6000, 'plannedOn', current_date + 10)
      )
    )
  $$,
  'a user can create a plan for an owned bill'
);

select is(
  (
    select count(*)
    from public.bill_payment_plans
    where credit_card_bill_id = '32000000-0000-0000-0000-000000000002'
  ),
  1::bigint,
  'the protected function creates one payment plan'
);

select is(
  (
    select count(*)
    from public.bill_payment_installments
    where payment_plan_id = (
      select id
      from public.bill_payment_plans
      where credit_card_bill_id = '32000000-0000-0000-0000-000000000002'
    )
  ),
  2::bigint,
  'the protected function creates the requested installments'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '40000000-0000-0000-0000-000000000004',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"40000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);

select throws_ok(
  $$
    select public.set_bill_payment_installment_paid(
      '34000000-0000-0000-0000-000000000001',
      true
    )
  $$,
  'P0001',
  'Payment installment was not found.',
  'a user cannot mark another user installment paid'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '30000000-0000-0000-0000-000000000003',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);

select lives_ok(
  $$
    select public.set_bill_payment_installment_paid(
      '34000000-0000-0000-0000-000000000001',
      true
    )
  $$,
  'a user can mark an owned installment paid'
);

select is(
  (
    select count(*)
    from public.bill_payment_installments
    where payment_plan_id = '33000000-0000-0000-0000-000000000001'
      and paid_on is not null
  ),
  1::bigint,
  'the completed installment records a paid date'
);

select is(
  (
    select status
    from public.bill_payment_plans
    where id = '33000000-0000-0000-0000-000000000001'
  ),
  'active',
  'the plan remains active while a payment is outstanding'
);

select lives_ok(
  $$
    select public.set_bill_payment_installment_paid(
      '34000000-0000-0000-0000-000000000002',
      true
    )
  $$,
  'a user can complete the final owned installment'
);

select is(
  (
    select status
    from public.bill_payment_plans
    where id = '33000000-0000-0000-0000-000000000001'
  ),
  'completed',
  'the plan completes after its final payment'
);

select is(
  (
    select paid_on is not null
    from public.credit_card_bills
    where id = '32000000-0000-0000-0000-000000000001'
  ),
  true,
  'the card bill is paid when its payment plan completes'
);

select * from finish();

rollback;
