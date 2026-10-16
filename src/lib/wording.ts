import type { Alarm } from '@/lib/barry';
import { type AppLanguage, appLanguage } from '@/lib/language';

export const formatWhen = (at: Date) =>
  at.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const GERMAN_WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const GERMAN_WEEKDAYS_BY_ENGLISH: Record<string, string> = { Sun: 'So', Mon: 'Mo', Tue: 'Di', Wed: 'Mi', Thu: 'Do', Fri: 'Fr', Sat: 'Sa' };
const GERMAN_MONTHS = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'];
const twoDigits = (n: number) => String(n).padStart(2, '0');

/** Like the German messages to the contacts: Sa, 17. Okt. um 18:00. */
export const formatWhenGerman = (at: Date) =>
  `${GERMAN_WEEKDAYS[at.getDay()]}, ${at.getDate()}. ${GERMAN_MONTHS[at.getMonth()]} um ${twoDigits(at.getHours())}:${twoDigits(at.getMinutes())}`;

export const formatDuration = (ms: number) => {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return minutes % 60 === 0 ? `${hours} h` : `${hours} h ${minutes % 60} min`;
};

export const formatDurationGerman = (ms: number) => {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  return minutes % 60 === 0 ? `${hours} Std.` : `${hours} Std. ${minutes % 60} Min.`;
};

// Built from parts, like the server's messages, because runtimes punctuate format() differently.
// Hermes types the hour and minute parts as literals, so the clock comes from format().
const messageTimeParts = (at: Date, timeZone: string, month: 'short' | 'numeric') => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)!.value;
  const clock = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at);
  return { weekday: part('weekday'), day: part('day'), month: part('month'), clock };
};

export const formatMessageTime = (at: Date, timeZone: string) => {
  const { weekday, day, month, clock } = messageTimeParts(at, timeZone, 'short');
  return `${weekday} ${day} ${month}, ${clock}`;
};

export const formatMessageTimeGerman = (at: Date, timeZone: string) => {
  const { weekday, day, month, clock } = messageTimeParts(at, timeZone, 'numeric');
  return `${GERMAN_WEEKDAYS_BY_ENGLISH[weekday]}, ${Number(day)}. ${GERMAN_MONTHS[Number(month) - 1]} um ${clock}`;
};

export const notificationText = ({ kind, adventure }: Alarm, language: AppLanguage = appLanguage()): { title: string; body: string } => {
  const destination = adventure.plan.destination;
  if (language === 'de') {
    const time = (at: Date) => formatMessageTimeGerman(at, adventure.timeZone);
    return kind === 'reminder'
      ? {
          title: 'Melde dich zurück oder verschiebe deine Rückkehrzeit',
          body: `Deine Rückkehrzeit für ${destination} ist am ${time(adventure.deadline)}.`,
        }
      : {
          title: 'Du bist überfällig',
          body: `Deine Rückkehrzeit für ${destination} war am ${time(adventure.deadline)}. Barry alarmiert deine Notfallkontakte am ${time(adventure.alertAt)}, ausser du meldest dich vorher zurück.`,
        };
  }
  const time = (at: Date) => formatMessageTime(at, adventure.timeZone);
  return kind === 'reminder'
    ? { title: 'Check in or move your Deadline', body: `Your Deadline for ${destination} is ${time(adventure.deadline)}.` }
    : {
        title: 'You are overdue',
        body: `Your Deadline for ${destination} was ${time(adventure.deadline)}. Barry alerts your emergency contacts at ${time(adventure.alertAt)} unless you check in.`,
      };
};
