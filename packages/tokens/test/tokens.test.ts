import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { colors, cssVar, radii, shadows, swatchFor } from '../tokens';

const css = readFileSync(fileURLToPath(new URL('../tokens.css', import.meta.url)), 'utf8');

function cssValue(name: string): string | undefined {
  const match = css.match(new RegExp(`--${name}:\\s*([^;]+);`));
  return match?.[1]?.trim();
}

describe('tokens.ts mirrors tokens.css', () => {
  it.each(Object.entries(colors))('colour %s', (key, value) => {
    const name = cssVar[key as keyof typeof colors].slice('var(--'.length, -1);
    expect(cssValue(name)).toBe(value);
  });

  it.each(Object.entries(radii))('radius %s', (key, value) => {
    expect(cssValue(`radius-${key}`)).toBe(value);
  });

  it('shadows', () => {
    expect(cssValue('shadow-sm')).toBe(shadows.sm);
    expect(cssValue('shadow')).toBe(shadows.default);
    expect(cssValue('shadow-coral')).toBe(shadows.coral);
    expect(cssValue('scrim')).toBe(shadows.scrim);
  });
});

describe('swatchFor', () => {
  it('matches colour names case-insensitively', () => {
    expect(swatchFor('Silver')).toBe('#c3c8cf');
    expect(swatchFor(' BLUE ')).toBe('#2d5da8');
  });

  it('falls back for unknown or missing colours', () => {
    expect(swatchFor('teal')).toBe('#9aa3af');
    expect(swatchFor(null)).toBe('#9aa3af');
  });
});
