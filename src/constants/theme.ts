export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    accent: '#0B6BCB',
    onAccent: '#ffffff',
    success: '#1F7A3D',
    warning: '#A35200',
    danger: '#C62828',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    accent: '#5AA9FF',
    onAccent: '#000000',
    success: '#5CC97F',
    warning: '#FFB86B',
    danger: '#FF7A7A',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Spacing = {
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  six: 64,
} as const;

export const MaxContentWidth = 800;
