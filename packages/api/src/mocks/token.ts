import { base64UrlEncode, decodeJwtPayload } from '../jwt';
import type { User } from '../schemas/user';
import { MOCK_TOKEN_TTL_SECONDS } from './db';

/** A JWT-shaped token like the API's (unsigned). Lasts 30 minutes, like the real one. */
export function createMockToken(
  user: Pick<User, 'id' | 'email' | 'first_name' | 'last_name'>,
  issuedAtMs: number,
  ttlSeconds = MOCK_TOKEN_TTL_SECONDS,
): string {
  const iat = Math.floor(issuedAtMs / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      iat,
      exp: iat + ttlSeconds,
    }),
  );
  return `${header}.${payload}.mock-signature`;
}

export function readMockToken(token: string): { id: number; exp: number } | null {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.id !== 'number' || typeof payload.exp !== 'number') return null;
  return { id: payload.id, exp: payload.exp };
}
