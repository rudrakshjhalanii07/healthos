/** Lowercase, 2–24 chars of letters, digits, dot, dash or underscore. Shared by the app and the API. */
export function normalizeUsername(raw: string): string | null {
  const name = raw.trim().replace(/^@/, '').toLowerCase();
  return /^[a-z0-9._-]{2,24}$/.test(name) ? name : null;
}

/** The account development builds sign into automatically; the API refuses it in production. */
export const DEV_USER = 'dev';
export const DEV_PASSWORD = 'dev-password';
