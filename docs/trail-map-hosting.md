# How to host the Trail Map on GitHub Pages

The workflow `.github/workflows/trail-map.yml` publishes the landing page, the Trail Map page and the email-confirmed page to GitHub Pages on the domain `barry.support`. Emergency Contacts open their link anywhere, at `https://barry.support/adventure#<token>`. The page's old address, `https://barry.support/trail#<token>`, no longer works, so links sent before the move show a 404.

## Before you start

You need a hosted Supabase project. The page fetches the Trail from Supabase in the contact's browser, and a browser refuses to call a plain `http://` address such as `http://Mirook.local:54321` from an `https://` page. The workflow stops with an error until the address starts with `https://`.

## Set up the repository once

1. On GitHub, open **Settings > Pages** and set **Source** to **GitHub Actions**.
2. On the same page, enter `barry.support` as **Custom domain** and save. Once GitHub has issued the certificate, tick **Enforce HTTPS**. The domain's DNS has the four A records `185.199.108.153` to `185.199.111.153`, and `www` is a CNAME to `mircowidmer.github.io`.
3. Open **Settings > Secrets and variables > Actions > Variables** and add two repository variables:
   - `EXPO_PUBLIC_SUPABASE_URL`, the hosted project's URL, for example `https://abcd.supabase.co`.
   - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, the hosted project's publishable key. It is public by design, so a variable is enough.
4. Point the links in Heads-ups and Alerts at the page. Set `TRAIL_MAP_URL=https://barry.support/adventure` in `supabase/.env.hosted` and run `node scripts/hosted-secrets.mjs`, as [The hosted Supabase project](hosted-supabase.md) describes. Do not run `npx supabase secrets set` by hand.
5. In the Supabase dashboard, open **Authentication > URL Configuration** and set **Site URL** to `https://barry.support/confirmed`.

## Deploy

Every push to `main` builds and publishes the page. To publish without a push, open **Actions > Trail Map on GitHub Pages** and choose **Run workflow**. The run's summary links to the page.

The workflow exports the web build and publishes `trail.html`, `confirmed.html`, `_expo`, `assets` and `favicon.ico`. It adds `web/index.html` and `web/site.css` with `assets/images/logo.png` as the landing page at `https://barry.support`. `confirmed.html` is where Supabase Auth sends a new account after its email confirmation link, so the hosted project's **Site URL** is `https://barry.support/confirmed`. The app's other web screens, such as sign-in, are not published.

## Try the build locally

```bash
npx expo export --platform web
```

The files in `dist` expect to be served at the root of a domain, and the page expects the path `/adventure`, without `.html`, as GitHub Pages serves it. `npx expo serve` serves them that way.

## Limits

- Messages already sent keep the link they were sent with. Only messages sent after `TRAIL_MAP_URL` changes use the new link. Links to `https://mircowidmer.github.io/barry/trail` from before the move to `barry.support` stop working.
- The map tiles come from `tile.openstreetmap.org`, whose usage policy allows this low traffic with the attribution the page shows.
