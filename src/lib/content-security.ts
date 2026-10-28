/**
 * GitHub Pages also serves /adventure as /adventure.html; Expo Router matches no route for that path, so hydration
 * would fail. The page template runs this before anything else.
 */
export const dropHtmlExtension = `if (location.pathname.endsWith('.html')) history.replaceState(history.state, '', location.pathname.replace(/(index)?\\.html$/, '') + location.search + location.hash);`;

/** The one script Expo Router's static export writes inline, to tell the bundle to hydrate the page. */
export const routerHydrate = 'globalThis.__EXPO_ROUTER_HYDRATE__=true;';

// The SHA-256 of each inline script, which content-security.test.ts recomputes, so a changed script cannot
// silently stop running.
const INLINE_SCRIPTS = ["'sha256-bbyVEoFCYgJH/F7tv333vGDe1sSktAikD8P2BYzKX5E='", "'sha256-67fhrP0+BkBqmgGGXTtgiVO/9EQs3QruYNU/7fnRkI8='"];

/** OpenFreeMap serves the Trail Map's style, tiles, glyphs and sprites. */
export const MAP_ORIGIN = 'https://tiles.openfreemap.org';

/**
 * What the pages on barry.support may load and run. GitHub Pages sets no headers, so the policy travels in a meta
 * tag. Only the page's own scripts run: injected markup, such as a map attribution that slipped past MapLibre's
 * sanitizer, can neither run a script nor send the Trail Map token anywhere but Supabase.
 */
export const contentSecurityPolicy = (supabaseUrl: string): string =>
  [
    "default-src 'self'",
    `script-src 'self' ${INLINE_SCRIPTS.join(' ')}`,
    // React Native Web writes its styles into style elements at runtime.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${MAP_ORIGIN}`,
    "font-src 'self' data:",
    `connect-src 'self' ${supabaseUrl} ${MAP_ORIGIN}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
