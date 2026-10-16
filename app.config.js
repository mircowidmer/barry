// app.json holds the settings every build shares. APP_VARIANT picks what differs, so the
// development, preview and production apps can sit side by side on one phone.
const VARIANTS = {
  development: { label: 'Barry Dev', id: 'support.barry.dev', scheme: 'barry-dev' },
  preview: { label: 'Barry Preview', id: 'support.barry.preview', scheme: 'barry-preview' },
  production: { label: 'Barry', id: 'support.barry', scheme: 'barry' },
};

const variant = process.env.APP_VARIANT ?? 'production';
if (!(variant in VARIANTS)) throw new Error(`APP_VARIANT must be one of ${Object.keys(VARIANTS).join(', ')}, not ${variant}`);
const { label, id, scheme } = VARIANTS[variant];

module.exports = ({ config }) => ({
  ...config,
  scheme,
  ios: {
    ...config.ios,
    bundleIdentifier: id,
    infoPlist: {
      ...config.ios?.infoPlist,
      // The name under the icon. config.name stays Barry, because prebuild names the Xcode project after it.
      CFBundleDisplayName: label,
      // Only a development build loads its JavaScript from Metro on the Mac.
      ...(variant === 'development' && {
        NSLocalNetworkUsageDescription: 'Barry connects to your development Mac on this network while you test it.',
      }),
    },
  },
  android: { ...config.android, package: id },
});
