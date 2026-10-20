const fs = require('fs');
const path = require('path');
const {
  AndroidConfig,
  withAndroidColors,
  withAndroidColorsNight,
  withAndroidStyles,
  withDangerousMod,
  withXcodeProject,
} = require('expo/config-plugins');

// The accent colours of src/constants/theme.ts, read from the source so the two cannot drift.
function accents() {
  const source = fs.readFileSync(path.join(__dirname, '../src/constants/theme.ts'), 'utf8');
  const accent = (scheme) => source.match(new RegExp(`${scheme}: \\{[^}]*?accent: '(#[0-9A-Fa-f]{6})'`))[1];
  return { light: accent('light'), dark: accent('dark') };
}

function colorsetEntry(hex, appearance) {
  const [red, green, blue] = [1, 3, 5].map((i) => `0x${hex.slice(i, i + 2).toUpperCase()}`);
  return {
    ...(appearance && { appearances: [{ appearance: 'luminosity', value: appearance }] }),
    color: { 'color-space': 'srgb', components: { alpha: '1.000', red, green, blue } },
    idiom: 'universal',
  };
}

// iOS takes its default tint, for alerts and every control without its own colour, from the asset
// catalog's global accent colour.
const withIosAccentColor = (config) => {
  config = withDangerousMod(config, [
    'ios',
    (config) => {
      const { light, dark } = accents();
      const dir = path.join(config.modRequest.platformProjectRoot, config.modRequest.projectName, 'Images.xcassets', 'AccentColor.colorset');
      fs.mkdirSync(dir, { recursive: true });
      const contents = { colors: [colorsetEntry(light), colorsetEntry(dark, 'dark')], info: { author: 'expo', version: 1 } };
      fs.writeFileSync(path.join(dir, 'Contents.json'), `${JSON.stringify(contents, null, 2)}\n`);
      return config;
    },
  ]);
  return withXcodeProject(config, (config) => {
    for (const entry of Object.values(config.modResults.pbxXCBuildConfigurationSection())) {
      if (entry.buildSettings?.PRODUCT_BUNDLE_IDENTIFIER) entry.buildSettings.ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = 'AccentColor';
    }
    return config;
  });
};

// Android dialogs, such as the Deadline's date and time pickers, take the app theme's colorAccent.
const withAndroidAccentColor = (config) => {
  const assign = (scheme) => (config) => {
    config.modResults = AndroidConfig.Colors.assignColorValue(config.modResults, { name: 'colorAccent', value: accents()[scheme] });
    return config;
  };
  config = withAndroidColors(config, assign('light'));
  config = withAndroidColorsNight(config, assign('dark'));
  return withAndroidStyles(config, (config) => {
    config.modResults = AndroidConfig.Styles.assignStylesValue(config.modResults, {
      add: true,
      parent: AndroidConfig.Styles.getAppThemeGroup(),
      name: 'colorAccent',
      value: '@color/colorAccent',
    });
    return config;
  });
};

module.exports = (config) => withAndroidAccentColor(withIosAccentColor(config));
