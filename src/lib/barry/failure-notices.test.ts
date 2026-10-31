import { describe, expect, it } from '@jest/globals';

import { createFailureNotices } from './failure-notices';
import type { AdventureId, InProgressAdventure, SentMessage } from './types';

const memoryStorage = () => {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
};

const a1 = 'a1' as AdventureId;
const a2 = 'a2' as AdventureId;
const adventure = (id: AdventureId) => ({ id, stage: 'active' }) as InProgressAdventure;
const message = (id: number, outcome: SentMessage['outcome'], undelivered = false) =>
  ({ id, message: 'heads_up', channel: 'sms', outcome, undelivered }) as SentMessage;

const setup = ({ storage = memoryStorage() } = {}) => {
  const shown: string[] = [];
  const world = {
    live: adventure(a1) as InProgressAdventure | null,
    messages: new Map<AdventureId, SentMessage[]>([[a1, []]]),
  };
  const notices = createFailureNotices({
    storage,
    show: async (m, id) => void shown.push(`${id}:${m.id}`),
    inProgress: () => world.live,
    messages: async (id) => world.messages.get(id) ?? [],
  });
  return { notices, shown, world, storage };
};

describe('the notice of an undelivered text message', () => {
  it('shows each undelivered message once, also when two triggers arrive together and after a relaunch', async () => {
    const { notices, shown, world, storage } = setup();
    world.messages.set(a1, [message(1, 'failed', true), message(2, 'failed'), message(3, 'delivered'), message(4, 'sent')]);
    await Promise.all([notices.notice(), notices.notice()]);
    const relaunched = setup({ storage });
    relaunched.world.messages = world.messages;
    await relaunched.notices.notice();
    expect([...shown, ...relaunched.shown]).toEqual(['a1:1']);
  });

  it('keeps looking at the Adventure after the Check-in, for the All-clear, until another one starts', async () => {
    const { notices, shown, world } = setup();
    await notices.notice();
    world.live = null;
    world.messages.set(a1, [message(5, 'failed', true)]);
    await notices.notice();
    world.live = adventure(a2);
    world.messages.set(a2, [message(6, 'failed', true)]);
    await notices.notice();
    expect(shown).toEqual(['a1:5', 'a2:6']);
  });

  it('shows nothing before the first Adventure', async () => {
    const { notices, shown, world } = setup();
    world.live = null;
    world.messages.set(a1, [message(1, 'failed', true)]);
    await notices.notice();
    expect(shown).toEqual([]);
  });

  it('shows a notice again on the next try when showing it failed', async () => {
    const storage = memoryStorage();
    const failing = createFailureNotices({
      storage,
      show: async () => {
        throw new Error('not permitted');
      },
      inProgress: () => adventure(a1),
      messages: async () => [message(1, 'failed', true)],
    });
    await expect(failing.notice()).rejects.toThrow('not permitted');
    const { notices, shown, world } = setup({ storage });
    world.messages.set(a1, [message(1, 'failed', true)]);
    await notices.notice();
    expect(shown).toEqual(['a1:1']);
  });
});
