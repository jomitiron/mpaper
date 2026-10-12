/**
 * The `?next=` path to go back to after signing in. Only same-site paths are allowed, so a link
 * can't send a driver to another website.
 *
 * Router paths leave out the base the app is served under (`/app/` on App Service), so a `next`
 * that includes it (`/app/cars`, e.g. copied from the address bar) has the base taken off.
 */
export function safeNext(next: unknown, fallback = '/', base = import.meta.env.BASE_URL): string {
  const value = Array.isArray(next) ? next[0] : next;
  if (typeof value !== 'string' || !isLocalPath(value)) return fallback;
  const path = withoutBase(value, base);
  return isLocalPath(path) ? path : fallback;
}

function isLocalPath(value: string): boolean {
  return value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\');
}

/** `/app/cars?x=1` → `/cars?x=1` when the base is `/app/`. Paths outside the base are kept. */
export function withoutBase(path: string, base: string): string {
  const root = base.replace(/\/+$/, '');
  if (!root || !path.startsWith(root)) return path;
  const rest = path.slice(root.length);
  if (rest === '') return '/';
  if (rest.startsWith('/')) return rest;
  if (rest.startsWith('?') || rest.startsWith('#')) return `/${rest}`;
  return path; // `/application`: not under the base.
}
