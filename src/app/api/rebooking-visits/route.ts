import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isRebookingAdminPassword, listRebookingVisits } from '@/lib/rebooking-visit-store';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  password: z.string().min(1),
  order: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional().default(500),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    password: url.searchParams.get('password') ?? '',
    order: url.searchParams.get('order') ?? undefined,
    limit: url.searchParams.get('limit') ?? '500',
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Неверный запрос.' }, { status: 400 });
  }

  if (!isRebookingAdminPassword(parsed.data.password)) {
    return NextResponse.json({ error: 'Неверный пароль.' }, { status: 401 });
  }

  const visits = await listRebookingVisits({
    order: parsed.data.order,
    limit: parsed.data.limit,
  });

  return NextResponse.json(
    { ok: true, visits, total: visits.length },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
