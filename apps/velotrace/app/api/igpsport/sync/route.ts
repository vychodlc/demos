import { requireUser } from '@/lib/auth';
import { apiError, ok } from '@/lib/http';
import { createIgpsportTask } from '@/lib/igpsport';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (Number(request.headers.get('content-length') || 0) > 60_000) return ok({ error: 'curl 内容过长' }, { status: 413 });
    const { curl, token, mode, region } = await request.json();
    return ok({ task: await createIgpsportTask(user.id, mode === 'token' ? token : curl, mode, region) }, { status: 202 });
  } catch (error) { return apiError(error); }
}
