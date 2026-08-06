create table public.transaction_import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  status text not null default 'staged',
  row_count integer not null default 0,
  posted_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transaction_import_batches_file_name_check check (char_length(trim(file_name)) > 0),
  constraint transaction_import_batches_status_check check (status in ('staged', 'posted', 'rolled_back')),
  constraint transaction_import_batches_counts_check check (row_count >= 0 and posted_count >= 0),
  constraint transaction_import_batches_user_id_id_unique unique (user_id, id)
);

create table public.transaction_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.transaction_import_batches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  row_number integer not null,
  transaction_type text not null,
  amount_cents integer not null,
  occurred_on date not null,
  description text not null,
  category_id uuid,
  account_id uuid,
  fingerprint text not null,
  status text not null default 'ready',
  error_messages text[] not null default '{}',
  raw_data jsonb not null default '{}'::jsonb,
  resulting_expense_id uuid references public.expenses(id) on delete set null,
  resulting_income_id uuid references public.income_entries(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint transaction_import_rows_number_check check (row_number > 0),
  constraint transaction_import_rows_type_check check (transaction_type in ('income', 'expense')),
  constraint transaction_import_rows_amount_check check (amount_cents > 0),
  constraint transaction_import_rows_description_check check (char_length(trim(description)) > 0),
  constraint transaction_import_rows_status_check check (status in ('ready', 'duplicate', 'invalid', 'posted', 'rolled_back')),
  constraint transaction_import_rows_result_check check (
    not (resulting_expense_id is not null and resulting_income_id is not null)
  ),
  constraint transaction_import_rows_batch_row_unique unique (batch_id, row_number),
  constraint transaction_import_rows_batch_owner_fk foreign key (user_id, batch_id)
    references public.transaction_import_batches(user_id, id) on delete cascade,
  constraint transaction_import_rows_category_owner_fk foreign key (user_id, category_id)
    references public.expense_categories(user_id, id) on delete restrict,
  constraint transaction_import_rows_account_owner_fk foreign key (user_id, account_id)
    references public.financial_accounts(user_id, id) on delete restrict
);

create table public.debt_settings (
  account_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  apr_basis_points integer not null default 0,
  minimum_payment_cents integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint debt_settings_apr_check check (apr_basis_points between 0 and 100000),
  constraint debt_settings_minimum_check check (minimum_payment_cents >= 0),
  constraint debt_settings_account_owner_fk foreign key (user_id, account_id)
    references public.financial_accounts(user_id, id) on delete cascade
);

create index transaction_import_batches_user_created_idx
on public.transaction_import_batches(user_id, created_at desc);
create index transaction_import_rows_batch_status_idx
on public.transaction_import_rows(batch_id, status, row_number);
create index transaction_import_rows_user_fingerprint_idx
on public.transaction_import_rows(user_id, fingerprint) where status = 'posted';
create index debt_settings_user_idx on public.debt_settings(user_id);

create trigger transaction_import_batches_set_updated_at before update
on public.transaction_import_batches for each row execute function public.set_updated_at();
create trigger debt_settings_set_updated_at before update
on public.debt_settings for each row execute function public.set_updated_at();

alter table public.transaction_import_batches enable row level security;
alter table public.transaction_import_rows enable row level security;
alter table public.debt_settings enable row level security;

create policy "Users can manage own import batches" on public.transaction_import_batches
for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users can manage own import rows" on public.transaction_import_rows
for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users can manage own debt settings" on public.debt_settings
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.transaction_import_batches,
  public.transaction_import_rows, public.debt_settings to authenticated, service_role;
revoke all on public.transaction_import_batches, public.transaction_import_rows,
  public.debt_settings from anon;

