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
6. Open Barry. Allow **Local Network** when it asks; without it the app cannot reach your Mac. If the development launcher shows a list of servers, tap the one on port 8081.
7. Sign in with the test account from `.env.local`, and allow location **Always** so the Trail records in the background.

Later, to use the installed app again, start Supabase and Metro and open Barry:

```bash
npx expo start --dev-client
```

## Limits

- Barry works only on the Wi-Fi your Mac is on, and only while the Mac is awake with Supabase and Metro running. On mobile data the app cannot reach the backend.
- There are no push notifications on the iPhone. The build leaves them out. Barry still asks for notification permission, and then registers no device.
- The Trail Map links in the emails open only on devices on the same Wi-Fi.
- A free team's profile expires after 7 days. When iOS says Barry is no longer available, repeat steps 3 and 4.
- If the macOS firewall asks whether `node` or Docker may accept incoming connections, allow it.
