alter table public.savings_goals
add constraint savings_goals_user_id_id_unique unique (user_id, id);

alter table public.account_transfers
add constraint account_transfers_user_id_id_unique unique (user_id, id);

create table public.savings_goal_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  savings_goal_id uuid not null,
  from_account_id uuid not null,
  to_account_id uuid not null,
  account_transfer_id uuid not null unique,
  amount_cents integer not null,
  contributed_on date not null,
  created_at timestamptz not null default now(),
  constraint savings_goal_contributions_amount_positive check (amount_cents > 0),
  constraint savings_goal_contributions_accounts_differ check (from_account_id <> to_account_id),
  constraint savings_goal_contributions_goal_owner_fk foreign key (user_id, savings_goal_id)
    references public.savings_goals(user_id, id)
    on delete restrict,
  constraint savings_goal_contributions_from_account_owner_fk foreign key (user_id, from_account_id)
    references public.financial_accounts(user_id, id)
    on delete restrict,
  constraint savings_goal_contributions_to_account_owner_fk foreign key (user_id, to_account_id)
    references public.financial_accounts(user_id, id)
    on delete restrict,
  constraint savings_goal_contributions_transfer_owner_fk foreign key (user_id, account_transfer_id)
    references public.account_transfers(user_id, id)
    on delete restrict
);

create index savings_goal_contributions_user_goal_date_idx
on public.savings_goal_contributions(user_id, savings_goal_id, contributed_on desc, created_at desc);

create function public.prevent_linked_savings_transfer_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.savings_goal_contributions as contribution
    where contribution.account_transfer_id = old.id
  ) then
    raise exception using
      errcode = '55000',
      message = 'Savings contribution transfers can only be reversed through the contribution flow.';
  end if;

  return new;
end;
$$;

create trigger account_transfers_prevent_linked_savings_update
before update on public.account_transfers
for each row execute function public.prevent_linked_savings_transfer_update();

create function public.prevent_untracked_savings_progress_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.current_amount_cents <> old.current_amount_cents
    and coalesce(current_setting('app.savings_contribution_change', true), '') <> 'allowed'
    and exists (
      select 1
      from public.financial_accounts as account
      where account.user_id = old.user_id
    )
  then
    raise exception using
      errcode = '55000',
      message = 'Use an account-backed savings contribution while accounts exist.';
  end if;

  return new;
end;
$$;

create trigger savings_goals_prevent_untracked_progress_change
before update of current_amount_cents on public.savings_goals
for each row execute function public.prevent_untracked_savings_progress_change();

create function public.record_savings_goal_contribution(
  p_savings_goal_id uuid,
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount_cents integer,
  p_contributed_on date default current_date
)
returns public.savings_goal_contributions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_goal_name text;
  v_target_amount_cents integer;
  v_current_amount_cents integer;
  v_source_account_id uuid;
  v_destination_account_id uuid;
  v_transfer_id uuid;
  v_contribution public.savings_goal_contributions;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception using errcode = '22023', message = 'Contribution amount must be greater than zero.';
  end if;

  if p_contributed_on is null then
    raise exception using errcode = '22023', message = 'Contribution date is required.';
  end if;

  if p_from_account_id = p_to_account_id then
    raise exception using errcode = '22023', message = 'Choose different source and savings accounts.';
  end if;

  select goal.name, goal.target_amount_cents, goal.current_amount_cents
  into v_goal_name, v_target_amount_cents, v_current_amount_cents
  from public.savings_goals as goal
  where goal.id = p_savings_goal_id
    and goal.user_id = v_user_id
    and goal.is_active
  for update;

  if v_goal_name is null then
    raise exception using errcode = 'P0002', message = 'Active savings goal was not found.';
  end if;

  if p_amount_cents > v_target_amount_cents - v_current_amount_cents then
    raise exception using errcode = '22023', message = 'Contribution cannot exceed the remaining goal amount.';
  end if;

  select account.id
  into v_source_account_id
  from public.financial_accounts as account
  where account.id = p_from_account_id
    and account.user_id = v_user_id
    and account.is_active
    and account.account_type in ('checking', 'cash')
  for update;

  if v_source_account_id is null then
    raise exception using errcode = 'P0002', message = 'An active checking or cash source account was not found.';
  end if;

  select account.id
  into v_destination_account_id
  from public.financial_accounts as account
  where account.id = p_to_account_id
    and account.user_id = v_user_id
    and account.is_active
    and account.account_type = 'savings'
  for update;

  if v_destination_account_id is null then
    raise exception using errcode = 'P0002', message = 'An active savings destination account was not found.';
  end if;

  insert into public.account_transfers (
    user_id,
    from_account_id,
    to_account_id,
    amount_cents,
    transferred_on,
    note
  )
  values (
    v_user_id,
    v_source_account_id,
    v_destination_account_id,
    p_amount_cents,
    p_contributed_on,
    concat('Savings contribution: ', v_goal_name)
  )
  returning id into v_transfer_id;

  insert into public.savings_goal_contributions (
    user_id,
    savings_goal_id,
    from_account_id,
    to_account_id,
    account_transfer_id,
    amount_cents,
    contributed_on
  )
  values (
    v_user_id,
    p_savings_goal_id,
    v_source_account_id,
    v_destination_account_id,
    v_transfer_id,
    p_amount_cents,
    p_contributed_on
  )
  returning * into v_contribution;

  perform set_config('app.savings_contribution_change', 'allowed', true);

  update public.savings_goals
  set current_amount_cents = current_amount_cents + p_amount_cents
  where id = p_savings_goal_id
    and user_id = v_user_id;

  return v_contribution;
