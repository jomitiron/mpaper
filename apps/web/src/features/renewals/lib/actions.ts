import { createRenewal, type CreatedRenewal, type PaperKind, type Renewal } from '@motopapers/api';
import { payOnPaystack, type CheckoutOptions } from '@/features/payments/lib/checkout';
import { renewalLabel } from './papers';

/** Starting a renewal (`POST /vehicles/:id/renewals`, mocked behind VITE_FLAG_RENEWALS). */

export interface RenewOrder {
  vehicleId: number;
  plate: string;
  kind: PaperKind;
  /** Naira, from GET /pricing. */
  amount: number;
  deliveryAddress: string;
  /** Where the receipt's "Track your renewal" (and "Try again") goes: the renew page. */
  returnTo: string;
}

/** Pays from the wallet. A 400 "Insufficient balance" means the wallet is short. */
export async function renewFromWallet(
  order: RenewOrder,
  create: typeof createRenewal = createRenewal,
): Promise<Renewal> {
  const created = await create(order.vehicleId, {
    document_type: order.kind,
    pay_with: 'wallet',
    delivery_address: order.deliveryAddress,
  });
  return created.renewal;
}

/**
 * Paystack's reference for the payment a card renewal started. The API sends it with the checkout
 * address (see api-gaps.md); failing that, Paystack's own return address carries it.
 */
export function paystackReference(created: CreatedRenewal): string | null {
  if (created.reference) return created.reference;
  if (!created.auth_url) return null;
  try {
    const url = new URL(created.auth_url);
    return url.searchParams.get('reference') ?? url.searchParams.get('trxref');
  } catch {
    return null;
  }
}

/**
 * Pays by card or bank transfer: the renewal starts a Paystack payment, and we send the driver
 * there with phase 3's `payOnPaystack()`, which remembers what the payment was for so the return
 * page can show "Insurance renewal · KJA 731 AE" and a way back to the renewal.
 */
export async function renewByCard(
  order: RenewOrder,
  options: CheckoutOptions & { create?: typeof createRenewal } = {},
): Promise<void> {
  const create = options.create ?? createRenewal;
  await payOnPaystack(
    {
      amount: order.amount,
      // Not sent: the renewal below starts the payment in place of POST /transactions/initialize.
      category: 'service_charge',
      intent: {
        kind: 'other',
        label: renewalLabel(order.kind, order.plate),
        returnTo: order.returnTo,
        returnLabel: 'Track your renewal',
      },
    },
    {
      ...options,
      initialize: async () => {
        const created = await create(order.vehicleId, {
          document_type: order.kind,
          pay_with: 'card',
          delivery_address: order.deliveryAddress,
        });
        if (!created.auth_url) throw new Error('Paystack sent no checkout page.');
        return {
          auth_url: created.auth_url,
          // Without a reference the return page can't tell what this was for, and shows a plain
          // receipt instead.
          reference: paystackReference(created) ?? `renewal-${created.renewal.id}`,
        };
      },
    },
  );
}
