# Pocket-Mate

Pocket-Mate is a JavaScript finance-planning app built with Expo, React Native,
and Supabase. It tracks monthly income and spending, fixed commitments, credit
card bills, installment plans, budgets, savings goals, and safe-to-spend
guidance.

## Repository

```text
apps/mobile/       Expo mobile and web app
packages/shared/   Shared package boundary
supabase/          Database migrations, functions, and pgTAP tests
docs/              Product, architecture, security, and deployment decisions
```

## Run Locally

```bash
cd apps/mobile
cp .env.example .env
npm ci
npm run start:go
```

Add the hosted Supabase URL and public anon key to `apps/mobile/.env`. Never use
the Supabase service-role key in the app.

## Verify

```bash
cd apps/mobile
npm run lint
npm test
npm run audit:production
npm run release:check
npx expo-doctor
```

Database security tests run in CI against an isolated local Supabase stack.

## Documentation

- [Product brief](docs/product-brief.md)
- [System design](docs/system-design.md)
- [Database schema](docs/database-schema.md)
- [CI/CD](docs/ci-cd.md)
- [Deployment](docs/deployment.md)
- [Roadmap](docs/roadmap.md)
