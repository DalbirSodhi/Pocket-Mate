# Release Readiness

Audit date: 2026-08-18
Updated: 2026-08-24
Branch: `fix/mobile-release-candidate-audit`
Development baseline: `d39f66f`

## Android Release Candidate Update

Version `1.0.2` adds Android-safe encrypted-session storage, explicit keyboard
resize behavior, keyboard-aware scrolling on every editable long screen, a
non-translucent status bar, and disabled Android cloud backup. Navigation and
keyboard contracts now fail tests when a screen introduces an unreachable route
or an editable layout without keyboard protection.

The linked Supabase project accepted a live confirmation-required signup after
the custom SMTP correction. The database migration dry run reports that local
and remote schemas are current. A fresh signed preview APK must still be
installed and exercised on a physical Android device before public release.

## Manual Finance Controls Update

This milestone closes the highest-value gaps found in a manual-first comparison
with YNAB, Monarch, Copilot, Rocket Money, and EveryDollar. It adds recurring
income plans, multi-cadence repeating expenses, auditable account balance
reconciliation, editable budgets and savings goals, row-level CSV assignment,
and a dashboard entry point for transactions awaiting review.

Both migrations were dry-run before application and are recorded on the linked
development project as `202608160001` and `202608160002`.

## Verdict

Pocket-Mate's JavaScript application is buildable for web, iOS, and Android,
its current unit suite passes, Expo reports compatible dependencies, and
release configuration validation passes. It is **not ready for a public store
release** yet because two Expo/Metro build-time advisories need an upstream
resolution and the new Android release candidate still requires physical-device
session, keyboard, notification, and offline testing.

This verdict applies to release readiness, not ordinary Expo Go development.

## Verification Run

The following commands were run from `apps/mobile` unless noted otherwise.

| Command | Result | Evidence |
| --- | --- | --- |
| `npm test` | Pass | 158 tests passed, 0 failed. |
| `npm run lint` | Pass | Expo ESLint completed with no findings. |
| `npm run release:check` | Pass | App identifiers, assets, runtime policy, and EAS profiles validated. |
| `npx expo-doctor` | Pass | 18 of 18 checks passed. |
| `npx expo export --platform web --output-dir /private/tmp/pocket-mate-rc-web-102 --clear` | Pass | Web bundle exported successfully. |
| `npx expo export --platform ios --output-dir /private/tmp/pocket-mate-rc-ios-102 --clear` | Pass | iOS Hermes bundle exported successfully. |
| `npx expo export --platform android --output-dir /private/tmp/pocket-mate-rc-android-102 --clear` | Pass | Android Hermes bundle exported successfully. |
| `npm run audit:production` | Pass | No unapproved high or critical production advisories found. |
| `npx supabase --agent no db push --linked --dry-run` from the repository root | Pass | Remote database is up to date; no migrations are pending. |
| `npx supabase --agent no db push --linked` from the repository root | Pass | Both migrations applied to the linked project. |
| `npx supabase --agent no migration list --linked` from the repository root | Pass | Local and remote history match through `202608160002`. |

The remaining high findings reach the Expo/Metro build toolchain through
`image-size`. The suggested forced resolution would downgrade Expo to SDK 53,
so it must not be applied blindly. CI permits only the two named advisories and
expires that exception on 2026-09-30; every other high or critical advisory
still fails. Resolve this with an Expo-compatible update and rerun Expo Doctor
plus all platform exports.

## Verified Capabilities

Automated tests exercise deterministic behavior for:

- Account balances, transfers, card purchases, statements, and payments.
- Account-backed savings transfers, contribution undo, and linked-transfer protection.
- Monthly dashboard totals, commitments, safe-to-spend calculations, and plan
  health.
- Income, expense, split, refund, categorization-rule, and validation math.
- Budget rollover chains, payment-plan rebalancing, purchase impact, calendar
  projections, debt payoff, trends, and monthly insights.
- Recurring-income projections, short-month anchors, recurring-expense cadence,
  and signed account reconciliation.
- CSV normalization, duplicate detection, rollback-oriented import metadata,
  and spreadsheet-safe report export.
- Account-deletion confirmation and household input/role rules.
- Offline/error classification, versioned dashboard cache parsing, and
  calendar-date behavior across leap days, month ends, and daylight-saving
  boundaries.
- Registered navigation targets, dynamic expense destinations, keyboard-safe
  editable screens, and Android keyboard/security release configuration.

These tests validate pure calculations and contracts. They do not prove hosted
Supabase availability, notification delivery, navigation behavior, or a full
signed-app workflow.

The in-app browser surface was still unavailable after reconnecting, so a
screenshot-based UI/accessibility audit could not be completed. Bundle
compilation and source-level accessibility checks are not substitutes for
visual inspection.

