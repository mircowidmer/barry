/**
 * The limits the server enforces, in `supabase/migrations/20261028120100_message_limits.sql`, the length
 * triggers of `20261028130000_length_limits_on_change.sql` and `max_alerts` in `20261015081453_clock_decide.sql`, repeated for the
 * app's inputs and texts. `limits.test.ts` and `limits.test.sql` pin the two sides to the same values.
 */
export const LIMITS = {
  contacts: 10,
  adventureContacts: 5,
  startsPerDay: 5,
  alertsPerDeadline: 3,
  destinationLength: 200,
  nameLength: 100,
  emailLength: 254,
  carMakeLength: 50,
  carColourLength: 50,
  carPlateLength: 20,
  medicalNotesLength: 500,
} as const;
