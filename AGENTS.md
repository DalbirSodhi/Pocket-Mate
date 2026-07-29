# Pocket-Mate Development Rules

## Scope And Security

- Work only inside this repository and temporary build directories required by
  project tooling.
- Do not inspect, modify, or report unrelated files from the user's computer.
- Never print, commit, or expose environment values, tokens, passwords, or
  Supabase credentials.
- Do not use destructive Git commands or discard changes that were not created
  for the current task.

## Branch Workflow

- `Development` is the integration branch. `main` is release-only.
- Start every task from the latest `origin/Development`.
- Create one focused `feature/`, `fix/`, or `chore/` branch with a descriptive
  kebab-case name.
- Use conventional commit messages and never include agent or tool names.
- Push the task branch and create a pull request targeting `Development`.
- Merge the pull request only after required CI checks pass.
- After merging, delete the task branch, switch back to `Development`, and
  fast-forward it from `origin/Development`.
- Never merge or push to `main` unless the user explicitly requests a release.

## Quality Gate

- Run focused tests while developing, then the full test and lint commands
  before pushing.
- For mobile-facing changes, verify both web and iOS Expo production bundles.
- Validate Supabase migrations with a dry run before applying them.
- Do not merge when tests, lint, required CI, or database migrations fail.

## Delivery

- Provide the pull request title and a short description.
- Report the commit, verification results, migration status, and preview URLs.
