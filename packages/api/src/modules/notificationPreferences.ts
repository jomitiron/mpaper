import { request } from '../client';
import { envelope } from '../schemas/common';
import { notificationPreferencesSchema, type NotificationPreferences } from '../schemas/gaps';

/** Reminder settings. **Not built yet** (api-gaps.md, `VITE_FLAG_REMINDER_SETTINGS`): mocks only. */

interface Options {
  signal?: AbortSignal;
}

/** `GET /users/notification-preferences`. */
export async function getNotificationPreferences(
  options: Options = {},
): Promise<NotificationPreferences> {
  const res = await request('/users/notification-preferences', {
    schema: envelope(notificationPreferencesSchema),
    ...options,
  });
  return res.data;
}

/** `PUT /users/notification-preferences`. */
export async function updateNotificationPreferences(
  body: NotificationPreferences,
  options: Options = {},
): Promise<NotificationPreferences> {
  const res = await request('/users/notification-preferences', {
    method: 'PUT',
    body,
    schema: envelope(notificationPreferencesSchema),
    ...options,
  });
  return res.data;
}
