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
  short-lived work branches
```

## Merge Flow

```text
feature/some-change -> pull request -> Development -> final merge -> main
```

## What CI Checks Today

The project is still in the documentation phase, so CI currently checks that documentation exists and is not empty.

## What CI Will Check After App Setup

Once the Expo app is added, the same workflow will automatically detect `package.json` and run:

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
