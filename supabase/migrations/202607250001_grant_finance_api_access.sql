grant usage on schema public to authenticated, service_role;

revoke all privileges on table
  public.profiles,
  public.income_entries,
  public.expense_categories,
  public.expenses,
  public.budget_caps,
  public.savings_goals
from anon;

grant select, insert, update, delete on table
  public.profiles,
  public.income_entries,
  public.expense_categories,
  public.expenses,
  public.budget_caps,
  public.savings_goals
to authenticated, service_role;
