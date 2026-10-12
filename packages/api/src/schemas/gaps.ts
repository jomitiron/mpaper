import { z } from 'zod';
import { isoDate } from './common';
import { transactionSchema, type TransactionLabelCategory } from './transaction';

/**
 * Shapes for endpoints the backend hasn't built yet (docs/phases/api-gaps.md). They're served by
 * the MSW mocks and the UI that uses them sits behind a VITE_FLAG_* flag.
 */

export const documentTypes = ['vehicle_license', 'insurance', 'roadworthiness'] as const;
export const documentTypeSchema = z.enum(documentTypes);
export type DocumentType = z.infer<typeof documentTypeSchema>;

// ---- Renewals (VITE_FLAG_RENEWALS)

export const renewalStatuses = [
  'awaiting_payment',
  'paid',
  'processing',
  'out_for_delivery',
  'delivered',
  'cancelled',
] as const;
export const renewalStatusSchema = z.enum(renewalStatuses);
export type RenewalStatus = z.infer<typeof renewalStatusSchema>;

export const renewalSchema = z.object({
  id: z.number(),
  vehicle_id: z.number(),
  document_type: documentTypeSchema,
  status: renewalStatusSchema,
  amount: z.number(),
  delivery_address: z.string(),
  new_expiry_date: isoDate.nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Renewal = z.infer<typeof renewalSchema>;

export const createdRenewalSchema = z.object({
  renewal: renewalSchema,
  /** Present when paying by card: send the driver to Paystack. */
  auth_url: z.string().optional(),
  /**
   * Paystack's reference for that payment, as `POST /transactions/initialize` returns it. Not in
   * api-gaps.md's first draft: the app needs it to know what the payment was for when Paystack
   * sends the driver back (phase 4).
   */
  reference: z.string().optional(),
});
export type CreatedRenewal = z.infer<typeof createdRenewalSchema>;

export interface CreateRenewalBody {
  document_type: DocumentType;
  pay_with: 'wallet' | 'card';
  delivery_address: string;
}

// ---- Pay from wallet (VITE_FLAG_WALLET_PAY)

export interface WalletDebitBody {
  amount: number;
  category: TransactionLabelCategory;
  vehicle_id?: number;
  document_type?: DocumentType;
}

export const walletDebitSchema = z.object({
  transaction: transactionSchema,
  wallet: z.object({ balance: z.number() }),
});
export type WalletDebit = z.infer<typeof walletDebitSchema>;

// ---- Pricing (no flag: falls back to DEFAULT_PRICING)

export const pricingSchema = z.object({
  tracking_fee: z.number(),
  renewal: z.object({
    vehicle_license: z.number(),
    insurance_third_party: z.number(),
    roadworthiness: z.number(),
  }),
});
export type Pricing = z.infer<typeof pricingSchema>;

/** Placeholder prices from the design. The only place these numbers live. */
export const DEFAULT_PRICING: Pricing = {
  tracking_fee: 2500,
  renewal: {
    vehicle_license: 18500,
    insurance_third_party: 15000,
    roadworthiness: 6500,
  },
};

// ---- Notification preferences (VITE_FLAG_REMINDER_SETTINGS)

export const notificationPreferencesSchema = z.object({
  email: z.boolean(),
  sms: z.boolean(),
  whatsapp: z.boolean(),
  lead_days: z.array(z.number()),
  auto_renew: z.boolean(),
});
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;
