import { describe, expect, it } from '@jest/globals';

import { createLiveActivity, type LiveActivityView } from './live-activity';
import type { AdventureId } from './types';

const a1 = 'a1' as AdventureId;

describe('createLiveActivity', () => {
  it('passes on only a changed view or text context, and tries again after iOS refused one', async () => {
    const view: LiveActivityView = { adventureId: a1, destination: 'Basel', startedAt: new Date(0), deadline: new Date(1) };
    let due: LiveActivityView | null = view;
    let refuse = true;
    let context = 'Sat Oct 17 2026 en';
    const shown: (LiveActivityView | null)[] = [];
    const activity = createLiveActivity({
      service: {
        show: async (next) => {
          if (refuse) throw new Error('Live Activities are off');
          shown.push(next);
        },
      },
      due: () => due,
      textContext: () => context,
    });

    await expect(activity.sync()).rejects.toThrow();
    refuse = false;
    await activity.sync();
    await activity.sync();
    context = 'Sun Oct 18 2026 en';
    await activity.sync();
    due = null;
    await activity.sync();
    expect(shown).toEqual([view, view, null]);
  });
});
