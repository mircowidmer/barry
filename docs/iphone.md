# How to run Barry on your iPhone

This puts a development build of Barry on a real iPhone. The app talks to the Supabase stack and the Metro bundler on your Mac, so the iPhone and the Mac must be on the same Wi-Fi.

## Before you start

- The iPhone is paired with Xcode on this Mac and has **Developer Mode** on (**Settings > Privacy & Security > Developer Mode**).
- Xcode is signed in to the Apple account of team `4GNTKX8XTQ` (`app.json` sets `ios.appleTeamId`). It is a free personal team.
- The Mac's local network name is `Mirook`. Check it with `scutil --get LocalHostName`. If it differs, change `Mirook.local` in `.env.local` and in `TRAIL_MAP_URL` in `supabase/config.toml`, then restart Supabase.

## Build and install

1. Start the local backend:

   ```bash
   npx supabase start
   ```

2. Generate the iOS project without push notifications. A free team cannot sign the Push Notifications capability, and `BARRY_WITHOUT_PUSH=1` makes `plugins/without-push.js` leave it out:

   ```bash
   BARRY_WITHOUT_PUSH=1 npx expo prebuild --clean --platform ios
   ```

3. Connect the iPhone with a cable and unlock it. Build once with Xcode's automatic signing allowed, so Xcode creates the provisioning profile (`expo run:ios` cannot):

   ```bash
   xcodebuild -workspace ios/Barry.xcworkspace -scheme Barry -configuration Debug -destination 'platform=iOS,name=Mirone' -allowProvisioningUpdates build
   ```

4. Install the app and start Metro:

   ```bash
   BARRY_WITHOUT_PUSH=1 npx expo run:ios --device Mirone
   ```

5. The first time only, trust the certificate on the iPhone. Open **Settings > General > VPN & Device Management**, tap **Apple Development: mirco.widmer@nxt-engineering.com**, and tap **Trust**. Until then iOS refuses to open Barry and step 4 ends with `profile has not been explicitly trusted by the user`.
6. Open Barry. Allow **Local Network** when it asks; without it the app cannot reach your Mac. If Barry shows the development launcher, tap the server on port 8081, or enter `http://Mirook.local:8081`.
7. Sign in with the test account from `.env.local`, and allow location **Always** so the Trail records in the background.

Later, to use the installed app again, start Supabase and Metro and open Barry:

```bash
npx expo start --dev-client
```

## Install a Release build that runs without Metro

A Release build carries Barry's JavaScript inside the app, so it opens without Metro. It still calls Supabase on your Mac, because `EXPO_PUBLIC_SUPABASE_URL` in `.env.local` is built into the bundle.

1. Build with the iPhone connected and unlocked:

   ```bash
   xcodebuild -workspace ios/Barry.xcworkspace -scheme Barry -configuration Release -destination 'platform=iOS,name=Mirone' -derivedDataPath ios/build -allowProvisioningUpdates build
   ```

2. Install it over the development build:

   ```bash
   xcrun devicectl device install app --device Mirone ios/build/Build/Products/Release-iphoneos/Barry.app
   ```

The Release build keeps the development build's sign-in and Trail, because both have the bundle identifier `support.barry`. A code change reaches it only through a new build. To go back to the development build, repeat step 4 of [Build and install](#build-and-install).

## Limits

- While the cable is connected, `Mirook.local` resolves to the cable link, so Supabase traffic goes over the cable and Metro traffic goes over Wi-Fi.
- Barry works only on the Wi-Fi your Mac is on, and only while the Mac is awake with Supabase running. The development build also needs Metro. On mobile data the app cannot reach the backend.
- There are no push notifications on the iPhone. The build leaves them out. Barry still asks for notification permission, because the Reminder and the Overdue Notice are local notifications that the app schedules on the phone. They arrive without push and without signal.
- The Trail Map links in the emails open only on devices on the same Wi-Fi.
- Barry sends no text messages, because it has no text message provider. [How to see what Barry sends locally](local-messages.md) shows where to read the emails.
- A free team's profile expires after 7 days. When iOS says Barry is no longer available, repeat steps 3 and 4.
- If the macOS firewall asks whether `node` or Docker may accept incoming connections, allow it.
