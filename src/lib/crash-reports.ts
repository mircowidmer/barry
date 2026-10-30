import type { Event, ReactNativeOptions } from '@sentry/react-native';

const EMAIL = /[^\s@<>"'(),;:]+@[^\s@<>"'(),;:]+\.[a-z]{2,}/gi;
const COORDINATE = /-?\d{1,3}\.\d{4,}/g;
// A leading + or 0, so dates and counts in a message stay readable.
const PHONE = /(?:\+|\b0)\d[\d ()/-]{6,}\d/g;

/** Takes email addresses, phone numbers and coordinates out of an error message. */
export const redact = (text: string): string =>
  text.replace(EMAIL, '[email]').replace(COORDINATE, '[coordinate]').replace(PHONE, '[phone]');

/**
 * Leaves a report only what broke and where: the error, its stack and the app, OS and device model. Who the Adventurer
 * is, where they are and what they did before stays on the phone.
 */
export const scrubEvent = <T extends Event>(event: T): T => {
  delete event.user;
  delete event.request;
  delete event.extra;
  delete event.server_name;
  delete event.breadcrumbs;
  if (event.contexts?.device) delete event.contexts.device.name;
  // Stays the same for every report from one phone, so it would tie them to one person.
  if (event.contexts?.app) delete event.contexts.app.device_app_hash;
  if (event.message) event.message = redact(event.message);
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = redact(exception.value);
  }
  return event;
};

/** Crash and error reports only: no sessions, tracing, screenshots, breadcrumbs or personal data. */
export const crashReportOptions = (dsn: string): ReactNativeOptions => ({
  dsn,
  sendDefaultPii: false,
  // A session is sent on every launch, which would make it usage analytics rather than crash reports.
  enableAutoSessionTracking: false,
  // Also reaches the native SDK, so a native crash carries no breadcrumbs either.
  maxBreadcrumbs: 0,
  enableAutoPerformanceTracing: false,
  enableCaptureFailedRequests: false,
  attachScreenshot: false,
  attachViewHierarchy: false,
  beforeSend: scrubEvent,
});
