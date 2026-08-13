import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { query } from './db';
import { hashPassword, randomToken, tokenHash, verifyPassword } from './security';

const COOKIE = 'velotrace_session';
const SESSION_DAYS = 30;

function usesSecureCookies() {
  try {
    return new URL(process.env.APP_URL ?? 'http://localhost').protocol === 'https:';
  } catch {
    return false;
  }
}

export type SessionUser = { id: string; email: string; displayName: string; annualGoal: number };
type UserRow = { id: string; email: string; display_name: string; annual_goal: number; password_hash: string };

function normalizeEmail(email: string) { return email.trim().toLowerCase(); }

export async function createUser(input: { email: string; password: string; displayName: string }) {
  const email = normalizeEmail(input.email);
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('请输入有效邮箱');
  if (input.password.length < 8) throw new Error('密码至少需要 8 位');
  const id = randomUUID();
  const passwordHash = await hashPassword(input.password);
  const result = await query<UserRow>(
    'INSERT INTO users (id, email, password_hash, display_name) VALUES ($1,$2,$3,$4) RETURNING *',
    [id, email, passwordHash, input.displayName.trim().slice(0, 40) || '骑手'],
  );
  return result.rows[0];
}

export async function authenticate(email: string, password: string) {
  const result = await query<UserRow>('SELECT * FROM users WHERE email = $1', [normalizeEmail(email)]);
  const user = result.rows[0];
  if (!user || !await verifyPassword(user.password_hash, password)) throw new Error('邮箱或密码不正确');
  return user;
}

export async function createSession(userId: string) {
  const rawToken = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  await query('INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ($1,$2,$3,$4)', [randomUUID(), userId, tokenHash(rawToken), expiresAt]);
  const store = await cookies();
  store.set(COOKIE, rawToken, { httpOnly: true, secure: usesSecureCookies(), sameSite: 'lax', path: '/', expires: expiresAt });
}

export async function destroySession() {
  const store = await cookies();
  const rawToken = store.get(COOKIE)?.value;
  if (rawToken) await query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash(rawToken)]);
  store.set(COOKIE, '', { httpOnly: true, secure: usesSecureCookies(), sameSite: 'lax', path: '/', expires: new Date(0) });
}

export async function currentUser(): Promise<SessionUser | null> {
  const rawToken = (await cookies()).get(COOKIE)?.value;
  if (!rawToken) return null;
  const result = await query<UserRow>('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>NOW()', [tokenHash(rawToken)]);
  const user = result.rows[0];
  return user ? { id: user.id, email: user.email, displayName: user.display_name, annualGoal: user.annual_goal } : null;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new Error('UNAUTHORIZED');
  return user;
}
