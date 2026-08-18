create table public.recurring_income_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null,
  amount_cents integer not null,
  account_id uuid,
  cadence text not null default 'monthly',
  anchor_day integer not null,
  next_expected_on date not null,
  ends_on date,
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_income_schedules_source_not_empty check (char_length(trim(source)) > 0),
  constraint recurring_income_schedules_amount_positive check (amount_cents > 0),
  constraint recurring_income_schedules_cadence_check check (
    cadence in ('weekly', 'biweekly', 'semi_monthly', 'monthly')
  ),
  constraint recurring_income_schedules_anchor_day_check check (anchor_day between 1 and 31),
  constraint recurring_income_schedules_date_range_check check (
    ends_on is null or next_expected_on <= ends_on
  ),
  constraint recurring_income_schedules_user_id_id_unique unique (user_id, id),
  constraint recurring_income_schedules_account_owner_fk foreign key (user_id, account_id)
    references public.financial_accounts(user_id, id)
    on delete restrict
);

create table public.recurring_income_occurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  schedule_id uuid not null,
  expected_on date not null,
  received_on date not null,
  income_entry_id uuid references public.income_entries(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint recurring_income_occurrences_schedule_owner_fk foreign key (user_id, schedule_id)
    references public.recurring_income_schedules(user_id, id)
    on delete cascade,
  constraint recurring_income_occurrences_user_schedule_date_unique
    unique (user_id, schedule_id, expected_on),
  constraint recurring_income_occurrences_user_income_unique
    unique (user_id, income_entry_id)
);

create index recurring_income_schedules_user_active_date_idx
on public.recurring_income_schedules(user_id, is_active, next_expected_on);

create index recurring_income_occurrences_user_expected_idx
on public.recurring_income_occurrences(user_id, expected_on);

create trigger recurring_income_schedules_set_updated_at
before update on public.recurring_income_schedules
for each row execute function public.set_updated_at();

alter table public.recurring_income_schedules enable row level security;
alter table public.recurring_income_occurrences enable row level security;

create policy "Users can view own recurring income schedules"
on public.recurring_income_schedules for select
using (user_id = auth.uid());

create policy "Users can create own recurring income schedules"
on public.recurring_income_schedules for insert
with check (user_id = auth.uid());

create policy "Users can update own recurring income schedules"
on public.recurring_income_schedules for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete own recurring income schedules"
on public.recurring_income_schedules for delete
using (user_id = auth.uid());

create policy "Users can view own recurring income occurrences"
on public.recurring_income_occurrences for select
using (user_id = auth.uid());

grant select, insert, update, delete on table public.recurring_income_schedules
to authenticated, service_role;
grant select on table public.recurring_income_occurrences
to authenticated, service_role;

revoke insert, update, delete on table public.recurring_income_occurrences
from anon, authenticated;

