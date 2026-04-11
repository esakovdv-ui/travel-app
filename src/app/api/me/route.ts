import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null });
  return NextResponse.json({
    user: {
      firstName: session.firstName,
      lastName: session.lastName,
      email: session.email,
      initials: `${session.firstName[0] ?? ''}${session.lastName[0] ?? ''}`.toUpperCase(),
    },
  });
}
