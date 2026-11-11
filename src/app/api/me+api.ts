import { currentUser, json, unauthorized } from '@/server/auth';

export async function GET(request: Request) {
  const user = await currentUser(request);
  return user ? json({ username: user.username }) : unauthorized();
}
