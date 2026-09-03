# Pocket-Mate System Architecture

Updated: 2026-09-02

Pocket-Mate is a feature-oriented Expo application backed by Supabase. The
mobile client is a modular monolith: presentation, feature services, pure
financial calculations, and infrastructure adapters are separated without
adding network boundaries that the current product does not need.

## Runtime Architecture

```mermaid
flowchart TB
    User[User]

    subgraph Client[Expo React Native client]
        UI[Screens and React Navigation]
        Features[Feature modules]
        Services[Feature services]
        Logic[Validation and financial calculations]
        Infrastructure[Supabase, network, pagination, and observability adapters]
    end

    subgraph Device[Device capabilities]
        SecureStore[SecureStore encryption keys]
        LocalStore[Encrypted session and dashboard cache]
        Notifications[Local financial reminders]
        Files[CSV import and report sharing]
    end

    subgraph Backend[Supabase]
        Auth[Authentication]
        DataAPI[PostgREST Data API]
        Functions[PostgreSQL RPC functions]
        RLS[Row Level Security]
        Database[(PostgreSQL)]
    end

    SMTP[Custom Gmail SMTP]
    EAS[Expo EAS Build and Update]

    User --> UI
    UI --> Features
    Features --> Services
    Features --> Logic
    Services --> Infrastructure
    Infrastructure --> Auth
    Infrastructure --> DataAPI
    Infrastructure --> Functions
    DataAPI --> RLS
    Functions --> RLS
    RLS --> Database
    Auth --> SMTP
    Infrastructure --> SecureStore
    Infrastructure --> LocalStore
    Features --> Notifications
    Features --> Files
    EAS --> Client
```

## Financial Write Flow

```mermaid
sequenceDiagram
    actor User
    participant Screen as React Native screen
    participant Service as Feature service
    participant API as Supabase API or RPC
    participant RLS as Row Level Security
    participant DB as PostgreSQL
    participant Cache as Local dashboard cache

    User->>Screen: Submit income, expense, bill, or plan
    Screen->>Screen: Validate and normalize input
    Screen->>Service: Execute use case
    Service->>API: Send authenticated request
    API->>RLS: Enforce user or household ownership
    RLS->>DB: Commit data or atomic function
    DB-->>Service: Return saved state
    Service->>API: Reload affected monthly data
    API-->>Service: Return current records
    Service->>Service: Recalculate totals and safe-to-spend
    Service->>Cache: Cache read-only dashboard summary
    Service-->>Screen: Render current state
```

## Delivery Architecture

```mermaid
flowchart LR
    Branch[Feature, fix, or chore branch] --> PR[Pull request]
    PR --> CI[GitHub Actions CI]
    CI --> JS[Lint, tests, and dependency audit]
    CI --> DB[Local Supabase RLS and function tests]
    CI --> Bundles[Web, iOS, and Android bundles]
    JS --> Development[Development branch]
    DB --> Development
    Bundles --> Development
    Development --> Preview[EAS internal preview builds]
    Development --> Main[Main release branch]
    Main --> Production[EAS production builds and updates]
    Migrations[Versioned SQL migrations] --> HostedDB[Hosted Supabase project]
```

## Security Boundaries

- The client contains only the public Supabase URL and anonymous key.
- Supabase Row Level Security is the authorization boundary for every user and
  household record.
- Multi-record operations such as imports and bill payment plans use database
  functions when they require atomic behavior.
- Native authentication sessions are encrypted before AsyncStorage persistence;
  encryption keys remain in SecureStore.
- Provider secrets, SMTP credentials, service-role keys, and future AI keys must
  remain in hosted server configuration and never enter an Expo bundle.

## Scaling Direction

Add server-side boundaries only when required. AI assistance should use a
Supabase Edge Function or separately deployed API. Receipt storage should sit
behind a storage adapter. Redis is unnecessary for the current workload; add a
cache only after measurement shows repeated expensive server queries that
PostgreSQL indexes, pagination, or materialized summaries cannot address.

## Development Availability

The Free Plan can pause the hosted project after sustained low database
activity. `.github/workflows/supabase-activity.yml` performs a read-only,
RLS-protected database request three times daily. It requires repository secrets
named `SUPABASE_URL` and `SUPABASE_ANON_KEY`; neither value is stored in Git.
