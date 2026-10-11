import type { RouteLocationRaw, Router } from 'vue-router';

/** Starts loading a page's code before the driver clicks (on hover or focus of a nav link). */
export function preloadRoute(router: Router, to: RouteLocationRaw): void {
  for (const record of router.resolve(to).matched) {
    const component = record.components?.default;
    if (typeof component === 'function') {
      void (component as () => Promise<unknown>)().catch(() => {});
    }
  }
}
