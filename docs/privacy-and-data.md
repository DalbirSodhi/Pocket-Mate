# Privacy And Data Lifecycle

## Data Stored

Pocket-Mate stores the minimum account and finance data needed for the manual
planning experience:

- Supabase Auth identity and email.
- Profile name, currency, and pay-cycle preferences.
- Income, expenses, category splits, refunds, tags, and monthly budgets.
- Savings goals, recurring expenses, cards, statements, and payment plans.
- User-authored categorization rules and their review queue.
- Reminder and dashboard display preferences.
- CSV import batches, normalized staging rows, and optional debt payoff settings.
- Household membership, invitation state, roles, and access-change audit events.

Pocket-Mate does not currently connect to bank accounts, collect card numbers,
or store card security codes. Saved cards contain only a user-provided nickname
and optional last four digits.

Bill, recurring-charge, and payday reminders are scheduled locally by the
operating system. Pocket-Mate does not request or store a remote push token for
this feature. Each device rebuilds its own reminder schedule from user-owned
finance records and preferences.

CSV files are read locally. Pocket-Mate sends only normalized staging rows to
the user's RLS-protected Supabase tables; the original file is not uploaded.
Posted batches retain duplicate fingerprints and result identifiers so users
can reverse an import. Rolling back deletes the ledger entries created by that
batch and preserves the batch as auditable history.

## Local Session Storage

On web, Supabase authentication follows the browser storage behavior expected
by Supabase's JavaScript client. On native Expo builds, Pocket-Mate encrypts the
stored Supabase session payload before writing it locally. The encryption key is
stored through Expo SecureStore so the full session is not kept as readable
AsyncStorage text.

Legacy native sessions written before this protection are migrated the next
time Supabase reads the session. If migration or decryption fails, the local
session is cleared and the user signs in again instead of seeing a stale or
partially authenticated app state.

## Error Reports

Pocket-Mate can send crash reports to
`EXPO_PUBLIC_ERROR_REPORTING_ENDPOINT` when that public endpoint is configured.
Reports are redacted before they leave the app: email addresses, token-shaped
values, secret query parameters, currency amounts, and long card-like numbers
are replaced with placeholders. The reporter is intentionally provider-neutral
so a future Sentry or PostHog integration can reuse the same privacy boundary.

## Access Controls

The mobile app uses the public Supabase anonymous key. Every finance table uses
Row Level Security, and authenticated requests can access only rows owned by
`auth.uid()`. The service-role key is never included in the app.

Household collaboration is a narrow exception implemented through protected
database functions. An authenticated member can request a monthly aggregate
containing member display names, roles, income totals, spending totals, and net
totals. The function does not return itemized transactions, notes, categories,
cards, account identifiers, or balances. Direct finance-table RLS remains
owner-only.

Household invitations use random, expiring, single-use codes. Only a hash is
stored, and acceptance requires the authenticated account email to match the
invited email. Owners alone can invite, change roles, or remove members. Every
membership change is recorded in the household audit history.

Pocket-Mate intentionally does not request bank credentials or provider access
tokens. Bank synchronization is deferred until the product has mature consent,
support, monitoring, and incident-response processes.

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

If the deleting user owns a household with other members, ownership transfers
to an existing member before deletion. Otherwise the empty household is
removed. Account deletion never deletes another member's private finance data.

Deletion is immediate and cannot be undone. Users should export reports they
want to retain before deleting their account.
