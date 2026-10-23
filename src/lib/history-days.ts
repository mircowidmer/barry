/** One calendar day of the History: today, yesterday, or an earlier date. */
export type HistoryDay<T> = { key: string; date: Date; relative: 'today' | 'yesterday' | null; items: T[] };

const dayKey = (at: Date) => `${at.getFullYear()}-${at.getMonth() + 1}-${at.getDate()}`;

/**
 * Splits items already sorted newest first into the local calendar days `at` falls on, in the same
 * order. Today and yesterday are named by the phone's calendar, so a day is a day across a time change.
 */
export const byDay = <T>(items: readonly T[], at: (item: T) => Date, now: Date): HistoryDay<T>[] => {
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const days: HistoryDay<T>[] = [];
  for (const item of items) {
    const date = at(item);
    const key = dayKey(date);
    const last = days.at(-1);
    if (last?.key === key) last.items.push(item);
    else days.push({ key, date, relative: key === today ? 'today' : key === yesterday ? 'yesterday' : null, items: [item] });
  }
  return days;
};
