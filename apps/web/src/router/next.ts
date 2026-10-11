/**
 * The `?next=` path to go back to after signing in. Only same-site paths are allowed, so a link
 * can't send a driver to another website.
 */
export function safeNext(next: unknown, fallback = '/'): string {
  const value = Array.isArray(next) ? next[0] : next;
  if (typeof value !== 'string') return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  return value;
}
