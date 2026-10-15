import { Redirect } from 'expo-router';

// The page is for a browser; trail.web.tsx and confirmed.web.tsx render it there.
export default function BrowserOnlyRoute() {
  return <Redirect href="/" />;
}
