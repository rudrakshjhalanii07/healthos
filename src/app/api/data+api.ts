import { json, readJSON, unauthorized } from '@/server/http';
import { currentUser } from '@/server/neon-auth';
import { db } from '@/server/db';

const MAX_BYTES = 1_000_000;

type Doc = { data: unknown; version: number };

async function load(userId: string): Promise<Doc> {
  const rows = await db()`select data, version from user_data where user_id = ${userId}`;
  return (rows[0] as Doc | undefined) ?? { data: null, version: 0 };
}

/** Just enough shape-checking that a bad client can't store something the app can't load. */
function looksLikeData(d: unknown): boolean {
  if (!d || typeof d !== 'object') return false;
  const o = d as Record<string, unknown>;
  return (
    o.version === 3 &&
    Array.isArray(o.entries) &&
    Array.isArray(o.weighIns) &&
    Array.isArray(o.closedDays) &&
    typeof o.settings === 'object' &&
    o.settings !== null
  );
}

export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return unauthorized();
  return json(await load(user.id));
}

export async function PUT(request: Request) {
  const user = await currentUser(request);
  if (!user) return unauthorized();
  const body = await readJSON<{ data?: unknown; baseVersion?: number }>(request, MAX_BYTES);
  if (!body || !looksLikeData(body.data) || !Number.isInteger(body.baseVersion)) {
    return json({ error: 'Invalid data' }, 400);
  }

  // Only lands if nobody else saved since this client last read; otherwise hand back the newer copy.
  // The row is created by the user's first save.
  const rows = await db()`
    insert into user_data (user_id, data, version) values (${user.id}, ${JSON.stringify(body.data)}::jsonb, 1)
    on conflict (user_id) do update set data = excluded.data, version = user_data.version + 1, updated_at = now()
    where user_data.version = ${body.baseVersion!}
    returning version`;
  const saved = rows[0] as { version: number } | undefined;
  if (saved) return json({ version: saved.version });
  return json(await load(user.id), 409);
}
