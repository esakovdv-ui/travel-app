import { cookies } from 'next/headers';
import { verifyJwtToken } from './jwt';

export const SESSION_COOKIE = 'mt_session';
export const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me-in-env';

export interface SessionPayload {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifyJwtToken(token, JWT_SECRET);
  if (!payload || !payload.userId) return null;

  return payload as unknown as SessionPayload;
}
