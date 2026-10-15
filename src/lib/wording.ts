import type { Refusal } from '@/lib/barry';

const refusals: Record<Refusal, string> = {
  not_found: 'This Adventure no longer exists.',
  profile_incomplete: 'Add your name and phone number in Profile first.',
  destination_missing: 'Add a destination.',
  deadline_missing: 'Set a Deadline.',
  deadline_not_in_future: 'The Deadline must be in the future.',
  deadline_not_later: 'The new Deadline must be later than the current one.',
  no_contacts: 'Choose at least one Emergency Contact.',
  unknown_contact: 'One of the contacts was removed. Choose the contacts again.',
  another_adventure_in_progress: 'Another Adventure is already in progress. Check in from it first.',
  wrong_stage: 'This Adventure can no longer be changed.',
  invalid_time_zone: 'Your phone reported a time zone Barry does not know.',
  messages_pending: 'Barry is still sending messages for this Adventure. Try again in a few minutes.',
};

export const refusalText = (refusal: Refusal) => refusals[refusal];

export const formatWhen = (at: Date) =>
  at.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export const formatDuration = (ms: number) => {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return minutes % 60 === 0 ? `${hours} h` : `${hours} h ${minutes % 60} min`;
};
