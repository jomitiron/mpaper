import { Car, House, Receipt, SlidersHorizontal } from '@lucide/vue';
import type { Component } from 'vue';
import type { RouteLocationNormalizedLoaded } from 'vue-router';

/** The app sections, in the order the design shows them. */
export interface NavItem {
  label: string;
  to: string;
  icon: Component;
  /** Left out of the sidebar and tab bar. The page still works at its address. */
  hidden?: boolean;
  /** Whether the current page belongs to this section (Add a car belongs to My cars). */
  matches: (route: RouteLocationNormalizedLoaded) => boolean;
}

const under = (prefix: string) => (route: RouteLocationNormalizedLoaded) =>
  route.path === prefix || route.path.startsWith(`${prefix}/`);

export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Home', to: '/', icon: House, matches: (route) => route.path === '/' },
  { label: 'My cars', to: '/cars', icon: Car, matches: under('/cars') },
  {
    label: 'Payments',
    to: '/payments',
    icon: Receipt,
    matches: under('/payments'),
    // Hidden from the menu for now; Home and the payment pages still link to it.
    hidden: true,
  },
  { label: 'Settings', to: '/settings', icon: SlidersHorizontal, matches: under('/settings') },
];

/** The sections the sidebar and tab bar show. */
export const SHOWN_NAV_ITEMS = NAV_ITEMS.filter((item) => !item.hidden);
