import { formatNaira } from '@motopapers/api';

/** Top-up amounts, from the design's top-up modal. */

/** Paystack's smallest payment, and the design's "Minimum ₦100". */
export const MIN_TOP_UP = 100;
export const QUICK_AMOUNTS: readonly number[] = [5_000, 10_000, 20_000, 50_000];
/** Up to ₦999,999,999: more digits than that are ignored, so the number stays exact. */
const MAX_DIGITS = 9;

/**
 * Whole naira from what the driver typed: `"₦20,000"` → 20000. Kobo are dropped
 * (`"1,500.50"` → 1500), and anything that isn't a digit is ignored. Empty input gives 0.
 */
export function parseAmount(input: string): number {
  const whole = input.split('.')[0] ?? '';
  const digits = whole.replace(/\D/g, '').replace(/^0+/, '').slice(0, MAX_DIGITS);
  return digits ? Number(digits) : 0;
}

/** The amount as it shows in the input: 20000 → `"20,000"`, 0 → `""`. */
export function formatAmountInput(amount: number): string {
  return amount > 0 ? new Intl.NumberFormat('en-NG').format(amount) : '';
}

/** Why an amount can't be topped up, or null when it can. */
export function topUpProblem(amount: number): string | null {
  if (amount < MIN_TOP_UP) return `Enter at least ${formatNaira(MIN_TOP_UP)}.`;
  return null;
}

/** "Continue to Paystack · ₦20,000", or just "Continue to Paystack" until the amount is enough. */
export function topUpButtonLabel(amount: number): string {
  return amount >= MIN_TOP_UP
    ? `Continue to Paystack · ${formatNaira(amount)}`
    : 'Continue to Paystack';
}
