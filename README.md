# Barry

Barry is an iPhone app for adventures alone. You tell Barry where you are going and when you will be back. If you don't check in by then, Barry tells the people you chose. It is an Expo app with a Supabase backend.

## Run it locally

```bash
npm install
npx supabase start
npx expo start --dev-client
```

Copy `.env.example` to `.env.local` first, and set `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the publishable key that `npx supabase start` prints.

The app needs a development build in the iOS Simulator or on an iPhone. [How to run Barry on your iPhone](docs/iphone.md) covers the build.

## Check it

```bash
npx expo lint
npx tsc --noEmit
npm test
deno test supabase/functions/deliver
npx supabase test db
npm run e2e
```

`npx supabase test db` and `npm run e2e` need the local Supabase stack running.

## Guides

- [Barry specification](docs/spec.md)
- [How to run Barry on your iPhone](docs/iphone.md)
- [How to see what Barry sends locally](docs/local-messages.md)
- [The hosted Supabase project](docs/hosted-supabase.md)
- [How to host the Adventure page on GitHub Pages](docs/trail-map-hosting.md)
- [Text messages](docs/text-messages.md)
