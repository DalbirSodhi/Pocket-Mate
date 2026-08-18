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
202608100001_add_household_collaboration.sql
202608130001_record_savings_contributions.sql
202608130002_harden_savings_transfer_links.sql
202608160001_add_recurring_income_schedules.sql
202608160002_add_account_balance_adjustments.sql
```

The transaction-planning migration adds month-specific budgets and rollovers,
expense splits and refunds, tags, deterministic categorization rules, and a
review queue. Split, refund, and expense-edit writes use protected functions so
ownership and cent-level reconciliation are enforced in one transaction.

The calendar-preferences migration adds RLS-protected local-reminder and
dashboard-display settings and includes them in transactional account deletion.

The import/debt migration adds reversible RLS-protected CSV staging, protected
post/rollback functions, duplicate indexes, and per-account debt assumptions.

The savings-contribution migration links goal progress to owned account
transfers, provides protected record/undo functions, and blocks direct mutation
of linked transfers.

The recurring-income migration adds owned schedule and occurrence tables plus
protected create, update, archive, delete, and idempotent receive functions.

The account-adjustment migration adds RLS-protected signed reconciliation rows
that correct computed balances without mutating historical transactions.
