# How to run Barry on your iPhone

This puts the development build of Barry, Barry Dev with the bundle identifier `support.barry.dev`, on a real iPhone.
It talks to the Supabase stack and the Metro bundler on your Mac, so the iPhone and the Mac must be on the same Wi-Fi.

## Before you start

- The iPhone is paired with Xcode on this Mac and has **Developer Mode** on (**Settings > Privacy & Security > Developer Mode**).
- Xcode is signed in to the Apple account of team `4GNTKX8XTQ` (`app.json` sets `ios.appleTeamId`).
  It is a free personal team.
- The Mac's local network name is `Mirook`.
  Check it with `scutil --get LocalHostName`.
  The iPhone reaches Supabase through that name, so set `EXPO_PUBLIC_SUPABASE_URL=http://Mirook.local:54321` in `.env.local`; the `127.0.0.1` from `.env.example` works only in the simulator.
  If the name differs, use yours there and in `TRAIL_MAP_URL` in `supabase/config.toml`, then restart Supabase.

## Build and install

1. Start the local backend:

   ```bash
   npx supabase start
   ```

2. Generate the iOS project for the development variant, without push notifications.
   A free team cannot sign the Push Notifications capability, and `BARRY_WITHOUT_PUSH=1` makes `plugins/without-push.js` leave it out.
   It also leaves out the Live Activity, whose App Group a free team cannot sign either.
   CocoaPods needs a UTF-8 locale:

   ```bash
   APP_VARIANT=development BARRY_WITHOUT_PUSH=1 LANG=en_US.UTF-8 npx expo prebuild --clean --platform ios
   ```

3. Connect the iPhone with a cable and unlock it.
   Build once with Xcode's automatic signing allowed, so Xcode creates the provisioning profile (`expo run:ios` cannot):

   ```bash
   xcodebuild -workspace ios/Barry.xcworkspace -scheme Barry -configuration Debug -destination 'platform=iOS,name=Mirone' -allowProvisioningUpdates build
   ```

4. Install the app and start Metro:

   ```bash
   APP_VARIANT=development BARRY_WITHOUT_PUSH=1 npx expo run:ios --device Mirone
   ```

5. The first time only, trust the certificate on the iPhone.
   Open **Settings > General > VPN & Device Management**, tap **Apple Development: mirco.widmer@nxt-engineering.com**, and tap **Trust**.
   Until then iOS refuses to open Barry Dev and step 4 ends with `profile has not been explicitly trusted by the user`.
6. Open Barry Dev.
   Allow **Local Network** when it asks; without it the app cannot reach your Mac.
   If Barry shows the development launcher, tap the server on port 8081, or enter `http://Mirook.local:8081`.
7. Sign in with the test account from `.env.local`, and allow location **Always** so the Trail records in the background.

Later, to use the installed app again, start Supabase and Metro and open Barry Dev:

```bash
npm start
```

## Install the production app

The production app, Barry with the bundle identifier `support.barry`, carries its JavaScript and talks to the hosted Supabase project.
It installs next to Barry Dev.
With a paid Apple team, `npm run build:production` builds it in the cloud instead, as [Builds](builds.md) describes.

With the iPhone connected and unlocked, one command builds and installs it:

```bash
npm run iphone:production
```

It runs the three steps below through `scripts/iphone-production.sh`.
The iPhone is the one named Mirone; for another one, set its name in `BARRY_IPHONE`:

```bash
BARRY_IPHONE="Anna's iPhone" npm run iphone:production
```

The first run takes about four minutes.
Later runs keep what they can:

- The script skips the prebuild when `ios/` already holds the production variant and nothing native changed.
  It compares the `@expo/fingerprint` hash and `locales/` with the ones it saved in `ios/.barry-production` at its last prebuild.
  Xcode then builds incrementally, so a run after a JavaScript change takes well under a minute.
- With ccache installed (`brew install ccache`), the C, C++ and Objective-C of the native modules come from the cache after a prebuild, which cuts a run after a native change to about two and a half minutes.

The steps one by one:

1. Generate the iOS project for the production variant.
   `USE_CCACHE=1` turns on ccache, if it is installed:

   ```bash
   APP_VARIANT=production BARRY_WITHOUT_PUSH=1 USE_CCACHE=1 LANG=en_US.UTF-8 npx expo prebuild --clean --platform ios
   ```

2. Build with the iPhone connected and unlocked.
   The first command takes the hosted Supabase URL and publishable key from the production profile in `eas.json`, the second points React Native's ccache wrapper at ccache:

   ```bash
   eval "$(node -e "for (const [k, v] of Object.entries(require('./eas.json').build.production.env)) console.log('export ' + k + '=' + JSON.stringify(v))")"
   ```

   ```bash
   export CCACHE_BINARY="$(command -v ccache)"
   ```

   ```bash
   LANG=en_US.UTF-8 xcodebuild -workspace ios/Barry.xcworkspace -scheme Barry -configuration Release -destination 'platform=iOS,name=Mirone' -derivedDataPath ios/build -allowProvisioningUpdates build
   ```

3. Install it:

   ```bash
   xcrun devicectl device install app --device Mirone ios/build/Build/Products/Release-iphoneos/Barry.app
   ```

A code change reaches it only through a new build.
`ios/` now belongs to the production variant, so repeat step 2 of [Build and install](#build-and-install) before the next development build.

## Limits

- While the cable is connected, `Mirook.local` resolves to the cable link, so Supabase traffic goes over the cable and Metro traffic goes over Wi-Fi.
- Barry works only on the Wi-Fi your Mac is on, and only while the Mac is awake with Supabase running.
  The development build also needs Metro.
  On mobile data the app cannot reach the backend.
- There are no push notifications on the iPhone.
  The build leaves them out.
  Barry still asks for notification permission, because the Reminder, the Overdue Notice and the Arrival Notice are local notifications that the app shows on the phone.
  They arrive without push and without signal.
- The Adventure page links in the emails open only on devices on the same Wi-Fi.
- Text messages never reach a phone locally.
  They land in `scripts/sms-relay.mjs`.
  [How to see what Barry sends locally](local-messages.md) shows where to read them and the emails.
- A free team's profile expires after 7 days.
  When iOS says Barry is no longer available, repeat steps 3 and 4.
- If the macOS firewall asks whether `node` or Docker may accept incoming connections, allow it.
