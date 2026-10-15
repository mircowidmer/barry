export type TrailMapLinks = { forToken: (token: string) => string };

export const trailMapLinks = (base: string | undefined): TrailMapLinks | null => {
  if (!base || !URL.canParse(base)) {
    console.error('TRAIL_MAP_URL is not a URL: Heads-ups and Alerts go out without the Trail Map link');
    return null;
  }
  return { forToken: (token) => `${base}#${token}` };
};
