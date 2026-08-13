import { query } from './db';
import { decryptSecret, encryptSecret } from './security';
import { normalizeActivity } from './activities.js';
import { saveActivities, type Activity } from './repository';

type IntegrationRow = { access_token_encrypted: string; refresh_token_encrypted: string; expires_at: Date };
type StravaToken = { access_token: string; refresh_token: string; expires_at: number; athlete?: { id?: number } };

function config() {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Strava API 尚未配置');
  return { clientId, clientSecret };
}

export async function saveStravaTokens(userId: string, token: StravaToken) {
  await query(
    "INSERT INTO integrations (user_id,provider,access_token_encrypted,refresh_token_encrypted,expires_at,external_user_id,scopes) VALUES ($1,'strava',$2,$3,$4,$5,$6) ON CONFLICT (user_id,provider) DO UPDATE SET access_token_encrypted=EXCLUDED.access_token_encrypted,refresh_token_encrypted=EXCLUDED.refresh_token_encrypted,expires_at=EXCLUDED.expires_at,external_user_id=EXCLUDED.external_user_id,scopes=EXCLUDED.scopes,updated_at=NOW()",
    [userId, encryptSecret(token.access_token), encryptSecret(token.refresh_token), new Date(token.expires_at * 1000), token.athlete?.id ? String(token.athlete.id) : null, ['read', 'activity:read_all']],
  );
}

export async function exchangeCode(userId: string, code: string) {
  const { clientId, clientSecret } = config();
  const response = await fetch('https://www.strava.com/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, grant_type: 'authorization_code' }) });
  if (!response.ok) throw new Error('Strava 授权失败');
  await saveStravaTokens(userId, await response.json() as StravaToken);
}

async function accessToken(userId: string) {
  const result = await query<IntegrationRow>("SELECT * FROM integrations WHERE user_id=$1 AND provider='strava'", [userId]);
  const row = result.rows[0];
  if (!row) throw new Error('请先连接 Strava');
  if (new Date(row.expires_at).getTime() > Date.now() + 60_000) return decryptSecret(row.access_token_encrypted);
  const { clientId, clientSecret } = config();
  const response = await fetch('https://www.strava.com/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token', refresh_token: decryptSecret(row.refresh_token_encrypted) }) });
  if (!response.ok) throw new Error('Strava token 刷新失败');
  const refreshed = await response.json() as StravaToken;
  await saveStravaTokens(userId, refreshed);
  return refreshed.access_token;
}

export async function stravaStatus(userId: string) {
  const result = await query<{ exists: boolean }>("SELECT EXISTS(SELECT 1 FROM integrations WHERE user_id=$1 AND provider='strava') AS exists", [userId]);
  return { configured: Boolean(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET), connected: Boolean(result.rows[0]?.exists) };
}

export async function syncStrava(userId: string) {
  const token = await accessToken(userId);
  const records: Activity[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const response = await fetch(`https://www.strava.com/api/v3/athlete/activities?page=${page}&per_page=100`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    if (!response.ok) throw new Error(`Strava 同步失败 (${response.status})`);
    const batch = await response.json() as Record<string, unknown>[];
    records.push(...batch.map(item => normalizeActivity(item, 'strava') as Activity));
    if (batch.length < 100) break;
  }
  await saveActivities(userId, records);
  return records.length;
}
