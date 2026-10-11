import { request } from '../client';
import { envelope } from '../schemas/common';
import { DEFAULT_PRICING, pricingSchema, type Pricing } from '../schemas/gaps';

/**
 * `GET /pricing`. **Not built yet** (api-gaps.md, no flag): returns `DEFAULT_PRICING` when the
 * endpoint fails, so prices always show.
 */
export async function getPricing(options: { signal?: AbortSignal } = {}): Promise<Pricing> {
  try {
    const res = await request('/pricing', { schema: envelope(pricingSchema), ...options });
    return res.data;
  } catch (error) {
    if (options.signal?.aborted) throw error;
    return DEFAULT_PRICING;
  }
}
