export const json = (body: unknown, status = 200, headers?: Record<string, string>) =>
  Response.json(body, { status, headers });

export const unauthorized = () => json({ error: 'Not signed in' }, 401);

/** Reads a JSON body, or null if it's missing, malformed, or over `limit` bytes. */
export async function readJSON<T>(request: Request, limit = 16_384): Promise<T | null> {
  const text = await request.text().catch(() => '');
  if (!text || text.length > limit) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
