import { z } from 'zod';

/** Every response is wrapped: `{ status, message, data, meta? }`. */
export function envelope<T extends z.ZodType>(data: T) {
  return z.object({
    status: z.string(),
    message: z.string().optional(),
    data,
  });
}

export const pageMetaSchema = z.object({
  page: z.coerce.number(),
  total: z.number(),
  per_page: z.coerce.number(),
  page_count: z.number(),
});
export type PageMeta = z.infer<typeof pageMetaSchema>;

export function pagedEnvelope<T extends z.ZodType>(item: T) {
  return z.object({
    status: z.string(),
    message: z.string().optional(),
    data: z.array(item),
    meta: pageMetaSchema,
  });
}

/** Responses that carry only a message (sign-out, forgot password…). */
export const messageEnvelope = z.object({
  status: z.string(),
  message: z.string().optional(),
});

/** A `YYYY-MM-DD` date. A full timestamp is accepted too; status maths reads the first 10 characters. */
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Expected a YYYY-MM-DD date');

/**
 * Display text that should never break a whole page if the API sends null or a number
 * (an older record with no colour, say). Always comes out as a string.
 */
export const text = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((value) => (value === null || value === undefined ? '' : String(value)));

/** `T | null`, accepting a missing key as null. */
export function nullable<T extends z.ZodType>(schema: T) {
  return schema.nullish().transform((value) => value ?? null);
}
