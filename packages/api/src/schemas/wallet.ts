import { z } from 'zod';

export const walletSchema = z.object({
  id: z.number(),
  email: z.string().nullish(),
  /** Naira. */
  balance: z.number(),
  user_id: z.number().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});
export type Wallet = z.infer<typeof walletSchema>;
