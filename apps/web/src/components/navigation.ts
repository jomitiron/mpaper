import { Car, House, Receipt, SlidersHorizontal } from '@lucide/vue';
import type { Component } from 'vue';
import type { RouteLocationNormalizedLoaded } from 'vue-router';

/** The four app sections, in the order the design shows them. */
export interface NavItem {
  label: string;
  to: string;
  icon: Component;
  /** Whether the current page belongs to this section (Add a car belongs to My cars). */
  matches: (route: RouteLocationNormalizedLoaded) => boolean;
}

const under = (prefix: string) => (route: RouteLocationNormalizedLoaded) =>
  route.path === prefix || route.path.startsWith(`${prefix}/`);

export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Home', to: '/', icon: House, matches: (route) => route.path === '/' },
  { label: 'My cars', to: '/cars', icon: Car, matches: under('/cars') },
  { label: 'Payments', to: '/payments', icon: Receipt, matches: under('/payments') },
  { label: 'Settings', to: '/settings', icon: SlidersHorizontal, matches: under('/settings') },
];
