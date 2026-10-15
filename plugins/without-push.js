const { withEntitlementsPlist } = require('expo/config-plugins');

// Free Apple teams cannot sign the Push Notifications capability, so builds for them leave it out.
// It is listed first in app.json so it runs after expo-notifications adds the entitlement.
module.exports = (config) =>
  withEntitlementsPlist(config, (config) => {
    if (process.env.BARRY_WITHOUT_PUSH === '1') delete config.modResults['aps-environment'];
    return config;
  });
