import { query } from '@/lib/db';
import { tokenHash } from '@/lib/security';
import { exchangeCode } from '@/lib/strava';
import { NextResponse } from 'next/server';
export async function GET(request: Request) {
  const url = new URL(request.url); const state = url.searchParams.get('state') || '';
  const result = await query<{user_id:string}>('DELETE FROM oauth_states WHERE state_hash=$1 AND expires_at>NOW() RETURNING user_id',[tokenHash(state)]);
  const userId = result.rows[0]?.user_id;
  const appUrl = (process.env.APP_URL || url.origin).replace(/\/$/, '');
  if (!userId) return NextResponse.redirect(`${appUrl}?strava=invalid`);
  try { await exchangeCode(userId,url.searchParams.get('code') || ''); return NextResponse.redirect(`${appUrl}?strava=connected`); }
  catch { return NextResponse.redirect(`${appUrl}?strava=failed`); }
}
