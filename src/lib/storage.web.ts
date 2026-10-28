// The static export renders without a browser, so there is no localStorage then.
export const storage: Storage | undefined = typeof localStorage === 'undefined' ? undefined : localStorage;
