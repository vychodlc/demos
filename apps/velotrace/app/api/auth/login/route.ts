import { authenticate, createSession } from '@/lib/auth';
import { apiError, ok } from '@/lib/http';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const user = await authenticate(email || '', password || '');
    await createSession(user.id);
    return ok({ user: { id: user.id, email: user.email, displayName: user.display_name, annualGoal: user.annual_goal } });
  } catch (error) { return apiError(error); }
}
