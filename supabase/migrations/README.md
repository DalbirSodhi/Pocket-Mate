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
```
