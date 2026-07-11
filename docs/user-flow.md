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
