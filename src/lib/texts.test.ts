import { describe, expect, it } from '@jest/globals';

import type { DeliveryFailure } from '@/lib/barry';

import { texts } from './texts';

describe('a Delivery Failure', () => {
  const failure: DeliveryFailure = {
    id: 1,
    message: 'alert',
    contactName: 'Luca',
    channel: 'email',
    address: 'luca@example.com',
    reason: 'HTTP 403: Resend validation_error',
  };

  it('names the message with the glossary term, in English and German', () => {
    expect(texts.en.adventure.failure(failure)).toBe('Luca: Alert by email (HTTP 403: Resend validation_error)');
    expect(texts.de.adventure.failure(failure)).toBe('Luca: Alarm per E-Mail (HTTP 403: Resend validation_error)');
    expect(texts.en.adventure.failure({ ...failure, message: 'deadline_update', channel: 'sms', reason: 'retries_exhausted' })).toBe(
      'Luca: Deadline Update by text message (gave up after several attempts)',
    );
  });
});
