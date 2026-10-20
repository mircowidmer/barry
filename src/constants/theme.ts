export const Colors = {
  light: {
    text: '#1C1A19',
    background: '#FAF8F5',
    backgroundElement: '#EFEBE6',
    backgroundSelected: '#E2DDD6',
    textSecondary: '#6B645E',
    accent: '#B5562A',
    onAccent: '#FFFFFF',
    success: '#1F7A3D',
    warning: '#856000',
    danger: '#C62828',
  },
  dark: {
    text: '#FAF8F5',
    background: '#1C1A19',
    backgroundElement: '#2A2725',
    backgroundSelected: '#3A3633',
    textSecondary: '#B3ACA5',
    accent: '#E07A4A',
    onAccent: '#1C1A19',
    success: '#5CC97F',
    warning: '#E8B23A',
    danger: '#FF7A7A',
  },
} as const;

// Bundled on iOS by the expo-font plugin and served from public/fonts on the web. Android falls back to its system font.
export const FontFamily = 'Nordwand Mono';

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Spacing = {
  one: 4,
  two: 8,
  three: 16,
  four: 24,
} as const;

export const MaxContentWidth = 800;