end;
$$;

create function public.undo_savings_goal_contribution(
  p_contribution_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_goal_id uuid;
  v_transfer_id uuid;
  v_amount_cents integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  select contribution.savings_goal_id, contribution.account_transfer_id, contribution.amount_cents
  into v_goal_id, v_transfer_id, v_amount_cents
  from public.savings_goal_contributions as contribution
  where contribution.id = p_contribution_id
    and contribution.user_id = v_user_id
  for update;

  if v_goal_id is null then
    raise exception using errcode = 'P0002', message = 'Savings contribution was not found.';
  end if;

  perform 1
  from public.savings_goals as goal
  where goal.id = v_goal_id
    and goal.user_id = v_user_id
  for update;

  perform set_config('app.savings_contribution_change', 'allowed', true);

  update public.savings_goals
  set current_amount_cents = current_amount_cents - v_amount_cents
  where id = v_goal_id
    and user_id = v_user_id;

  delete from public.savings_goal_contributions
  where id = p_contribution_id
    and user_id = v_user_id;

  delete from public.account_transfers
  where id = v_transfer_id
    and user_id = v_user_id;
end;
$$;

alter table public.savings_goal_contributions enable row level security;

create policy "Users can view own savings contributions"
on public.savings_goal_contributions for select
using (user_id = auth.uid());

grant select on table public.savings_goal_contributions to authenticated, service_role;
revoke all on table public.savings_goal_contributions from anon;

revoke all on function public.prevent_linked_savings_transfer_update() from public;
revoke all on function public.prevent_untracked_savings_progress_change() from public;
revoke all on function public.record_savings_goal_contribution(uuid, uuid, uuid, integer, date) from public, anon;
revoke all on function public.undo_savings_goal_contribution(uuid) from public, anon;
grant execute on function public.record_savings_goal_contribution(uuid, uuid, uuid, integer, date) to authenticated, service_role;
grant execute on function public.undo_savings_goal_contribution(uuid) to authenticated, service_role;

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_household record;
  v_successor_user_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  select lower(email)
  into v_user_email
  from auth.users
  where id = v_user_id;

  insert into public.household_audit_events (
    household_id,
    actor_user_id,
    action,
    metadata
  )
  select
    invitation.household_id,
    v_user_id,
    'invitation.revoked',
    jsonb_build_object('role', invitation.role, 'reason', 'account_deleted')
  from public.household_invitations as invitation
  where invitation.accepted_at is null
    and invitation.revoked_at is null
    and (
      invitation.invited_by = v_user_id
      or invitation.invited_email = v_user_email
    );

  update public.household_invitations
  set revoked_at = now()
  where accepted_at is null
    and revoked_at is null
    and (
      invited_by = v_user_id
      or invited_email = v_user_email
    );

  for v_household in
    select household.id
    from public.households as household
    where household.owner_user_id = v_user_id
    order by household.created_at, household.id
    for update
  loop
    select member.user_id
    into v_successor_user_id
    from public.household_members as member
    where member.household_id = v_household.id
      and member.user_id <> v_user_id
    order by member.joined_at, member.user_id
    limit 1
    for update;

    if v_successor_user_id is null then
      insert into public.household_audit_events (
        household_id,
        actor_user_id,
        action,
        target_user_id,
        metadata
      ) values (
        v_household.id,
        v_user_id,
        'household.deleted',
        v_user_id,
        jsonb_build_object('reason', 'account_deleted')
      );

      delete from public.households where id = v_household.id;
    else
      update public.household_members
      set role = 'editor'
      where household_id = v_household.id
        and user_id = v_user_id;

      update public.household_members
      set role = 'owner'
      where household_id = v_household.id
        and user_id = v_successor_user_id;

      update public.households
      set owner_user_id = v_successor_user_id
      where id = v_household.id;

      insert into public.household_audit_events (
        household_id,
        actor_user_id,
        action,
        target_user_id,
        metadata
      ) values (
        v_household.id,
        v_user_id,
        'ownership.transferred',
        v_successor_user_id,
        jsonb_build_object('reason', 'account_deleted')
      );
    end if;
  end loop;

  insert into public.household_audit_events (
    household_id,
    actor_user_id,
    action,
    target_user_id,
    metadata
  )
  select
    member.household_id,
    v_user_id,
    'member.left',
    v_user_id,
    jsonb_build_object('role', member.role, 'reason', 'account_deleted')
  from public.household_members as member
  where member.user_id = v_user_id;

  delete from public.household_members where user_id = v_user_id;
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
  delete from public.savings_goal_contributions where user_id = v_user_id;
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
