create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint households_name_not_empty check (
    char_length(trim(name)) between 1 and 80
  )
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id),
  constraint household_members_one_household_per_user unique (user_id),
  constraint household_members_role_check check (
    role in ('owner', 'editor', 'viewer')
  )
);

alter table public.households
add constraint households_owner_membership_fk
foreign key (id, owner_user_id)
  references public.household_members(household_id, user_id)
  deferrable initially deferred;

create unique index household_members_one_owner_idx
on public.household_members(household_id)
where role = 'owner';

create table public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  invited_email text not null,
  role text not null,
  token_hash bytea not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint household_invitations_email_normalized check (
    invited_email = lower(trim(invited_email))
    and invited_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  constraint household_invitations_role_check check (
    role in ('editor', 'viewer')
  ),
  constraint household_invitations_token_hash_unique unique (token_hash),
  constraint household_invitations_expiration_check check (
    expires_at > created_at
  ),
  constraint household_invitations_terminal_state_check check (
    accepted_at is null or revoked_at is null
  )
);

create unique index household_invitations_one_open_email_idx
on public.household_invitations(household_id, invited_email)
where accepted_at is null and revoked_at is null;

create index household_invitations_household_created_idx
on public.household_invitations(household_id, created_at desc);

create table public.household_audit_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint household_audit_events_action_not_empty check (
    char_length(trim(action)) > 0
  ),
  constraint household_audit_events_metadata_object check (
    jsonb_typeof(metadata) = 'object'
  )
);

create index household_audit_events_household_created_idx
on public.household_audit_events(household_id, created_at desc);

create trigger households_set_updated_at
before update on public.households
for each row execute function public.set_updated_at();

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invitations enable row level security;
alter table public.household_audit_events enable row level security;

create function public.is_household_member(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.household_members as member
    where member.household_id = p_household_id
      and member.user_id = auth.uid()
  );
$$;

create function public.is_household_owner(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.households as household
    where household.id = p_household_id
      and household.owner_user_id = auth.uid()
  );
$$;

create policy "Members can view their household"
on public.households for select
using (public.is_household_member(id));

create policy "Members can view household membership"
on public.household_members for select
using (public.is_household_member(household_id));

create policy "Owners can view household invitations"
on public.household_invitations for select
using (public.is_household_owner(household_id));

create policy "Members can view household audit events"
on public.household_audit_events for select
using (public.is_household_member(household_id));

revoke all on table
  public.households,
  public.household_members,
  public.household_invitations,
  public.household_audit_events
from public, anon, authenticated;

grant select on table
  public.households,
  public.household_members,
  public.household_invitations,
  public.household_audit_events
to authenticated;

grant all on table
  public.households,
  public.household_members,
  public.household_invitations,
  public.household_audit_events
to service_role;

