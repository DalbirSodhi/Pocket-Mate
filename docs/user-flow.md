# Pocket-Mate User Flow

## Primary Flow

```mermaid
flowchart TD
    A["Open Pocket-Mate"] --> B{"Logged in?"}
    B -->|No| C["Welcome"]
    C --> D["Sign up or log in"]
    D --> E["Profile setup"]
    B -->|Yes| F["Dashboard"]
    E --> F

    F --> G["Add income"]
    F --> H["Add expense"]
    F --> I["Manage budgets"]
    F --> J["Manage savings"]
    F --> K["Review insights"]

    G --> F
    H --> F
    I --> F
    J --> F
    K --> F
```

## First-Time Setup

```mermaid
flowchart TD
    A["Create account"] --> B["Choose currency"]
    B --> C["Choose pay cycle"]
    C --> D["Add expected income"]
    D --> E["Create default categories"]
    E --> F["Set category caps"]
    F --> G["Set savings target"]
    G --> H["Open dashboard"]
```

## Daily Use Flow

```mermaid
flowchart TD
    A["Open app"] --> B["See safe-to-spend today"]
    B --> C{"Did user spend money?"}
    C -->|Yes| D["Add expense"]
    C -->|No| E["Mark no-spend day later"]
    D --> F["Update category usage"]
    F --> G["Update remaining balance"]
    G --> H["Update budget pressure"]
    H --> I["Return to dashboard"]
```

Saving a one-time, recurring, or card-bill expense must close the entry flow and
return to the dashboard. A successful save must never leave the user on a form
that appears frozen.

## Bill Payment Plan Flow

```mermaid
flowchart TD
    A["Open an upcoming bill"] --> B["Review statement total and due date"]
    B --> C["Revise total if the statement changed"]
    C --> D["Choose equal or custom amounts"]
    D --> E["Select a date for every payment"]
    E --> F["Save 2 to 8 payments within 12 months"]
    F --> G["Mark a completed payment"]
    G --> H["Move that amount from committed to spent"]
    H --> I["Refresh available and safe-to-spend amounts"]
    I --> J{"Balance changed?"}
    J -->|Yes| C
    J -->|No| K["Continue plan"]
```

Completed installments are immutable history while remaining installments can
be rescheduled. A card statement total cannot be reduced below the amount
already paid. Dates after the issuer due date are allowed for planning but must
show an interest-and-fee warning.

## Planned Purchase Flow

```mermaid
flowchart TD
    A["User enters planned purchase"] --> B["Choose amount and category"]
    B --> C["Calculate impact"]
    C --> D{"Inside budget?"}
    D -->|Yes| E["Show safe result"]
    D -->|No| F["Show warning and alternatives"]
    E --> G["User confirms or cancels"]
    F --> G
```

## Main Navigation

```text
Dashboard
Expenses
Budgets
Savings
Settings
```

## Dashboard Requirements

The dashboard should make these visible without digging:

- Safe-to-spend today.
- Income this cycle.
- Spent this cycle.
- Savings protected.
- Remaining balance.
- Days until next payday.
- Category warnings.
- Recent expenses.
- Paid bill installments included in spent and available totals.
- Remaining bill installments included in committed totals.
