// Compares two secrets without stopping at the first differing byte, so the time a request takes tells a
// caller nothing about how much of a guess was right. Only the length can show.
export const sameSecret = (a: string, b: string): boolean => {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let difference = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) difference |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return difference === 0;
};
