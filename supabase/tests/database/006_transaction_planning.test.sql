begin;

create extension if not exists pgtap with schema extensions;

select plan(28);

insert into auth.users (id, email)
values
  ('80000000-0000-0000-0000-000000000008', 'planning-one@example.com'),
  ('90000000-0000-0000-0000-000000000009', 'planning-two@example.com');

insert into public.profiles (id, display_name)
values
  ('80000000-0000-0000-0000-000000000008', 'Planner One'),
  ('90000000-0000-0000-0000-000000000009', 'Planner Two');

insert into public.expense_categories (id, user_id, name)
values
  ('81000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000008', 'Food'),
  ('81000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000008', 'Travel'),
  ('91000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000009', 'Other food');

insert into public.financial_accounts (
  id, user_id, name, account_type, opening_balance_cents
)
values
  ('82000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000008', 'Checking', 'checking', 100000),
  ('92000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000009', 'Other checking', 'checking', 100000);

insert into public.expenses (
  id, user_id, category_id, account_id, amount_cents, spent_on, merchant
)
values
  ('83000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000008', '81000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', 10000, '2026-08-03', 'Market'),
  ('93000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000009', '91000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000001', 20000, '2026-08-03', 'Other market');

insert into public.tags (user_id, name)
values
  ('80000000-0000-0000-0000-000000000008', 'Reimbursable'),
  ('90000000-0000-0000-0000-000000000009', 'Private');

insert into public.categorization_rules (
  user_id, name, match_field, operator, match_value, category_id
)
values
  ('80000000-0000-0000-0000-000000000008', 'Markets', 'merchant', 'contains', 'market', '81000000-0000-0000-0000-000000000001'),
  ('90000000-0000-0000-0000-000000000009', 'Other markets', 'merchant', 'contains', 'market', '91000000-0000-0000-0000-000000000001');

insert into public.review_items (user_id, expense_id, reason)
values
  ('80000000-0000-0000-0000-000000000008', '83000000-0000-0000-0000-000000000001', 'Check category'),
  ('90000000-0000-0000-0000-000000000009', '93000000-0000-0000-0000-000000000001', 'Check category');

set local role authenticated;
select set_config('request.jwt.claim.sub', '80000000-0000-0000-0000-000000000008', true);
select set_config('request.jwt.claims', '{"sub":"80000000-0000-0000-0000-000000000008","role":"authenticated"}', true);

select lives_ok(
  $$
    select public.save_expense_splits(
      '83000000-0000-0000-0000-000000000001',
      '[{"categoryId":"81000000-0000-0000-0000-000000000001","amountCents":7000},{"categoryId":"81000000-0000-0000-0000-000000000002","amountCents":3000}]'::jsonb
    )
  $$,
  'an owned expense can be split'
);

select is(
  (select count(*) from public.expense_splits where expense_id = '83000000-0000-0000-0000-000000000001'),
  2::bigint,
  'the split function creates every requested row'
);

select is(
  (select sum(amount_cents) from public.expense_splits where expense_id = '83000000-0000-0000-0000-000000000001'),
  10000::bigint,
  'split rows reconcile to the parent expense'
);

select throws_ok(
  $$
    select public.save_expense_splits(
      '83000000-0000-0000-0000-000000000001',
      '[{"categoryId":"81000000-0000-0000-0000-000000000001","amountCents":5000},{"categoryId":"81000000-0000-0000-0000-000000000001","amountCents":5000}]'::jsonb
    )
  $$,
  '22023',
  'Each split category can only be used once.',
  'duplicate split categories are rejected'
);

select throws_ok(
  $$select public.save_expense_splits('93000000-0000-0000-0000-000000000001', '[]'::jsonb)$$,
  'P0002',
  'Expense was not found.',
  'a user cannot split another user expense'
);

select throws_ok(
  $$
    select public.save_expense_splits(
      '83000000-0000-0000-0000-000000000001',
      '[{"categoryId":"81000000-0000-0000-0000-000000000001","amountCents":6000},{"categoryId":"81000000-0000-0000-0000-000000000002","amountCents":3000}]'::jsonb
    )
  $$,
  '22023',
  'Split amounts must equal the expense total.',
  'split totals must match the parent expense'
);

select throws_ok(
  $$
    select public.save_expense_splits(
      '83000000-0000-0000-0000-000000000001',
      '[{},{},{},{},{},{},{},{},{}]'::jsonb
    )
  $$,
  '22023',
  'Use between two and eight split categories.',
  'a split is limited to eight category rows'
);

