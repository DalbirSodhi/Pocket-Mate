# Pocket-Mate Roadmap

## Phase 1: Foundation

- Product brief.
- User flow.
- System design.
- Database design.
- UI direction.
- Expo app scaffold.
- Project folder structure.

## Phase 2: Finance Core

- Authentication.
- Profile setup.
- Currency and pay-cycle settings.
- Income entries.
- Expense categories.
- Expense entries.
- Budget caps.
- Savings goals.
- Recurring expenses and credit card statements.
- Dynamic bill payment plans.

## Phase 3: Decision Dashboard

- Safe-to-spend today.
- Budget pressure score.
- Remaining balance.
- Category progress.
- Recent expense list.
- Savings progress.
- Paid-installment cash flow and remaining bill commitments.
- Purchase-impact guidance using available cash, commitments, daily pace, and
  category caps.

## Phase 4: Quality And Trust

- [x] Input validation.
- [x] Finance calculation tests.
- [x] RLS policy and protected-function tests.
- [x] Recoverable error states on primary data screens.
- [x] Initial loading states that do not display false zero balances.
- [x] Empty states for dashboard, activity, budgets, savings, bills, and cards.
- [x] Offline-aware dashboard fallback using the last saved summary.
- [x] Duplicate-submit guards and offline save messaging for primary money flows.
- [x] Session-expiry handling that returns users to authentication.

## Phase 5: Deployment

- [x] Supabase project configuration and secret boundaries.
- [x] Development, preview, and production environment configuration.
- [x] Expo development-client profile while preserving Expo Go.
- [x] Installable EAS preview profile.
- [x] Manual GitHub Actions build workflow.
- [x] Store-readiness and internal iOS distribution checklist.
- [x] Link the Expo account and EAS project.
- [ ] Register an iPhone and create the first Apple-signed preview build.

## Phase 6: Transaction Control And Insights

- [x] Monthly activity ledger with income, spending, and net totals.
- [x] Search and filter activity by month, type, and expense category.
- [x] Income and one-time expense detail, edit, and delete flows.
- [x] Reconcile completed bill payments with dashboard spending.
- [x] Monthly category breakdown with budget-cap status.
- [x] Dashboard drill-down to filtered activity and full insights.

## Phase 7: Data Portability And Reports

- [x] Monthly report with reconciled income, spending, and net totals.
- [x] Monthly category breakdown and transaction count.
- [x] CSV export through native sharing and web download.
- [x] Spreadsheet-formula protection for user-entered CSV fields.
- [x] Settings and Insights navigation to reports.

## Phase 8: Privacy And Account Lifecycle

- [x] In-app self-service account deletion.
- [x] Authenticated-only deletion contract with no client-provided user ID.
- [x] Transactional cleanup for every user-owned finance table.
- [x] Typed confirmation and final destructive confirmation.
- [x] Privacy and data-lifecycle documentation.

## Phase 9: Accounts And Transaction Planning

- [x] Manual asset and liability accounts with transfer-safe balances.
- [x] Statement versus purchase-tracked credit-card reconciliation.
- [x] Expense category splits with exact cent reconciliation.
- [x] Partial and full refunds that update account and spending totals.
- [x] Calendar-month budget snapshots with optional signed rollovers.
- [x] Tags, deterministic category rules, and an explicit review queue.
- [x] Recurring calendar, local reminders, accessibility, and appearance controls.
- [x] CSV import with duplicate review and reversible staging.
- [x] Cash-flow trends and debt payoff scenarios.
- [x] Household collaboration with explicit roles, aggregate-only sharing, and audit history.
- [ ] Optional provider-backed bank sync, receipt OCR, investments, and credit data.

## Phase 10: Finance Planning Completion

- [x] Payday frequency and anchor-date setup in onboarding and settings.
- [x] First-run checklist for income, spendable accounts, category limits, and savings.
- [x] Separate calendar-month balance, actual spendable cash, and after-plan money.
- [x] Cap safe-to-spend by checking/cash while excluding protected savings.
- [x] Account-backed savings contributions with atomic transfer and undo history.
- [x] Edit and delete controls for recurring expenses and unpaid card statements.
- [x] Require a funding account before completing a credit-card payment.
- [x] Paginate account and dashboard history beyond the API row limit.

## Phase 11: Manual Finance Controls

- [x] Recurring income plans with weekly, biweekly, twice-monthly, and monthly schedules.
- [x] Project expected income on the planning calendar and post it once when received.
- [x] Weekly, biweekly, monthly, and yearly repeating expense schedules.
- [x] Account balance reconciliation with auditable, reversible corrections.
- [x] Edit and delete savings goals without breaking linked contributions.
- [x] Edit existing category budgets and preserve rollover behavior.
- [x] Review CSV category and account assignments row by row before posting.
- [x] Surface pending categorization work on the dashboard.

Provider-backed bank sync remains deliberately deferred. Manual entry and
reviewed CSV imports keep the current product useful without asking early users
to grant financial-institution access. A provider integration should begin only
after the manual finance loop, privacy disclosures, incident response process,
and production support model are stable.

## Later Ideas

- Optional cloud backup.
- Optional bank sync.
- Meal planning.
- Gym reminders.
- AI meal photo analysis.
