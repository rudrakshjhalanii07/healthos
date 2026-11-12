import { db } from '@/server/db';
import { json, readJSON, unauthorized } from '@/server/http';
import { authBaseUrl, currentUser, forgetSession } from '@/server/neon-auth';

// Neon Auth's own delete-user endpoint isn't enabled, so the account is deleted here. Removing the
// neon_auth user row cascades to its sessions, its credentials and its user_data.

const CLEAR_COOKIES = ['session_token', 'session_data', 'dont_remember'].map(
  (name) => `__Secure-neon-auth.${name}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`,
);

export async function DELETE(request: Request) {
  const user = await currentUser(request);
  if (!user) return unauthorized();

  // Ask for the password again so a borrowed, still-signed-in device can't wipe the account.
  const body = await readJSON<{ password?: string }>(request);
  if (!body?.password) return json({ error: 'Enter your password to delete your account.' }, 400);
  const check = await fetch(`${authBaseUrl()}/sign-in/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: request.headers.get('origin') ?? new URL(request.url).origin },
    body: JSON.stringify({ email: user.email, password: body.password }),
  }).catch(() => null);
  if (!check) return json({ error: 'Couldn’t reach the sign-in service. Try again.' }, 502);
  if (check.status === 401) return json({ error: 'Wrong password.' }, 403);
  if (!check.ok) return json({ error: 'Couldn’t verify your password. Try again.' }, 502);

  await db()`delete from neon_auth."user" where id = ${user.id}`;
  forgetSession(request);

  const headers = new Headers();
  for (const c of CLEAR_COOKIES) headers.append('set-cookie', c);
  return Response.json({ deleted: true }, { headers });
}
