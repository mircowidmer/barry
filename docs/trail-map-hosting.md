# How to host the Adventure page on GitHub Pages

The workflow `.github/workflows/trail-map.yml` publishes the landing page, the Adventure page, the email-confirmed page, the Privacy Policy and the Terms of Use to GitHub Pages on the domain `barry.support`. Emergency Contacts open their link anywhere, at `https://barry.support/adventure#<token>`. Any other address on `barry.support` goes to the landing page, because `web/404.html` sends the visitor there.

## Before you start

You need a hosted Supabase project. The page fetches the Trail from Supabase in the contact's browser, and a browser refuses to call a plain `http://` address such as `http://Mirook.local:54321` from an `https://` page. The workflow stops with an error until the address starts with `https://`.

## Set up the repository once

1. On GitHub, open **Settings > Pages** and set **Source** to **GitHub Actions**.
2. On the same page, enter `barry.support` as **Custom domain** and save. Once GitHub has issued the certificate, tick **Enforce HTTPS**. The domain's DNS has the four A records `185.199.108.153` to `185.199.111.153`, and `www` is a CNAME to `mircowidmer.github.io`.
3. Open **Settings > Secrets and variables > Actions > Variables** and add two repository variables:
   - `EXPO_PUBLIC_SUPABASE_URL`, the hosted project's URL, for example `https://abcd.supabase.co`.
   - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, the hosted project's publishable key. It is public by design, so a variable is enough.
4. Point the links in Heads-ups and Alerts at the page. Set `TRAIL_MAP_URL=https://barry.support/adventure` in `supabase/.env.hosted` and run `node scripts/hosted-secrets.mjs`, as [The hosted Supabase project](hosted-supabase.md) describes. Do not run `npx supabase secrets set` by hand.
5. Make `https://barry.support/confirmed` the Auth **Site URL**. It is `site_url` under `[remotes.hosted.auth]` in `supabase/config.toml` and goes out with `node scripts/hosted-auth.mjs`, as [The hosted Supabase project](hosted-supabase.md) describes. Do not set it in the dashboard, or the next push undoes it.

## Deploy

Every push to `main` builds and publishes the page. To publish without a push, open **Actions > Trail Map on GitHub Pages** and choose **Run workflow**. The run's summary links to the page.

The workflow exports the web build and publishes `adventure.html`, `confirmed.html`, `_expo`, `assets`, `fonts`, `maplibre` and `favicon.ico`. `fonts` holds Nordwand Mono from `public/fonts`, which `web/site.css` loads for every page. `maplibre` holds MapLibre's map worker, which `scripts/maplibre-worker.mjs` copies from `node_modules` into `public/maplibre` after every `npm install`. The two app pages carry a Content-Security-Policy in a meta tag (`src/lib/content-security.ts`), because GitHub Pages sets no headers: they run only their own scripts and reach only Supabase and OpenFreeMap. A new inline script needs its hash there. It adds `web/index.html` and `web/site.css` with `assets/images/logo.png` as the landing page at `https://barry.support`, `web/privacy.html` and `web/terms.html` at `/privacy` and `/terms`, and `web/404.html` for every other address. `confirmed.html` is where Supabase Auth sends a new account after its email confirmation link, so the hosted project's **Site URL** is `https://barry.support/confirmed`. The app's other web screens, such as sign-in, are not published.

## Try the build locally

```bash
npx expo export --platform web
```

The files in `dist` expect to be served at the root of a domain, and the page expects the path `/adventure`, without `.html`, as GitHub Pages serves it. `npx expo serve` serves them that way.

## Limits

- Messages already sent keep the link they were sent with. Only messages sent after `TRAIL_MAP_URL` changes use the new link. Links to `https://barry.support/trail` from before the move to `/adventure` open the landing page. Links to `https://mircowidmer.github.io/barry/trail` from before the move to `barry.support` stop working.
- The map comes from OpenFreeMap (`tiles.openfreemap.org`, style `liberty`) as vector tiles of OpenStreetMap data, which MapLibre draws in the browser, so it stays sharp on a phone with labels at their normal size. Leaflet still draws the Trail on top, through `@maplibre/maplibre-gl-leaflet`. OpenFreeMap needs no key and has no request limit; the page shows its attribution. MapLibre stays on version 5, because version 6 loads its worker from separate files that the Metro bundle does not ship.
