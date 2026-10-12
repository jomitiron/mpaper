import {
  errorMessage,
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from '@motopapers/api';
import { useToast } from '@motopapers/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { flags } from '@/env';
import { queryKeys } from '@/lib/queries';

/**
 * Reminder settings (`GET`/`PUT /users/notification-preferences`, mocked behind
 * VITE_FLAG_REMINDER_SETTINGS): email, SMS and WhatsApp, how many days before each expiry date,
 * and auto-renew. Each change is saved as it's made, optimistically, and put back if it fails.
 */

/** The design's reminder days. */
export const LEAD_DAY_OPTIONS: readonly number[] = [30, 14, 7, 1];

/** Turns one reminder day on or off. Null when it's the last one left: keep at least one. */
export function toggleLeadDay(days: readonly number[], day: number): number[] | null {
  if (days.includes(day)) {
    if (days.length === 1) return null;
    return days.filter((d) => d !== day);
  }
  return [...days, day].sort((a, b) => b - a);
}

/** "30, 14 and 7 days", "1 day". */
export function leadDaysWords(days: readonly number[]): string {
  const sorted = [...days].sort((a, b) => b - a);
  const unit = sorted.length === 1 && sorted[0] === 1 ? 'day' : 'days';
  if (sorted.length <= 1) return `${sorted[0] ?? 0} ${unit}`;
  return `${sorted.slice(0, -1).join(', ')} and ${sorted.at(-1)} ${unit}`;
}

export type SwitchKey = 'email' | 'sms' | 'whatsapp' | 'auto_renew';

export const SWITCH_NAMES: Record<SwitchKey, string> = {
  email: 'Email reminders',
  sms: 'SMS reminders',
  whatsapp: 'WhatsApp reminders',
  auto_renew: 'Renew automatically',
};

/** What the toast says once a change is saved, as the design words it: "Email reminders on." */
export function savedMessage(before: NotificationPreferences, after: NotificationPreferences) {
  for (const key of Object.keys(SWITCH_NAMES) as SwitchKey[]) {
    if (before[key] !== after[key]) return `${SWITCH_NAMES[key]} ${after[key] ? 'on' : 'off'}.`;
  }
  return `We'll remind you ${leadDaysWords(after.lead_days)} before each expiry date.`;
}

export function useReminderSettings() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const key = queryKeys.notificationPreferences;

  const prefs = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => getNotificationPreferences({ signal }),
    enabled: flags.reminderSettings,
    meta: { silent: true },
  });

  const save = useMutation({
    mutationFn: (next: NotificationPreferences) => updateNotificationPreferences(next),
    async onMutate(next) {
      await queryClient.cancelQueries({ queryKey: key });
      const before = queryClient.getQueryData<NotificationPreferences>(key);
      queryClient.setQueryData(key, next);
      return { before };
    },
    onError(error, _next, context) {
      if (context?.before) queryClient.setQueryData(key, context.before);
      // Another change may have been in flight: ask the API what it has now.
      void queryClient.invalidateQueries({ queryKey: key });
      toast.error(`We couldn't save that change. ${errorMessage(error)}`);
    },
    onSuccess(saved, _next, context) {
      queryClient.setQueryData(key, saved);
      if (context?.before) toast.success(savedMessage(context.before, saved));
    },
  });

  /** Saves a change from what's on screen now. */
  function change(update: (current: NotificationPreferences) => NotificationPreferences) {
    const current = queryClient.getQueryData<NotificationPreferences>(key);
    if (!current) return;
    save.mutate(update(current));
  }

  return { prefs, change };
}
