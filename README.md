# Barry

Barry is an iPhone app for adventures alone. You tell Barry where you are going and when you will be back. If you don't check in by then, Barry tells the people you chose. It is an Expo app with a Supabase backend.

## Run it locally

```bash
npm install
npx supabase start
npx expo start --dev-client
```

The app needs a development build in the iOS Simulator or on an iPhone. [How to run Barry on your iPhone](docs/iphone.md) covers the build.

## Check it

```bash
npx expo lint
npx tsc --noEmit
npm test
npm run e2e
```

`npm run e2e` needs the local Supabase stack running.

## Guides

- [Barry specification](docs/spec.md)
- [How to run Barry on your iPhone](docs/iphone.md)
- [How to see what Barry sends locally](docs/local-messages.md)
- [The hosted Supabase project](docs/hosted-supabase.md)
- [How to host the Trail Map on GitHub Pages](docs/trail-map-hosting.md)
- [Text messages](docs/text-messages.md)
