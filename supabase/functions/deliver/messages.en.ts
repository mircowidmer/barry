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
  return `${part('weekday')} ${part('day')} ${part('month')}, ${part('hour')}:${part('minute')}`;
};

const planLines = (plan: Plan): string[] => [`Destination: ${plan.destination}`];

const lines = (...parts: (string | false | null)[]): string => parts.filter((p) => p !== false && p !== null).join('\n');

export const render = (facts: MessageFacts, links: TrailMapLinks | null): Rendered => {
  const name = facts.adventurerName;
  const time = (at: Date) => formatTime(at, facts.timeZone);
  const trailLine = (token: string | null) => links !== null && token !== null && `Follow ${name}'s trail: ${links.forToken(token)}`;

  switch (facts.kind) {
    case 'heads_up':
      return {
        subject: `${name} is heading out to ${facts.plan.destination}`,
        text: lines(
          `${name} is going on an adventure alone and chose you as an emergency contact on Barry. Barry is the watchdog here: he only barks if ${name} does not check in in time.`,
          '',
          ...planLines(facts.plan),
          '',
          `If ${name} has not checked in by ${time(facts.deadline)}, Barry will message you again.`,
          trailLine(facts.trailToken) && '',
          trailLine(facts.trailToken),
        ),
      };

    case 'plan_update':
      return {
        subject: `${name} changed the plan for ${facts.plan.destination}`,
        text: lines(
          `${name} changed the plan, and Barry has sniffed out the new one.`,
          '',
          ...planLines(facts.plan),
          '',
          `If ${name} has not checked in by ${time(facts.deadline)}, Barry will message you again.`,
          trailLine(facts.trailToken) && '',
          trailLine(facts.trailToken),
        ),
      };

    case 'deadline_update':
      return {
        subject: `${name} needs more time for ${facts.plan.destination}`,
        text: lines(
          `${name} needs more time and moved the deadline from ${time(facts.previousDeadline)} to ${time(facts.deadline)}. Barry has picked up the new scent and keeps watching.`,
          '',
          `Destination: ${facts.plan.destination}`,
          '',
          `If ${name} has not checked in by ${time(facts.deadline)}, Barry will message you again.`,
          trailLine(facts.trailToken) && '',
          trailLine(facts.trailToken),
        ),
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
            : `${name} has still not checked in (alert ${facts.round} of 3)`,
        text: lines(
          facts.round === 1
            ? `${name} has not checked in from an adventure. The deadline was ${time(facts.deadline)}.`
            : `${name} has still not checked in from an adventure (alert ${facts.round} of 3). The deadline was ${time(facts.deadline)}.`,
          '',
          ...planLines(facts.plan),
          '',
          p
            ? `Last position at ${time(p.takenAt)}: ${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}` +
                (p.accuracyM === null ? '' : ` (within ${Math.round(p.accuracyM)} m)`)
            : 'Last position: not recorded',
          trailLine(facts.trailToken),
          '',
          facts.profile.phone !== null && `${name}'s phone: ${facts.profile.phone}`,
          car !== '' && `Car: ${car}`,
          facts.profile.medicalNotes !== null && `Medical notes: ${facts.profile.medicalNotes}`,
        ),
      };
    }

    case 'all_clear':
      return {
        subject: `${name} is back safe`,
        text: lines(
          `${name} checked in safely at ${time(facts.checkedInAt)}. Barry can stop worrying, and so can you.`,
          links !== null && facts.trailToken !== null && '',
          links !== null &&
            facts.trailToken !== null &&
            `Curious where ${name} has been? Barry sniffed out the whole trail: ${links.forToken(facts.trailToken)}`,
        ),
      };
  }
};
