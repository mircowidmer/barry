import {
  type AndroidSymbol,
  type SFSymbol,
  SymbolView as ExpoSymbolView,
  type SymbolViewProps as ExpoSymbolViewProps,
  unstable_getMaterialSymbolSourceAsync,
} from 'expo-symbols';
import type { ImageSourcePropType } from 'react-native';
import { Platform } from 'react-native';

// Android has no SF Symbols, so each one Barry shows names its Material Symbol here.
const MATERIAL = {
  'bell.slash': 'notifications_off',
  'car.fill': 'directions_car',
  checkmark: 'check',
  'checkmark.circle': 'check_circle',
  'checkmark.circle.fill': 'check_circle',
  'chevron.right': 'chevron_right',
  circle: 'radio_button_unchecked',
  clock: 'schedule',
  'clock.arrow.circlepath': 'history',
  cloud: 'cloud',
  'cloud.bolt.rain': 'thunderstorm',
  'cloud.drizzle': 'rainy_light',
  'cloud.fog': 'foggy',
  'cloud.heavyrain': 'rainy_heavy',
  'cloud.moon': 'nights_stay',
  'cloud.rain': 'rainy',
  'cloud.snow': 'weather_snowy',
  'cloud.sun': 'partly_cloudy_day',
  'cross.case.fill': 'medical_services',
  drop: 'water_drop',
  envelope: 'mail',
  'exclamationmark.circle': 'error',
  'exclamationmark.triangle': 'warning',
  'exclamationmark.triangle.fill': 'warning',
  'figure.hiking': 'hiking',
  'info.circle': 'info',
  'location.fill': 'location_on',
  'location.slash': 'location_off',
  map: 'map',
  'mappin.circle.fill': 'pin_drop',
  'mappin.slash': 'wrong_location',
  message: 'sms',
  'minus.circle': 'do_not_disturb_on',
  'moon.stars': 'bedtime',
  paperplane: 'send',
  pencil: 'edit',
  'play.fill': 'play_arrow',
  'person.2': 'group',
  'person.fill': 'person',
  plus: 'add',
  'sun.max': 'sunny',
  sunset: 'wb_twilight',
  'thermometer.medium': 'thermostat',
  trash: 'delete',
  'wifi.slash': 'wifi_off',
  wind: 'air',
  xmark: 'close',
} as const satisfies Partial<Record<SFSymbol, AndroidSymbol>>;

export type SymbolName = keyof typeof MATERIAL;

export type SymbolViewProps = Omit<ExpoSymbolViewProps, 'name'> & { name: SymbolName };

export function SymbolView({ name, ...props }: SymbolViewProps) {
  return <ExpoSymbolView name={{ ios: name, android: MATERIAL[name] }} {...props} />;
}

const TOOLBAR_SYMBOLS = ['checkmark', 'clock', 'pencil', 'person.2', 'play.fill', 'plus', 'trash', 'xmark'] as const satisfies SymbolName[];
type ToolbarSymbol = (typeof TOOLBAR_SYMBOLS)[number];

const toolbarImages = new Map<ToolbarSymbol, ImageSourcePropType>();

/**
 * The toolbar's Material Symbols rendered to images, because Android's toolbar takes images only. The work starts on
 * the first import, beside the session restore, rather than after the first render.
 */
export const toolbarIconsLoaded: Promise<void> = (async () => {
  if (Platform.OS !== 'android') return;
  await Promise.all(
    TOOLBAR_SYMBOLS.map(async (name) => {
      const image = await unstable_getMaterialSymbolSourceAsync(MATERIAL[name], 24, '#000000').catch(() => null);
      if (image) toolbarImages.set(name, image);
    }),
  );
})();

/** The icon of a Stack.Toolbar item: the SF Symbol on iOS, the image rendered for it on Android. */
export const toolbarIcon = (name: ToolbarSymbol): SFSymbol | ImageSourcePropType | undefined =>
  Platform.OS === 'android' ? toolbarImages.get(name) : name;

/** The icon of a Stack.Toolbar item that shows text on iOS: Android's toolbar renders no item without an image. */
export const androidToolbarIcon = (name: ToolbarSymbol): ImageSourcePropType | undefined =>
  Platform.OS === 'android' ? toolbarImages.get(name) : undefined;
