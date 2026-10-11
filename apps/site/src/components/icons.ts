/**
 * Icon paths from design/motopapers-site.html (24×24, stroked). IconSprite renders them once per page
 * as <symbol>s; Icon references one with <use>.
 */
export const ICONS = {
  doc: '<path d="M7 3.5h7l4 4v13H7z"/><path d="M14 3.5v4h4M10 12h5M10 15.5h3"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  bell: '<path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  licence:
    '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="11" r="2"/><path d="M6 16c.5-1.3 1.4-2 2.5-2s2 .7 2.5 2M14 10h4M14 13.5h3"/>',
  shield: '<path d="M12 3 5 6v5c0 4.5 3 8.2 7 10 4-1.8 7-5.5 7-10V6z"/><path d="m9 12 2 2 4-4"/>',
  gauge: '<path d="M4 17a8 8 0 1 1 16 0"/><path d="m12 17 4-5"/><path d="M8 17h8"/>',
  chevl: '<path d="m15 6-6 6 6 6"/>',
  more: '<path d="M6 12h.01M12 12h.01M18 12h.01" stroke-width="3"/>',
  home: '<path d="M3.5 10.5 12 3.5l8.5 7V19a1.5 1.5 0 0 1-1.5 1.5h-4v-6h-6v6H5A1.5 1.5 0 0 1 3.5 19z"/>',
  car: '<path d="M5 11.5 6.8 7a2 2 0 0 1 1.9-1.3h6.6A2 2 0 0 1 17.2 7l1.8 4.5"/><rect x="3" y="11.5" width="18" height="5.5" rx="1.5"/><path d="M6 17v2M18 17v2M7 14.2h.01M17 14.2h.01"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  sliders:
    '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  spark:
    '<path d="M12 3c.5 4.5 2.5 6.5 7 7-4.5.5-6.5 2.5-7 7-.5-4.5-2.5-6.5-7-7 4.5-.5 6.5-2.5 7-7z"/>',
  truck:
    '<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="17.5" r="1.5"/><circle cx="17" cy="17.5" r="1.5"/>',
  wallet:
    '<path d="M4 7a2 2 0 0 1 2-2h11v4"/><path d="M4 7v11a1 1 0 0 0 1 1h15V9H6a2 2 0 0 1-2-2z"/><path d="M16 14h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
} as const;

export type IconName = keyof typeof ICONS;
