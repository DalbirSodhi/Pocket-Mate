import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const IDENTIFIER_PREFIX = 'pocket-mate-';
const ANDROID_CHANNEL_ID = 'pocket-mate-reminders';
const DEFAULT_REMINDER_HOUR = 9;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function isPermissionGranted(settings) {
  return Boolean(
    settings?.granted ||
      settings?.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL,
  );
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : 'Unknown notification error.';
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Pocket-Mate reminders',
    description: 'Local reminders for bills and financial planning events.',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
  });
}

function getEventDate(event) {
  const value =
    event?.date ??
    event?.eventDate ??
    event?.dueOn ??
    event?.dueDate ??
    event?.startsAt ??
    event?.startAt;

  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  if (typeof value === 'string') {
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (dateOnly) {
      return new Date(
        Number(dateOnly[1]),
        Number(dateOnly[2]) - 1,
        Number(dateOnly[3]),
      );
    }
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toBoundedInteger(value, fallback, minimum, maximum) {
  const number = typeof value === 'string' && value.trim() ? Number(value) : value;
  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, Math.trunc(number)));
}

function getReminderTime(event, preferences) {
  const rawHour =
    event?.reminderHour ??
    event?.reminder_hour ??
    preferences?.reminderHour ??
    preferences?.reminder_hour;
  const rawMinute =
    event?.reminderMinute ??
    event?.reminder_minute ??
    preferences?.reminderMinute ??
    preferences?.reminder_minute;

  if (typeof rawHour === 'string' && rawHour.includes(':')) {
    const [hour, minute] = rawHour.split(':');
    return {
      hour: toBoundedInteger(hour, DEFAULT_REMINDER_HOUR, 0, 23),
      minute: toBoundedInteger(minute, 0, 0, 59),
    };
  }

  return {
    hour: toBoundedInteger(rawHour, DEFAULT_REMINDER_HOUR, 0, 23),
    minute: toBoundedInteger(rawMinute, 0, 0, 59),
  };
}

function getLeadDays(event, preferences) {
  const configuredLeadDays =
    event?.leadDays ??
    event?.lead_days ??
    event?.reminderLeadDays ??
    event?.reminder_lead_days ??
    preferences?.leadDays ??
    preferences?.lead_days ??
    preferences?.defaultLeadDays;
  const values = Array.isArray(configuredLeadDays)
    ? configuredLeadDays
    : [configuredLeadDays ?? 0];

  return [
    ...new Set(values.map((value) => toBoundedInteger(value, 0, 0, 365))),
  ];
}

function getTriggerDate(event, preferences, leadDays) {
  const eventDate = getEventDate(event);
  if (!eventDate) {
    return null;
  }

  const { hour, minute } = getReminderTime(event, preferences);

  eventDate.setDate(eventDate.getDate() - leadDays);
  eventDate.setHours(hour, minute, 0, 0);
  return eventDate;
}

function stableHash(value) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function getNotificationIdentifier(event, leadDays, reminderTime) {
  const eventId = event?.id ?? event?.eventId;
  if (eventId === undefined || eventId === null || String(eventId).trim() === '') {
    return null;
  }

  const value = String(eventId);
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32);
  return `${IDENTIFIER_PREFIX}${slug || 'event'}-${stableHash(value)}-${leadDays}d-${reminderTime.hour}${String(reminderTime.minute).padStart(2, '0')}`;
}

function remindersAreEnabled(preferences) {
  return !(
    preferences?.enabled === false ||
    preferences?.remindersEnabled === false ||
    preferences?.reminders_enabled === false ||
    preferences?.notificationsEnabled === false
  );
}

function eventReminderIsEnabled(event, preferences) {
  const typeEnabled =
    event?.type === 'credit_card_bill'
      ? preferences?.remind_card_bills !== false
      : event?.type === 'recurring_expense'
        ? preferences?.remind_recurring_bills !== false
        : event?.type === 'payday'
          ? preferences?.remind_paydays === true
          : true;

  return !(
    !typeEnabled ||
    event?.reminderEnabled === false ||
    event?.reminder_enabled === false ||
    event?.notificationsEnabled === false
  );
}

