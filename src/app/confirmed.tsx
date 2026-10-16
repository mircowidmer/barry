import { Redirect } from 'expo-router';

// The page is for a browser; confirmed.web.tsx renders it there.
export default function BrowserOnlyRoute() {
  return <Redirect href="/" />;
}
