import { requireUser } from '@/lib/auth';
import { apiError, ok } from '@/lib/http';
import { listActivities } from '@/lib/repository';
import { summarize, summarizeCareer } from '@/lib/activities.js';
export async function GET(request: Request) {
  try {
    const user = await requireUser(); const activities = await listActivities(user.id);
    const requested = new URL(request.url).searchParams.get('year');
    return ok(requested === 'career' ? summarizeCareer(activities) : summarize(activities, Number(requested) || new Date().getFullYear()));
  } catch (error) { return apiError(error); }
}
