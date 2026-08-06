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
- [ ] Recurring calendar, local reminders, accessibility, and appearance controls.
- [ ] CSV import with duplicate review and reversible staging.
- [ ] Cash-flow trends and debt payoff scenarios.
- [ ] Household collaboration with explicit roles and audit history.
- [ ] Optional provider-backed bank sync, receipt OCR, investments, and credit data.

## Later Ideas

- Optional cloud backup.
- Optional bank sync.
- Meal planning.
- Gym reminders.
- AI meal photo analysis.
