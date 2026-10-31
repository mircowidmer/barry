import { describe, expect, it } from '@jest/globals';

import { checkInTarget, checkInTargetId, createLiveActivity, type LiveActivityView } from './live-activity';
import type { AdventureId } from './types';

const a1 = 'a1' as AdventureId;

describe('checkInTargetId', () => {
  it('reads back the Adventure the Check In button names', () => {
    expect(checkInTargetId(checkInTarget(a1))).toBe(a1);
  });

  it('ignores a tap on anything else', () => {
    expect(checkInTargetId('check-in:')).toBeNull();
    expect(checkInTargetId('move-deadline:a1')).toBeNull();
  });
});

describe('createLiveActivity', () => {
  it('passes on only a changed view, and tries again after iOS refused one', async () => {
    const view: LiveActivityView = { adventureId: a1, destination: 'Basel', startedAt: new Date(0), deadline: new Date(1) };
    let due: LiveActivityView | null = view;
    let refuse = true;
    const shown: (LiveActivityView | null)[] = [];
    const activity = createLiveActivity({
      service: {
        show: async (next) => {
          if (refuse) throw new Error('Live Activities are off');
          shown.push(next);
        },
      },
      due: () => due,
    });

    await expect(activity.sync()).rejects.toThrow();
    refuse = false;
    await activity.sync();
    await activity.sync();
    due = null;
    await activity.sync();
    expect(shown).toEqual([view, null]);
  });
});
