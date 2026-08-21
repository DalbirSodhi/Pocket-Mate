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
deleteOwnAccount()
requestPasswordReset(email)
updatePassword(password)
createSessionFromUrl(url)
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

## Account Deletion

`deleteOwnAccount()` calls the authenticated `delete_own_account` database
function and then clears the local session. The function accepts no user ID;
the database derives ownership from `auth.uid()` and removes all related
finance data transactionally.

The UI must require the exact `DELETE` confirmation phrase and a separate final
destructive prompt. Users should be directed to export reports before deletion.

Navigation should wait until `isLoading` is false before deciding whether to
show authenticated or unauthenticated screens.

## Email Confirmation

Signup and resend requests redirect native confirmation links to:

```text
pocketmate://auth/callback
```

The signup screen keeps the pending address in memory and allows another
confirmation request after Supabase's one-minute cooldown. Delivery failures
must be shown as errors; the UI must not imply that an email was sent when the
Auth service rejected it.

Hosted environments must use custom SMTP before external testing. Supabase's
built-in mail service is not an application delivery channel and may reject
addresses outside the project team. Keep email confirmation enabled.

## Password Recovery

Password reset requests redirect to:

```text
pocketmate://reset-password
```

The mobile app registers the `pocketmate` URL scheme and passes callback URLs
through `createSessionFromUrl`. Recovery sessions show the new-password screen
before normal authenticated navigation resumes.

The same redirect must be allowed in the hosted Supabase Auth URL
configuration.
