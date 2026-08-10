begin;

create extension if not exists pgtap with schema extensions;

select plan(66);

select has_table(
  'public',
  table_name,
  format('public.%s exists', table_name)
)
from unnest(array[
  'households',
  'household_members',
  'household_invitations',
  'household_audit_events'
]) as table_name;

select is(
  (
    select count(*)
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public'
      and pg_class.relname = any(array[
        'households',
        'household_members',
        'household_invitations',
        'household_audit_events'
      ])
      and pg_class.relrowsecurity
  ),
  4::bigint,
  'RLS is enabled on every household table'
);

select ok(
  (
    select bool_and(
      has_table_privilege(
        'authenticated',
        format('public.%I', table_name),
        'SELECT'
      )
      and not has_table_privilege(
        'authenticated',
        format('public.%I', table_name),
        'INSERT, UPDATE, DELETE'
      )
    )
    from unnest(array[
      'households',
      'household_members',
      'household_invitations',
      'household_audit_events'
    ]) as table_name
  ),
  'authenticated users have read-only direct access to household tables'
);

select ok(
  not exists (
    select 1
    from unnest(array[
      'households',
      'household_members',
      'household_invitations',
      'household_audit_events'
    ]) as table_name
    where has_table_privilege(
      'anon',
      format('public.%I', table_name),
      'SELECT, INSERT, UPDATE, DELETE'
    )
  ),
  'anonymous users have no household table privileges'
);

select ok(
  (
    select bool_and(
      not has_function_privilege('anon', function_name, 'EXECUTE')
    )
    from unnest(array[
      'public.is_household_member(uuid)',
      'public.is_household_owner(uuid)',
      'public.create_household(text)',
      'public.create_household_invitation(uuid,text,text)',
      'public.accept_household_invitation(text)',
      'public.update_household_member_role(uuid,uuid,text)',
      'public.remove_household_member(uuid,uuid)',
      'public.get_household_monthly_summary(uuid,date)'
    ]) as function_name
  ),
  'anonymous users cannot execute household functions'
);

select ok(
  (
    select bool_and(
      has_function_privilege('authenticated', function_name, 'EXECUTE')
    )
    from unnest(array[
      'public.is_household_member(uuid)',
      'public.is_household_owner(uuid)',
      'public.create_household(text)',
      'public.create_household_invitation(uuid,text,text)',
      'public.accept_household_invitation(text)',
      'public.update_household_member_role(uuid,uuid,text)',
      'public.remove_household_member(uuid,uuid)',
      'public.get_household_monthly_summary(uuid,date)'
    ]) as function_name
  ),
  'authenticated users can execute household functions'
);

insert into auth.users (id, email)
values
  ('a0000000-0000-0000-0000-000000000001', 'owner@example.com'),
  ('a0000000-0000-0000-0000-000000000002', 'editor@example.com'),
  ('a0000000-0000-0000-0000-000000000003', 'viewer@example.com'),
  ('a0000000-0000-0000-0000-000000000004', 'wrong@example.com'),
  ('a0000000-0000-0000-0000-000000000005', 'expired@example.com'),
  ('a0000000-0000-0000-0000-000000000006', 'outsider@example.com');

insert into public.profiles (id, display_name)
values
  ('a0000000-0000-0000-0000-000000000001', 'Household Owner'),
  ('a0000000-0000-0000-0000-000000000002', 'Household Editor'),
  ('a0000000-0000-0000-0000-000000000003', 'Household Viewer'),
  ('a0000000-0000-0000-0000-000000000004', 'Wrong Recipient'),
  ('a0000000-0000-0000-0000-000000000005', 'Expired Recipient'),
  ('a0000000-0000-0000-0000-000000000006', 'Outside User');

create temporary table household_test_state (
  key text primary key,
  value text not null
);

grant select, insert, update, delete on household_test_state to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select lives_ok(
  $$
    insert into household_test_state (key, value)
    values ('household_id', public.create_household('  The Household  ')::text)
  $$,
  'an authenticated user can create a household'
);

select is(
  (select count(*) from public.households),
  1::bigint,
  'the owner can view the created household'
);

select is(
  (
    select role
    from public.household_members
    where user_id = 'a0000000-0000-0000-0000-000000000001'
  ),
  'owner',
  'the creator receives the owner membership'
);

