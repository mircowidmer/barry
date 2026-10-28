// verify_jwt is off for deliver, so this is the only gate on a run. Without the secret it opens for nobody:
// the header would otherwise match the literal "Bearer undefined".
export const authorizedKick = (authorization: string | null, secret: string | undefined): boolean =>
  secret !== undefined && secret !== '' && authorization === `Bearer ${secret}`;
