import { currentUser } from '@/lib/auth';
import { ok } from '@/lib/http';
export async function GET() { const user = await currentUser(); return user ? ok({ user }) : ok({ error: '请先登录' }, { status: 401 }); }