select throws_ok(
  $$select public.create_household('Another household')$$,
  '23505',
  'You already belong to a household.',
  'a user can have only one active household membership'
);

select throws_ok(
  $$insert into public.households (name, owner_user_id) values ('Direct', auth.uid())$$,
  '42501',
  'permission denied for table households',
  'authenticated users cannot bypass RPCs with direct mutations'
);

select throws_ok(
  $$
    select public.create_household_invitation(
      (select value::uuid from household_test_state where key = 'household_id'),
      'editor@example.com',
      'owner'
    )
  $$,
  '22023',
  'Invitation role must be editor or viewer.',
  'invitations cannot grant ownership'
);

select lives_ok(
  $$
    insert into household_test_state (key, value)
    select
      'editor_token',
      public.create_household_invitation(
        (select value::uuid from household_test_state where key = 'household_id'),
        'EDITOR@EXAMPLE.COM',
        'editor'
      )
  $$,
  'the owner can invite an editor'
);

select ok(
  (
    select
      invitation.token_hash = public.digest(state.value, 'sha256')
      and encode(invitation.token_hash, 'hex') <> state.value
    from public.household_invitations as invitation
    join household_test_state as state on state.key = 'editor_token'
    where invitation.invited_email = 'editor@example.com'
  ),
  'only the invitation token hash is stored'
);

