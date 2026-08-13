import { requireUser } from '@/lib/auth';
import { apiError, ok } from '@/lib/http';
import { importFiles } from '@/lib/importers';
import { saveActivities } from '@/lib/repository';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (Number(request.headers.get('content-length') || 0) > 60 * 1024 * 1024) return ok({ error: '上传内容不能超过 60MB' }, { status: 413 });
    const { files } = await request.json(); const result = await importFiles(files || []);
    if (!result.imported.length && result.errors.length) return ok({ imported: 0, errors: result.errors }, { status: 400 });
    await saveActivities(user.id, result.imported); return ok({ imported: result.imported.length, errors: result.errors });
  } catch (error) { return apiError(error); }
}
