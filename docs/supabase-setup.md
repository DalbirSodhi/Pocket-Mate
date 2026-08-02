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

The mobile Supabase client lives at:

```text
apps/mobile/src/infrastructure/supabase/client.js
```

Environment access is centralized at:

```text
apps/mobile/src/config/env.js
```

Do not create Supabase clients directly inside screens. Import the shared client or call feature services that use it.

EAS builds load these same public values from explicit `development`,
`preview`, and `production` environments. Configuration steps are documented in
[deployment.md](./deployment.md). Never place local `.env` files or a service
role key in an EAS build profile.

Auth screens should call the auth feature service documented in [auth-service-contract.md](./auth-service-contract.md).

The hosted Supabase Auth redirect allow list includes:

```text
http://localhost:8081
pocketmate://reset-password
```

The web app uses its current origin for password recovery. Native builds use the
`pocketmate` URL scheme.

After reviewing the proposed diff, deploy linked project configuration with:

```bash
npx supabase config push
```

Do not accept unrelated hosted configuration changes. Email confirmation, TOTP
MFA support, the eight-character OTP setting, and the one-minute email rate
limit are intentionally preserved in `supabase/config.toml`.

## Backend-First Flow

For finance features, prefer this order:

1. create or update migration
2. confirm RLS policies
3. define service/API contract
4. wire mobile UI to the service boundary

Screens should not directly own database logic.

## Local Database Security Tests

Database tests live in:

```text
supabase/tests/database/
```

Run them against an isolated local stack:

```bash
npx supabase start
npx supabase db lint --local --level warning
npx supabase test db
```

The tests verify that every user-owned table has RLS enabled, anonymous users
have no finance access, authenticated users only see their own rows, and
security-definer bill-plan functions reject cross-user operations. CI creates a
fresh local database from migrations and never runs these tests against hosted
user data.
