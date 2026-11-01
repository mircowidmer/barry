# Builds

Barry has three app variants.
Each has its own bundle identifier, so all three can be installed on one phone at the same time.
`APP_VARIANT` picks the variant, and `app.config.js` applies it on top of `app.json`.

| Variant | Name under the icon | Bundle identifier | URL scheme | Backend | JavaScript |
| --- | --- | --- | --- | --- | --- |
| `development` | Barry Dev | `support.barry.dev` | `barry-dev` | Supabase on your Mac, from `.env.local` | From Metro on your Mac, through the development client |
| `preview` | Barry Preview | `support.barry.preview` | `barry-preview` | The hosted project | Built into the app |
| `production` | Barry | `support.barry` | `barry` | The hosted project | Built into the app |

Every variant needs iOS 26 or later (`ios.deploymentTarget` in `app.json`), because the Check In button sits in the tab bar's bottom accessory, which iOS 26 introduced.

Without `APP_VARIANT`, the config is `production`.
The npm scripts `start`, `ios` and `android` set `development`.
Only the development variant asks for Local Network access, because only it talks to Metro.
The sign-up confirmation page opens `barry://sign-in`, so it opens the production app.

## Build in the cloud with EAS

`eas.json` has one build profile per variant, plus `development-simulator` for the iOS Simulator.
The preview and production profiles carry the hosted Supabase URL and publishable key.
The publishable key is meant to ship inside the app, so it is not a secret.

```bash
npm run build:dev
```

```bash
npm run build:dev:simulator
```

```bash
npm run build:preview
```

```bash
npm run build:production
```

```bash
npm run submit:production
```

- `build:dev` makes a development client for registered iPhones.
  Install it once, then run `npm start` on your Mac and open Barry Dev on the phone.
- `build:dev:simulator` makes the same development client for the iOS Simulator.
  It needs no Apple account.
- `build:preview` is for testers on registered iPhones.
  It talks to the hosted project.
- `build:production` is for TestFlight and the App Store.
  EAS counts up the build number on every production build, because `eas.json` sets `"appVersionSource": "remote"` and `"autoIncrement": true`.
  The version that users see, `1.0.0`, stays in `app.json`.
- `submit:production` uploads the latest production build to App Store Connect.
  The first run asks for the App Store Connect app.

### Before the first cloud build

- EAS builds for an iPhone need a paid Apple Developer Program membership.
  A free personal team works only for local builds, and its builds expire after 7 days.
- `app.json` links Barry to the EAS project `@musharosky/barry` (`extra.eas.projectId`).
  Log in with `npx eas-cli@latest login` as `musharosky`.
  The Expo website may show the same account under the name `mircowidmer`.
  `npx eas-cli@latest whoami` shows who is logged in.
- With a paid team, EAS signs the Push Notifications capability itself.
  `BARRY_WITHOUT_PUSH` is for local builds with the free team and for the unsigned Simulator build in CI.

## Build on your Mac

[How to run Barry on your iPhone](iphone.md) builds the development and production variants locally with Xcode; `npm run iphone:production` does it for the production variant in one command.
`ios/` is generated for one variant at a time, so switching variants needs `npx expo prebuild --clean` with the new `APP_VARIANT`.

## Build on GitHub

The `ios` job of `.github/workflows/ci.yml` builds the production variant in Release for the iOS Simulator on a macOS runner, without signing and with `BARRY_WITHOUT_PUSH=1`, so without the Push entitlement and the Live Activity.
It proves that the native project and the JavaScript bundle still build.
It runs on `main` and on a pull request that changes what goes into the native project: the packages, `.nvmrc`, `app.json`, `app.config.js`, `eas.json`, `plugins/`, `modules/`, `patches/`, `locales/`, `assets/`, the workflow itself or the gate script.
Every pull request also runs the `ios-bundle` job, which only exports the iOS JavaScript bundle and takes a minute.
Neither makes an app for a phone: that still comes from the local Release build or from EAS.
In the same way, the jobs that need the local stack run on a pull request only when it changes what the stack, the e2e cases or the relay read: the packages, `.nvmrc`, `deno.json`, `patches/`, `supabase/`, `e2e/`, `scripts/sms-relay.mjs`, `src/lib/database.types.ts`, the backend doctor, the workflow or the gate script.
`scripts/changed-inputs.sh` holds both lists.
