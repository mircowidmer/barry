/**
 * The limits the server enforces, in `supabase/migrations/20261028120100_message_limits.sql`, the length
 * triggers of `20261028130000_length_limits_on_change.sql`, `max_alerts` in `20261015081453_clock_decide.sql`
 * and `max_alerts_per_adventure` in `20261030100100_alert_cap.sql`, repeated for the app's inputs and texts. `limits.test.ts` and `limits.test.sql` pin the two sides to the same values.
 */
export const LIMITS = {
  contacts: 10,
  adventureContacts: 5,
  startsPerDay: 5,
  alertsPerDeadline: 3,
  alertsPerAdventure: 9,
  destinationLength: 200,
  nameLength: 100,
  emailLength: 254,
  carMakeLength: 50,
  carColourLength: 50,
  carPlateLength: 20,
  medicalNotesLength: 500,
} as const;

/**
 * The text cut to `max` characters as Postgres counts them, whole code points, so a cut never splits an emoji into
 * half a surrogate pair.
 */
export const clip = (text: string, max: number): string => Array.from(text).slice(0, max).join('');
