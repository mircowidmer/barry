import { useEffect, useRef, useSyncExternalStore } from 'react';

/** A Check-in made without signal, which the phone keeps until it can send it. */
export type WaitingCheckIn = { at: Date; keepsTrying: boolean };

/** What the bottom accessory needs to offer Hold to Check In for the Live Adventure, or to say a Check-in waits. */
export type CheckInOffer = { busy: boolean; checkIn: () => void; waiting: WaitingCheckIn | null };

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
export const useOfferCheckIn = (live: boolean, busy: boolean, checkIn: () => void, waiting: WaitingCheckIn | null) => {
  // The latest callback, so a new closure on every render does not republish the offer.
  const latest = useRef(checkIn);
  useEffect(() => {
    latest.current = checkIn;
  });
  // The waiting Check-in by value, so a new Date for the same moment does not republish the offer.
  const at = waiting?.at.getTime() ?? null;
  const keepsTrying = waiting?.keepsTrying ?? false;
  useEffect(() => {
    const waitingNow = at === null ? null : { at: new Date(at), keepsTrying };
    setCheckInOffer(live ? { busy, checkIn: () => latest.current(), waiting: waitingNow } : null);
    return () => setCheckInOffer(null);
  }, [live, busy, at, keepsTrying]);
};
