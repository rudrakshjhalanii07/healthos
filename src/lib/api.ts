/** A failed API call. `status` is 0 when the server couldn't be reached at all (offline). */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
  }
}

/** JSON fetch against this app's own API routes, sending the session cookie. */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? 'GET',
      credentials: 'include',
      headers: init.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError('You’re offline', 0);
  }
  const body = (await res.json().catch(() => null)) as (T & { error?: string; message?: string; code?: string }) | null;
  if (!res.ok) {
    // 429 comes from the Vercel Firewall rate limit on sign-in, sign-up and password reset.
    const message =
      res.status === 429
        ? 'Too many attempts. Wait a minute and try again.'
        : ((body?.code && FRIENDLY[body.code]) ?? body?.error ?? body?.message ?? `Request failed (${res.status})`);
    throw new ApiError(message, res.status, body);
  }
  return body as T;
}

/** Neon Auth error codes worth rewording for people. */
const FRIENDLY: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'Wrong email or password.',
  USER_ALREADY_EXISTS: 'An account with this email already exists. Sign in instead.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'An account with this email already exists. Sign in instead.',
  INVALID_EMAIL: 'That doesn’t look like an email address.',
  PASSWORD_TOO_SHORT: 'That password is too short.',
  PASSWORD_TOO_LONG: 'That password is too long.',
  INVALID_TOKEN: 'This reset link is invalid or has expired. Request a new one.',
};
