import { json } from '@/server/http';
import { authBaseUrl } from '@/server/neon-auth';

// Proxies the Neon Auth endpoints the app uses, so their session cookie belongs to our domain.
// Anything not listed here is refused rather than forwarded.
const ALLOWED: Record<string, 'GET' | 'POST'> = {
  'get-session': 'GET',
  'sign-up/email': 'POST',
  'sign-in/email': 'POST',
  'sign-out': 'POST',
  'request-password-reset': 'POST',
  'reset-password': 'POST',
  'change-password': 'POST',
};

const MAX_BODY = 16_384;

async function proxy(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/auth\//, '');
  if (ALLOWED[path] !== request.method) return json({ error: 'Not found' }, 404);

  const headers: Record<string, string> = {
    // Neon checks Origin on POSTs against its trusted domains, which is its CSRF protection.
    origin: request.headers.get('origin') ?? url.origin,
  };
  for (const name of ['cookie', 'content-type', 'user-agent']) {
    const value = request.headers.get(name);
    if (value) headers[name] = value;
  }

  let body: string | undefined;
  if (request.method === 'POST') {
    body = await request.text();
    if (body.length > MAX_BODY) return json({ error: 'Request too large' }, 413);
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${authBaseUrl()}/${path}`, { method: request.method, headers, body, redirect: 'manual' });
  } catch {
    return json({ error: 'Sign-in is unavailable right now. Try again in a moment.' }, 502);
  }

  const out = new Headers({ 'cache-control': 'no-store' });
  const type = upstream.headers.get('content-type');
  if (type) out.set('content-type', type);
  // Neon marks its cookies for cross-site use; served from our own domain they can be first-party.
  for (const c of upstream.headers.getSetCookie()) {
    out.append('set-cookie', c.replace(/;\s*Partitioned/i, '').replace(/SameSite=None/i, 'SameSite=Lax'));
  }
  return new Response(await upstream.text(), { status: upstream.status, headers: out });
}

export const GET = proxy;
export const POST = proxy;
