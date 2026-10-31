import { type EventSubscription, requireOptionalNativeModule } from 'expo';

export type LiveActivityTap = { target: string; at: number };

type Native = {
  take(): LiveActivityTap[];
  finish(): void;
  addListener(event: 'onTap', listener: () => void): EventSubscription;
};

// Only Apple has the module; elsewhere there is no Live Activity to tap.
const LiveActivityTaps = requireOptionalNativeModule<Native>('LiveActivityTaps');

/** Calls `onTaps` with the taps kept since launch, then with each new one. */
export const listenForTaps = (onTaps: (taps: LiveActivityTap[]) => Promise<void>) => {
  if (!LiveActivityTaps) return;
  let running = 0;
  const drain = () => {
    const taps = LiveActivityTaps.take();
    if (taps.length === 0) return;
    running++;
    void onTaps(taps)
      .catch(() => undefined)
      .finally(() => {
        if (--running === 0) LiveActivityTaps.finish();
      });
  };
  LiveActivityTaps.addListener('onTap', drain);
  drain();
};
