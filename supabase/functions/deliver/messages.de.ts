import type { MessageFacts, Plan } from './facts.ts';
import type { TrailMapLinks } from './links.ts';
import type { Rendered } from './messages.en.ts';

const WEEKDAYS: Record<string, string> = { Mon: 'Mo', Tue: 'Di', Wed: 'Mi', Thu: 'Do', Fri: 'Fr', Sat: 'Sa', Sun: 'So' };
const MONTHS = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'];

// Built from parts, like the English time, because runtimes ship different ICU data for German.
export const formatTime = (at: Date, timeZone: string): string => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)!.value;
  return `${WEEKDAYS[part('weekday')]}, ${Number(part('day'))}. ${MONTHS[Number(part('month')) - 1]} um ${part('hour')}:${part('minute')}`;
};

const planLines = (plan: Plan): string[] => [`Ziel: ${plan.destination}`];

const lines = (...parts: (string | false | null)[]): string => parts.filter((p) => p !== false && p !== null).join('\n');

export const render = (facts: MessageFacts, links: TrailMapLinks | null): Rendered => {
  const name = facts.adventurerName;
  const time = (at: Date) => formatTime(at, facts.timeZone);
  const trailLine = (token: string | null) =>
    links !== null && token !== null && `Hier siehst du, wo ${name} unterwegs ist: ${links.forToken(token)}`;

  switch (facts.kind) {
    case 'heads_up':
      return {
        subject: `${name} ist unterwegs: ${facts.plan.destination}`,
        text: lines(
          `${name} ist allein auf einem Abenteuer und hat dich auf Barry als Notfallkontakt angegeben. Barry ist hier der Wachhund: Er bellt nur, wenn sich ${name} nicht rechtzeitig zurückmeldet.`,
          '',
          ...planLines(facts.plan),
          '',
          `Wenn sich ${name} bis ${time(facts.deadline)} nicht zurückgemeldet hat, meldet sich Barry wieder bei dir.`,
          trailLine(facts.trailToken) && '',
          trailLine(facts.trailToken),
        ),
      };

    case 'plan_update':
      return {
        subject: `${name} hat den Plan für ${facts.plan.destination} geändert`,
        text: lines(
          `${name} hat den Plan geändert, und Barry hat den neuen erschnüffelt.`,
          '',
          ...planLines(facts.plan),
          '',
          `Wenn sich ${name} bis ${time(facts.deadline)} nicht zurückgemeldet hat, meldet sich Barry wieder bei dir.`,
          trailLine(facts.trailToken) && '',
          trailLine(facts.trailToken),
        ),
      };

    case 'deadline_update':
      return {
        subject: `${name} braucht mehr Zeit für ${facts.plan.destination}`,
        text: lines(
          `${name} braucht mehr Zeit und hat die Rückkehrzeit von ${time(facts.previousDeadline)} auf ${time(facts.deadline)} verschoben. Barry hat die neue Fährte aufgenommen und passt weiter auf.`,
          '',
          `Ziel: ${facts.plan.destination}`,
          '',
          `Wenn sich ${name} bis ${time(facts.deadline)} nicht zurückgemeldet hat, meldet sich Barry wieder bei dir.`,
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
            ? `${name} hat sich nicht zurückgemeldet`
            : `${name} hat sich immer noch nicht zurückgemeldet (Alarm ${facts.round} von 3)`,
        text: lines(
          facts.round === 1
            ? `${name} hat sich nach einem Abenteuer nicht zurückgemeldet. Die vereinbarte Rückkehrzeit war am ${time(facts.deadline)}.`
            : `${name} hat sich nach einem Abenteuer immer noch nicht zurückgemeldet (Alarm ${facts.round} von 3). Die vereinbarte Rückkehrzeit war am ${time(facts.deadline)}.`,
          '',
          ...planLines(facts.plan),
          '',
          p
            ? `Letzter Standort am ${time(p.takenAt)}: ${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}` +
                (p.accuracyM === null ? '' : ` (auf ${Math.round(p.accuracyM)} m genau)`)
            : 'Letzter Standort: nicht erfasst',
          trailLine(facts.trailToken),
          '',
          facts.profile.phone !== null && `Telefon von ${name}: ${facts.profile.phone}`,
          car !== '' && `Auto: ${car}`,
          facts.profile.medicalNotes !== null && `Medizinische Hinweise: ${facts.profile.medicalNotes}`,
        ),
      };
    }

    case 'all_clear':
      return {
        subject: `${name} ist sicher zurück`,
        text: lines(
          `${name} hat sich am ${time(facts.checkedInAt)} sicher zurückgemeldet. Barry muss sich keine Sorgen mehr machen, und du auch nicht.`,
          links !== null && facts.trailToken !== null && '',
          links !== null &&
            facts.trailToken !== null &&
            `Neugierig, wo ${name} überall war? Barry hat die ganze Spur erschnüffelt: ${links.forToken(facts.trailToken)}`,
        ),
      };
  }
};
