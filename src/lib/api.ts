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

const TIMEOUT_MS = 20_000;

/** JSON fetch against this app's own API routes, sending the session cookie. */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? 'GET',
      credentials: 'include',
      headers: init.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      // The database sleeps when idle and can take a few seconds to wake; past this, give up.
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'TimeoutError') {
      throw new ApiError('The server is taking too long. Check your connection and try again.', 0);
    }
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
  INVALID_PASSWORD: 'Your current password is wrong.',
  USER_ALREADY_EXISTS: 'An account with this email already exists. Sign in instead.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'An account with this email already exists. Sign in instead.',
  INVALID_EMAIL: 'That doesn’t look like an email address.',
  PASSWORD_TOO_SHORT: 'That password is too short.',
  PASSWORD_TOO_LONG: 'That password is too long.',
  INVALID_TOKEN: 'This reset link is invalid or has expired. Request a new one.',
  EMAIL_NOT_VERIFIED: 'Verify your email first. We’ve sent you a new code.',
  INVALID_OTP: 'That code isn’t right. Check the email and try again.',
  OTP_EXPIRED: 'That code has expired. Send a new one.',
  TOO_MANY_ATTEMPTS: 'Too many wrong codes. Send a new one.',
};
