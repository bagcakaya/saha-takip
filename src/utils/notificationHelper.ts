import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Check if running in Expo Go by checking executionEnvironment and appOwnership
const isExpoGo =
  Constants.appOwnership === 'expo' ||
  (Constants as any).executionEnvironment === 'storeClient';

// Lazily load expo-notifications only if NOT running in Expo Go
let Notifications: any = null;

if (!isExpoGo && Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (error) {
    console.error('expo-notifications module could not be required:', error);
  }
}

/**
 * Requests push notification permission in standalone builds.
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (isExpoGo || Platform.OS === 'web' || !Notifications) {
    return false;
  }
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      const { status: askStatus } = await Notifications.requestPermissionsAsync();
      return askStatus === 'granted';
    }
    return true;
  } catch (error) {
    console.error('Permission request failed:', error);
    return false;
  }
};

/**
 * Schedules a local notification at the OS level (triggers even when app is closed).
 * Returns notification identifier string, or undefined if skipped/failed.
 */
export const scheduleLocalReminder = async (
  title: string,
  body: string,
  date: Date
): Promise<string | undefined> => {
  if (isExpoGo || Platform.OS === 'web' || !Notifications) {
    console.log('Expo Go or Web environment: Native OS notifications are bypassed.');
    return undefined;
  }
  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: date,
      },
    });
    return identifier;
  } catch (error) {
    console.error('Failed to schedule local notification:', error);
    return undefined;
  }
};

/**
 * Cancels a scheduled local notification.
 */
export const cancelLocalReminder = async (identifier: string): Promise<void> => {
  if (isExpoGo || Platform.OS === 'web' || !Notifications || !identifier) {
    return;
  }
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch (error) {
    console.error('Failed to cancel scheduled notification:', error);
  }
};
