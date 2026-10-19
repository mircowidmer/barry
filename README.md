# Barry

Barry is an iPhone app for adventures alone. You tell Barry where you are going and when you will be back. If you don't check in by then, Barry tells the people you chose. It is an Expo app with a Supabase backend.

## Run it locally

```bash
npm install
npx supabase start
npm start
```

Copy `.env.example` to `.env.local` first, and set `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the publishable key that `npx supabase start` prints.

The app needs the development build, Barry Dev, in the iOS Simulator or on an iPhone. [How to run Barry on your iPhone](docs/iphone.md) covers the local build, and [Builds](docs/builds.md) the variants and the cloud builds with EAS.

## Check it

```bash
npx expo lint
npx tsc --noEmit
npm test
deno test supabase/functions/deliver
npx supabase test db
npm run e2e
```

`npx tsc --noEmit` needs `expo-env.d.ts`, which `npm start` writes on its first run. `npx supabase test db` and `npm run e2e` need the local Supabase stack running.

## Guides

- [Barry specification](docs/spec.md)
- [How to run Barry on your iPhone](docs/iphone.md)
- [Builds](docs/builds.md)
- [How to see what Barry sends locally](docs/local-messages.md)
- [The hosted Supabase project](docs/hosted-supabase.md)
- [How to host the Adventure page on GitHub Pages](docs/trail-map-hosting.md)
- [Text messages](docs/text-messages.md)