## Accessibility

Shared UI controls now provide stable programmatic labels and states for form
fields, date fields, buttons, loading indicators, notices, and screen headings.
Validation and status messages use live-region semantics so updates can be
announced without requiring focus to move. A focused source-contract test
protects these shared semantics, and the web/iOS bundles compile with them.

Before release, complete manual VoiceOver, keyboard, and large-text checks.
Automated source checks cannot validate reading order, focus restoration after
navigation, text clipping at accessibility sizes, gesture alternatives, or
spoken output from native date pickers.

## Security And Privacy

Verified controls:

- The app accepts only the public Supabase URL and anonymous key.
- No service-role value or private signing material was found in tracked app
  configuration. Example files contain empty placeholders only.
- Authentication sessions persist in browser storage on web. On native, the
  Supabase session payload is encrypted before it is stored locally, and the
  encryption key is kept in Expo SecureStore.
- Expired local sessions are cleared during startup so the app returns to
  authentication instead of showing a false connected state.
- CI includes Supabase schema lint and database policy/function tests.
- Production EAS builds are rejected outside `main`, and production builds use
  a separate EAS environment name.
- CSV source files stay local; only normalized rows are sent to Supabase.
- A top-level crash boundary prevents render failures from leaving a blank
  screen, and the optional error-reporting endpoint receives only redacted
  events.

Residual security risks:

- Two build-time parser advisories remain a public-release blocker. Their
  narrow CI exception is time-limited and does not apply to new advisories.
- Hosted RLS behavior was not independently verified in this run. Required CI
  database checks must pass on the final pull request and release commit.
- Error reporting is provider-neutral. Configure
  `EXPO_PUBLIC_ERROR_REPORTING_ENDPOINT` or wire the existing reporter to a
  provider such as Sentry before public release if richer crash triage is
  needed.

## CI Review

The pull-request workflow installs from the lockfile and runs documentation
checks, lint, tests, dependency audit, release validation, Expo Doctor, local
database lint, database policy tests, and explicit web/iOS/Android Expo bundle
exports. The EAS workflow requires an Expo token, supports
development/preview/production profiles, and prevents production builds from
non-`main` branches.

Remaining CI risks:

- GitHub Actions are pinned to immutable commit SHAs with comments noting the
  source tag.
- EAS reruns the app quality gate, while database policy tests remain the
  responsibility of required pull-request CI before a release branch is built.

## Manual Expo Go And iOS Checklist

These checks were **not run during this code audit** and remain required on a
physical iPhone:

- [ ] Start with `npm run start:go`, scan the QR code, and confirm a clean launch
  without a red screen or stale cached bundle.
- [ ] Sign up, verify email if enabled, sign in, sign out, reset the password,
  and reopen the app to verify session restoration.
- [ ] Complete onboarding and confirm currency/pay-cycle changes survive a
  restart.
- [ ] Add, edit, and delete income and expenses; confirm dashboard, activity,
  account balances, reports, and insights reconcile after each change.
- [ ] Create a card bill, split its payment plan, edit dates and total amount,
  mark a chunk paid, and confirm available cash changes once.
- [ ] Import and roll back a CSV batch using a real Files document.
- [ ] Schedule reminders, deny and grant notification permission, and verify a
  local notification arrives after the app is backgrounded.
- [ ] Export a monthly CSV and open the shared file.
- [ ] Test offline launch, cached-dashboard fallback, network loss during save,
  retry behavior, and session expiry.
- [ ] Run VoiceOver through authentication and one finance-entry flow; test
  accessibility text sizes, reduced motion, and landscape/tablet layouts where
  supported.
- [ ] Install a signed preview build and repeat critical flows without Metro.

## Deferred Provider Sync

Bank and provider sync remains intentionally deferred. A credible implementation
requires provider contracts, supported-region coverage, consent and revocation
flows, webhook verification, token vaulting, data-retention rules, incident
response, and ongoing compliance/support work. Requesting bank access before the
product has established trust would add security and onboarding risk without
improving the current manual-planning core.

Manual accounts, CSV import, deterministic duplicate handling, and reversible
imports provide useful portability without collecting bank credentials. Future
sync should be isolated behind a provider adapter and server-side token boundary;
no provider secret should ever ship in the Expo client.

## Release Exit Criteria

- Resolve or formally risk-accept the npm audit findings without an unsupported
  Expo downgrade.
- Require successful project and database CI on the final pull request.
- Keep repeatable web, iOS, and Android bundle checks green for every release
  candidate.
- Complete the physical-device checklist and record results by app version and
  build number.
- Produce and test signed preview builds before merging `Development` to `main`.
- Configure store privacy, support, data-safety, screenshots, and account-
  deletion disclosures before submission.
