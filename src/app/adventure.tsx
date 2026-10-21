import { Redirect } from 'expo-router';

// The page is for a browser; adventure.web.tsx renders it there.
export default function BrowserOnlyRoute() {
  return <Redirect href="/" />;
}
