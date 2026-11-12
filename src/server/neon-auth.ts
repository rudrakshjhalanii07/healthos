/// <reference types="node" />
// Accounts live in Neon's managed Better Auth (the `neon_auth` schema). The browser never talks to it
// directly: /api/auth/* proxies it so its session cookie is first-party on our domain (Safari blocks
// the third-party alternative), and API routes resolve the user by asking it about that cookie.

/** Vercel's Neon integration names the variable with the `DATABASE_` prefix we chose at install. */
export function authBaseUrl(): string {
  const url = process.env.NEON_AUTH_BASE_URL ?? process.env.DATABASE_NEON_AUTH_BASE_URL;
  if (!url) throw new Error('NEON_AUTH_BASE_URL is not set');
  return url.replace(/\/$/, '');
}

export type SessionUser = { id: string; email: string };

// A session check is a network round trip, and sync can make several requests in a row. Cache each
// answer briefly; a signed-out or revoked session stops working within this window.
const TTL_MS = 30_000;
const cache = new Map<string, { user: SessionUser | null; until: number }>();

export async function currentUser(request: Request): Promise<SessionUser | null> {
  const cookie = request.headers.get('cookie') ?? '';
  if (!cookie.includes('neon-auth.session_token=')) return null;

  const hit = cache.get(cookie);
  if (hit && hit.until > Date.now()) return hit.user;

  const res = await fetch(`${authBaseUrl()}/get-session`, { headers: { cookie } });
  if (!res.ok) throw new Error(`Auth service returned ${res.status}`);
  const body = (await res.json().catch(() => null)) as { user?: { id: string; email: string } } | null;
  const user = body?.user ? { id: body.user.id, email: body.user.email } : null;

  if (cache.size > 1000) cache.clear();
  cache.set(cookie, { user, until: Date.now() + TTL_MS });
  return user;
}

/** Drops this request's cached session, e.g. once its user is deleted. */
export function forgetSession(request: Request) {
  cache.delete(request.headers.get('cookie') ?? '');
}
