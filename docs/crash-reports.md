# Crash reports

A release build of Barry sends its crashes and errors to Sentry, so a failure on someone else's phone shows up without their phone in hand. A JavaScript error at startup in a release build does not crash: the app stays on the splash screen and nothing reaches Apple's crash reports. Sentry starts before every other module in `index.ts`, so such an error is reported too.

## What a report holds

`src/lib/crash-reports.ts` sets Sentry up and its tests pin what leaves the phone:

- The error, its stack, the app version, the OS and the device model.
- No user, no request, no extras, no device name and no `device_app_hash`, which would tie the reports from one phone together. `sendDefaultPii` is off, so the SDK asks Sentry never to infer the IP address.
- No sessions, so nothing is sent on a launch without an error. Sentry's crash-free rate stays empty.
- No breadcrumbs, screenshots, view hierarchy or performance traces. `maxBreadcrumbs` is 0 in JavaScript and in the native SDK.
- Email addresses, phone numbers and coordinates in an error message are replaced by `[email]`, `[phone]` and `[coordinate]`.

The scrubbing in `beforeSend` runs on JavaScript errors. A native crash is written by the native SDK and sent on the next launch without passing through JavaScript; it carries native stack frames and the same device context, and no breadcrumbs. The [privacy policy](../web/privacy.html) describes this in English and German.

A development build and a build without `EXPO_PUBLIC_SENTRY_DSN` send nothing.

## Set up the Sentry project

1. Create a Sentry account in the **EU (Frankfurt)** data region, which the privacy policy names, and a React Native project in it.
2. In the project's settings, under **Security & Privacy**, turn on **Prevent Storing of IP Addresses** and keep **Data Scrubber** on. The privacy policy promises the first.
3. Put the project's DSN into `EXPO_PUBLIC_SENTRY_DSN` of the `preview` and `production` profiles in `eas.json`. The DSN only lets an app send reports, so it ships inside the app like the Supabase publishable key.
4. Create an organization auth token and write it, with the organization and project slugs and the regional URL, to `.env.sentry-build-plugin` at the root, which git ignores:

   ```bash
   SENTRY_AUTH_TOKEN=sntrys_...
   SENTRY_ORG=<organization slug>
   SENTRY_PROJECT=<project slug>
   SENTRY_URL=https://de.sentry.io/
   ```

## Readable stack traces

`metro.config.js` uses Sentry's serializer, which gives the bundle and its source map a shared debug ID. In a Release build, Sentry's Xcode build phases upload the source map and the debug symbols (dSYMs) with the token in `.env.sentry-build-plugin`, so a report shows the source lines instead of the minified bundle. A Debug build skips the upload.

Without that file and without `SENTRY_AUTH_TOKEN`, `npm run iphone:production` sets `SENTRY_DISABLE_AUTO_UPLOAD=true`, and the build succeeds without uploading. CI's iOS Release build always sets it, because it has no token and never ships.

## Check it

A fatal error is saved on the phone and sent on the next launch that gets far enough, so an error that kills every launch at once is reported only after a fixed build is installed.

After building with `npm run iphone:production`, throw an error from a button in a scratch change, tap it on the phone, reopen the app and look for the report in Sentry. Its stack trace should name a file under `src/`, and nothing in it should name the Adventurer.