create or replace function public.create_recurring_income_schedule(
  p_source text,
  p_amount_cents integer,
  p_account_id uuid default null,
  p_cadence text default 'monthly',
  p_next_expected_on date default current_date,
  p_ends_on date default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_schedule_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'Authentication is required.';
  end if;

  if char_length(trim(coalesce(p_source, ''))) = 0 then
    raise exception using errcode = 'P0001', message = 'Income source is required.';
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception using errcode = 'P0001', message = 'Income amount must be greater than zero.';
  end if;

  if p_cadence not in ('weekly', 'biweekly', 'semi_monthly', 'monthly') then
    raise exception using errcode = 'P0001', message = 'Unsupported income cadence.';
  end if;

  if p_next_expected_on is null or (p_ends_on is not null and p_next_expected_on > p_ends_on) then
    raise exception using errcode = 'P0001', message = 'Income dates are invalid.';
  end if;

  if p_account_id is not null and not exists (
    select 1
    from public.financial_accounts as account
    where account.id = p_account_id
      and account.user_id = v_user_id
      and account.is_active = true
      and account.account_type in ('checking', 'savings', 'cash', 'investment', 'other')
  ) then
    raise exception using errcode = 'P0001', message = 'The selected account is unavailable.';
  end if;

  insert into public.recurring_income_schedules (
    user_id, source, amount_cents, account_id, cadence, anchor_day,
    next_expected_on, ends_on, note
  )
  values (
    v_user_id, trim(p_source), p_amount_cents, p_account_id, p_cadence,
    case
      when p_cadence = 'semi_monthly' and extract(day from p_next_expected_on)::integer > 15
        then extract(day from p_next_expected_on)::integer - 15
      else extract(day from p_next_expected_on)::integer
    end,
    p_next_expected_on, p_ends_on, nullif(trim(coalesce(p_note, '')), '')
  )
  returning id into v_schedule_id;

  return v_schedule_id;
end;
$$;

create or replace function public.update_recurring_income_schedule(
  p_schedule_id uuid,
  p_source text,
  p_amount_cents integer,
  p_account_id uuid default null,
  p_cadence text default 'monthly',
  p_next_expected_on date default current_date,
  p_ends_on date default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'Authentication is required.';
  end if;

  if not exists (
    select 1 from public.recurring_income_schedules
    where id = p_schedule_id and user_id = v_user_id
  ) then
    raise exception using errcode = 'P0002', message = 'Income schedule was not found.';
  end if;

  if char_length(trim(coalesce(p_source, ''))) = 0 then
    raise exception using errcode = 'P0001', message = 'Income source is required.';
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception using errcode = 'P0001', message = 'Income amount must be greater than zero.';
  end if;

  if p_cadence not in ('weekly', 'biweekly', 'semi_monthly', 'monthly') then
    raise exception using errcode = 'P0001', message = 'Unsupported income cadence.';
  end if;

  if p_next_expected_on is null or (p_ends_on is not null and p_next_expected_on > p_ends_on) then
    raise exception using errcode = 'P0001', message = 'Income dates are invalid.';
  end if;

  if p_account_id is not null and not exists (
    select 1
    from public.financial_accounts as account
    where account.id = p_account_id
      and account.user_id = v_user_id
      and account.is_active = true
      and account.account_type in ('checking', 'savings', 'cash', 'investment', 'other')
  ) then
    raise exception using errcode = 'P0001', message = 'The selected account is unavailable.';
  end if;

  update public.recurring_income_schedules
  set source = trim(p_source),
      amount_cents = p_amount_cents,
      account_id = p_account_id,
      cadence = p_cadence,
      anchor_day = case
        when p_cadence = 'semi_monthly' and extract(day from p_next_expected_on)::integer > 15
          then extract(day from p_next_expected_on)::integer - 15
        else extract(day from p_next_expected_on)::integer
      end,
      next_expected_on = p_next_expected_on,
      ends_on = p_ends_on,
      note = nullif(trim(coalesce(p_note, '')), '')
  where id = p_schedule_id and user_id = v_user_id;

  return p_schedule_id;
end;
$$;

create or replace function public.archive_recurring_income_schedule(
  p_schedule_id uuid,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'Authentication is required.';
  end if;

  update public.recurring_income_schedules
  set is_active = p_is_active
  where id = p_schedule_id and user_id = v_user_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Income schedule was not found.';
  end if;
end;
$$;

create or replace function public.delete_recurring_income_schedule(
  p_schedule_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'Authentication is required.';
  end if;

  delete from public.recurring_income_schedules
  where id = p_schedule_id and user_id = v_user_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Income schedule was not found.';
  end if;
end;
$$;

create or replace function public.record_recurring_income_occurrence(
  p_schedule_id uuid,
  p_expected_on date,
  p_received_on date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_source text;
  v_amount_cents integer;
  v_account_id uuid;
  v_note text;
  v_ends_on date;
  v_cadence text;
  v_anchor_day integer;
  v_current_next_expected_on date;
  v_is_active boolean;
  v_income_id uuid;
  v_occurrence_id uuid;
  v_next_expected_on date;
  v_next_month_start date;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'Authentication is required.';
  end if;

  if p_expected_on is null or p_received_on is null then
    raise exception using errcode = 'P0001', message = 'Occurrence dates are required.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(concat(p_schedule_id::text, ':', p_expected_on::text), 0)
  );

  select source, amount_cents, account_id, note, ends_on, cadence, anchor_day,
    next_expected_on, is_active
  into v_source, v_amount_cents, v_account_id, v_note, v_ends_on, v_cadence,
    v_anchor_day, v_current_next_expected_on, v_is_active
  from public.recurring_income_schedules
  where id = p_schedule_id
    and user_id = v_user_id;

  if v_source is null then
    raise exception using errcode = 'P0002', message = 'Income schedule was not found.';
  end if;

  select id, income_entry_id
  into v_occurrence_id, v_income_id
  from public.recurring_income_occurrences
  where user_id = v_user_id
    and schedule_id = p_schedule_id
    and expected_on = p_expected_on;

  if v_occurrence_id is not null then
    return jsonb_build_object(
      'occurrence_id', v_occurrence_id,
      'income_entry_id', v_income_id,
      'already_recorded', true
    );
  end if;

  if not v_is_active then
    raise exception using errcode = 'P0001', message = 'This income schedule is archived.';
  end if;

  if p_expected_on <> v_current_next_expected_on then
    raise exception using errcode = 'P0001', message = 'Record the next expected income occurrence first.';
  end if;

  if p_expected_on < current_date - interval '10 years'
     or (v_ends_on is not null and p_expected_on > v_ends_on) then
    raise exception using errcode = 'P0001', message = 'Occurrence date is outside this schedule.';
  end if;

  insert into public.income_entries (
    user_id, account_id, amount_cents, source, received_on, note
  )
  values (
    v_user_id, v_account_id, v_amount_cents, v_source, p_received_on, v_note
  )
  returning id into v_income_id;

  insert into public.recurring_income_occurrences (
    user_id, schedule_id, expected_on, received_on, income_entry_id
  )
  values (
    v_user_id, p_schedule_id, p_expected_on, p_received_on, v_income_id
  )
  returning id into v_occurrence_id;

  case v_cadence
    when 'weekly' then v_next_expected_on := p_expected_on + 7;
    when 'biweekly' then v_next_expected_on := p_expected_on + 14;
    when 'semi_monthly' then
      v_next_expected_on := case
        when extract(day from p_expected_on)::integer = v_anchor_day
          then (
            date_trunc('month', p_expected_on)
            + (v_anchor_day + 14) * interval '1 day'
          )::date
        else (
          date_trunc('month', p_expected_on)
          + interval '1 month'
          + (v_anchor_day - 1) * interval '1 day'
        )::date
      end;
    else
      v_next_month_start := (date_trunc('month', p_expected_on) + interval '1 month')::date;
      v_next_expected_on := v_next_month_start + (
        least(
          v_anchor_day,
          extract(day from v_next_month_start + interval '1 month' - interval '1 day')::integer
        ) - 1
      )::integer;
  end case;

  update public.recurring_income_schedules
  set next_expected_on = case
        when v_ends_on is not null and v_next_expected_on > v_ends_on
          then greatest(v_current_next_expected_on, p_expected_on)
        else greatest(v_current_next_expected_on, v_next_expected_on)
      end,
      is_active = case
        when v_ends_on is not null and v_next_expected_on > v_ends_on then false
        else is_active
      end
  where id = p_schedule_id and user_id = v_user_id;

  return jsonb_build_object(
    'occurrence_id', v_occurrence_id,
    'income_entry_id', v_income_id,
    'already_recorded', false
  );
end;
$$;

revoke all on function public.create_recurring_income_schedule(text, integer, uuid, text, date, date, text) from public, anon;
revoke all on function public.update_recurring_income_schedule(uuid, text, integer, uuid, text, date, date, text) from public, anon;
revoke all on function public.archive_recurring_income_schedule(uuid, boolean) from public, anon;
revoke all on function public.delete_recurring_income_schedule(uuid) from public, anon;
revoke all on function public.record_recurring_income_occurrence(uuid, date, date) from public, anon;

grant execute on function public.create_recurring_income_schedule(text, integer, uuid, text, date, date, text) to authenticated, service_role;
grant execute on function public.update_recurring_income_schedule(uuid, text, integer, uuid, text, date, date, text) to authenticated, service_role;
grant execute on function public.archive_recurring_income_schedule(uuid, boolean) to authenticated, service_role;
grant execute on function public.delete_recurring_income_schedule(uuid) to authenticated, service_role;
grant execute on function public.record_recurring_income_occurrence(uuid, date, date) to authenticated, service_role;
