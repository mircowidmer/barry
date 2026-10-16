import type { Alarm, Refusal } from '@/lib/barry';

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
  adventure_in_progress: 'Check in from your Adventure first.',
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

// Built from parts, like the server's messages, because runtimes punctuate format() differently.
// Hermes types the hour and minute parts as literals, so the clock comes from format().
export const formatMessageTime = (at: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short' }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)!.value;
  const clock = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at);
  return `${part('weekday')} ${part('day')} ${part('month')}, ${clock}`;
};

export const notificationText = ({ kind, adventure }: Alarm): { title: string; body: string } => {
  const time = (at: Date) => formatMessageTime(at, adventure.timeZone);
  const destination = adventure.plan.destination;
  return kind === 'reminder'
    ? { title: 'Check in or move your Deadline', body: `Your Deadline for ${destination} is ${time(adventure.deadline)}.` }
    : {
        title: 'You are overdue',
        body: `Your Deadline for ${destination} was ${time(adventure.deadline)}. Barry alerts your emergency contacts at ${time(adventure.alertAt)} unless you check in.`,
      };
};