create or replace function public.commit_transaction_import(p_batch_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_row record;
  v_result_id uuid;
  v_posted integer := 0;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  perform 1 from public.transaction_import_batches
  where id = p_batch_id and user_id = v_user_id and status = 'staged'
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'Staged import was not found.';
  end if;

  update public.transaction_import_rows as candidate
  set status = 'duplicate', error_messages = array['Already imported']
  where candidate.batch_id = p_batch_id and candidate.user_id = v_user_id
    and candidate.status = 'ready'
    and exists (
      select 1 from public.transaction_import_rows as posted
      where posted.user_id = v_user_id and posted.status = 'posted'
        and posted.fingerprint = candidate.fingerprint
        and posted.batch_id <> p_batch_id
    );

  for v_row in
    select * from public.transaction_import_rows
    where batch_id = p_batch_id and user_id = v_user_id and status = 'ready'
    order by row_number
    for update
  loop
    if v_row.transaction_type = 'income' then
      insert into public.income_entries (user_id, account_id, amount_cents, source, received_on, note)
      values (v_user_id, v_row.account_id, v_row.amount_cents, v_row.description, v_row.occurred_on, 'Imported from CSV')
      returning id into v_result_id;
      update public.transaction_import_rows set status = 'posted', resulting_income_id = v_result_id
      where id = v_row.id;
    else
      insert into public.expenses (user_id, account_id, category_id, amount_cents, spent_on, merchant, note)
      values (v_user_id, v_row.account_id, v_row.category_id, v_row.amount_cents, v_row.occurred_on, v_row.description, 'Imported from CSV')
      returning id into v_result_id;
      update public.transaction_import_rows set status = 'posted', resulting_expense_id = v_result_id
      where id = v_row.id;
    end if;
    v_posted := v_posted + 1;
  end loop;

  update public.transaction_import_batches
  set status = 'posted', posted_count = v_posted
  where id = p_batch_id;
  return v_posted;
end;
$$;

create or replace function public.rollback_transaction_import(p_batch_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_deleted integer := 0;
  v_income_deleted integer := 0;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;
  perform 1 from public.transaction_import_batches
  where id = p_batch_id and user_id = v_user_id and status = 'posted'
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'Posted import was not found.';
  end if;

  delete from public.expenses where user_id = v_user_id and id in (
    select resulting_expense_id from public.transaction_import_rows
    where batch_id = p_batch_id and resulting_expense_id is not null
  );
  get diagnostics v_deleted = row_count;
  delete from public.income_entries where user_id = v_user_id and id in (
    select resulting_income_id from public.transaction_import_rows
    where batch_id = p_batch_id and resulting_income_id is not null
  );
  get diagnostics v_income_deleted = row_count;
  v_deleted := v_deleted + v_income_deleted;

  update public.transaction_import_rows set status = 'rolled_back'
  where batch_id = p_batch_id and user_id = v_user_id and status = 'posted';
  update public.transaction_import_batches set status = 'rolled_back'
  where id = p_batch_id;
  return v_deleted;
end;
$$;

revoke all on function public.commit_transaction_import(uuid) from public, anon;
revoke all on function public.rollback_transaction_import(uuid) from public, anon;
grant execute on function public.commit_transaction_import(uuid) to authenticated, service_role;
grant execute on function public.rollback_transaction_import(uuid) to authenticated, service_role;

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  delete from public.transaction_import_batches where user_id = v_user_id;
  delete from public.debt_settings where user_id = v_user_id;
  delete from public.user_preferences where user_id = v_user_id;
  delete from public.expense_tags where user_id = v_user_id;
  delete from public.tags where user_id = v_user_id;
  delete from public.review_items where user_id = v_user_id;
  delete from public.categorization_rules where user_id = v_user_id;
  delete from public.expense_splits where user_id = v_user_id;
  delete from public.expense_refunds where user_id = v_user_id;
  delete from public.budget_allocations where user_id = v_user_id;
  delete from public.budget_periods where user_id = v_user_id;
  delete from public.budget_templates where user_id = v_user_id;
  delete from public.account_transfers where user_id = v_user_id;
  delete from public.bill_payment_installments where user_id = v_user_id;
  delete from public.bill_payment_plans where user_id = v_user_id;
  delete from public.credit_card_bills where user_id = v_user_id;
  delete from public.credit_cards where user_id = v_user_id;
  delete from public.recurring_expenses where user_id = v_user_id;
  delete from public.budget_caps where user_id = v_user_id;
  delete from public.expenses where user_id = v_user_id;
  delete from public.expense_categories where user_id = v_user_id;
  delete from public.savings_goals where user_id = v_user_id;
  delete from public.income_entries where user_id = v_user_id;
  delete from public.financial_accounts where user_id = v_user_id;
  delete from public.profiles where id = v_user_id;
  delete from auth.users where id = v_user_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'Account was not found.';
  end if;
end;
$$;
