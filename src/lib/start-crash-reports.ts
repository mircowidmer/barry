import * as Sentry from '@sentry/react-native';

import { crashReportOptions } from './crash-reports';

// A build without EXPO_PUBLIC_SENTRY_DSN, and every development build, sends nothing.
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (dsn && !__DEV__) Sentry.init(crashReportOptions(dsn));
