import { useEffect, useRef, useSyncExternalStore } from 'react';

/** What the bottom accessory needs to offer Hold to Check In for the Live Adventure. */
export type CheckInOffer = { busy: boolean; checkIn: () => void };

let offer: CheckInOffer | null = null;
const listeners = new Set<() => void>();

export const setCheckInOffer = (next: CheckInOffer | null) => {
  if (offer === next) return;
  offer = next;
  listeners.forEach((listener) => listener());
};

export const getCheckInOffer = () => offer;

export const subscribeToCheckInOffer = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * The Check-in the Live Adventure offers, or null without one. The accessory renders twice, once regular and
 * once inline, so both copies read it here instead of keeping state of their own.
 */
export const useCheckInOffer = () => useSyncExternalStore(subscribeToCheckInOffer, getCheckInOffer);

/** Offers the Check-in while `live` is true, and withdraws it when the screen goes away. */
export const useOfferCheckIn = (live: boolean, busy: boolean, checkIn: () => void) => {
  // The latest callback, so a new closure on every render does not republish the offer.
  const latest = useRef(checkIn);
  useEffect(() => {
    latest.current = checkIn;
  });
  useEffect(() => {
    setCheckInOffer(live ? { busy, checkIn: () => latest.current() } : null);
    return () => setCheckInOffer(null);
  }, [live, busy]);
};
