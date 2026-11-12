/** Trimmed, lowercased email if it looks valid, else null. The server does the real validation. */
export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : null;
}

export const MIN_PASSWORD = 8;
