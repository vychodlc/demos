import { randomUUID } from 'node:crypto';
import { parseFit } from './importers';
import { query } from './db';
import { saveActivities } from './repository';
import { parseIgpsportCurl, parseIgpsportToken } from './igpsport-curl.js';

export { parseIgpsportCurl, parseIgpsportToken } from './igpsport-curl.js';

const CHINA_API = 'https://prod.zh.igpsport.com';
const GLOBAL_API = 'https://prod.en.igpsport.com';
const DEFAULT_PAGE_SIZE = 20;
const MAX_ACTIVITIES = 10_000;

type IgpsportCredential = {
  token: string;
  apiBase: string;
  expiresAt: Date | null;
  memberId: string | null;
};

type ActivityListItem = {
  rideId?: string | number;
  id?: string | number;
  title?: string;
  fitUrl?: string;
  fitOssPath?: string;
};

type TaskRow = {
  id: string;
  user_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  total: number;
  processed: number;
  imported: number;
  skipped: number;
  error: string | null;
  created_at: Date;
  updated_at: Date;
  finished_at: Date | null;
};

const activeTasks = new Map<string, Promise<void>>();

function taskView(row: TaskRow) {
  return {
    id: row.id, status: row.status, total: row.total, processed: row.processed,
    imported: row.imported, skipped: row.skipped, error: row.error,
    createdAt: row.created_at, updatedAt: row.updated_at, finishedAt: row.finished_at,
  };
}

async function apiJson<T>(credential: IgpsportCredential, path: string): Promise<T> {
  const response = await fetch(`${credential.apiBase}${path}`, {
    headers: { accept: 'application/json', authorization: `Bearer ${credential.token}`, 'x-platform': 'web' },
    signal: AbortSignal.timeout(30_000),
  });
  if (response.status === 401 || response.status === 403) throw new Error('iGPSPORT 凭证已失效，请重新复制 curl');
  if (!response.ok) throw new Error(`iGPSPORT 请求失败（HTTP ${response.status}）`);
  const body = await response.json() as { code?: number; message?: string; data?: T };
  if (body.code !== undefined && body.code !== 0) throw new Error(body.message || `iGPSPORT 接口错误 ${body.code}`);
  return (body.data ?? body) as T;
}

async function listActivities(credential: IgpsportCredential) {
  const activities: ActivityListItem[] = [];
  for (let page = 1; activities.length < MAX_ACTIVITIES; page += 1) {
    const params = new URLSearchParams({ pageNo: String(page), pageSize: String(DEFAULT_PAGE_SIZE), reqType: '0', sort: '1', sortType: '1' });
    const data = await apiJson<{ rows?: ActivityListItem[]; items?: ActivityListItem[]; totalPage?: number; pages?: number; total?: number }>(credential, `/service/web-gateway/web-analyze/activity/queryMyActivity?${params}`);
    const rows = data.rows || data.items || [];
    activities.push(...rows);
    const totalPages = Number(data.totalPage || data.pages || 0);
    const total = Number(data.total || 0);
    if (!rows.length || (totalPages && page >= totalPages) || (total && activities.length >= total) || (!totalPages && !total && rows.length < DEFAULT_PAGE_SIZE)) break;
  }
  return [...new Map(activities.map(item => [String(item.rideId ?? item.id ?? ''), item])).values()].filter(item => item.rideId ?? item.id);
}

function safeDownloadUrl(value: unknown) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    if (url.hostname === 'localhost' || url.hostname.endsWith('.local') || /^\d+(?:\.\d+){3}$/.test(url.hostname)) return null;
    return url;
  } catch { return null; }
}

async function downloadUrl(credential: IgpsportCredential, item: ActivityListItem) {
  const rideId = String(item.rideId ?? item.id);
  try {
    const value = await apiJson<string>(credential, `/service/web-gateway/web-analyze/activity/getDownloadUrl/${encodeURIComponent(rideId)}`);
    const url = safeDownloadUrl(value);
    if (url) return url;
  } catch (error) {
    if (error instanceof Error && /凭证已失效/.test(error.message)) throw error;
  }
  const detail = await apiJson<Record<string, unknown>>(credential, `/service/web-gateway/web-analyze/activity/queryActivityDetail/${encodeURIComponent(rideId)}`);
  return safeDownloadUrl(detail.fitUrl || detail.fitOssPath || item.fitUrl || item.fitOssPath);
}

