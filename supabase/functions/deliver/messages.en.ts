import type { MessageFacts, Plan } from './facts.ts';
import type { TrailMapLinks } from './links.ts';

export type Rendered = { subject: string; text: string };

// Built from parts because runtimes ship different ICU data, which punctuates format() differently.
export const formatTime = (at: Date, timeZone: string): string => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)!.value;
  const place = timeZone.split('/').pop()!.replaceAll('_', ' ');
  return `${part('weekday')} ${part('day')} ${part('month')}, ${part('hour')}:${part('minute')} ${place} time`;
};

const planLines = (plan: Plan): string[] =>
  [
    `Destination: ${plan.destination}`,
    plan.route && `Route: ${plan.route}`,
    plan.startingPoint && `Starting point: ${plan.startingPoint}`,
    plan.notes && `Notes: ${plan.notes}`,
  ].filter((line): line is string => Boolean(line));

const lines = (...parts: (string | false | null)[]): string => parts.filter((p) => p !== false && p !== null).join('\n');

export const render = (facts: MessageFacts, links: TrailMapLinks | null): Rendered => {
  const name = facts.adventurerName;
  const time = (at: Date) => formatTime(at, facts.timeZone);
  const trailLine = (token: string | null) => links !== null && token !== null && `Follow ${name}'s Trail: ${links.forToken(token)}`;

  switch (facts.kind) {
    case 'heads_up':
      return {
        subject: `${name} is heading out to ${facts.plan.destination}`,
        text: lines(
          `${name} is going on an Adventure alone and chose you as an Emergency Contact on Barry.`,
          '',
          ...planLines(facts.plan),
          '',
          `If ${name} has not checked in by ${time(facts.deadline)}, Barry will message you again.`,
          trailLine(facts.trailToken) && '',
          trailLine(facts.trailToken),
        ),
      };

    case 'reminder':
      return {
        subject: 'Check in or move your Deadline',
        text: `Your Deadline for ${facts.plan.destination} is ${time(facts.deadline)}.`,
      };

    case 'overdue_notice':
      return {
        subject: 'You are overdue',
        text: `Your Deadline for ${facts.plan.destination} was ${time(facts.deadline)}. Barry alerts your Emergency Contacts at ${time(facts.alertAt)} unless you check in.`,
      };

    case 'alert': {
      const p = facts.lastKnownPosition;
      const car = [
        [facts.profile.carColour, facts.profile.carMake].filter(Boolean).join(' '),
        facts.profile.carPlate,
      ].filter(Boolean).join(', ');
      return {
        subject:
          facts.round === 1
            ? `${name} has not checked in`
            : `${name} has still not checked in (Alert ${facts.round} of 3)`,
        text: lines(
          `${name} has not checked in from an Adventure. The Deadline was ${time(facts.deadline)}.`,
          '',
          ...planLines(facts.plan),
          '',
          p
            ? `Last Known Position at ${time(p.takenAt)}: ${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}` +
                (p.accuracyM === null ? '' : ` (within ${Math.round(p.accuracyM)} m)`)
            : 'Last Known Position: not recorded',
          p !== null &&
            `Map: https://www.openstreetmap.org/?mlat=${p.latitude}&mlon=${p.longitude}#map=15/${p.latitude}/${p.longitude}`,
          trailLine(facts.trailToken),
          '',
          `${name}'s phone: ${facts.profile.phone}`,
          car !== '' && `Car: ${car}`,
          facts.profile.medicalNotes !== null && `Medical notes: ${facts.profile.medicalNotes}`,
        ),
      };
    }

    case 'all_clear':
      return {
        subject: `${name} is back safe`,
        text: `${name} checked in safely at ${time(facts.checkedInAt)}.`,
      };
  }
};
