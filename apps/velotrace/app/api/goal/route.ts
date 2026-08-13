import { requireUser } from '@/lib/auth';
import { apiError, ok } from '@/lib/http';
import { updateAnnualGoal } from '@/lib/repository';
export async function PATCH(request: Request) { try { const user = await requireUser(); const { annualGoal } = await request.json(); return ok({ annualGoal: await updateAnnualGoal(user.id, Number(annualGoal)) }); } catch (error) { return apiError(error); } }
