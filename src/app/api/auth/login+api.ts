import { decoyHash, json, readJSON, startSession, verifyPassword } from '@/server/auth';
import { db } from '@/server/db';
import { normalizeUsername } from '@/lib/username';

export async function POST(request: Request) {
  const body = await readJSON<{ username?: string; password?: string }>(request);
  const username = normalizeUsername(body?.username ?? '');
  const password = body?.password ?? '';
  const rows = username ? await db()`select id, password_hash from users where username = ${username}` : [];
  const user = rows[0] as { id: string; password_hash: string } | undefined;
  // Hash even for unknown users so the response time doesn't reveal which usernames exist.
  const ok = await verifyPassword(password, user?.password_hash ?? (await decoyHash()));
  if (!user || !ok) return json({ error: 'Wrong username or password' }, 401);

  return json({ username }, 200, { 'Set-Cookie': await startSession(user.id) });
}
