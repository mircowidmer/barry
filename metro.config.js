// Sentry's serializer gives the bundle and its source map a shared debug ID, so a minified stack trace in a crash
// report can be matched to the source.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);