create function public.create_household(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_household_id uuid;
  v_name text := nullif(trim(p_name), '');
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  if v_name is null or char_length(v_name) > 80 then
    raise exception using errcode = '22023', message = 'Household name must contain between 1 and 80 characters.';
  end if;

  if exists (
    select 1 from public.household_members where user_id = v_user_id
  ) then
    raise exception using errcode = '23505', message = 'You already belong to a household.';
  end if;

  insert into public.households (name, owner_user_id)
  values (v_name, v_user_id)
  returning id into v_household_id;

  insert into public.household_members (household_id, user_id, role)
  values (v_household_id, v_user_id, 'owner');

  insert into public.household_audit_events (
    household_id,
    actor_user_id,
    action,
    target_user_id
  ) values (
    v_household_id,
    v_user_id,
    'household.created',
    v_user_id
  );

  return v_household_id;
end;
$$;

create function public.create_household_invitation(
  p_household_id uuid,
  p_email text,
  p_role text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(trim(p_email));
  v_role text := lower(trim(p_role));
  v_token text;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  perform 1
  from public.households
  where id = p_household_id
    and owner_user_id = v_user_id
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'Only the household owner can create invitations.';
  end if;

  if v_email is null or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception using errcode = '22023', message = 'Enter a valid email address.';
  end if;

  if v_role is null or v_role not in ('editor', 'viewer') then
    raise exception using errcode = '22023', message = 'Invitation role must be editor or viewer.';
  end if;

  if exists (
    select 1
    from public.household_members as member
    join auth.users as invited_user on invited_user.id = member.user_id
    where member.household_id = p_household_id
      and lower(invited_user.email) = v_email
  ) then
    raise exception using errcode = '23505', message = 'This user already belongs to the household.';
  end if;

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
    jsonb_build_object('role', invitation.role, 'reason', 'replaced')
  from public.household_invitations as invitation
  where invitation.household_id = p_household_id
    and invitation.invited_email = v_email
    and invitation.accepted_at is null
    and invitation.revoked_at is null;

  update public.household_invitations
  set revoked_at = now()
  where household_id = p_household_id
    and invited_email = v_email
    and accepted_at is null
    and revoked_at is null;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.household_invitations (
    household_id,
    invited_email,
    role,
    token_hash,
    expires_at,
    invited_by
  ) values (
    p_household_id,
    v_email,
    v_role,
    extensions.digest(v_token, 'sha256'),
    now() + interval '7 days',
    v_user_id
  );

  insert into public.household_audit_events (
    household_id,
    actor_user_id,
    action,
    metadata
  ) values (
    p_household_id,
    v_user_id,
    'invitation.created',
    jsonb_build_object('role', v_role)
  );

  return v_token;
end;
$$;

create function public.accept_household_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_invitation public.household_invitations%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  if nullif(trim(p_token), '') is null then
    raise exception using errcode = '22023', message = 'Invitation token is required.';
  end if;

  select lower(email)
  into v_user_email
  from auth.users
  where id = v_user_id;

  if v_user_email is null then
    raise exception using errcode = '42501', message = 'The authenticated account has no verified identity.';
  end if;

  select invitation.*
  into v_invitation
  from public.household_invitations as invitation
  where invitation.token_hash = extensions.digest(trim(p_token), 'sha256')
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Invitation is invalid.';
  end if;

  if v_invitation.accepted_at is not null then
    raise exception using errcode = 'P0001', message = 'Invitation has already been accepted.';
  end if;

  if v_invitation.revoked_at is not null then
    raise exception using errcode = 'P0001', message = 'Invitation has been revoked.';
  end if;

  if v_invitation.expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'Invitation has expired.';
  end if;

  if v_invitation.invited_email <> v_user_email then
    raise exception using errcode = '42501', message = 'This invitation belongs to another email address.';
  end if;

  if exists (
    select 1 from public.household_members where user_id = v_user_id
  ) then
    raise exception using errcode = '23505', message = 'You already belong to a household.';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (v_invitation.household_id, v_user_id, v_invitation.role);

  update public.household_invitations
  set accepted_at = now()
  where id = v_invitation.id;

  insert into public.household_audit_events (
    household_id,
    actor_user_id,
    action,
    target_user_id,
    metadata
  ) values (
    v_invitation.household_id,
    v_user_id,
    'invitation.accepted',
    v_user_id,
    jsonb_build_object('role', v_invitation.role)
  );

  return v_invitation.household_id;
end;
$$;

create function public.update_household_member_role(
  p_household_id uuid,
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_owner_user_id uuid;
  v_previous_role text;
  v_role text := lower(trim(p_role));
begin
  if v_actor_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  select owner_user_id
  into v_owner_user_id
  from public.households
  where id = p_household_id
  for update;

  if v_owner_user_id is null then
    raise exception using errcode = 'P0002', message = 'Household was not found.';
  end if;

  if v_owner_user_id <> v_actor_user_id then
    raise exception using errcode = '42501', message = 'Only the household owner can change member roles.';
  end if;

  if v_role is null or v_role not in ('owner', 'editor', 'viewer') then
    raise exception using errcode = '22023', message = 'Member role must be owner, editor, or viewer.';
  end if;

  select role
  into v_previous_role
  from public.household_members
  where household_id = p_household_id
    and user_id = p_user_id
  for update;

  if v_previous_role is null then
    raise exception using errcode = 'P0002', message = 'Household member was not found.';
  end if;

  if v_previous_role = v_role then
    return;
  end if;

  if p_user_id = v_owner_user_id and v_role <> 'owner' then
    raise exception using errcode = '22023', message = 'Transfer ownership before changing the owner role.';
  end if;

  if v_role = 'owner' then
    update public.household_members
    set role = 'editor'
    where household_id = p_household_id
      and user_id = v_owner_user_id;

    update public.household_members
    set role = 'owner'
    where household_id = p_household_id
      and user_id = p_user_id;

    update public.households
    set owner_user_id = p_user_id
    where id = p_household_id;

    insert into public.household_audit_events (
      household_id,
      actor_user_id,
      action,
      target_user_id,
      metadata
    ) values (
      p_household_id,
      v_actor_user_id,
      'ownership.transferred',
      p_user_id,
      jsonb_build_object('previousOwnerUserId', v_owner_user_id)
    );

    return;
  end if;

  update public.household_members
  set role = v_role
  where household_id = p_household_id
    and user_id = p_user_id;

  insert into public.household_audit_events (
    household_id,
    actor_user_id,
    action,
    target_user_id,
    metadata
  ) values (
    p_household_id,
    v_actor_user_id,
    'member.role_updated',
    p_user_id,
    jsonb_build_object('previousRole', v_previous_role, 'role', v_role)
  );
end;
$$;

create function public.remove_household_member(
  p_household_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_owner_user_id uuid;
  v_target_role text;
begin
  if v_actor_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  select owner_user_id
  into v_owner_user_id
  from public.households
  where id = p_household_id
  for update;

  if v_owner_user_id is null then
    raise exception using errcode = 'P0002', message = 'Household was not found.';
  end if;

  if v_actor_user_id <> v_owner_user_id and v_actor_user_id <> p_user_id then
    raise exception using errcode = '42501', message = 'Only the owner can remove another household member.';
  end if;

  select role
  into v_target_role
  from public.household_members
  where household_id = p_household_id
    and user_id = p_user_id
  for update;

  if v_target_role is null then
    raise exception using errcode = 'P0002', message = 'Household member was not found.';
  end if;

  if v_target_role = 'owner' then
    raise exception using errcode = '22023', message = 'Transfer ownership before the owner leaves.';
  end if;

  insert into public.household_audit_events (
    household_id,
    actor_user_id,
    action,
    target_user_id,
    metadata
  ) values (
    p_household_id,
    v_actor_user_id,
    case when v_actor_user_id = p_user_id then 'member.left' else 'member.removed' end,
    p_user_id,
    jsonb_build_object('role', v_target_role)
  );

  delete from public.household_members
  where household_id = p_household_id
    and user_id = p_user_id;
end;
$$;

create function public.get_household_monthly_summary(
  p_household_id uuid,
  p_month_start date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_month_end date;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  if p_month_start is null
    or p_month_start <> date_trunc('month', p_month_start)::date
  then
    raise exception using errcode = '22023', message = 'Month start must be the first day of a month.';
  end if;

  if not public.is_household_member(p_household_id) then
    raise exception using errcode = '42501', message = 'Household membership is required.';
  end if;

  v_month_end := (p_month_start + interval '1 month')::date;

  with member_base as (
    select
      member.user_id,
      member.role,
      member.joined_at,
      coalesce(nullif(trim(profile.display_name), ''), 'Household member') as display_name
    from public.household_members as member
    left join public.profiles as profile on profile.id = member.user_id
    where member.household_id = p_household_id
  ),
  income_totals as (
    select income.user_id, sum(income.amount_cents)::bigint as amount_cents
    from public.income_entries as income
    join member_base as member on member.user_id = income.user_id
    where income.received_on >= p_month_start
      and income.received_on < v_month_end
    group by income.user_id
  ),
  expense_totals as (
    select expense.user_id, sum(expense.amount_cents)::bigint as amount_cents
    from public.expenses as expense
    join member_base as member on member.user_id = expense.user_id
    left join public.credit_cards as card
      on card.user_id = expense.user_id
      and card.financial_account_id = expense.account_id
    where expense.spent_on >= p_month_start
      and expense.spent_on < v_month_end
      and (card.id is null or card.tracking_mode = 'transactions')
    group by expense.user_id
  ),
  refund_totals as (
    select refund.user_id, sum(refund.amount_cents)::bigint as amount_cents
    from public.expense_refunds as refund
    join member_base as member on member.user_id = refund.user_id
    join public.expenses as expense
      on expense.id = refund.expense_id
      and expense.user_id = refund.user_id
    left join public.credit_cards as card
      on card.user_id = expense.user_id
      and card.financial_account_id = expense.account_id
    where refund.refunded_on >= p_month_start
      and refund.refunded_on < v_month_end
      and (card.id is null or card.tracking_mode = 'transactions')
    group by refund.user_id
  ),
  direct_statement_payments as (
    select bill.user_id, sum(bill.amount_cents)::bigint as amount_cents
    from public.credit_card_bills as bill
    join member_base as member on member.user_id = bill.user_id
    join public.credit_cards as card
      on card.id = bill.credit_card_id
      and card.user_id = bill.user_id
    where bill.paid_on >= p_month_start
      and bill.paid_on < v_month_end
      and card.tracking_mode = 'statement'
      and not exists (
        select 1
        from public.bill_payment_plans as plan
        where plan.credit_card_bill_id = bill.id
          and plan.user_id = bill.user_id
      )
    group by bill.user_id
  ),
  installment_payments as (
    select installment.user_id, sum(installment.amount_cents)::bigint as amount_cents
    from public.bill_payment_installments as installment
    join member_base as member on member.user_id = installment.user_id
    join public.bill_payment_plans as plan
      on plan.id = installment.payment_plan_id
      and plan.user_id = installment.user_id
    left join public.credit_card_bills as bill
      on bill.id = plan.credit_card_bill_id
      and bill.user_id = plan.user_id
    left join public.credit_cards as card
      on card.id = bill.credit_card_id
      and card.user_id = bill.user_id
    where installment.paid_on >= p_month_start
      and installment.paid_on < v_month_end
      and (
        plan.recurring_expense_id is not null
        or (plan.credit_card_bill_id is not null and card.tracking_mode = 'statement')
      )
    group by installment.user_id
  ),
  member_totals as (
    select
      member.user_id,
      member.display_name,
      member.role,
      member.joined_at,
      coalesce(income.amount_cents, 0)::bigint as income_cents,
      (
        coalesce(expense.amount_cents, 0)
        - coalesce(refund.amount_cents, 0)
        + coalesce(direct_payment.amount_cents, 0)
        + coalesce(installment.amount_cents, 0)
      )::bigint as spent_cents
    from member_base as member
    left join income_totals as income on income.user_id = member.user_id
    left join expense_totals as expense on expense.user_id = member.user_id
    left join refund_totals as refund on refund.user_id = member.user_id
    left join direct_statement_payments as direct_payment
      on direct_payment.user_id = member.user_id
    left join installment_payments as installment
      on installment.user_id = member.user_id
  )
  select jsonb_build_object(
    'monthStart', p_month_start,
    'householdIncomeCents', coalesce(sum(income_cents), 0),
    'householdSpentCents', coalesce(sum(spent_cents), 0),
    'householdNetCents', coalesce(sum(income_cents - spent_cents), 0),
    'members', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'userId', user_id,
          'displayName', display_name,
          'role', role,
          'incomeCents', income_cents,
          'spentCents', spent_cents,
          'netCents', income_cents - spent_cents
        ) order by joined_at, user_id
      ),
      '[]'::jsonb
    )
  )
  into v_result
  from member_totals;

  return v_result;
end;
$$;

revoke all on function public.is_household_member(uuid) from public, anon;
revoke all on function public.is_household_owner(uuid) from public, anon;
revoke all on function public.create_household(text) from public, anon;
revoke all on function public.create_household_invitation(uuid, text, text) from public, anon;
revoke all on function public.accept_household_invitation(text) from public, anon;
revoke all on function public.update_household_member_role(uuid, uuid, text) from public, anon;
revoke all on function public.remove_household_member(uuid, uuid) from public, anon;
revoke all on function public.get_household_monthly_summary(uuid, date) from public, anon;

grant execute on function public.is_household_member(uuid) to authenticated, service_role;
grant execute on function public.is_household_owner(uuid) to authenticated, service_role;
grant execute on function public.create_household(text) to authenticated, service_role;
grant execute on function public.create_household_invitation(uuid, text, text) to authenticated, service_role;
grant execute on function public.accept_household_invitation(text) to authenticated, service_role;
grant execute on function public.update_household_member_role(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.remove_household_member(uuid, uuid) to authenticated, service_role;
grant execute on function public.get_household_monthly_summary(uuid, date) to authenticated, service_role;

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

comment on table public.households is
  'A privacy-safe collaboration boundary with one active household per user.';
comment on function public.get_household_monthly_summary(uuid, date) is
  'Returns member-level monthly aggregates without exposing itemized transactions.';
comment on function public.delete_own_account() is
  'Deletes the authenticated account, transferring owned households to the earliest remaining member.';
