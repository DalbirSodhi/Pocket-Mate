# Auth Service Contract

## Goal

The mobile UI should not call Supabase Auth directly from screens. Screens should call the auth feature service.

## Mobile Service

Auth service entrypoint:

```text
apps/mobile/src/features/auth/index.js
```

Implementation:

```text
apps/mobile/src/features/auth/services/authService.js
```

## Supported Operations

```text
signUpWithEmail({ email, password, displayName })
signInWithEmail({ email, password })
signOut()
getCurrentSession()
getCurrentUser()
subscribeToAuthChanges(callback)
```

## Validation Rules

The first contract validates:

- email must be present and contain `@`
- password must be at least 8 characters
- email is trimmed and lowercased before auth calls
- display name is trimmed and saved into Supabase user metadata when present

## Profile Creation

Profile row creation is intentionally not handled in this service yet.

Reason:

- Supabase email confirmation settings can change the timing of authenticated sessions.
- The `profiles` table is protected by Row Level Security.
- Profile setup should be handled as its own feature after auth state is available.

## UI Rule

Auth screens should import from:

```text
apps/mobile/src/features/auth
```

They should not import:

```text
apps/mobile/src/infrastructure/supabase/client.js
```

## Auth State

The app root is wrapped with `AuthProvider`. Screens and navigators can read the
current authentication state with:

```js
import { useAuthSession } from '../features/auth';

const {
  session,
  user,
  isAuthenticated,
  isLoading,
  error,
} = useAuthSession();
```

The provider:

- restores the persisted session when the app starts
- listens for sign-in, sign-out, and token refresh events
- unsubscribes when it is unmounted
- exposes loading and initialization error states

Navigation should wait until `isLoading` is false before deciding whether to
show authenticated or unauthenticated screens.
