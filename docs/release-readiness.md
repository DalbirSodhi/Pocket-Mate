# Release Readiness

Audit date: 2026-08-10
Updated: 2026-08-10
Branch: `feature/improve-beta-reliability`
Baseline commit: `06703d4`

## Verdict

Pocket-Mate's JavaScript application is buildable for web and iOS, its current
unit suite passes, Expo reports compatible dependencies, and release
configuration validation passes. It is **not ready for a public store release**
yet because two Expo/Metro build-time advisories need an upstream resolution,
no signed build or real-device release flow was tested during this audit, and
manual offline/session QA still needs to be repeated on a physical iPhone.

This verdict applies to release readiness, not ordinary Expo Go development.

## Verification Run

The following commands were run from `apps/mobile` unless noted otherwise.

| Command | Result | Evidence |
| --- | --- | --- |
| `npm test` | Pass | 117 tests passed, 0 failed. |
| `npm run lint` | Pass | Expo ESLint completed with no findings. |
| `npm run release:check` | Pass | App identifiers, assets, runtime policy, and EAS profiles validated. |
| `npx expo-doctor` | Pass | 18 of 18 checks passed. |
| `npx expo export --platform web --output-dir /private/tmp/pocket-mate-release-audit-web --clear` | Pass | Web bundle exported successfully. |
| `npx expo export --platform ios --output-dir /private/tmp/pocket-mate-release-audit-ios --clear` | Pass | iOS Hermes bundle exported successfully. |
| `npx expo export --platform all --output-dir /private/tmp/pocket-mate-household-all --clear` | Pass | Web, iOS, and Android bundles exported successfully. |
| `npm run audit:production` | Conditional pass | Non-breaking fixes were applied; only two exact Expo/Metro `image-size` advisories are temporarily allowlisted through 2026-09-30. |
| `npx supabase --agent no status` from the repository root | Blocked | Docker and Podman were unavailable, so local schema lint and policy tests were not run. |

The remaining high findings reach the Expo/Metro build toolchain through
`image-size`. The suggested forced resolution would downgrade Expo to SDK 53,
so it must not be applied blindly. CI permits only the two named advisories and
expires that exception on 2026-09-30; every other high or critical advisory
still fails. Resolve this with an Expo-compatible update and rerun Expo Doctor
plus all platform exports.

## Verified Capabilities

Automated tests exercise deterministic behavior for:

- Account balances, transfers, card purchases, statements, and payments.
- Monthly dashboard totals, commitments, safe-to-spend calculations, and plan
  health.
- Income, expense, split, refund, categorization-rule, and validation math.
- Budget rollover chains, payment-plan rebalancing, purchase impact, calendar
  projections, debt payoff, trends, and monthly insights.
- CSV normalization, duplicate detection, rollback-oriented import metadata,
  and spreadsheet-safe report export.
- Account-deletion confirmation and household input/role rules.
- Offline/error classification, versioned dashboard cache parsing, and
  calendar-date behavior across leap days, month ends, and daylight-saving
  boundaries.

These tests validate pure calculations and contracts. They do not prove hosted
Supabase availability, notification delivery, navigation behavior, or a full
signed-app workflow.

The in-app browser surface was unavailable during this run, so a screenshot-
based UI/accessibility audit could not be completed. Bundle compilation and
source-level accessibility checks are not substitutes for visual inspection.

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
- Authentication sessions persist in AsyncStorage and refresh only while the
  native app is active.
- Expired local sessions are cleared during startup so the app returns to
  authentication instead of showing a false connected state.
- CI includes Supabase schema lint and database policy/function tests.
- Production EAS builds are rejected outside `main`, and production builds use
  a separate EAS environment name.
- CSV source files stay local; only normalized rows are sent to Supabase.

Residual security risks:

- Supabase sessions use AsyncStorage rather than OS keychain storage. This is
  acceptable for the current Expo architecture but increases exposure on a
  compromised device; evaluate secure native storage before public release.
- Two build-time parser advisories remain a public-release blocker. Their
  narrow CI exception is time-limited and does not apply to new advisories.
- Hosted RLS behavior was not independently verified in this run. Required CI
  database checks must pass on the final pull request and release commit.
- There is no crash-reporting or production error-observability integration.

## CI Review

The pull-request workflow installs from the lockfile and runs documentation
checks, lint, tests, dependency audit, release validation, Expo Doctor, local
database lint, and database policy tests. The EAS workflow requires an Expo
token, supports development/preview/production profiles, and prevents
production builds from non-`main` branches.

Remaining CI risks:

- GitHub Actions are pinned to mutable major-version tags rather than immutable
  commit SHAs, leaving avoidable workflow supply-chain exposure.
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
- Add bundle compilation to CI or run repeatable web, iOS, and Android bundle
  checks for every release candidate.
- Complete the physical-device checklist and record results by app version and
  build number.
- Produce and test signed preview builds before merging `Development` to `main`.
- Configure store privacy, support, data-safety, screenshots, and account-
  deletion disclosures before submission.
