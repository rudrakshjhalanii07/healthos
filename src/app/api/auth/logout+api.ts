import { endSession, json } from '@/server/auth';

export async function POST(request: Request) {
  return json({ ok: true }, 200, { 'Set-Cookie': await endSession(request) });
}
