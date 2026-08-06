# Supabase Migrations

Database tables, indexes, triggers, and Row Level Security policies will live here.

The first real migration should create the finance core:

- profiles
- income_entries
- expense_categories
- expenses
- budget_caps
- savings_goals

Current migrations:

```text
202607110001_create_finance_core.sql
202607250001_grant_finance_api_access.sql
202607270001_add_recurring_expenses_and_card_bills.sql
202607270002_complete_monthly_plan.sql
202607270003_add_pay_cycle_anchor.sql
202607290001_add_bill_payment_plans.sql
202607310001_make_bill_payment_plans_dynamic.sql
202608040001_add_account_deletion.sql
202608050001_add_financial_accounts.sql
202608050002_add_transaction_planning.sql
202608060001_add_calendar_preferences.sql
202608060002_add_imports_and_debt_settings.sql
```

The transaction-planning migration adds month-specific budgets and rollovers,
expense splits and refunds, tags, deterministic categorization rules, and a
review queue. Split, refund, and expense-edit writes use protected functions so
ownership and cent-level reconciliation are enforced in one transaction.

The calendar-preferences migration adds RLS-protected local-reminder and
dashboard-display settings and includes them in transactional account deletion.

The import/debt migration adds reversible RLS-protected CSV staging, protected
post/rollback functions, duplicate indexes, and per-account debt assumptions.
