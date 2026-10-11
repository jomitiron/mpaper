/**
 * MotoPapers design tokens for TypeScript, mirroring tokens.css (Direction C).
 * Use the CSS variables in stylesheets; use these where a value is needed in code
 * (charts, canvas, meta theme-color, tests).
 */

export const colors = {
  bg: '#f4f3f9',
  card: '#ffffff',
  ink: '#1e1b33',
  ink2: '#45425c',
  muted: '#6a6783',
  line: '#e6e4ef',
  line2: '#d6d3e4',

  coral: '#ff5a3c',
  coralD: '#de3b22',
  coralSoft: '#ffe6e0',

  rose: '#ffe2dc',
  roseI: '#c02b15',

  sky: '#e4edff',
  skyI: '#2453cf',
  skyB: '#7fa2f5',

  mint: '#dcf5e9',
  mintI: '#0a7647',
  mintB: '#45bf88',

  butter: '#ffefc4',
  butterI: '#7f5300',
  butterB: '#f2c14e',

  lilac: '#ece7ff',
  lilacI: '#5a3fcc',

  due: '#ffe6c7',
  dueI: '#9a4500',

  idle: '#efeef4',
  idleI: '#5f5c78',

  night: '#1e1b33',
  night2: '#2c2847',
  nightMute: '#b9b5d3',

  focus: '#2453cf',
} as const;

export type ColorToken = keyof typeof colors;

/** CSS variable name for each colour token, e.g. `cssVar.coralD` → `var(--coral-d)`. */
export const cssVar = Object.fromEntries(
  Object.keys(colors).map((key) => [key, `var(--${toKebab(key)})`]),
) as Record<ColorToken, string>;

export const fonts = {
  head: "'Gabarito', 'Figtree', system-ui, sans-serif",
  body: "'Figtree', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  mono: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
} as const;

export const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&family=Gabarito:wght@600;700;800;900&display=swap';

export const radii = {
  xs: '8px',
  plate: '9px',
  sm: '12px',
  md: '14px',
  lg: '16px',
  xl: '20px',
  '2xl': '24px',
  '3xl': '30px',
  '4xl': '36px',
  pill: '999px',
} as const;

export const shadows = {
  sm: '0 1px 2px rgba(30, 27, 51, 0.06)',
  default: '0 2px 6px rgba(30, 27, 51, 0.05), 0 26px 50px -26px rgba(30, 27, 51, 0.32)',
  coral: '0 10px 22px -12px rgba(255, 90, 60, 0.8)',
  ringFocus: '0 0 0 4px rgba(36, 83, 207, 0.14)',
  ringCoral: '0 0 0 3px rgba(255, 90, 60, 0.14)',
  scrim: 'rgba(30, 27, 51, 0.45)',
} as const;

/** Widths (px) where the design changes layout. `tabbar`: below it the sidebar becomes a bottom tab bar. */
export const breakpoints = {
  phone: 420,
  small: 560,
  medium: 760,
  tabbar: 900,
  wide: 1100,
} as const;

/** Each paper has its own colour everywhere: sky licence, mint insurance, butter roadworthiness. */
export const paperColors = {
  vehicle_license: { bg: colors.sky, ink: colors.skyI, bar: colors.skyB },
  insurance: { bg: colors.mint, ink: colors.mintI, bar: colors.mintB },
  roadworthiness: { bg: colors.butter, ink: colors.butterI, bar: colors.butterB },
} as const;

/** Swatches for a car's paint colour, keyed by lower-case colour name (from the design). */
export const carSwatches: Record<string, string> = {
  silver: '#c3c8cf',
  grey: '#7d838c',
  gray: '#7d838c',
  blue: '#2d5da8',
  black: '#1e2026',
  red: '#a82a22',
  white: '#f4f5f7',
  green: '#2f6b46',
  gold: '#b8913a',
};

export const fallbackSwatch = '#9aa3af';

export function swatchFor(colour: string | null | undefined): string {
  const name = String(colour ?? '').trim();
  return carSwatches[name.toLowerCase()] ?? fallbackSwatch;
}

function toKebab(key: string): string {
  return key.replace(/([a-z])([A-Z0-9])/g, '$1-$2').toLowerCase();
}
