# Backend API Strategy

## Direction

Pocket-Mate should be backend-first for product features.

That means the app should define data contracts, validation rules, and backend boundaries before building final UI screens.

## First Backend Layer

The first backend layer is Supabase:

- Supabase Auth for identity.
- Supabase Postgres for finance data.
- Supabase Row Level Security for user-owned access.
- Supabase migrations for schema changes.
- Supabase Edge Functions for server-only endpoints when direct database access is not enough.

## Endpoint Strategy

Not every feature needs a custom HTTP endpoint on day one.

Use direct Supabase client access when:

- the operation is simple CRUD
- Row Level Security fully protects the data
- no private server-side secret is needed

Use Supabase Edge Functions when:

- the operation needs server-only secrets
- the operation combines multiple writes that need stricter control
- the operation calls an external API
- the operation should hide implementation details from the mobile app
- the operation needs custom rate limiting or audit behavior

## Mobile App Rule

React Native screens should not contain database logic.

Screens should call feature services:

```text
Screen -> hook/service -> API or repository adapter -> Supabase
```

This keeps the frontend simple and allows the backend implementation to change later.

## Initial API Contracts

Finance features should be designed around these contracts:

```text
createIncomeEntry(input)
listIncomeEntries(filters)
createExpense(input)
listExpenses(filters)
createCategory(input)
listCategories()
setBudgetCap(input)
listBudgetCaps()
createSavingsGoal(input)
getDashboardSummary(filters)
getSafeToSpendToday(filters)
```

## Future Split

If Pocket-Mate outgrows direct Supabase access, the backend can move toward:

```text
apps/api/
```

or:

```text
services/finance-api/
```

The mobile app should not need a major rewrite if the service boundaries are respected.
