create table public.nutrition_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  goal_type text not null,
  dietary_style text not null default 'balanced',
  current_weight_grams integer not null,
  target_weight_grams integer not null,
  height_cm integer not null,
  daily_calorie_target integer not null,
  protein_target_g integer not null,
  carbs_target_g integer not null,
  fat_target_g integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_profiles_goal_type_check check (
    goal_type in ('lose_fat', 'maintain', 'build_muscle')
  ),
  constraint nutrition_profiles_dietary_style_check check (
    dietary_style in (
      'balanced', 'high_protein', 'vegetarian', 'vegan',
      'pescatarian', 'mediterranean', 'low_carb'
    )
  ),
  constraint nutrition_profiles_current_weight_check check (
    current_weight_grams between 25000 and 400000
  ),
  constraint nutrition_profiles_target_weight_check check (
    target_weight_grams between 25000 and 400000
  ),
  constraint nutrition_profiles_height_check check (height_cm between 100 and 250),
  constraint nutrition_profiles_calorie_target_check check (
    daily_calorie_target between 500 and 10000
  ),
  constraint nutrition_profiles_protein_target_check check (
    protein_target_g between 1 and 500
  ),
  constraint nutrition_profiles_carbs_target_check check (
    carbs_target_g between 0 and 1000
  ),
  constraint nutrition_profiles_fat_target_check check (
    fat_target_g between 0 and 500
  )
);

create table public.meal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  eaten_on date not null,
  meal_type text not null,
  name text not null,
  calories integer not null,
  protein_g integer not null default 0,
  carbs_g integer not null default 0,
  fat_g integer not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meal_entries_user_id_id_unique unique (user_id, id),
  constraint meal_entries_type_check check (
    meal_type in ('breakfast', 'lunch', 'dinner', 'snack')
  ),
  constraint meal_entries_name_not_empty check (char_length(trim(name)) between 2 and 100),
  constraint meal_entries_calories_check check (calories between 0 and 10000),
  constraint meal_entries_protein_check check (protein_g between 0 and 1000),
  constraint meal_entries_carbs_check check (carbs_g between 0 and 2000),
  constraint meal_entries_fat_check check (fat_g between 0 and 1000)
);

create index meal_entries_user_date_idx
on public.meal_entries(user_id, eaten_on desc, created_at desc);

create trigger nutrition_profiles_set_updated_at
before update on public.nutrition_profiles
for each row execute function public.set_updated_at();

create trigger meal_entries_set_updated_at
before update on public.meal_entries
for each row execute function public.set_updated_at();

alter table public.nutrition_profiles enable row level security;
alter table public.meal_entries enable row level security;

create policy "Users can manage own nutrition profile"
on public.nutrition_profiles
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can manage own meal entries"
on public.meal_entries
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

revoke all on table public.nutrition_profiles from public, anon;
revoke all on table public.meal_entries from public, anon;

grant select, insert, update, delete on table public.nutrition_profiles
to authenticated, service_role;
grant select, insert, update, delete on table public.meal_entries
to authenticated, service_role;
