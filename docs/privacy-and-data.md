# Privacy And Data Lifecycle

## Data Stored

Pocket-Mate stores the minimum account and finance data needed for the manual
planning experience:

- Supabase Auth identity and email.
- Profile name, currency, and pay-cycle preferences.
- Income, expenses, category splits, refunds, tags, and monthly budgets.
- Savings goals, recurring expenses, cards, statements, and payment plans.
- User-authored categorization rules and their review queue.

Pocket-Mate does not currently connect to bank accounts, collect card numbers,
or store card security codes. Saved cards contain only a user-provided nickname
and optional last four digits.

## Access Controls

The mobile app uses the public Supabase anonymous key. Every finance table uses
Row Level Security, and authenticated requests can access only rows owned by
`auth.uid()`. The service-role key is never included in the app.

## Data Export

Users can export monthly transaction reports as CSV from Settings or Monthly
Insights. The file is generated locally and is not uploaded to another storage
or analytics provider.

## Account Deletion

Users can permanently delete their account in Settings. The app requires the
exact confirmation phrase and a final destructive confirmation before calling
`public.delete_own_account()`.

The database function accepts no user identifier. It derives the target from
the authenticated JWT with `auth.uid()`, removes owned finance data in
dependency order, and deletes that Auth user in the same database transaction.
Anonymous clients cannot execute the function.

Deletion is immediate and cannot be undone. Users should export reports they
want to retain before deleting their account.
