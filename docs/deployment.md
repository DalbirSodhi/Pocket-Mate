# Deployment Guide

Pocket-Mate uses Expo Application Services (EAS) for native builds. Run every
Expo and EAS command from `apps/mobile`, which is the app root inside this
repository.

Linked EAS project: `@dalbir-tech/pocket-mate`

## Deployment Environments

| EAS profile | Environment | Artifact | Intended use |
| --- | --- | --- | --- |
| `development` | `development` | Development client | Local coding with Metro |
| `development-simulator` | `development` | iOS simulator app | Simulator testing without Apple signing |
| `preview` | `preview` | Installable internal app | Device testing without a laptop server |
| `production` | `production` | Store binary | TestFlight, App Store, and Play Store |

The permanent native identifiers are:

```text
iOS:     com.dalbirsodhi.pocketmate
Android: com.dalbirsodhi.pocketmate
```

Do not rename these after the first store records or signed builds are created.

## Local Development

Create `apps/mobile/.env` from `apps/mobile/.env.example`, then run:

```bash
cd apps/mobile
npm ci
npm run start:go
```

`start:go` preserves the Expo Go workflow. After installing a development
client, use `npm run start:dev-client` instead.

## Link The Expo Project

The project is linked. The Expo account owner can repeat these commands only
when repairing the local CLI session. Browser login prevents credentials from
being placed in commands or repository files.

```bash
cd apps/mobile
npx eas-cli@21.4.0 login --browser
npx eas-cli@21.4.0 project:info
```

The generated EAS project ID is committed in `app.json`. The project ID is
public configuration, not a secret.

## Configure EAS Environments

Create both variables below in the Expo project for the `development`,
`preview`, and `production` environments:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
```

Optional public value for redacted crash-report delivery:

```text
EXPO_PUBLIC_ERROR_REPORTING_ENDPOINT
```

They can be entered under the Expo project environment-variable settings or
with `eas env:create`. Client-side values are readable from a compiled app even
when a dashboard labels them sensitive. Supabase Auth and Row Level Security,
not key secrecy, protect user data.

Never create or upload this value for the mobile app:

```text
SUPABASE_SERVICE_ROLE_KEY
```

For now all environments may point to the same hosted Supabase project. Before
external beta testing, create a separate preview Supabase project so test data
cannot mix with production data.

## Build For Testing

### Expo Go

Requires Metro to keep running on the development computer:

```bash
npm run start:go
```

### Development Client

Requires Metro while actively coding, but supports native modules unavailable
in Expo Go:

```bash
npm run build:development:ios
npm run start:dev-client
```

### Standalone Preview

Runs on a phone without Metro or a laptop server:

```bash
npm run build:preview:ios
```

An iOS internal build uses ad hoc signing. A paid Apple Developer membership is
required, and each iPhone must be registered before the build:

```bash
npx eas-cli@21.4.0 device:create
npm run build:preview:ios
```

EAS returns an installation URL when the build succeeds. Registering another
iPhone later requires a new build or a re-signed build containing that device.

## Production Release

1. Merge tested work from `Development` into `main`.
2. Update the public `version` in `app.json` for a new release line.
3. Run `npm run release:check`, `npm run lint`, and `npm test`.
4. Trigger `npm run build:production` from a clean `main` checkout.
5. Test the iOS build in TestFlight and the Android build in an internal track.
6. Submit iOS with `npm run submit:production:ios` after adding the App Store
   Connect app ID to the production submit profile.
7. Complete privacy, support, screenshots, age-rating, and data-safety details
   in the store consoles before review.
8. Verify report export and in-app account deletion against the production
   Supabase project before submission.

The production profile uses remote build-number management and auto-increments
store build versions. The public app version remains an intentional source
change because it also defines EAS Update runtime compatibility.

## GitHub Build Workflow

`.github/workflows/eas-build.yml` is a manual CD workflow. It avoids consuming
EAS build quota for every pull request.

Before using it:

1. Complete one interactive build for each target platform so EAS has signing
   credentials.
2. Create an Expo access token.
3. Save it as the `EXPO_TOKEN` GitHub Actions repository secret.
4. Open GitHub Actions, choose **EAS Build**, select the platform and profile,
   and run the workflow.

Production builds are rejected unless the workflow runs from `main`.

## Release Safety

- Local `.env` files, signing files, provisioning profiles, and private keys
  remain ignored by Git and EAS uploads.
- `npm run release:check` validates identifiers, versions, build profiles, and
  required assets without reading secret values.
- Pull-request CI runs tests, lint, Expo Doctor, release validation, and local
  Supabase security tests before merge.
- EAS Update is enabled only after the Expo project is linked and the first
  native preview build has passed. This avoids publishing JavaScript updates to
  an unverified native runtime.
