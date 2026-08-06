begin;

create extension if not exists pgtap with schema extensions;

select plan(32);

select has_table(
  'public',
  table_name,
  format('public.%s exists', table_name)
)
from unnest(array[
  'profiles',
  'income_entries',
  'expense_categories',
  'expenses',
  'budget_caps',
  'savings_goals',
  'recurring_expenses',
  'credit_cards',
  'credit_card_bills',
  'bill_payment_plans',
  'bill_payment_installments'
  ,'financial_accounts'
  ,'account_transfers'
  ,'expense_splits'
  ,'expense_refunds'
  ,'budget_templates'
  ,'budget_periods'
  ,'budget_allocations'
  ,'tags'
  ,'expense_tags'
  ,'categorization_rules'
  ,'review_items'
  ,'user_preferences'
  ,'transaction_import_batches'
  ,'transaction_import_rows'
  ,'debt_settings'
]) as table_name;

select is(
  (
    select count(*)
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public'
      and pg_class.relname = any(array[
        'profiles',
        'income_entries',
        'expense_categories',
        'expenses',
        'budget_caps',
        'savings_goals',
        'recurring_expenses',
        'credit_cards',
        'credit_card_bills',
        'bill_payment_plans',
        'bill_payment_installments'
        ,'financial_accounts'
        ,'account_transfers'
        ,'expense_splits'
        ,'expense_refunds'
        ,'budget_templates'
        ,'budget_periods'
        ,'budget_allocations'
        ,'tags'
        ,'expense_tags'
        ,'categorization_rules'
        ,'review_items'
        ,'user_preferences'
        ,'transaction_import_batches'
        ,'transaction_import_rows'
        ,'debt_settings'
      ])
      and pg_class.relrowsecurity
  ),
  26::bigint,
  'RLS is enabled on every user-owned table'
);

select ok(
  not exists (
    select 1
    from unnest(array[
      'profiles',
      'income_entries',
      'expense_categories',
      'expenses',
      'budget_caps',
      'savings_goals',
      'recurring_expenses',
      'credit_cards',
      'credit_card_bills',
      'bill_payment_plans',
      'bill_payment_installments'
      ,'financial_accounts'
      ,'account_transfers'
      ,'expense_splits'
      ,'expense_refunds'
      ,'budget_templates'
      ,'budget_periods'
      ,'budget_allocations'
      ,'tags'
      ,'expense_tags'
      ,'categorization_rules'
      ,'review_items'
      ,'user_preferences'
      ,'transaction_import_batches'
      ,'transaction_import_rows'
      ,'debt_settings'
    ]) as table_name
    where has_table_privilege(
      'anon',
      format('public.%I', table_name),
      'SELECT, INSERT, UPDATE, DELETE'
    )
  ),
  'anonymous users have no finance-table privileges'
);

select ok(
  (
    select bool_and(
      has_table_privilege(
        'authenticated',
        format('public.%I', table_name),
        'SELECT, INSERT, UPDATE, DELETE'
      )
    )
    from unnest(array[
      'profiles',
      'income_entries',
      'expense_categories',
      'expenses',
      'budget_caps',
      'savings_goals',
      'recurring_expenses',
      'credit_cards',
      'credit_card_bills'
      ,'financial_accounts'
      ,'account_transfers'
      ,'budget_templates'
      ,'budget_periods'
      ,'budget_allocations'
      ,'tags'
      ,'expense_tags'
      ,'categorization_rules'
      ,'review_items'
      ,'user_preferences'
      ,'transaction_import_batches'
      ,'transaction_import_rows'
      ,'debt_settings'
    ]) as table_name
  ),
  'authenticated users can manage RLS-protected finance rows'
);

select ok(
  (
    select bool_and(
      has_table_privilege(
        'authenticated',
        format('public.%I', table_name),
        'SELECT'
      )
      and not has_table_privilege(
        'authenticated',
        format('public.%I', table_name),
        'INSERT, UPDATE, DELETE'
      )
    )
    from unnest(array[
      'bill_payment_plans',
      'bill_payment_installments'
      ,'expense_splits'
      ,'expense_refunds'
    ]) as table_name
  ),
  'bill-plan tables are read-only outside protected functions'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.save_bill_payment_plan(uuid,uuid,date,integer,jsonb)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.set_bill_payment_installment_paid(uuid,boolean)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.save_expense_splits(uuid,jsonb)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.create_expense_refund(uuid,integer,date,uuid,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.update_expense_entry(uuid,uuid,uuid,integer,date,text,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.ensure_budget_period(date)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.save_budget_allocation(date,uuid,integer,text,boolean)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.remove_budget_allocation(date,uuid,boolean)',
    'EXECUTE'
  ),
  'anonymous users cannot execute protected finance functions'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.save_bill_payment_plan(uuid,uuid,date,integer,jsonb)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.set_bill_payment_installment_paid(uuid,boolean)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.save_expense_splits(uuid,jsonb)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.create_expense_refund(uuid,integer,date,uuid,text)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.update_expense_entry(uuid,uuid,uuid,integer,date,text,text)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.ensure_budget_period(date)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.save_budget_allocation(date,uuid,integer,text,boolean)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.remove_budget_allocation(date,uuid,boolean)',
    'EXECUTE'
  ),
  'authenticated users can execute protected finance functions'
);

select * from finish();

rollback;
