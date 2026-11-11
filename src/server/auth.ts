/// <reference types="node" />
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

import { db } from './db';

const COOKIE = 'hos_session';
const SESSION_DAYS = 30;
const KEY_LEN = 64;

export const MIN_PASSWORD = 8;

function scryptAsync(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, KEY_LEN, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

/** `scrypt$<salt>$<key>`, both base64. */
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, salt, key] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !key) return false;
  const expected = Buffer.from(key, 'base64');
  const actual = await scryptAsync(password, Buffer.from(salt, 'base64'));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// A stored hash to compare against when the user doesn't exist, so both failures take as long.
let decoy: Promise<string> | null = null;
export const decoyHash = () => (decoy ??= hashPassword(randomBytes(16).toString('hex')));

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

function cookie(value: string, maxAge: number) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

/** Creates a session and returns the Set-Cookie header for it. Only the token's hash is stored. */
export async function startSession(userId: string) {
  const token = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db()`insert into sessions (token_hash, user_id, expires_at) values (${sha256(token)}, ${userId}, ${expires.toISOString()})`;
  return cookie(token, SESSION_DAYS * 86_400);
}

function tokenFrom(request: Request) {
  const header = request.headers.get('cookie') ?? '';
  const match = header.split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`));
  return match ? match.slice(COOKIE.length + 1) : null;
}

export async function endSession(request: Request) {
  const token = tokenFrom(request);
  if (token) await db()`delete from sessions where token_hash = ${sha256(token)}`;
  return cookie('', 0);
}

export type SessionUser = { id: string; username: string };

export async function currentUser(request: Request): Promise<SessionUser | null> {
  const token = tokenFrom(request);
  if (!token) return null;
  const rows = await db()`
    select u.id, u.username from sessions s join users u on u.id = s.user_id
    where s.token_hash = ${sha256(token)} and s.expires_at > now()`;
  return (rows[0] as SessionUser | undefined) ?? null;
}

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
