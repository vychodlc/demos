import { createSession, createUser } from '@/lib/auth';
import { apiError, ok } from '@/lib/http';

export async function POST(request: Request) {
  try {
    const user = await createUser(await request.json());
    await createSession(user.id);
    return ok({ user: { id: user.id, email: user.email, displayName: user.display_name, annualGoal: user.annual_goal } }, { status: 201 });
  } catch (error) { return apiError(error); }
}
