/** A swatch colour for a car's colour name, from the design. Unknown names get a neutral grey. */
const SWATCHES: Record<string, string> = {
  silver: '#C3C8CF',
  grey: '#7D838C',
  gray: '#7D838C',
  blue: '#2D5DA8',
  black: '#1E2026',
  red: '#A82A22',
  white: '#F4F5F7',
  green: '#2F6B46',
  gold: '#B8913A',
  brown: '#6B4A32',
  wine: '#6E1F2E',
  maroon: '#6E1F2E',
  orange: '#D9722B',
  yellow: '#E2BE3A',
  beige: '#D8C7A6',
  cream: '#EFE6CF',
  purple: '#5B3F8C',
};

const FALLBACK = '#9AA3AF';

export function swatchFor(colour: string): string {
  const words = colour
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);
  // "Dark blue", "Metallic silver": the last known word wins.
  for (const word of words.reverse()) {
    const swatch = SWATCHES[word];
    if (swatch) return swatch;
  }
  return FALLBACK;
}
