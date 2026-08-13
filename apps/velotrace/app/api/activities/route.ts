import { requireUser } from '@/lib/auth';
import { apiError, ok } from '@/lib/http';
import { listActivities } from '@/lib/repository';
export async function GET() { try { const user = await requireUser(); return ok(await listActivities(user.id)); } catch (error) { return apiError(error); } }
