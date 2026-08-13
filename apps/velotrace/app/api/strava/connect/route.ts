import { requireUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { randomToken, tokenHash } from '@/lib/security';
import { apiError } from '@/lib/http';
import { NextResponse } from 'next/server';
export async function GET() {
  try {
    const user = await requireUser();
    if (!process.env.STRAVA_CLIENT_ID || !process.env.APP_URL) throw new Error('Strava API 尚未配置');
    const state = randomToken();
    await query('INSERT INTO oauth_states (state_hash,user_id,expires_at) VALUES ($1,$2,$3)', [tokenHash(state),user.id,new Date(Date.now()+600000)]);
    const target = new URL('https://www.strava.com/oauth/authorize');
    const appUrl = process.env.APP_URL.replace(/\/$/, '');
    target.search = new URLSearchParams({client_id:process.env.STRAVA_CLIENT_ID,response_type:'code',redirect_uri:`${appUrl}/api/strava/callback`,approval_prompt:'auto',scope:'read,activity:read_all',state}).toString();
    return NextResponse.redirect(target);
  } catch (error) { return apiError(error); }
}
