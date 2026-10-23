import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { getCheckInOffer, setCheckInOffer, subscribeToCheckInOffer } from './live-check-in';

const offer = () => ({ busy: false, checkIn: jest.fn() });

describe('the Check-in offer', () => {
  afterEach(() => setCheckInOffer(null));

  it('reaches both copies of the accessory, and so does its withdrawal', () => {
    const regular = jest.fn();
    const inline = jest.fn();
    subscribeToCheckInOffer(regular);
    subscribeToCheckInOffer(inline);
    const offered = offer();

    setCheckInOffer(offered);
    expect(getCheckInOffer()).toBe(offered);
    setCheckInOffer(null);

    expect(getCheckInOffer()).toBeNull();
    expect(regular).toHaveBeenCalledTimes(2);
    expect(inline).toHaveBeenCalledTimes(2);
  });

  it('does not wake the accessory for the same offer twice, nor after it unsubscribed', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToCheckInOffer(listener);
    const offered = offer();

    setCheckInOffer(offered);
    setCheckInOffer(offered);
    unsubscribe();
    setCheckInOffer(null);

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
