import * as Notifications from 'expo-notifications';

import { currentTexts } from '@/lib/texts';

export const ALARM_CHANNEL = 'alarms';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Asks once for permission to show the Reminder and the Overdue Notice. Safe to call on every app open. */
export const askForNotifications = async () => {
  // Android 13 asks for the permission only once a channel exists; on iOS this does nothing.
  await Notifications.setNotificationChannelAsync(ALARM_CHANNEL, {
    name: currentTexts().adventure.alarmChannel,
    importance: Notifications.AndroidImportance.MAX,
  });
  const current = await Notifications.getPermissionsAsync();
  if (!current.granted && current.canAskAgain) await Notifications.requestPermissionsAsync();
};