select is(
  (select count(*) from public.household_invitations),
  1::bigint,
  'the owner can view household invitations'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000004', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);

select throws_ok(
  $$
    select public.accept_household_invitation(
      (select value from household_test_state where key = 'editor_token')
    )
  $$,
  '42501',
  'This invitation belongs to another email address.',
  'a different email cannot accept the invitation'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select lives_ok(
  $$
    select public.accept_household_invitation(
      (select value from household_test_state where key = 'editor_token')
    )
  $$,
  'the invited email can accept the invitation'
);

select is(
  (
    select role
    from public.household_members
    where user_id = 'a0000000-0000-0000-0000-000000000002'
  ),
  'editor',
  'the accepted membership uses the invited role'
);

select throws_ok(
  $$
    select public.accept_household_invitation(
      (select value from household_test_state where key = 'editor_token')
    )
  $$,
  'P0001',
  'Invitation has already been accepted.',
  'an accepted invitation cannot be reused'
);

select is(
  (select count(*) from public.household_invitations),
  0::bigint,
  'non-owners cannot view invitation rows or email addresses'
);

select is(
  (select count(*) from public.profiles),
  1::bigint,
  'membership does not bypass profile-name RLS'
);

select throws_ok(
  $$
    select public.create_household_invitation(
      (select value::uuid from household_test_state where key = 'household_id'),
      'viewer@example.com',
      'viewer'
    )
  $$,
  '42501',
  'Only the household owner can create invitations.',
  'editors cannot administer invitations'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select lives_ok(
  $$
    insert into household_test_state (key, value)
    select
      'viewer_old_token',
      public.create_household_invitation(
        (select value::uuid from household_test_state where key = 'household_id'),
        'viewer@example.com',
        'viewer'
      )
  $$,
  'the owner can create an initial viewer invitation'
);

select lives_ok(
  $$
    insert into household_test_state (key, value)
    select
      'viewer_token',
      public.create_household_invitation(
        (select value::uuid from household_test_state where key = 'household_id'),
        'viewer@example.com',
        'viewer'
      )
  $$,
  'a replacement invitation revokes the previous open token'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000003', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);

select throws_ok(
  $$
    select public.accept_household_invitation(
      (select value from household_test_state where key = 'viewer_old_token')
    )
  $$,
  'P0001',
  'Invitation has been revoked.',
  'a revoked invitation cannot be accepted'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select lives_ok(
  $$
    insert into household_test_state (key, value)
    select
      'expired_token',
      public.create_household_invitation(
        (select value::uuid from household_test_state where key = 'household_id'),
        'expired@example.com',
        'viewer'
      )
  $$,
  'the owner can create an invitation for expiration testing'
);

reset role;

update public.household_invitations
set
  created_at = now() - interval '8 days',
  expires_at = now() - interval '1 day'
where token_hash = public.digest(
  (select value from household_test_state where key = 'expired_token'),
  'sha256'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000005', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated"}',
  true
);

select throws_ok(
  $$
    select public.accept_household_invitation(
      (select value from household_test_state where key = 'expired_token')
    )
  $$,
  'P0001',
  'Invitation has expired.',
  'an expired invitation cannot be accepted'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000003', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);

select lives_ok(
  $$
    select public.accept_household_invitation(
      (select value from household_test_state where key = 'viewer_token')
    )
  $$,
  'the viewer can accept the current valid invitation'
);

select is(
  (select count(*) from public.household_members),
  3::bigint,
  'all three members can view the household membership roster'
);

select is(
  (
    select role
    from public.household_members
    where user_id = 'a0000000-0000-0000-0000-000000000003'
  ),
  'viewer',
  'the viewer receives the least-privileged invited role'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  $$
    select public.update_household_member_role(
      (select value::uuid from household_test_state where key = 'household_id'),
      'a0000000-0000-0000-0000-000000000001',
      'editor'
    )
  $$,
  '22023',
  'Transfer ownership before changing the owner role.',
  'the sole owner role cannot be demoted'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select throws_ok(
  $$
    select public.update_household_member_role(
      (select value::uuid from household_test_state where key = 'household_id'),
      'a0000000-0000-0000-0000-000000000003',
      'editor'
    )
  $$,
  '42501',
  'Only the household owner can change member roles.',
  'editors cannot change member roles'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select lives_ok(
  $$
    select public.update_household_member_role(
      (select value::uuid from household_test_state where key = 'household_id'),
      'a0000000-0000-0000-0000-000000000003',
      'editor'
    )
  $$,
  'the owner can change a non-owner role'
);

select is(
  (
    select role
    from public.household_members
    where user_id = 'a0000000-0000-0000-0000-000000000003'
  ),
  'editor',
  'the role change is persisted'
);

select lives_ok(
  $$
    select public.update_household_member_role(
      (select value::uuid from household_test_state where key = 'household_id'),
      'a0000000-0000-0000-0000-000000000002',
      'owner'
    )
  $$,
  'the owner can transfer ownership to another member'
);

select is(
  (
    select owner_user_id
    from public.households
    where id = (select value::uuid from household_test_state where key = 'household_id')
  ),
  'a0000000-0000-0000-0000-000000000002'::uuid,
  'the household points to the new owner'
);

select is(
  (
    select role
    from public.household_members
    where user_id = 'a0000000-0000-0000-0000-000000000001'
  ),
  'editor',
  'the previous owner becomes an editor after transfer'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select lives_ok(
  $$
    select public.update_household_member_role(
      (select value::uuid from household_test_state where key = 'household_id'),
      'a0000000-0000-0000-0000-000000000001',
      'owner'
    )
  $$,
  'the new owner can transfer ownership back'
);

select is(
  (
    select owner_user_id
    from public.households
    where id = (select value::uuid from household_test_state where key = 'household_id')
  ),
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'ownership transfer preserves exactly one owner'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000006', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-000000000006","role":"authenticated"}',
  true
);

select throws_ok(
  $$
    select public.get_household_monthly_summary(
      (select value::uuid from household_test_state where key = 'household_id'),
      '2026-08-01'
    )
  $$,
  '42501',
  'Household membership is required.',
  'outsiders cannot read household aggregates'
);

reset role;

insert into public.expense_categories (id, user_id, name)
values
  (
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Owner spending'
  ),
  (
    'b0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000003',
    'Viewer spending'
  );

insert into public.income_entries (user_id, amount_cents, received_on, note)
values
  (
    'a0000000-0000-0000-0000-000000000001',
    100000,
    '2026-08-02',
    'private owner income note'
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    50000,
    '2026-08-03',
    'private viewer income note'
  );

insert into public.expenses (
  id,
  user_id,
  category_id,
  amount_cents,
  spent_on,
  merchant,
  note
)
values (
  'b1000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  10000,
  '2026-08-04',
  'Private Owner Merchant',
  'private expense note'
);

insert into public.expense_refunds (
  user_id,
  expense_id,
  amount_cents,
  refunded_on,
  note
)
values (
  'a0000000-0000-0000-0000-000000000001',
  'b1000000-0000-0000-0000-000000000001',
  2000,
  '2026-08-05',
  'private refund note'
);

insert into public.credit_cards (
  id,
  user_id,
  nickname,
  last_four,
  tracking_mode
)
values
  (
    'c0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Owner Statement Card',
    '1001',
    'statement'
  ),
  (
    'c0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000003',
    'Viewer Transaction Card',
    '3003',
    'transactions'
  );

insert into public.expenses (
  user_id,
  category_id,
  account_id,
  amount_cents,
  spent_on,
  merchant
)
values
  (
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    (
      select financial_account_id
      from public.credit_cards
      where id = 'c0000000-0000-0000-0000-000000000001'
    ),
    7000,
    '2026-08-06',
    'Excluded Statement Purchase'
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    'b0000000-0000-0000-0000-000000000003',
    (
      select financial_account_id
      from public.credit_cards
      where id = 'c0000000-0000-0000-0000-000000000003'
    ),
    4000,
    '2026-08-07',
    'Private Viewer Merchant'
  );

insert into public.credit_card_bills (
  id,
  user_id,
  credit_card_id,
  amount_cents,
  statement_on,
  due_on,
  paid_on
)
values
  (
    'd0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    3000,
    '2026-08-01',
    '2026-08-15',
    '2026-08-10'
  ),
  (
    'd0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    5000,
    '2026-08-02',
    '2026-08-20',
    '2026-08-20'
  ),
  (
    'd0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000003',
    'c0000000-0000-0000-0000-000000000003',
    4000,
    '2026-08-01',
    '2026-08-20',
    '2026-08-20'
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
  'e0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000002',
  '2026-08-01',
  'Planned statement bill',
  5000,
  '2026-08-20'
);

insert into public.bill_payment_installments (
  id,
  user_id,
  payment_plan_id,
  amount_cents,
  planned_on,
  paid_on
)
values (
  'f0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'e0000000-0000-0000-0000-000000000001',
  5000,
  '2026-08-12',
  '2026-08-12'
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
  'c1000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  'Owner recurring bill',
  2000,
  8
);

insert into public.bill_payment_plans (
  id,
  user_id,
  recurring_expense_id,
  period_start,
  title,
  total_amount_cents,
  due_on
)
values (
  'e0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  'c1000000-0000-0000-0000-000000000001',
  '2026-08-01',
  'Recurring bill plan',
  2000,
  '2026-08-08'
);

insert into public.bill_payment_installments (
  id,
  user_id,
  payment_plan_id,
  amount_cents,
  planned_on,
  paid_on
)
values (
  'f0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  'e0000000-0000-0000-0000-000000000002',
  2000,
  '2026-08-08',
  '2026-08-08'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select is(
  (
    public.get_household_monthly_summary(
      (select value::uuid from household_test_state where key = 'household_id'),
      '2026-08-01'
    )->>'householdIncomeCents'
  )::bigint,
  150000::bigint,
  'household income includes each member income entry for the month'
);

select is(
  (
    public.get_household_monthly_summary(
      (select value::uuid from household_test_state where key = 'household_id'),
      '2026-08-01'
    )->>'householdSpentCents'
  )::bigint,
  22000::bigint,
  'household spending nets refunds and avoids card-payment double counting'
);

select is(
  (
    public.get_household_monthly_summary(
      (select value::uuid from household_test_state where key = 'household_id'),
      '2026-08-01'
    )->>'householdNetCents'
  )::bigint,
  128000::bigint,
  'household net is income minus defensible actual spending'
);

select is(
  jsonb_array_length(
    public.get_household_monthly_summary(
      (select value::uuid from household_test_state where key = 'household_id'),
      '2026-08-01'
    )->'members'
  ),
  3,
  'the aggregate includes every member, including members without activity'
);

select ok(
  (
    select
      (member->>'incomeCents')::bigint = 0
      and (member->>'spentCents')::bigint = 0
      and (member->>'netCents')::bigint = 0
    from jsonb_array_elements(
      public.get_household_monthly_summary(
        (select value::uuid from household_test_state where key = 'household_id'),
        '2026-08-01'
      )->'members'
    ) as member
    where member->>'userId' = 'a0000000-0000-0000-0000-000000000002'
  ),
  'a zero-activity member has explicit zero aggregates'
);

select is(
  (
    select (member->>'spentCents')::bigint
    from jsonb_array_elements(
      public.get_household_monthly_summary(
        (select value::uuid from household_test_state where key = 'household_id'),
        '2026-08-01'
      )->'members'
    ) as member
    where member->>'userId' = 'a0000000-0000-0000-0000-000000000001'
  ),
  18000::bigint,
  'owner spending includes net expenses and actual statement and plan payments'
);

select is(
  (
    select (member->>'spentCents')::bigint
    from jsonb_array_elements(
      public.get_household_monthly_summary(
        (select value::uuid from household_test_state where key = 'household_id'),
        '2026-08-01'
      )->'members'
    ) as member
    where member->>'userId' = 'a0000000-0000-0000-0000-000000000003'
  ),
  4000::bigint,
  'transaction-tracked card purchases count once and their bill payment does not'
);

select ok(
  public.get_household_monthly_summary(
    (select value::uuid from household_test_state where key = 'household_id'),
    '2026-08-01'
  )::text not ilike '%private%'
  and public.get_household_monthly_summary(
    (select value::uuid from household_test_state where key = 'household_id'),
    '2026-08-01'
  )::text not like '%@example.com%',
  'the aggregate does not disclose merchants, notes, or invitation emails'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  $$
    select public.remove_household_member(
      (select value::uuid from household_test_state where key = 'household_id'),
      'a0000000-0000-0000-0000-000000000001'
    )
  $$,
  '22023',
  'Transfer ownership before the owner leaves.',
  'an owner cannot leave without transferring ownership'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000003', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);

select lives_ok(
  $$
    select public.remove_household_member(
      (select value::uuid from household_test_state where key = 'household_id'),
      'a0000000-0000-0000-0000-000000000003'
    )
  $$,
  'a non-owner can leave the household'
);

select is(
  (select count(*) from public.household_members),
  0::bigint,
  'a departed user loses all household roster visibility'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select is(
  (
    select count(*)
    from public.household_audit_events
    where action = 'member.left'
      and target_user_id = 'a0000000-0000-0000-0000-000000000003'
  ),
  1::bigint,
  'member departure is recorded in the household audit history'
);

select lives_ok(
  $$select public.delete_own_account()$$,
  'an owner can delete their account without deleting the shared household'
);

reset role;

select is(
  (
    select count(*)
    from auth.users
    where id = 'a0000000-0000-0000-0000-000000000001'
  ),
  0::bigint,
  'the deleting owner auth user is removed'
);

select is(
  (
    select count(*)
    from public.households
    where id = (select value::uuid from household_test_state where key = 'household_id')
  ),
  1::bigint,
  'a household with another member survives owner account deletion'
);

select is(
  (
    select owner_user_id
    from public.households
    where id = (select value::uuid from household_test_state where key = 'household_id')
  ),
  'a0000000-0000-0000-0000-000000000002'::uuid,
  'ownership transfers to the earliest remaining member'
);

select is(
  (
    select count(*)
    from public.household_members
    where user_id = 'a0000000-0000-0000-0000-000000000001'
  ),
  0::bigint,
  'the deleted account no longer has a household membership'
);

select is(
  (
    select count(*)
    from public.household_audit_events
    where action = 'ownership.transferred'
      and target_user_id = 'a0000000-0000-0000-0000-000000000002'
      and actor_user_id is null
      and metadata->>'reason' = 'account_deleted'
  ),
  1::bigint,
  'ownership transfer remains audited after the former owner is deleted'
);

select is(
  (
    select count(*)
    from public.profiles
    where id = 'a0000000-0000-0000-0000-000000000002'
  ),
  1::bigint,
  'another household member profile is preserved'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000006', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-000000000006","role":"authenticated"}',
  true
);

select lives_ok(
  $$
    insert into household_test_state (key, value)
    values ('sole_household_id', public.create_household('Sole household')::text)
  $$,
  'a separate user can create a sole-member household'
);

select lives_ok(
  $$select public.delete_own_account()$$,
  'deleting a sole owner account succeeds'
);

reset role;

select is(
  (
    select count(*)
    from public.households
    where id = (select value::uuid from household_test_state where key = 'sole_household_id')
  ),
  0::bigint,
  'a household without a successor is deleted with its owner account'
);

select is(
  (
    select count(*)
    from public.household_audit_events
    where household_id is null
      and action = 'household.deleted'
      and actor_user_id is null
      and metadata->>'reason' = 'account_deleted'
  ),
  1::bigint,
  'sole-household deletion remains in the protected audit trail'
);

select * from finish();

rollback;
