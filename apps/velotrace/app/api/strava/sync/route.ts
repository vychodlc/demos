import { requireUser } from '@/lib/auth';
import { apiError, ok } from '@/lib/http';
import { syncStrava } from '@/lib/strava';
export async function POST() { try { const user = await requireUser(); return ok({ imported: await syncStrava(user.id) }); } catch (error) { return apiError(error); } }
