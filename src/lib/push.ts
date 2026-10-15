import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';

import { barry } from '@/lib/barry';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type PushRegistration = 'registered' | 'denied' | 'unavailable';

/** Asks for permission once, then registers this phone's Expo push token. Safe to call on every app open. */
export const registerForPush = async (): Promise<PushRegistration> => {
  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted || !current.canAskAgain ? current : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return 'denied';

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return 'unavailable';
  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    await barry.registerPushDevice(token.data);
    return 'registered';
  } catch {
    return 'unavailable';
  }
};
