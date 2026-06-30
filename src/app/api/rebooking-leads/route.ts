import { NextResponse } from 'next/server';
import { z } from 'zod';
import { listRebookingLeads } from '@/lib/rebooking-lead-store';
import { isRebookingAdminPassword } from '@/lib/rebooking-visit-store';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  password: z.string().min(1),
  order: z.string().optional(),
  status: z.enum(['pending', 'sent', 'failed', 'all']).optional().default('all'),
  limit: z.coerce.number().int().min(1).max(1000).optional().default(500),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    password: url.searchParams.get('password') ?? '',
    order: url.searchParams.get('order') ?? undefined,
    status: url.searchParams.get('status') ?? 'all',
    limit: url.searchParams.get('limit') ?? '500',
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Неверный запрос.' }, { status: 400 });
  }

  if (!isRebookingAdminPassword(parsed.data.password)) {
    return NextResponse.json({ error: 'Неверный пароль.' }, { status: 401 });
  }

  const leads = await listRebookingLeads({
    order: parsed.data.order,
    status: parsed.data.status,
    limit: parsed.data.limit,
  });

  return NextResponse.json(
    { ok: true, leads, total: leads.length },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
