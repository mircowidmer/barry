/** The reason Supabase gives when it redirects from a confirmation link that did not work, or null. */
export const confirmationError = (href: string): string | null => {
  const url = new URL(href);
  const params = new URLSearchParams(url.hash.slice(1));
  for (const [key, value] of url.searchParams) params.append(key, value);
  return params.get('error_description') ?? params.get('error');
};
