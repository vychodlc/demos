import { requireUser } from '@/lib/auth';
import { apiError, ok } from '@/lib/http';
import { getIgpsportTask } from '@/lib/igpsport';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    return ok({ task: await getIgpsportTask(user.id, id) });
  } catch (error) { return apiError(error); }
}
