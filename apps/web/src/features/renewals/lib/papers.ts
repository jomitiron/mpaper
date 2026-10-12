import { PAPER_LABELS, type PaperKind, type Pricing } from '@motopapers/api';

/** Papers in renewal addresses and words: `/cars/12/renew/licence`, "Insurance renewal". */

/** The paper in the renew page's address. */
export const PAPER_SLUGS: Record<PaperKind, string> = {
  vehicle_license: 'licence',
  insurance: 'insurance',
  roadworthiness: 'roadworthiness',
};

export function paperFromSlug(slug: unknown): PaperKind | null {
  const value = Array.isArray(slug) ? slug[0] : slug;
  const found = (Object.keys(PAPER_SLUGS) as PaperKind[]).find((k) => PAPER_SLUGS[k] === value);
  return found ?? null;
}

/** "Licence renewal", "Insurance renewal", "Roadworthiness renewal" (what Payments calls them). */
export const RENEWAL_NAMES: Record<PaperKind, string> = {
  vehicle_license: 'Licence renewal',
  insurance: 'Insurance renewal',
  roadworthiness: 'Roadworthiness renewal',
};

/** "Insurance renewal · KJA 731 AE", for the Paystack receipt. */
export function renewalLabel(kind: PaperKind, plate: string): string {
  return `${RENEWAL_NAMES[kind]} · ${plate}`;
}

/** The paper inside a sentence: "vehicle licence", "insurance", "roadworthiness". */
export function paperWords(kind: PaperKind): string {
  return PAPER_LABELS[kind].name.toLowerCase();
}

/**
 * What renewing a paper costs (`GET /pricing`). Undefined while prices load. Null when there's
 * no set price: only third-party cover has one (comprehensive depends on the car's value), so the
 * team quotes for anything else.
 */
export function renewalPrice(
  prices: Pricing | undefined,
  kind: PaperKind,
  cover: string | null | undefined,
): number | null | undefined {
  if (!prices) return undefined;
  if (kind === 'vehicle_license') return prices.renewal.vehicle_license;
  if (kind === 'roadworthiness') return prices.renewal.roadworthiness;
  return cover === 'third_party' ? prices.renewal.insurance_third_party : null;
}
