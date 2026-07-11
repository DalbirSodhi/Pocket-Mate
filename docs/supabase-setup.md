# Supabase Setup

## Project

Pocket-Mate uses Supabase for:

- authentication
- Postgres database
- Row Level Security
- future Edge Functions
- future file storage

## Local Config

The local Supabase config lives at:

```text
supabase/config.toml
```

The first migration lives at:

```text
supabase/migrations/202607110001_create_finance_core.sql
```

## Environment Variables

The mobile app should only use public Supabase values:

```text
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

These values are safe to include in the mobile app because database access is protected by Supabase Auth and Row Level Security.

## Secret Handling

Never put this key in the mobile app:

```text
SUPABASE_SERVICE_ROLE_KEY
```

The service role key bypasses Row Level Security and should only be used in server-only code such as Supabase Edge Functions or a future backend API.

## Mobile App Setup

Create a local env file from the example:

```text
apps/mobile/.env
```

Use:

```text
apps/mobile/.env.example
```

as the template.

## Backend-First Flow

For finance features, prefer this order:

1. create or update migration
2. confirm RLS policies
3. define service/API contract
4. wire mobile UI to the service boundary

Screens should not directly own database logic.
