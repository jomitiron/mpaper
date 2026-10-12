import {
  addDays,
  DUE_SOON_DAYS,
  formatDate,
  paperStatus,
  PAPER_KINDS,
  type DateInput,
  type PaperKind,
} from '@motopapers/api';
import { dueWords, PAPER_NOUN } from '../lib/papers';
import type { PaperBodies } from './draft';

/**
 * The line under "KTU 604 XR is all set": when the first reminder goes out, or what needs
 * doing now if a paper is already due or expired.
 */
export function firstReminderLine(
  bodies: PaperBodies,
  saved: readonly PaperKind[],
  today: DateInput = new Date(),
): string {
  const tracked = PAPER_KINDS.filter((kind) => saved.includes(kind) && bodies[kind])
    .map((kind) => ({ kind, status: paperStatus(bodies[kind]!.expiry_date, today) }))
    .filter((p) => p.status.daysLeft !== null)
    .sort((a, b) => a.status.daysLeft! - b.status.daysLeft!);

  const first = tracked[0];
  if (!first) return 'Add expiry dates from the car panel to start getting reminders.';

  const noun = PAPER_NOUN[first.kind];
  if (first.status.state === 'expired') {
    return `Its ${noun} ${dueWords(first.status)}. Renew it from My cars.`;
  }
  if (first.status.state === 'due') {
    return `Its ${noun} is ${dueWords(first.status)}. Renew it from My cars.`;
  }
  const reminder = addDays(first.status.expiryDate!, -DUE_SOON_DAYS);
  return `We'll send your first reminder on ${formatDate(reminder)}, ${DUE_SOON_DAYS} days before the earliest expiry.`;
}
