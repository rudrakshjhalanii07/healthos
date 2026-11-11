import { hashPassword, json, MIN_PASSWORD, readJSON, startSession } from '@/server/auth';
import { db } from '@/server/db';
import { DEV_USER, normalizeUsername } from '@/lib/username';

export async function POST(request: Request) {
  const body = await readJSON<{ username?: string; password?: string }>(request);
  const username = normalizeUsername(body?.username ?? '');
  const password = body?.password ?? '';
  if (!username) return json({ error: 'Invalid username' }, 400);
  if (password.length < MIN_PASSWORD) return json({ error: `Password must be at least ${MIN_PASSWORD} characters` }, 400);
  if (username === DEV_USER && process.env.NODE_ENV === 'production') return json({ error: 'That username is reserved' }, 400);

  const hash = await hashPassword(password);
  const rows = await db()`
    with u as (
      insert into users (username, password_hash) values (${username}, ${hash})
      on conflict (username) do nothing
      returning id
    )
    insert into user_data (user_id) select id from u returning user_id`;
  const id = (rows[0] as { user_id: string } | undefined)?.user_id;
  if (!id) return json({ error: 'That username is taken' }, 409);

  return json({ username }, 201, { 'Set-Cookie': await startSession(id) });
}
