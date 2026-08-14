create or replace function public.prevent_linked_savings_transfer_update()
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

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger account_transfers_prevent_linked_savings_update
on public.account_transfers;

create trigger account_transfers_prevent_linked_savings_update
before update or delete on public.account_transfers
for each row execute function public.prevent_linked_savings_transfer_update();

revoke all on function public.prevent_linked_savings_transfer_update() from public;
