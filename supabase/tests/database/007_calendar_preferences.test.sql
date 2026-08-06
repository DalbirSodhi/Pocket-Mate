begin;

create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email)
values
  ('a0000000-0000-0000-0000-000000000001', 'preferences-one@example.com'),
  ('a0000000-0000-0000-0000-000000000002', 'preferences-two@example.com');

insert into public.user_preferences (
  user_id, reminders_enabled, lead_days, dashboard_density
)
values
  ('a0000000-0000-0000-0000-000000000001', true, array[1, 3], 'compact'),
  ('a0000000-0000-0000-0000-000000000002', false, array[7], 'comfortable');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is((select count(*) from public.user_preferences), 1::bigint, 'preferences are isolated by owner');

select lives_ok(
  $$update public.user_preferences set hide_amounts = true where user_id = 'a0000000-0000-0000-0000-000000000001'$$,
  'a user can update owned preferences'
);

select results_eq(
  $$update public.user_preferences set hide_amounts = true where user_id = 'a0000000-0000-0000-0000-000000000002' returning 1$$,
  $$select 1 where false$$,
  'a user cannot update another user preferences'
);

select throws_ok(
  $$update public.user_preferences set lead_days = array[2] where user_id = 'a0000000-0000-0000-0000-000000000001'$$,
  '23514',
  null,
  'unsupported reminder lead days are rejected'
);

select throws_ok(
  $$update public.user_preferences set dashboard_density = 'tiny' where user_id = 'a0000000-0000-0000-0000-000000000001'$$,
  '23514',
  null,
  'unsupported dashboard density is rejected'
);

select * from finish();
rollback;
