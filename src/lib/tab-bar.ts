import { useEffect, useSyncExternalStore } from 'react';

let hidden = false;
const listeners = new Set<() => void>();

const setHidden = (value: boolean) => {
  if (hidden === value) return;
  hidden = value;
  listeners.forEach((listener) => listener());
};

/** Whether a screen asked to hide the tab bar, as Photos and Files do while selecting. */
export const useTabBarHidden = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => hidden,
  );

/** Hides the tab bar while `hide` is true, and shows it again when the screen goes away. */
export const useHideTabBar = (hide: boolean) => {
  useEffect(() => {
    setHidden(hide);
    return () => setHidden(false);
  }, [hide]);
};