async function fetchFit(url: URL) {
  let current = url;
  let response: Response | null = null;
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    response = await fetch(current, { headers: { accept: 'application/octet-stream' }, redirect: 'manual', signal: AbortSignal.timeout(30_000) });
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const next = safeDownloadUrl(new URL(response.headers.get('location') || '', current).href);
    if (!next) throw new Error('FIT 下载重定向地址不安全');
    current = next;
  }
  if (!response) throw new Error('FIT 下载失败');
  if ([301, 302, 303, 307, 308].includes(response.status)) throw new Error('FIT 下载重定向次数过多');
  if (!response.ok) throw new Error(`FIT 下载失败（HTTP ${response.status}）`);
  const length = Number(response.headers.get('content-length') || 0);
  if (length > 30 * 1024 * 1024) throw new Error('单个 FIT 文件超过 30 MB');
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > 30 * 1024 * 1024) throw new Error('单个 FIT 文件超过 30 MB');
  return buffer;
}

async function updateTask(taskId: string, values: Partial<Pick<TaskRow, 'status' | 'total' | 'processed' | 'imported' | 'skipped' | 'error'>>) {
  const entries = Object.entries(values);
  if (!entries.length) return;
  const columns = entries.map(([key], index) => `${key}=$${index + 1}`);
  const finished = values.status === 'completed' || values.status === 'failed';
  await query(`UPDATE import_tasks SET ${columns.join(',')},updated_at=NOW()${finished ? ',finished_at=NOW()' : ''} WHERE id=$${entries.length + 1}`, [...entries.map(([, value]) => value), taskId]);
}

async function runTask(taskId: string, userId: string, credential: IgpsportCredential) {
  try {
    await updateTask(taskId, { status: 'running', error: null });
    const items = await listActivities(credential);
    await updateTask(taskId, { total: items.length });
    const existingResult = await query<{ source_id: string }>("SELECT source_id FROM activities WHERE user_id=$1 AND source='igpsport' AND source_id IS NOT NULL", [userId]);
    const existing = new Set(existingResult.rows.map(row => row.source_id));
    let processed = 0; let imported = 0; let skipped = 0;
    for (const item of items) {
      const rideId = String(item.rideId ?? item.id);
      if (existing.has(rideId)) {
        processed += 1; skipped += 1;
        await updateTask(taskId, { processed, imported, skipped });
        continue;
      }
      try {
        const url = await downloadUrl(credential, item);
        if (!url) throw new Error('没有可用的 FIT 下载地址');
        const activities = await parseFit(await fetchFit(url), 'igpsport');
        const normalized = activities.map(activity => ({ ...activity, id: `igpsport-${rideId}`, sourceId: rideId, name: item.title || activity.name }));
        if (!normalized.length) throw new Error('FIT 中没有活动记录');
        await saveActivities(userId, normalized);
        imported += normalized.length;
      } catch (error) {
        skipped += 1;
        console.warn(`iGPSPORT activity ${item.rideId ?? item.id} skipped:`, error instanceof Error ? error.message : error);
      }
      processed += 1;
      await updateTask(taskId, { processed, imported, skipped });
    }
    await updateTask(taskId, { status: 'completed', processed, imported, skipped });
  } catch (error) {
    await updateTask(taskId, { status: 'failed', error: error instanceof Error ? error.message.slice(0, 500) : '同步失败' });
  }
}

function launch(taskId: string, userId: string, credential: IgpsportCredential) {
  if (activeTasks.has(taskId)) return;
  const task = runTask(taskId, userId, credential).finally(() => activeTasks.delete(taskId));
  activeTasks.set(taskId, task);
}

export async function createIgpsportTask(userId: string, input: string, mode = 'curl', region = 'cn') {
  const credential = mode === 'token' ? parseIgpsportToken(input, region) : parseIgpsportCurl(input);
  await query("UPDATE import_tasks SET status='failed',error='同步进程已中断，请重新开始',updated_at=NOW(),finished_at=NOW() WHERE user_id=$1 AND provider='igpsport' AND status IN ('queued','running') AND updated_at < NOW() - INTERVAL '10 minutes'", [userId]);
  const running = await query<TaskRow>("SELECT * FROM import_tasks WHERE user_id=$1 AND provider='igpsport' AND status IN ('queued','running') ORDER BY created_at DESC LIMIT 1", [userId]);
  if (running.rows[0]) return taskView(running.rows[0]);
  const result = await query<TaskRow>("INSERT INTO import_tasks (id,user_id,provider,status) VALUES ($1,$2,'igpsport','queued') RETURNING *", [randomUUID(), userId]);
  const row = result.rows[0];
  launch(row.id, userId, credential);
  return { ...taskView(row), tokenExpiresAt: credential.expiresAt, region: credential.apiBase === CHINA_API ? '中国区' : '国际区' };
}

export async function getIgpsportTask(userId: string, taskId: string) {
  const result = await query<TaskRow>("SELECT * FROM import_tasks WHERE id=$1 AND user_id=$2 AND provider='igpsport'", [taskId, userId]);
  if (!result.rows[0]) throw new Error('同步任务不存在');
  return taskView(result.rows[0]);
}
