/**
 * Reads a JWT's payload without verifying it (the API verifies; the app only needs `exp` to sign
 * the driver out when the 30-minute token runs out).
 */

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const value: unknown = JSON.parse(base64UrlDecode(part));
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** When the token expires, in ms since the epoch, or null if it has no readable `exp`. */
export function tokenExpiresAt(token: string): number | null {
  const exp = decodeJwtPayload(token)?.exp;
  return typeof exp === 'number' ? exp * 1000 : null;
}

export function base64UrlEncode(text: string): string {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlDecode(part: string): string {
  const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}
