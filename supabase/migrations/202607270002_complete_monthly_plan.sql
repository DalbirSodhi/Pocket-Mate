alter table public.savings_goals
add column monthly_contribution_cents integer not null default 0;

alter table public.savings_goals
add constraint savings_goals_monthly_contribution_non_negative
check (monthly_contribution_cents >= 0);

alter table public.recurring_expenses
add column source_expense_id uuid references public.expenses(id) on delete set null;

create unique index recurring_expenses_user_source_unique
on public.recurring_expenses(user_id, source_expense_id)
where source_expense_id is not null;

create unique index budget_caps_user_category_period_unique
on public.budget_caps(user_id, category_id, period);

update public.expense_categories
set color = case name
  when 'Housing' then '#1F2A44'
  when 'Food' then '#9C7B31'
  when 'Transport' then '#476553'
  when 'Shopping' then '#596783'
  when 'Health' then '#A33D4A'
  when 'Bills' then '#6B7280'
  when 'Entertainment' then '#8E6F39'
  when 'Other' then '#626A78'
  else color
end
where is_default = true;
