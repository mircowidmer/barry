# How to host the Trail Map on GitHub Pages

The workflow `.github/workflows/trail-map.yml` publishes the Trail Map page, and only that page, to GitHub Pages. Emergency Contacts then open their link anywhere, at `https://mircowidmer.github.io/barry/trail#<token>`.

## Before you start

You need a hosted Supabase project. The page fetches the Trail from Supabase in the contact's browser, and a browser refuses to call a plain `http://` address such as `http://Mirook.local:54321` from an `https://` page. The workflow stops with an error until the address starts with `https://`.

## Set up the repository once

1. On GitHub, open **Settings > Pages** and set **Source** to **GitHub Actions**.
2. Open **Settings > Secrets and variables > Actions > Variables** and add two repository variables:
   - `EXPO_PUBLIC_SUPABASE_URL`, the hosted project's URL, for example `https://abcd.supabase.co`.
   - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, the hosted project's publishable key. It is public by design, so a variable is enough.
3. Point the links in Heads-ups and Alerts at the page:

   ```bash
   npx supabase secrets set TRAIL_MAP_URL=https://mircowidmer.github.io/barry/trail
   ```

## Deploy

Every push to `main` builds and publishes the page. To publish without a push, open **Actions > Trail Map on GitHub Pages** and choose **Run workflow**. The run's summary links to the page.

The workflow exports the web build with the base path `/barry`, set through `BARRY_WEB_BASE_URL` in `app.config.js`, and publishes `trail.html`, `_expo`, `assets` and `favicon.ico`. The app's other web screens, such as sign-in, are not published.

## Try the build locally

```bash
BARRY_WEB_BASE_URL=/barry npx expo export --platform web
```

The files in `dist` expect to be served under `/barry/`, and the page expects the path `/barry/trail`, without `.html`, as GitHub Pages serves it.

## Limits

- Messages already sent keep the link they were sent with. Only messages sent after `TRAIL_MAP_URL` changes link to GitHub Pages.
- The map tiles come from `tile.openstreetmap.org`, whose usage policy allows this low traffic with the attribution the page shows.
