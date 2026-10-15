import type { AdventureId, Position } from './types';

export type TrailSendOutcome = 'accepted' | 'refused' | 'retry';

export type TrailBuffer = {
  add(adventureId: AdventureId, readings: readonly Position[]): void;
  flush(send: (adventureId: AdventureId, batch: readonly Position[]) => Promise<TrailSendOutcome>): Promise<void>;
  keepOnly(adventureId: AdventureId | null): void;
  newest(adventureId: AdventureId): Position | null;
};

const KEY = 'barry.trailBuffer';
const SENT_KEY = 'barry.trailSent';
const BATCH = 200;
const MAX_SLOTS = 1_440;

/** The UTC minute a reading falls in. The database's `slot` column is finer, so one reading a minute always fits. */
export const slotKey = (reading: Pick<Position, 'takenAt'>): string => reading.takenAt.toISOString().slice(0, 16);

type Stored = { t: string; lat: number; lon: number; acc: number | null };
type Contents = Record<string, Record<string, Stored>>;
type Sent = Record<string, string>;

const toReading = (s: Stored): Position => ({ takenAt: new Date(s.t), latitude: s.lat, longitude: s.lon, accuracyM: s.acc });

export const createTrailBuffer = (storage: Pick<Storage, 'getItem' | 'setItem'>): TrailBuffer => {
  const read = (): Contents => {
    const raw = storage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Contents) : {};
  };
  const write = (contents: Contents) => storage.setItem(KEY, JSON.stringify(contents));
  const readSent = (): Sent => JSON.parse(storage.getItem(SENT_KEY) ?? '{}') as Sent;
  const writeSent = (sent: Sent) => storage.setItem(SENT_KEY, JSON.stringify(sent));
  const slots = (contents: Contents, adventureId: string) => Object.keys(contents[adventureId] ?? {}).sort();

  let running: Promise<void> | null = null;

  const run = async (send: Parameters<TrailBuffer['flush']>[0]) => {
    for (const adventureId of Object.keys(read())) {
      for (;;) {
        const contents = read();
        const batchKeys = slots(contents, adventureId).slice(0, BATCH);
        if (batchKeys.length === 0) break;
        const batch = batchKeys.map((k) => toReading(contents[adventureId][k]));
        const outcome = await send(adventureId as AdventureId, batch);
        if (outcome === 'retry') return;
        const after = read();
        if (outcome === 'refused') delete after[adventureId];
        else {
          writeSent({ ...readSent(), [adventureId]: batchKeys.at(-1)! });
          if (after[adventureId]) {
            for (const k of batchKeys) delete after[adventureId][k];
            if (Object.keys(after[adventureId]).length === 0) delete after[adventureId];
          }
        }
        write(after);
      }
    }
  };

  return {
    add: (adventureId, readings) => {
      const contents = read();
      const own = (contents[adventureId] ??= {});
      const sent = readSent()[adventureId] ?? '';
      for (const r of readings) {
        const slot = slotKey(r);
        if (slot > sent) own[slot] ??= { t: r.takenAt.toISOString(), lat: r.latitude, lon: r.longitude, acc: r.accuracyM };
      }
      if (Object.keys(own).length === 0) delete contents[adventureId];
      for (const k of slots(contents, adventureId).slice(0, -MAX_SLOTS)) delete own[k];
      write(contents);
    },
    flush: (send) => {
      running ??= run(send).finally(() => {
        running = null;
      });
      return running;
    },
    keepOnly: (adventureId) => {
      const contents = read();
      write(adventureId && contents[adventureId] ? { [adventureId]: contents[adventureId] } : {});
      const sent = readSent();
      writeSent(adventureId && sent[adventureId] ? { [adventureId]: sent[adventureId] } : {});
    },
    newest: (adventureId) => {
      const contents = read();
      const last = slots(contents, adventureId).at(-1);
      return last ? toReading(contents[adventureId][last]) : null;
    },
  };
};
