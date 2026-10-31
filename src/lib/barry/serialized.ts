/** Runs `apply` one call at a time, so a slow run from older state cannot undo what a newer one did. */
export const serialized = (apply: () => Promise<void>) => {
  let last: Promise<void> = Promise.resolve();
  return (): Promise<void> => {
    const run = last.then(apply);
    last = run.catch(() => undefined);
    return run;
  };
};
