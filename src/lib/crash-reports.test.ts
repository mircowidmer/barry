import { describe, expect, it } from '@jest/globals';
import type { ErrorEvent } from '@sentry/react-native';

import { crashReportOptions, redact, scrubEvent } from './crash-reports';

describe('redact', () => {
  it('takes out email addresses, phone numbers and coordinates', () => {
    expect(redact('No contact anna.muster@example.ch')).toBe('No contact [email]');
    expect(redact('Text to +41 79 123 45 67 failed')).toBe('Text to [phone] failed');
    expect(redact('Text to 079 123 45 67 failed')).toBe('Text to [phone] failed');
    expect(redact('Fix at 46.5578921, 7.9799384')).toBe('Fix at [coordinate], [coordinate]');
  });

  it('keeps dates, counts and identifiers readable', () => {
    const message = 'Deadline 2026-10-30T18:00:00Z passed 3 times for 1c9e4a2b-77f0-4c3e-9d1a-5b2f8e6a0c11';
    expect(redact(message)).toBe(message);
  });
});

describe('scrubEvent', () => {
  it('keeps the error and its stack and drops who, where and what came before', () => {
    const event: ErrorEvent = {
      type: undefined,
      message: 'Start failed for anna@example.ch',
      user: { id: 'u1', email: 'anna@example.ch', ip_address: '1.2.3.4' },
      request: { url: 'https://example.supabase.co/rest/v1/adventures?id=eq.1' },
      extra: { destination: 'Eiger' },
      server_name: "Anna's iPhone",
      breadcrumbs: [{ message: 'tapped Start' }],
      contexts: {
        device: { name: "Anna's iPhone", model: 'iPhone16,1' },
        app: { app_version: '1.0.0', device_app_hash: 'ba6e05d73cad8111903e83c5d458263da95eed34' },
      },
      exception: { values: [{ type: 'Error', value: 'No fix near 46.5578921', stacktrace: { frames: [{ function: 'start' }] } }] },
    };

    expect(scrubEvent(event)).toEqual({
      type: undefined,
      message: 'Start failed for [email]',
      contexts: { device: { model: 'iPhone16,1' }, app: { app_version: '1.0.0' } },
      exception: { values: [{ type: 'Error', value: 'No fix near [coordinate]', stacktrace: { frames: [{ function: 'start' }] } }] },
    });
  });
});

describe('crashReportOptions', () => {
  it('sends no personal data, sessions, breadcrumbs, screenshots or traces, and scrubs every event', () => {
    expect(crashReportOptions('https://key@example.ingest.sentry.io/1')).toMatchObject({
      sendDefaultPii: false,
      enableAutoSessionTracking: false,
      maxBreadcrumbs: 0,
      enableAutoPerformanceTracing: false,
      enableCaptureFailedRequests: false,
      attachScreenshot: false,
      attachViewHierarchy: false,
      beforeSend: scrubEvent,
    });
  });
});
