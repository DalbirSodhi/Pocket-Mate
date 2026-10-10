begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

insert into auth.users (id, email)
values
  ('14000000-0000-0000-0000-000000000001', 'nutrition-one@example.com'),
  ('14000000-0000-0000-0000-000000000002', 'nutrition-two@example.com');

insert into public.nutrition_profiles (
  user_id, goal_type, dietary_style, current_weight_grams,
  target_weight_grams, height_cm, daily_calorie_target,
  protein_target_g, carbs_target_g, fat_target_g
)
values
  (
    '14000000-0000-0000-0000-000000000001', 'build_muscle', 'high_protein',
    80000, 85000, 180, 2800, 180, 320, 80
  ),
  (
    '14000000-0000-0000-0000-000000000002', 'maintain', 'balanced',
    70000, 70000, 170, 2200, 120, 260, 70
  );

insert into public.meal_entries (
  user_id, eaten_on, meal_type, name, calories, protein_g, carbs_g, fat_g
)
values
  (
    '14000000-0000-0000-0000-000000000001', current_date,
    'breakfast', 'Greek yogurt bowl', 420, 35, 48, 10
  ),
  (
    '14000000-0000-0000-0000-000000000002', current_date,
    'lunch', 'Other user lunch', 600, 30, 70, 20
  );

select ok(
  has_table_privilege('authenticated', 'public.nutrition_profiles', 'select'),
  'authenticated users can read nutrition profiles'
);
select ok(
  has_table_privilege('authenticated', 'public.meal_entries', 'insert'),
  'authenticated users can create meal entries'
);
select ok(
  not has_table_privilege('anon', 'public.nutrition_profiles', 'select'),
  'anonymous users cannot read nutrition profiles'
);
select ok(
  not has_table_privilege('anon', 'public.meal_entries', 'select'),
  'anonymous users cannot read meal entries'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '14000000-0000-0000-0000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"14000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.nutrition_profiles),
  1::bigint,
  'nutrition profiles are isolated by owner'
);
select is(
  (select count(*) from public.meal_entries),
  1::bigint,
  'meal entries are isolated by owner'
);
select is(
  (select calories from public.meal_entries limit 1),
  420,
  'an owner can read exact meal nutrition'
);

select lives_ok(
  $$
    update public.nutrition_profiles
    set daily_calorie_target = 2900
    where user_id = '14000000-0000-0000-0000-000000000001'
  $$,
  'an owner can update their nutrition targets'
);

select is(
  (
    select daily_calorie_target
    from public.nutrition_profiles
    where user_id = '14000000-0000-0000-0000-000000000001'
  ),
  2900,
  'the updated calorie target is stored'
);

select throws_ok(
  $$
    insert into public.meal_entries (
      user_id, eaten_on, meal_type, name, calories
    ) values (
      '14000000-0000-0000-0000-000000000002', current_date,
      'snack', 'Not allowed', 100
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "meal_entries"',
  'a user cannot create another user meal entry'
);

select throws_ok(
  $$
    insert into public.meal_entries (
      user_id, eaten_on, meal_type, name, calories
    ) values (
      '14000000-0000-0000-0000-000000000001', current_date,
      'midnight', 'Invalid meal', 100
    )
  $$,
  '23514',
  null,
  'unsupported meal types are rejected'
);

select throws_ok(
  $$
    update public.nutrition_profiles
    set daily_calorie_target = 100
    where user_id = '14000000-0000-0000-0000-000000000001'
  $$,
  '23514',
  null,
  'unsafe calorie targets are rejected'
);

select finish();
rollback;
