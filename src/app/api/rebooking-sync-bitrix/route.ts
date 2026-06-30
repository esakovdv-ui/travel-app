import { NextResponse } from 'next/server';
import { z } from 'zod';
import { syncPendingRebookingLeadsToBitrix } from '@/lib/rebooking-bitrix-sync';
import { isRebookingSyncAuthorized } from '@/lib/rebooking-lead-store';
import { isRebookingAdminPassword } from '@/lib/rebooking-visit-store';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  secret: z.string().optional(),
  password: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(30),
});

function isAuthorized(secret?: string, password?: string) {
  if (secret && isRebookingSyncAuthorized(secret)) return true;
  if (password && isRebookingAdminPassword(password)) return true;
  return false;
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    secret: url.searchParams.get('secret') ?? undefined,
    password: url.searchParams.get('password') ?? undefined,
    limit: url.searchParams.get('limit') ?? '30',
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Неверный запрос.' }, { status: 400 });
  }

  if (!isAuthorized(parsed.data.secret, parsed.data.password)) {
    return NextResponse.json({ error: 'Нет доступа.' }, { status: 401 });
  }

  const result = await syncPendingRebookingLeadsToBitrix(parsed.data.limit);
  return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request: Request) {
  return POST(request);
}
