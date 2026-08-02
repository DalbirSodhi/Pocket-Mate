# CI/CD Plan

## Current Workflow

The repository uses GitHub Actions for automatic checks.

Workflow file:

```text
.github/workflows/ci.yml
```

## Branch Strategy

Development should happen in short-lived branches created from `Development`.

```text
main
  stable release branch

Development
  integration branch for active work

feature/*
chore/*
  short-lived work branches
```

## Merge Flow

```text
feature/some-change -> pull request -> Development -> final merge -> main
chore/some-change -> pull request -> Development -> final merge -> main
```

## What CI Checks Today

The workflow validates the repository structure and runs:

- dependency installation
- mobile lint
- JavaScript finance calculation tests
- production dependency audit that blocks high and critical advisories
- Expo dependency compatibility checks
- EAS release configuration and native identifier validation
- a clean local Supabase stack built from migrations
- Postgres schema linting at warning level
- pgTAP tests for RLS isolation, table privileges, and protected bill-plan
  functions

Database tests use fixed synthetic users inside transactions. They never connect
to or modify the hosted Supabase project.

## Why This Matters

CI protects shared branches by checking changes before merge. It also teaches whether the project can be installed, linted, and tested in a clean machine environment.

## Deployment Workflow

Native builds are configured in `apps/mobile/eas.json`. GitHub Actions includes
a manual `EAS Build` workflow so preview or production builds are intentional
and do not consume build quota on every pull request.

The workflow requires the `EXPO_TOKEN` repository secret and one successful
interactive EAS build for each platform before it can run non-interactively.
Production builds are accepted only from `main`.

See [deployment.md](./deployment.md) for environment setup, physical iPhone
registration, preview builds, and the store release checklist.
