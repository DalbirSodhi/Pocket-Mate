# Pocket-Mate Product Brief

## Product Promise

Pocket-Mate helps users know what they can safely spend today while protecting savings first.

## First Product Focus

The first version is a personal finance app. Meal planning, gym reminders, and AI meal scanning are intentionally out of scope until the finance loop is useful and stable.

## Target Users

- Students and working adults who want daily control over spending.
- People paid weekly, bi-weekly, semi-monthly, or monthly.
- Users who prefer manual tracking before connecting bank accounts.
- Users who want simple guidance instead of complex finance dashboards.

## Core Problem

Most finance apps explain where money went after it is already spent. Pocket-Mate should help users decide what they can safely spend before they spend it.

## Differentiation

Pocket-Mate is not only an expense tracker. It is a daily spending decision assistant.

Key ideas:

- Safe-to-spend today.
- Savings-first budgeting.
- Paycheck-cycle budgeting.
- Budget pressure score.
- Mistake-friendly budget adjustments.
- Manual-first privacy.

## Finance MVP

The first complete version should include:

- User authentication.
- Profile setup.
- Income and paystub entries.
- Expense categories.
- Expense logging.
- Category spending caps.
- Savings goals.
- Dashboard summary.
- Safe-to-spend calculation.
- Budget pressure warning.
- Purchase-impact check before recording an expense.
- Recurring expenses and credit card statements.
- Editable bill payment plans with user-selected payment dates.
- Searchable monthly activity with correction and deletion controls.
- Monthly category insights that reconcile completed bill payments.
- Monthly reports and portable CSV transaction exports.
- Privacy-safe household monthly totals with explicit access roles and history.

## Non-Goals For First Version

- Bank account syncing.
- Investment tracking.
- Credit score.
- Meal planning.
- Gym scheduling.
- AI image analysis.
- Shared editing of another member's itemized transactions.

## Product Principle

Every core screen should answer at least one of these questions:

- Can I spend this today?
- Where did my money go?
- Am I still inside my limit?
- How much did I protect for savings?
- What happens if I make this purchase?

Finance totals must follow one cash-movement rule: unpaid bills are commitments,
while completed bill payments and recorded expenses are spending. Dashboard,
Activity, and Insights must reconcile to that same rule.

The Home dashboard presents three different values explicitly: calendar-month
balance is income minus completed spending, spendable cash is the current total
in checking and cash accounts, and after-plan money subtracts unpaid commitments
and protected savings. Safe-to-spend uses the lower of spendable cash and
after-plan money, divided across the days to the next configured payday.

Users own their finance records. Reports must be generated from owner-scoped
queries, remain on the user's device, and export standard CSV without sending
data through an additional analytics or file-storage service.

Household collaboration shares only each member's monthly income, spending,
and net totals. Transaction descriptions, notes, category details, cards, and
account balances remain owner-only. Owners manage invitations and roles;
editors and viewers can review the aggregate snapshot but cannot administer
the household or change another person's finance records.
