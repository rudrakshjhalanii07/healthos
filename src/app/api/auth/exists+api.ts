import { db } from '@/server/db';
import { json } from '@/server/auth';
import { normalizeUsername } from '@/lib/username';

export async function GET(request: Request) {
  const username = normalizeUsername(new URL(request.url).searchParams.get('username') ?? '');
  if (!username) return json({ error: 'Invalid username' }, 400);
  const rows = await db()`select 1 from users where username = ${username}`;
  return json({ exists: rows.length > 0 });
}
