import { requireUser } from '@/lib/auth';
import { apiError, ok } from '@/lib/http';
import { stravaStatus } from '@/lib/strava';
export async function GET() { try { const user = await requireUser(); return ok(await stravaStatus(user.id)); } catch (error) { return apiError(error); } }
