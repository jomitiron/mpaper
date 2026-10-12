import { formatNaira, formatShortDate, type Transaction, type Vehicle } from '@motopapers/api';

/**
 * A payment as a line in Home's Recent activity.
 *
 * With transaction labels (VITE_FLAG_TX_LABELS) we know what each payment was for and which car.
 * Without them we only know money in or out (api-gaps.md): credit → "Wallet top-up",
 * debit → "Payment".
 */

export type ActivityIcon = 'topup' | 'vehicle_license' | 'insurance' | 'roadworthiness' | 'service';

export interface ActivityRow {
  id: number;
  title: string;
  sub: string;
  icon: ActivityIcon;
  /** `+₦20,000`, `−₦18,500`. */
  amount: string;
  /** `in` for money that arrived, `void` for failed or reversed payments. */
  tone: 'in' | 'void' | '';
}

const CATEGORY_TITLES: Record<string, string> = {
  wallet_topup: 'Wallet top-up',
  service_charge: 'Tracking and reminders',
  subscription_charge: 'Subscription',
  renewal: 'Renewal',
};

const STATUS_WORDS: Record<string, string> = {
  pending: 'Pending',
  failed: 'Failed',
  reversed: 'Reversed',
};

function iconFor(tx: Transaction, labelled: boolean, credit: boolean): ActivityIcon {
  if (credit) return 'topup';
  if (!labelled) return 'service';
  const type = tx.document_type;
  if (type === 'vehicle_license' || type === 'insurance' || type === 'roadworthiness') return type;
  return tx.category === 'wallet_topup' ? 'topup' : 'service';
}

export function activityRow(
  tx: Transaction,
  vehicles: readonly Vehicle[],
  useLabels: boolean,
): ActivityRow {
  const credit = tx.transaction_type === 'credit';
  const labelled = useLabels && Boolean(tx.category || tx.description);
  const title = labelled
    ? (tx.description ??
      CATEGORY_TITLES[tx.category ?? ''] ??
      (credit ? 'Wallet top-up' : 'Payment'))
    : credit
      ? 'Wallet top-up'
      : 'Payment';

  const plate = labelled ? vehicles.find((v) => v.id === tx.vehicle_id)?.plate_number : undefined;
  const via = tx.payment ? 'Paystack' : credit ? '' : 'Wallet';
  const sub = [plate ?? via, formatShortDate(tx.created_at), STATUS_WORDS[tx.status]]
    .filter(Boolean)
    .join(' · ');

  const failed = tx.status === 'failed' || tx.status === 'reversed';
  return {
    id: tx.id,
    title,
    sub,
    icon: iconFor(tx, labelled, credit),
    amount: formatNaira(credit ? tx.amount : -tx.amount, { sign: true }),
    tone: failed ? 'void' : credit && tx.status === 'success' ? 'in' : '',
  };
}