select lives_ok(
  $$select public.create_expense_refund('83000000-0000-0000-0000-000000000001', 3000, '2026-08-05', '82000000-0000-0000-0000-000000000001', 'Return')$$,
  'an owned expense can receive a refund'
);

select is(
  (select sum(amount_cents) from public.expense_refunds where expense_id = '83000000-0000-0000-0000-000000000001'),
  3000::bigint,
  'refunds preserve their exact amount'
);

select throws_ok(
  $$select public.create_expense_refund('83000000-0000-0000-0000-000000000001', 7001, '2026-08-06', null, null)$$,
  '22023',
  'Refunds cannot exceed the original expense.',
  'cumulative refunds cannot exceed the purchase'
);

select throws_ok(
  $$select public.create_expense_refund('83000000-0000-0000-0000-000000000001', 100, '2026-08-06', '92000000-0000-0000-0000-000000000001', null)$$,
  '23503',
  null,
  'a refund cannot be assigned to another user account'
);

select throws_ok(
  $$select public.update_expense_entry('83000000-0000-0000-0000-000000000001', null, '81000000-0000-0000-0000-000000000001', 2999, '2026-08-03', 'Market', null)$$,
  '22023',
  'Expense total cannot be lower than its refunds.',
  'an expense cannot be reduced below its recorded refunds'
);

select lives_ok(
  $$select public.update_expense_entry('83000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 9000, '2026-08-03', 'Market', 'Edited')$$,
  'an owned expense can be edited through the protected function'
);

select is(
  (select count(*) from public.expense_splits where expense_id = '83000000-0000-0000-0000-000000000001'),
  0::bigint,
  'changing an expense total clears stale split rows'
);

select lives_ok(
  $$select public.save_budget_allocation('2026-08-01', '81000000-0000-0000-0000-000000000001', 50000, 'positive_only', true)$$,
  'a user can create a monthly budget allocation'
);

select is(
  (select count(*) from public.budget_periods where month_start = '2026-08-01'),
  1::bigint,
  'saving a budget creates its monthly period'
);

select is(
  (select planned_amount_cents from public.budget_allocations where category_id = '81000000-0000-0000-0000-000000000001'),
  50000,
  'the monthly allocation stores its exact amount'
);

select is(
  (select default_amount_cents from public.budget_templates where category_id = '81000000-0000-0000-0000-000000000001'),
  50000,
  'future-month templates are updated when requested'
);

select lives_ok(
  $$select public.ensure_budget_period('2026-09-01')$$,
  'a later budget month can be initialized'
);

select is(
  (
    select allocation.planned_amount_cents
    from public.budget_allocations as allocation
    join public.budget_periods as period on period.id = allocation.budget_period_id
    where allocation.category_id = '81000000-0000-0000-0000-000000000001'
      and period.month_start = '2026-09-01'
  ),
  50000,
  'new months copy active budget templates'
);

select lives_ok(
  $$select public.remove_budget_allocation('2026-09-01', '81000000-0000-0000-0000-000000000001', true)$$,
  'a user can remove an owned month allocation'
);

select ok(
  not exists (
    select 1
    from public.budget_allocations as allocation
    join public.budget_periods as period on period.id = allocation.budget_period_id
    where allocation.category_id = '81000000-0000-0000-0000-000000000001'
      and period.month_start = '2026-09-01'
  )
  and not (select is_active from public.budget_templates where category_id = '81000000-0000-0000-0000-000000000001'),
  'removing future defaults deletes the month and disables its template'
);

select is((select count(*) from public.tags), 1::bigint, 'tag rows are isolated by owner');
select is((select count(*) from public.categorization_rules), 1::bigint, 'rule rows are isolated by owner');
select is((select count(*) from public.review_items), 1::bigint, 'review rows are isolated by owner');

select throws_ok(
  $$insert into public.tags (user_id, name) values ('90000000-0000-0000-0000-000000000009', 'Not allowed')$$,
  '42501',
  'new row violates row-level security policy for table "tags"',
  'a user cannot create another user tag'
);

select throws_ok(
  $$select public.save_budget_allocation('2026-08-01', '91000000-0000-0000-0000-000000000001', 50000, 'none', false)$$,
  'P0002',
  'Category was not found.',
  'a user cannot budget another user category'
);

select throws_ok(
  $$
    insert into public.expense_splits (user_id, expense_id, category_id, amount_cents)
    values ('80000000-0000-0000-0000-000000000008', '83000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 9000)
  $$,
  '42501',
  null,
  'split rows can only be written through the protected function'
);

select * from finish();

rollback;
