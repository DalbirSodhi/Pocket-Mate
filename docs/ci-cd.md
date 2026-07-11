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

CI checks that documentation exists, that the monorepo folders exist, and that the mobile app can run its package scripts.

## What CI Will Check After App Setup

The workflow detects `apps/mobile/package.json` and runs:

- dependency installation
- lint script, if present
- test script, if present

## Why This Matters

CI protects shared branches by checking changes before merge. It also teaches whether the project can be installed, linted, and tested in a clean machine environment.

## Later CD Steps

CD should be added after the app can run locally.

Future deployment steps:

- create Expo preview builds for pull requests
- create EAS builds for release branches
- deploy web preview if Expo web is enabled
- run Supabase migration checks before backend changes merge
