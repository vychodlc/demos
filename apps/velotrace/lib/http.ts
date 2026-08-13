import { NextResponse } from 'next/server';

export const ok = (body: unknown, init?: ResponseInit) => NextResponse.json(body, init);

export function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : '请求失败';
  if (message === 'UNAUTHORIZED') return ok({ error: '请先登录' }, { status: 401 });
  if (/duplicate key|users_email_key/i.test(message)) return ok({ error: '这个邮箱已经注册' }, { status: 409 });
  console.error(error);
  return ok({ error: message }, { status: 400 });
}