async function getPocketMateNotifications() {
  const notifications = await Notifications.getAllScheduledNotificationsAsync();
  return notifications.filter(({ identifier }) => identifier?.startsWith(IDENTIFIER_PREFIX));
}

export async function requestReminderPermission() {
  try {
    await ensureAndroidChannel();
    let settings = await Notifications.getPermissionsAsync();

    if (!isPermissionGranted(settings)) {
      settings = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: false,
          allowSound: true,
        },
      });
    }

    return {
      supported: true,
      granted: isPermissionGranted(settings),
      status: settings?.status ?? 'undetermined',
    };
  } catch (error) {
    return {
      supported: false,
      granted: false,
      status: 'error',
      error: getErrorMessage(error),
    };
  }
}

export async function syncPocketMateReminders({ events = [], preferences = {} } = {}) {
  const result = {
    supported: true,
    granted: false,
    scheduledCount: 0,
    cancelledCount: 0,
    skippedCount: 0,
    errors: [],
  };

  try {
    await ensureAndroidChannel();
    const scheduled = await getPocketMateNotifications();

    for (const notification of scheduled) {
      try {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        result.cancelledCount += 1;
      } catch (error) {
        result.errors.push({
          identifier: notification.identifier,
          operation: 'cancel',
          message: getErrorMessage(error),
        });
      }
    }

    if (!remindersAreEnabled(preferences)) {
      return result;
    }

    const permission = await Notifications.getPermissionsAsync();
    result.granted = isPermissionGranted(permission);
    if (!result.granted) {
      result.reason = 'permission-required';
      return result;
    }

    const safeEvents = Array.isArray(events) ? events : [];
    const identifiers = new Set();

    for (const event of safeEvents) {
      const leadDaysValues = getLeadDays(event, preferences);
      const reminderTime = getReminderTime(event, preferences);

      if (!eventReminderIsEnabled(event, preferences)) {
        result.skippedCount += leadDaysValues.length;
        continue;
      }

      for (const leadDays of leadDaysValues) {
        const identifier = getNotificationIdentifier(event, leadDays, reminderTime);
        const triggerDate = getTriggerDate(event, preferences, leadDays);

        if (
          !identifier ||
          !triggerDate ||
          triggerDate.getTime() <= Date.now() ||
          identifiers.has(identifier)
        ) {
          result.skippedCount += 1;
          continue;
        }

        identifiers.add(identifier);

        try {
          await Notifications.scheduleNotificationAsync({
            identifier,
            content: {
              title:
                event?.reminderTitle ??
                event?.reminder_title ??
                event?.title ??
                event?.name ??
                'Pocket-Mate reminder',
              body:
                event?.reminderBody ??
                event?.reminder_body ??
                event?.body ??
                'A planned financial event is coming up.',
              sound: 'default',
              data: {
                source: 'pocket-mate',
                eventId: String(event?.id ?? event?.eventId),
                eventType: String(event?.type ?? 'planning-event'),
                leadDays,
              },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: triggerDate,
              ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
            },
          });
          result.scheduledCount += 1;
        } catch (error) {
          result.errors.push({
            identifier,
            operation: 'schedule',
            message: getErrorMessage(error),
          });
        }
      }
    }

    return result;
  } catch (error) {
    return {
      ...result,
      supported: false,
      error: getErrorMessage(error),
    };
  }
}

export async function getScheduledReminderCount() {
  try {
    const notifications = await getPocketMateNotifications();
    return {
      supported: true,
      count: notifications.length,
    };
  } catch (error) {
    return {
      supported: false,
      count: 0,
      error: getErrorMessage(error),
    };
  }
}
